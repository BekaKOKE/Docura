"""Generates grafana/dashboards/docura.json. Run: python observability/make_dashboard.py"""

import json
from pathlib import Path


def panel(i, title, expr, x, y, w=12, kind="timeseries", legend="{{deployment_environment}}"):
    return {
        "id": i,
        "type": kind,
        "title": title,
        "gridPos": {"x": x, "y": y, "w": w, "h": 8},
        "datasource": {"type": "prometheus", "uid": "prom"},
        "targets": [{"expr": expr, "legendFormat": legend, "refId": "A"}],
    }


PANELS = [
    panel(1, "Registrations / min", "sum by (deployment_environment) (increase(docura_registrations_total[1m]))", 0, 0),
    panel(
        2,
        "Logins by outcome / min",
        "sum by (outcome, deployment_environment) (increase(docura_logins_total[1m]))",
        12,
        0,
        legend="{{deployment_environment}} {{outcome}}",
    ),
    panel(
        3, "Companies created (total)", "sum by (deployment_environment) (docura_companies_created_total)", 0, 8, 6, "stat"
    ),
    panel(
        4,
        "Rate-limited auth requests / min",
        "sum by (deployment_environment) (increase(docura_rate_limited_total[1m]))",
        6,
        8,
        6,
    ),
    panel(
        5,
        "API errors by code / min",
        "sum by (code, deployment_environment) (increase(docura_api_errors_total[1m]))",
        12,
        8,
        12,
        legend="{{deployment_environment}} {{code}}",
    ),
    panel(
        6,
        "Request rate by route",
        "sum by (http_route) (rate(http_server_duration_milliseconds_count[1m]))",
        0,
        16,
        12,
        legend="{{http_route}}",
    ),
    panel(
        7,
        "p95 latency (ms)",
        "histogram_quantile(0.95, sum by (le, http_route) (rate(http_server_duration_milliseconds_bucket[5m])))",
        12,
        16,
        12,
        legend="{{http_route}}",
    ),
]

dashboard = {
    "uid": "docura-app",
    "title": "Docura application metrics",
    "schemaVersion": 39,
    "version": 1,
    "refresh": "5s",
    "time": {"from": "now-30m", "to": "now"},
    "panels": PANELS,
}
out = Path(__file__).parent / "grafana" / "dashboards" / "docura.json"
out.write_text(json.dumps(dashboard, indent=1), encoding="utf-8")
