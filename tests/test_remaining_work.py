import time

from fastapi.testclient import TestClient

from backend.app.main import app


def _unique_user_payload(prefix: str = "user") -> dict:
    nonce = time.time_ns()
    return {
        "email": f"{prefix}_{nonce}@example.com",
        "password": "testpass123",
        "username": f"{prefix}_{nonce}",
        "bio": f"{prefix} test account",
    }


def _register_user(client: TestClient, prefix: str = "user") -> dict:
    payload = _unique_user_payload(prefix)
    response = client.post("/api/auth/register", json=payload)
    assert response.status_code == 200
    return response.json()


def test_public_profile_hides_email_from_other_users():
    with TestClient(app) as client:
        owner = _register_user(client, "owner")
        client.post("/api/auth/logout")

        _register_user(client, "viewer")
        response = client.get(f"/api/users/{owner['id']}")

        assert response.status_code == 200
        payload = response.json()
        assert payload["id"] == owner["id"]
        assert "email" not in payload


def test_project_detail_marks_pending_collaboration_for_requester():
    with TestClient(app) as client:
        _register_user(client, "owner")
        project_response = client.post(
            "/api/projects",
            json={
                "title": "Collab Test Project",
                "description": "A project used to verify pending collaboration status visibility.",
                "stage": "idea",
                "support_needed": "Testing help",
            },
        )
        assert project_response.status_code == 200
        project_id = project_response.json()["id"]

        client.post("/api/auth/logout")
        _register_user(client, "requester")

        collab_response = client.post(
            f"/api/projects/{project_id}/collaborate",
            json={"message": "I would like to help."},
        )
        assert collab_response.status_code == 200

        detail_response = client.get(f"/api/projects/{project_id}")
        assert detail_response.status_code == 200
        assert detail_response.json().get("has_requested_collab") is True


def test_project_search_filters_results_by_query():
    with TestClient(app) as client:
        _register_user(client, "searcher")

        alpha_response = client.post(
            "/api/projects",
            json={
                "title": "Alpha Build Tracker",
                "description": "A search-friendly project about build metrics.",
                "stage": "idea",
                "support_needed": "Feedback",
            },
        )
        beta_response = client.post(
            "/api/projects",
            json={
                "title": "Beta Community Hub",
                "description": "A separate project for community growth.",
                "stage": "idea",
                "support_needed": "Testing",
            },
        )

        assert alpha_response.status_code == 200
        assert beta_response.status_code == 200

        response = client.get("/api/projects?q=alpha")
        assert response.status_code == 200

        project_titles = [project["title"] for project in response.json()]
        assert "Alpha Build Tracker" in project_titles
        assert "Beta Community Hub" not in project_titles


def test_user_directory_search_returns_public_results():
    with TestClient(app) as client:
        owner = _register_user(client, "directory")

        response = client.get("/api/users?q=directory")
        assert response.status_code == 200

        payload = response.json()
        assert any(user["id"] == owner["id"] for user in payload)
        assert all("email" not in user for user in payload)
