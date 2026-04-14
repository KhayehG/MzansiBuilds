from __future__ import annotations

import asyncio
from bson import ObjectId
from bson.errors import InvalidId
from contextlib import asynccontextmanager, suppress
import json

import jwt
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from starlette.middleware.cors import CORSMiddleware

from .core.config import JWT_ALGORITHM, USE_MOCK_DB, allow_origin_regex, allowed_origins, get_jwt_secret, logger
from .core.database import (
    PERSIST_MOCK_DB,
    close_database,
    db,
    initialize_database,
    persist_mock_data,
    seed_admin_user,
    write_test_credentials,
)
from .routes import auth, collaboration, collaborations, community, projects, reports, system, users, chat
from .services.realtime import manager


async def autosave_mock_database() -> None:
    """Periodically persist local mock data so restarts do not wipe development state."""
    while True:
        await asyncio.sleep(5)
        try:
            await persist_mock_data()
        except Exception as exc:  # pragma: no cover - defensive logging
            logger.warning("Mock database autosave failed: %s", exc)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    autosave_task = None
    await initialize_database()
    await seed_admin_user()
    write_test_credentials()

    if USE_MOCK_DB and PERSIST_MOCK_DB:
        autosave_task = asyncio.create_task(autosave_mock_database())

    try:
        yield
    finally:
        if autosave_task:
            autosave_task.cancel()
            with suppress(asyncio.CancelledError):
                await autosave_task
        await close_database()


app = FastAPI(title="MzansiBuilds Platform", lifespan=lifespan)


for router in (
    auth.router,
    users.router,
    projects.router,
    collaborations.router,
    collaboration.router,
    community.router,
    reports.router,
    system.router,
    chat.router,
):
    app.include_router(router, prefix="/api")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=allow_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


async def _get_websocket_event_participants(user_id: str | None, conversation_id: str | None) -> list[str]:
    if not user_id or not conversation_id:
        return []

    try:
        conversation = await db.conversations.find_one({"_id": ObjectId(conversation_id)})
    except (InvalidId, TypeError):
        return []

    if not conversation:
        return []

    participants = [str(participant_id) for participant_id in conversation.get("participants", [])]
    if conversation.get("type") == "project" and conversation.get("project_id"):
        try:
            project = await db.projects.find_one({"_id": ObjectId(conversation["project_id"])})
        except (InvalidId, TypeError):
            project = None

        if not project:
            return []

        participants = [str(project["user_id"])]
        accepted_requests = await db.collaboration_requests.find(
            {"project_id": conversation["project_id"], "status": "accepted"}
        ).to_list(200)
        participants.extend(str(request["requester_id"]) for request in accepted_requests)
        participants = list(dict.fromkeys(participants))

        if set(conversation.get("participants", [])) != set(participants):
            await db.conversations.update_one(
                {"_id": conversation["_id"]},
                {"$set": {"participants": participants}},
            )

    if user_id not in participants:
        return []

    return participants


async def dispatch_websocket_event(user_id: str | None, event: dict) -> bool:
    event_type = event.get("type")
    if event_type not in {"chat_message", "typing"}:
        return False

    participants = await _get_websocket_event_participants(user_id, event.get("conversation_id"))
    if not participants:
        return False

    if event_type == "chat_message":
        payload = {
            "type": "chat_message",
            "conversation_id": event.get("conversation_id"),
            "sender_id": user_id,
            "content": event.get("content"),
        }
    else:
        payload = {
            "type": "typing",
            "conversation_id": event.get("conversation_id"),
            "user_id": user_id,
        }

    for participant_id in participants:
        await manager.send_to_user(participant_id, payload)

    return True



# --- WebSocket endpoint with chat event handling ---
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str | None = None):
    user_id = None
    auth_token = token or websocket.cookies.get("access_token")
    if auth_token:
        try:
            payload = jwt.decode(auth_token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
            if payload.get("type") == "access":
                user_id = payload["sub"]
        except jwt.InvalidTokenError:
            user_id = None

    await manager.connect(websocket, user_id)
    try:
        while True:
            data = await websocket.receive_text()
            try:
                event = json.loads(data)
            except Exception:
                continue

            await dispatch_websocket_event(user_id, event)
    except WebSocketDisconnect:
        await manager.disconnect(websocket, user_id)

