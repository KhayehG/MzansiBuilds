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


def test_rejected_collaboration_request_can_be_resubmitted():
    with TestClient(app) as client:
        owner = _register_user(client, "retry_owner")
        project = _create_project(client, "Retry Collaboration Project")

        _logout_user(client)
        requester = _register_user(client, "retry_requester")
        first_request_response = client.post(
            f"/api/projects/{project['id']}/collaborate",
            json={"message": "First attempt."},
        )
        assert first_request_response.status_code == 200

        _logout_user(client)
        _login_user(client, owner["email"], owner["password"])
        received_response = client.get("/api/collaborations/requests-received")
        request_id = next(
            request["id"]
            for request in received_response.json()["requests"]
            if request["project"]["id"] == project["id"]
        )
        reject_response = client.put(f"/api/collaborations/{request_id}?status=rejected")
        assert reject_response.status_code == 200

        _logout_user(client)
        _login_user(client, requester["email"], requester["password"])
        retry_response = client.post(
            f"/api/projects/{project['id']}/collaborate",
            json={"message": "Second attempt with more detail."},
        )
        assert retry_response.status_code == 200
        assert retry_response.json()["id"] == request_id
        assert retry_response.json()["status"] == "pending"


def test_collaboration_request_can_be_revoked_and_accepted_collaborator_can_leave():
    with TestClient(app) as client:
        owner = _register_user(client, "revoke_owner")
        project = _create_project(client, "Revoke Collaboration Project")

        _logout_user(client)
        requester = _register_user(client, "revoke_requester")
        request_response = client.post(
            f"/api/projects/{project['id']}/collaborate",
            json={"message": "I can help with docs and QA."},
        )
        assert request_response.status_code == 200

        pending_detail = client.get(f"/api/projects/{project['id']}")
        assert pending_detail.status_code == 200
        assert pending_detail.json()["collaboration_status"] == "pending"

        revoke_response = client.delete(f"/api/projects/{project['id']}/collaborate")
        assert revoke_response.status_code == 200
        assert revoke_response.json()["state"] == "revoked"

        revoked_detail = client.get(f"/api/projects/{project['id']}")
        assert revoked_detail.status_code == 200
        assert revoked_detail.json()["collaboration_status"] is None
        assert revoked_detail.json()["has_requested_collab"] is False

        second_request_response = client.post(
            f"/api/projects/{project['id']}/collaborate",
            json={"message": "Trying again with a stronger pitch."},
        )
        assert second_request_response.status_code == 200

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

        owner_detail = client.get(f"/api/projects/{project['id']}")
        assert owner_detail.status_code == 200
        assert owner_detail.json()["collaborator_count"] == 1
        assert owner_detail.json()["collaborators"][0]["username"] == requester["username"]

        _logout_user(client)
        _login_user(client, requester["email"], requester["password"])
        leave_response = client.delete(f"/api/projects/{project['id']}/collaborate")
        assert leave_response.status_code == 200
        assert leave_response.json()["state"] == "left"

        after_leave_detail = client.get(f"/api/projects/{project['id']}")
        assert after_leave_detail.status_code == 200
        assert after_leave_detail.json()["collaboration_status"] is None

        _logout_user(client)
        _login_user(client, owner["email"], owner["password"])
        owner_after_leave = client.get(f"/api/projects/{project['id']}")
        assert owner_after_leave.status_code == 200
        assert owner_after_leave.json()["collaborators"] == []


