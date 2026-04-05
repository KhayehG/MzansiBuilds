from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager, suppress

import jwt
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from starlette.middleware.cors import CORSMiddleware

from .core.config import JWT_ALGORITHM, USE_MOCK_DB, allow_origin_regex, allowed_origins, get_jwt_secret, logger
from .core.database import (
    PERSIST_MOCK_DB,
    close_database,
    initialize_database,
    persist_mock_data,
    seed_admin_user,
    write_test_credentials,
)
from .routes import auth, collaborations, community, projects, system, users
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
    community.router,
    system.router,
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
            await websocket.receive_text()
    except WebSocketDisconnect:
        await manager.disconnect(websocket, user_id)

