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


def test_project_filters_support_owner_tech_stack_and_liked_projects():
    with TestClient(app) as client:
        owner = _register_user(client, "filters")

        python_response = client.post(
            "/api/projects",
            json={
                "title": "FastAPI Builder",
                "description": "Backend service for query filtering tests.",
                "stage": "idea",
                "support_needed": "Testing",
                "tech_stack": ["FastAPI", "MongoDB"],
            },
        )
        react_response = client.post(
            "/api/projects",
            json={
                "title": "React Builder",
                "description": "Frontend service for query filtering tests.",
                "stage": "idea",
                "support_needed": "Design",
                "tech_stack": ["React", "Tailwind"],
            },
        )

        assert python_response.status_code == 200
        assert react_response.status_code == 200

        tech_filter_response = client.get("/api/projects?tech_stack=FastAPI")
        assert tech_filter_response.status_code == 200
        tech_titles = [project["title"] for project in tech_filter_response.json()]
        assert "FastAPI Builder" in tech_titles
        assert "React Builder" not in tech_titles

        owner_filter_response = client.get(f"/api/projects?owner_username={owner['username']}")
        assert owner_filter_response.status_code == 200
        owner_titles = [project["title"] for project in owner_filter_response.json()]
        assert "FastAPI Builder" in owner_titles
        assert "React Builder" in owner_titles

        like_response = client.post(
            "/api/like",
            json={"project_id": python_response.json()["id"]},
        )
        assert like_response.status_code == 200

        liked_response = client.get(f"/api/projects?liked_by={owner['id']}")
        assert liked_response.status_code == 200
        liked_titles = [project["title"] for project in liked_response.json()]
        assert liked_titles == ["FastAPI Builder"]


def test_feed_search_and_filters_are_applied_server_side():
    with TestClient(app) as client:
        owner = _register_user(client, "feedfilter")

        alpha_response = client.post(
            "/api/projects",
            json={
                "title": "Alpha Feed Search",
                "description": "This project should match feed filters.",
                "stage": "idea",
                "support_needed": "QA",
                "tech_stack": ["React"],
            },
        )
        beta_response = client.post(
            "/api/projects",
            json={
                "title": "Beta Feed Search",
                "description": "This project should be filtered out.",
                "stage": "idea",
                "support_needed": "Docs",
                "tech_stack": ["FastAPI"],
            },
        )
        assert alpha_response.status_code == 200
        assert beta_response.status_code == 200

        search_response = client.get("/api/feed?q=alpha")
        assert search_response.status_code == 200
        assert all("alpha" in (item.get("title", "") + item.get("project_title", "")).lower() for item in search_response.json())

        tech_response = client.get("/api/feed?tech_stack=React")
        assert tech_response.status_code == 200
        project_items = [item for item in tech_response.json() if item["type"] == "project"]
        assert any(item["title"] == "Alpha Feed Search" for item in project_items)
        assert all("React" in item.get("tech_stack", []) for item in project_items)


def test_user_directory_search_returns_public_results():
    with TestClient(app) as client:
        owner = _register_user(client, "directory")

        response = client.get("/api/users?q=directory")
        assert response.status_code == 200

        payload = response.json()
        assert any(user["id"] == owner["id"] for user in payload)
        assert all("email" not in user for user in payload)