def test_notifications_include_click_routing_metadata():
    with TestClient(app) as client:
        followed_user = _register_user(client, "notif_target")

        _logout_user(client)
        follower = _register_user(client, "notif_actor")
        follow_response = client.post(f"/api/users/{followed_user['id']}/follow")
        assert follow_response.status_code == 200

        _logout_user(client)
        _login_user(client, followed_user["email"], followed_user["password"])
        follow_notifications = client.get("/api/chat/notifications")
        assert follow_notifications.status_code == 200
        follow_notification = follow_notifications.json()["notifications"][0]
        assert follow_notification["type"] == "new_follow"
        assert follow_notification["reference_id"] == follower["id"]
        assert follow_notification["route"] == f"/profile/{follower['id']}"

        project = _create_project(client, "Notification Route Project")

        _logout_user(client)
        commenter = _register_user(client, "notif_commenter")
        comment_response = client.post(
            f"/api/projects/{project['id']}/comments",
            json={"content": "Nice progress on this build."},
        )
        assert comment_response.status_code == 200

        _logout_user(client)
        _login_user(client, followed_user["email"], followed_user["password"])
        comment_notifications = client.get("/api/chat/notifications")
        assert comment_notifications.status_code == 200
        comment_notification = next(
            notification
            for notification in comment_notifications.json()["notifications"]
            if notification["type"] == "new_comment"
        )
        assert comment_notification["reference_id"] == project["id"]
        assert comment_notification["route"] == f"/project/{project['id']}"


def test_collaborator_can_edit_project_content_but_not_owner_only_actions():
    with TestClient(app) as client:
        owner = _register_user(client, "perm_owner")
        project = _create_project(client, "Permission Coverage Project")

        _logout_user(client)
        collaborator = _register_user(client, "perm_collab")
        request_response = client.post(
            f"/api/projects/{project['id']}/collaborate",
            json={"message": "I can contribute implementation work."},
        )
        assert request_response.status_code == 200

        _logout_user(client)
        _login_user(client, owner["email"], owner["password"])
        received_response = client.get("/api/collaborations/requests-received")
        collab_id = next(
            request["id"]
            for request in received_response.json()["requests"]
            if request["project"]["id"] == project["id"]
        )
        accept_response = client.put(f"/api/collaborations/{collab_id}?status=accepted")
        assert accept_response.status_code == 200

        _logout_user(client)
        _login_user(client, collaborator["email"], collaborator["password"])

        detail_response = client.get(f"/api/projects/{project['id']}")
        assert detail_response.status_code == 200
        detail_payload = detail_response.json()
        assert detail_payload["is_collaborator"] is True
        assert detail_payload["can_edit_project"] is True
        assert detail_payload["can_delete_project"] is False
        assert detail_payload["can_manage_collaboration_requests"] is False

        update_project_response = client.put(
            f"/api/projects/{project['id']}",
            json={"title": "Permission Coverage Project Updated"},
        )
        assert update_project_response.status_code == 200
        assert update_project_response.json()["title"] == "Permission Coverage Project Updated"

        add_update_response = client.post(
            f"/api/projects/{project['id']}/updates",
            json={"content": "Collaborator progress note."},
        )
        assert add_update_response.status_code == 200
        update_id = add_update_response.json()["id"]

        edit_update_response = client.put(
            f"/api/projects/{project['id']}/updates/{update_id}",
            json={"content": "Collaborator progress note edited."},
        )
        assert edit_update_response.status_code == 200

        add_milestone_response = client.post(
            f"/api/projects/{project['id']}/milestones",
            json={
                "stage_name": "planning",
                "title": "Collaborator milestone",
                "description": "Defined scope and approach.",
                "is_retrospective": False,
            },
        )
        assert add_milestone_response.status_code == 200

        complete_stage_response = client.post(f"/api/projects/{project['id']}/stages/complete")
        assert complete_stage_response.status_code == 200

        move_stage_response = client.post(
            f"/api/projects/{project['id']}/stages/move",
            json={"to_stage": "planning", "reason": "Need to revisit the original plan."},
        )
        assert move_stage_response.status_code == 200

        delete_project_response = client.delete(f"/api/projects/{project['id']}")
        assert delete_project_response.status_code == 403

        manage_requests_response = client.get(f"/api/projects/{project['id']}/collaborations")
        assert manage_requests_response.status_code == 403

        _logout_user(client)
        outsider = _register_user(client, "perm_outsider")
        outsider_update_edit = client.put(
            f"/api/projects/{project['id']}/updates/{update_id}",
            json={"content": "Outsider edit attempt."},
        )
        assert outsider_update_edit.status_code == 403


