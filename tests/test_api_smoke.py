import time

from fastapi.testclient import TestClient

from backend.app.main import app


def _unique_user_payload() -> dict:
    nonce = time.time_ns()
    return {
        "email": f"smoke_{nonce}@example.com",
        "password": "testpass123",
        "username": f"smoke_{nonce}",
        "bio": "Smoke test account",
    }


def _register_user(client: TestClient) -> dict:
    payload = _unique_user_payload()
    response = client.post("/api/auth/register", json=payload)
    assert response.status_code == 200
    assert "access_token" in response.cookies
    return payload


def test_health_endpoint():
    with TestClient(app) as client:
        response = client.get("/api/health")
        assert response.status_code == 200
        assert response.json()["status"] == "healthy"


def test_register_and_get_me_flow():
    with TestClient(app) as client:
        payload = _register_user(client)
        me_response = client.get("/api/auth/me")
        assert me_response.status_code == 200
        assert me_response.json()["email"] == payload["email"]


def test_login_logout_flow():
    with TestClient(app) as client:
        payload = _register_user(client)

        logout_response = client.post("/api/auth/logout")
        assert logout_response.status_code == 200
        assert client.get("/api/auth/me").status_code == 401

        login_response = client.post(
            "/api/auth/login",
            json={"email": payload["email"], "password": payload["password"]},
        )
        assert login_response.status_code == 200
        assert client.get("/api/auth/me").status_code == 200


def test_project_creation_and_update_flow():
    with TestClient(app) as client:
        _register_user(client)

        create_response = client.post(
            "/api/projects",
            json={
                "title": "Smoke Test Project",
                "description": "A simple project created during automated smoke testing.",
                "stage": "idea",
                "support_needed": "Feedback on the initial concept",
            },
        )
        assert create_response.status_code == 200
        project_id = create_response.json()["id"]

        list_response = client.get("/api/projects")
        assert list_response.status_code == 200
        assert any(project["id"] == project_id for project in list_response.json())

        update_response = client.put(
            f"/api/projects/{project_id}",
            json={"stage": "in_progress", "support_needed": "Frontend review"},
        )
        assert update_response.status_code == 200
        assert update_response.json()["stage"] == "in_progress"

        detail_response = client.get(f"/api/projects/{project_id}")
        assert detail_response.status_code == 200
        assert detail_response.json()["id"] == project_id
