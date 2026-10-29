from fastapi.testclient import TestClient

from app.main import app as module_level_app


def test_health_is_ok(client: TestClient) -> None:
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"ok": True}


def test_docs_and_openapi_are_served(client: TestClient) -> None:
    assert client.get("/docs").status_code == 200
    paths = client.get("/openapi.json").json()["paths"]
    assert "/api/health" in paths


def test_module_level_app_serves_health() -> None:
    with TestClient(module_level_app) as test_client:
        assert test_client.get("/api/health").json() == {"ok": True}


def test_cors_allows_the_dev_origin(client: TestClient) -> None:
    response = client.get("/api/health", headers={"Origin": "http://localhost:5173"})
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"


def test_cors_does_not_allow_a_stranger(client: TestClient) -> None:
    response = client.get("/api/health", headers={"Origin": "http://evil.example"})
    assert "access-control-allow-origin" not in response.headers