def test_project_owner_can_remove_accepted_collaborator():
    with TestClient(app) as client:
        owner = _register_user(client, "remove_owner")
        project = _create_project(client, "Owner Remove Collaborator Project")

        _logout_user(client)
        collaborator = _register_user(client, "remove_collab")
        request_response = client.post(
            f"/api/projects/{project['id']}/collaborate",
            json={"message": "I can help maintain this."},
        )
        assert request_response.status_code == 200

        _logout_user(client)
        _login_user(client, owner["email"], owner["password"])
        requests_response = client.get(f"/api/projects/{project['id']}/collaborations")
        assert requests_response.status_code == 200
        accepted_candidate = requests_response.json()[0]
        accept_response = client.put(f"/api/collaborations/{accepted_candidate['id']}?status=accepted")
        assert accept_response.status_code == 200

        accepted_requests_response = client.get(f"/api/projects/{project['id']}/collaborations")
        accepted_request = next(item for item in accepted_requests_response.json() if item["status"] == "accepted")

        remove_response = client.delete(f"/api/collaborations/{accepted_request['id']}")
        assert remove_response.status_code == 200

        project_detail = client.get(f"/api/projects/{project['id']}")
        assert project_detail.status_code == 200
        assert project_detail.json()["collaborators"] == []

        _logout_user(client)
        _login_user(client, collaborator["email"], collaborator["password"])
        collaborator_detail = client.get(f"/api/projects/{project['id']}")
        assert collaborator_detail.status_code == 200
        assert collaborator_detail.json()["is_collaborator"] is False
        assert collaborator_detail.json()["can_edit_project"] is False


def test_dm_conversations_include_username_and_unread_counts_without_notifications():
    with TestClient(app) as client:
        sender = _register_user(client, "dm_sender")
        _logout_user(client)
        receiver = _register_user(client, "dm_receiver")

        dm_response = client.post(
            f"/api/chat/conversations/dm?target_user_id={sender['id']}",
            json={},
        )
        assert dm_response.status_code == 201
        conversation_id = dm_response.json()["id"]

        _logout_user(client)
        _login_user(client, sender["email"], sender["password"])
        message_response = client.post(
            "/api/chat/messages",
            json={"conversation_id": conversation_id, "content": "Hello there"},
        )
        assert message_response.status_code == 201

        sender_conversations = client.get("/api/chat/conversations")
        assert sender_conversations.status_code == 200
        sender_conversation = next(conv for conv in sender_conversations.json() if conv["id"] == conversation_id)
        assert sender_conversation["other_participant_username"] == receiver["username"]
        assert sender_conversation["unread_count"] == 0

        _logout_user(client)
        _login_user(client, receiver["email"], receiver["password"])
        receiver_conversations = client.get("/api/chat/conversations")
        assert receiver_conversations.status_code == 200
        receiver_conversation = next(conv for conv in receiver_conversations.json() if conv["id"] == conversation_id)
        assert receiver_conversation["other_participant_username"] == sender["username"]
        assert receiver_conversation["unread_count"] == 1
        assert receiver_conversation["title"] == sender["username"]

        notifications_response = client.get("/api/chat/notifications")
        assert notifications_response.status_code == 200
        assert notifications_response.json()["notifications"] == []

        messages_response = client.get(f"/api/chat/messages/{conversation_id}")
        assert messages_response.status_code == 200
        assert messages_response.json()[0]["content"] == "Hello there"

        refreshed_conversations = client.get("/api/chat/conversations")
        refreshed_conversation = next(conv for conv in refreshed_conversations.json() if conv["id"] == conversation_id)
        assert refreshed_conversation["unread_count"] == 0