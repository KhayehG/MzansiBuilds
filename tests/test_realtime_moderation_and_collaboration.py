import asyncio
import time

from fastapi.testclient import TestClient

from backend.app.main import app, dispatch_websocket_event
from backend.app.services.realtime import manager


def _unique_user_payload(prefix: str = "user") -> dict:
    nonce = time.time_ns()
    compact_prefix = "".join(ch for ch in prefix if ch.isalnum())[:10] or "user"
    compact_nonce = str(nonce)[-8:]
    return {
        "email": f"{compact_prefix}{compact_nonce}@example.com",
        "password": "testpass123",
        "username": f"{compact_prefix}{compact_nonce}",
        "bio": f"{prefix} test account",
    }


def _register_user(client: TestClient, prefix: str = "user") -> dict:
    payload = _unique_user_payload(prefix)
    response = client.post("/api/auth/register", json=payload)
    assert response.status_code == 200
    return {**payload, **response.json()}


def _login_user(client: TestClient, email: str, password: str) -> dict:
    response = client.post(
        "/api/auth/login",
        json={"email": email, "password": password},
    )
    assert response.status_code == 200
    return response.json()


def _logout_user(client: TestClient) -> None:
    response = client.post("/api/auth/logout")
    assert response.status_code == 200


def _login_admin(client: TestClient) -> dict:
    return _login_user(client, "admin@example.com", "admin123")


def _create_project(client: TestClient, title: str, *, stage: str = "idea", current_stage: str | None = None) -> dict:
    payload = {
        "title": title,
        "description": f"{title} description for automated testing.",
        "stage": stage,
        "support_needed": "Testing support",
    }
    if current_stage:
        payload["current_stage"] = current_stage

    response = client.post("/api/projects", json=payload)
    assert response.status_code == 200
    return response.json()


def _submit_report(
    client: TestClient,
    *,
    report_type: str,
    reason: str,
    reported_item_id: str | None = None,
    reported_user_id: str | None = None,
) -> dict:
    params = {
        "report_type": report_type,
        "reason": reason,
    }
    if reported_item_id:
        params["reported_item_id"] = reported_item_id
    if reported_user_id:
        params["reported_user_id"] = reported_user_id

    response = client.post("/api/reports", params=params)
    return response


def test_secure_websocket_dispatch_and_chat_access(monkeypatch):
    with TestClient(app) as client:
        owner = _register_user(client, "chat_owner")
        _logout_user(client)
        collaborator = _register_user(client, "chat_collab")
        _logout_user(client)
        outsider = _register_user(client, "chat_outsider")

        _logout_user(client)
        _login_user(client, owner["email"], owner["password"])
        project = _create_project(client, "Realtime Chat Project")

        _logout_user(client)
        _login_user(client, collaborator["email"], collaborator["password"])
        collab_response = client.post(
            f"/api/projects/{project['id']}/collaborate",
            json={"message": "I can help with this build."},
        )
        assert collab_response.status_code == 200

        _logout_user(client)
        _login_user(client, owner["email"], owner["password"])
        received_response = client.get("/api/collaborations/requests-received")
        assert received_response.status_code == 200
        collab_id = received_response.json()["requests"][0]["id"]

        accept_response = client.put(f"/api/collaborations/{collab_id}?status=accepted")
        assert accept_response.status_code == 200

        conversation_response = client.post(
            "/api/chat/conversations",
            json={"type": "project", "project_id": project["id"]},
        )
        assert conversation_response.status_code == 201
        conversation_id = conversation_response.json()["id"]

        sent_message_response = client.post(
            "/api/chat/messages",
            json={"conversation_id": conversation_id, "content": "Owner update"},
        )
        assert sent_message_response.status_code == 201

        delivered_to: list[str] = []

        async def fake_send_to_user(user_id: str, message: dict) -> bool:
            delivered_to.append(user_id)
            return True

        monkeypatch.setattr(manager, "send_to_user", fake_send_to_user)

        dispatched = asyncio.run(
            dispatch_websocket_event(
                owner["id"],
                {
                    "type": "chat_message",
                    "conversation_id": conversation_id,
                    "content": "Secure websocket message",
                },
            )
        )
        assert dispatched is True
        assert set(delivered_to) == {owner["id"], collaborator["id"]}

        delivered_to.clear()
        rejected = asyncio.run(
            dispatch_websocket_event(
                outsider["id"],
                {
                    "type": "chat_message",
                    "conversation_id": conversation_id,
                    "content": "Should not deliver",
                },
            )
        )
        assert rejected is False
        assert delivered_to == []

        _logout_user(client)
        _login_user(client, outsider["email"], outsider["password"])
        forbidden_response = client.get(f"/api/chat/messages/{conversation_id}")
        assert forbidden_response.status_code == 403


