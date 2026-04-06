from __future__ import annotations

from typing import List

from bson import ObjectId
from fastapi import WebSocket

from ..core.config import logger
from ..core.database import db
from ..utils.common import utc_now_iso


class ConnectionManager:
    def __init__(self) -> None:
        self.active_connections: List[WebSocket] = []
        self.user_connections: dict[str, WebSocket] = {}
        self.online_users: set[str] = set()

    async def connect(self, websocket: WebSocket, user_id: str | None = None) -> None:
        await websocket.accept()
        self.active_connections.append(websocket)
        if user_id:
            self.user_connections[user_id] = websocket
            self.online_users.add(user_id)
            await db.users.update_one(
                {"_id": ObjectId(user_id)},
                {"$set": {"is_online": True, "last_seen": utc_now_iso()}},
            )
            await self.broadcast({"type": "user_online", "user_id": user_id})
        logger.info(
            "WebSocket connected. Total: %s, Online users: %s",
            len(self.active_connections),
            len(self.online_users),
        )

    async def disconnect(self, websocket: WebSocket, user_id: str | None = None) -> None:
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        if user_id:
            self.user_connections.pop(user_id, None)
            self.online_users.discard(user_id)
            await db.users.update_one(
                {"_id": ObjectId(user_id)},
                {"$set": {"is_online": False, "last_seen": utc_now_iso()}},
            )
            await self.broadcast({"type": "user_offline", "user_id": user_id})
        logger.info(
            "WebSocket disconnected. Total: %s, Online users: %s",
            len(self.active_connections),
            len(self.online_users),
        )

    def is_user_online(self, user_id: str) -> bool:
        return user_id in self.online_users

    async def broadcast(self, message: dict) -> None:
        disconnected: list[WebSocket] = []
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception as exc:  # pragma: no cover - defensive cleanup
                logger.error("Error broadcasting: %s", exc)
                disconnected.append(connection)

        for connection in disconnected:
            if connection in self.active_connections:
                self.active_connections.remove(connection)

    async def send_to_user(self, user_id: str, message: dict) -> bool:
        if user_id not in self.user_connections:
            return False

        try:
            await self.user_connections[user_id].send_json(message)
            return True
        except Exception as exc:  # pragma: no cover - defensive cleanup
            logger.error("Error sending to user %s: %s", user_id, exc)
            return False


manager = ConnectionManager()
