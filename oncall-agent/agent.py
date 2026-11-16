"""On-call AI responder. Alertmanager posts firing alerts here; Claude triages each one and the result is filed as a
GitHub issue. Without ANTHROPIC_API_KEY it falls back to a rule-based runbook, so the pipeline still works offline."""

import json
import os
import subprocess
import urllib.request
from http.server import BaseHTTPRequestHandler, HTTPServer

RUNBOOK = {
    "DocuraLoginFailureSpike": "Check recent deploys; look for one IP in Loki logs (credential stuffing). "
    "The rate limiter is the first defence.",
    "DocuraRateLimitHits": "Confirm the limiter works as designed; if the traffic is legitimate, raise the limit.",
    "DocuraApiErrorBurst": "Open Tempo traces for the failing routes; if it correlates with the last promotion, roll back.",
    "DocuraBackendDown": "Check container health, then OTLP collector connectivity.",
}


def ask_claude(alert: dict) -> str:
    key = os.environ.get("ANTHROPIC_API_KEY")
    name = alert["labels"].get("alertname", "unknown")
    if not key:
        return "Rule-based triage (no API key): " + RUNBOOK.get(name, "No runbook entry; investigate manually.")
    body = json.dumps(
        {
            "model": os.environ.get("ONCALL_MODEL", "claude-sonnet-5-5"),
            "max_tokens": 600,
            "system": "You are the on-call engineer for Docura, a FastAPI quotes/invoices app. Given a Prometheus "
            "alert, give: likely cause, first 3 diagnostic steps, and whether to roll back. Be concise.",
            "messages": [{"role": "user", "content": json.dumps(alert, ensure_ascii=False)}],
        }
    ).encode()
    headers = {"x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json"}
    req = urllib.request.Request("https://api.anthropic.com/v1/messages", body, headers)
    with urllib.request.urlopen(req, timeout=60) as response:
        return json.load(response)["content"][0]["text"]


def file_issue(title: str, text: str) -> None:
    repo = os.environ.get("GITHUB_REPO")
    if repo and os.environ.get("GH_TOKEN"):
        subprocess.run(["gh", "issue", "create", "-R", repo, "-t", title, "-b", text, "-l", "incident"], check=False)
    print(f"[on-call] {title}\n{text}", flush=True)


class Handler(BaseHTTPRequestHandler):
    def do_POST(self):
        payload = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        for alert in payload.get("alerts", []):
            name = alert["labels"].get("alertname", "alert")
            env = alert["labels"].get("deployment_environment", "?")
            file_issue(f"[incident] {name} in {env}", ask_claude(alert))
        self.send_response(200)
        self.end_headers()


if __name__ == "__main__":
    HTTPServer(("0.0.0.0", 9000), Handler).serve_forever()