def test_hidden_project_is_removed_from_public_read_endpoints():
    with TestClient(app) as client:
        owner = _register_user(client, "hidden_owner")
        project = _create_project(
            client,
            "Moderated Completed Project",
            stage="completed",
            current_stage="maintenance",
        )

        update_response = client.post(
            f"/api/projects/{project['id']}/updates",
            json={"content": "Release notes for the moderated project."},
        )
        assert update_response.status_code == 200

        _logout_user(client)
        reporter = _register_user(client, "hidden_reporter")
        report_response = _submit_report(
            client,
            report_type="project",
            reason="spam",
            reported_item_id=project["id"],
        )
        assert report_response.status_code == 200
        report_id = report_response.json()["_id"]

        duplicate_report_response = _submit_report(
            client,
            report_type="project",
            reason="spam",
            reported_item_id=project["id"],
        )
        assert duplicate_report_response.status_code == 400

        _logout_user(client)
        _login_admin(client)
        list_reports_response = client.get("/api/reports/admin/all")
        assert list_reports_response.status_code == 200
        assert any(report["_id"] == report_id for report in list_reports_response.json()["reports"])

        hide_response = client.delete(f"/api/reports/admin/{report_id}/hide-content")
        assert hide_response.status_code == 200

        _logout_user(client)
        public_detail = client.get(f"/api/projects/{project['id']}")
        public_stages = client.get(f"/api/projects/{project['id']}/stages")
        public_milestones = client.get(f"/api/projects/{project['id']}/milestones")
        public_updates = client.get(f"/api/projects/{project['id']}/updates")
        public_comments = client.get(f"/api/projects/{project['id']}/comments")
        public_list = client.get("/api/projects")
        public_feed = client.get("/api/feed")
        public_celebration = client.get("/api/celebration-wall")

        assert public_detail.status_code == 404
        assert public_stages.status_code == 404
        assert public_milestones.status_code == 404
        assert public_updates.status_code == 404
        assert public_comments.status_code == 404
        assert all(item["id"] != project["id"] for item in public_list.json())
        assert all(item.get("project_id") != project["id"] and item.get("id") != project["id"] for item in public_feed.json())
        assert all(item["id"] != project["id"] for item in public_celebration.json())

        _login_user(client, owner["email"], owner["password"])
        owner_detail = client.get(f"/api/projects/{project['id']}")
        assert owner_detail.status_code == 200


def test_hidden_comments_are_filtered_from_public_comment_reads():
    with TestClient(app) as client:
        owner = _register_user(client, "comment_owner")
        project = _create_project(client, "Visible Project With Moderated Comment")

        _logout_user(client)
        commenter = _register_user(client, "comment_reporter")
        comment_response = client.post(
            f"/api/projects/{project['id']}/comments",
            json={"content": "This comment should be moderated."},
        )
        assert comment_response.status_code == 200
        comment_id = comment_response.json()["id"]

        report_response = _submit_report(
            client,
            report_type="comment",
            reason="abuse",
            reported_item_id=comment_id,
        )
        assert report_response.status_code == 200
        report_id = report_response.json()["_id"]

        _logout_user(client)
        _login_admin(client)
        hide_response = client.delete(f"/api/reports/admin/{report_id}/hide-content")
        assert hide_response.status_code == 200

        _logout_user(client)
        comments_response = client.get(f"/api/projects/{project['id']}/comments")
        assert comments_response.status_code == 200
        assert comments_response.json() == []


def test_collaboration_inbox_and_status_updates_are_covered():
    with TestClient(app) as client:
        owner = _register_user(client, "collab_owner")
        project = _create_project(client, "Collaboration Coverage Project")

        _logout_user(client)
        requester = _register_user(client, "collab_requester")
        request_response = client.post(
            f"/api/projects/{project['id']}/collaborate",
            json={"message": "Happy to contribute tests."},
        )
        assert request_response.status_code == 200

        inbox_response = client.get("/api/collaborations/inbox")
        assert inbox_response.status_code == 200
        inbox_requests = inbox_response.json()["requests"]
        assert any(request["project_id"] == project["id"] and request["status"] == "pending" for request in inbox_requests)

        _logout_user(client)
        _login_user(client, owner["email"], owner["password"])
        received_response = client.get("/api/collaborations/requests-received")
        assert received_response.status_code == 200
        request_id = next(
            request["id"]
            for request in received_response.json()["requests"]
            if request["project"]["id"] == project["id"]
        )

        accept_response = client.put(f"/api/collaborations/{request_id}?status=accepted")
        assert accept_response.status_code == 200

        _logout_user(client)
        _login_user(client, requester["email"], requester["password"])
        accepted_response = client.get("/api/collaborations/inbox?status=accepted")
        assert accepted_response.status_code == 200
        assert any(request["id"] == request_id and request["status"] == "accepted" for request in accepted_response.json()["requests"])