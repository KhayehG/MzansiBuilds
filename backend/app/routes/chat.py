from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request
from ..models.schemas import ConversationCreate, ConversationType, MessageCreate
from ..core.database import db
from ..services.auth import get_current_user
from ..services.realtime import manager
from ..utils.common import utc_now_iso
from bson import ObjectId

router = APIRouter(prefix="/chat", tags=["Chat"])


def _str_id(doc: dict) -> dict:
    doc["id"] = str(doc.pop("_id"))
    return doc


def _current_user_id(current_user: dict) -> str:
    user_id = current_user.get("id") or current_user.get("_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Authenticated user is missing an id.")
    return str(user_id)


async def _get_project_chat_participants(project_id: str) -> list[str]:
    project = await db.projects.find_one({"_id": ObjectId(project_id)})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found.")

    participants = {str(project["user_id"])}
    accepted_requests = await db.collaboration_requests.find(
        {"project_id": project_id, "status": "accepted"}
    ).to_list(200)
    participants.update(str(request["requester_id"]) for request in accepted_requests)
    return list(participants)


async def _ensure_project_chat_access(conversation: dict, user_id: str) -> list[str]:
    participants = await _get_project_chat_participants(conversation["project_id"])
    if user_id not in participants:
        raise HTTPException(status_code=403, detail="You are not allowed to access this project chat.")

    current_participants = set(conversation.get("participants", []))
    expected_participants = set(participants)
    if current_participants != expected_participants:
        await db.conversations.update_one(
            {"_id": conversation["_id"]},
            {"$set": {"participants": participants}},
        )
    return participants


# --- Conversation Endpoints ---

@router.post("/conversations", status_code=201)
async def create_conversation(payload: ConversationCreate, request: Request):
    current_user = await get_current_user(request)
    user_id = _current_user_id(current_user)

    # For private DM: prevent duplicates between same two users
    if payload.type == ConversationType.private and payload.project_id is None:
        raise HTTPException(status_code=400, detail="For private DMs, use /conversations/dm endpoint.")

    # For project chat: check if conversation already exists for this project
    if payload.type == ConversationType.project and payload.project_id:
        participants = await _get_project_chat_participants(payload.project_id)
        if user_id not in participants:
            raise HTTPException(status_code=403, detail="You are not allowed to access this project chat.")

        existing = await db.conversations.find_one({
            "type": "project",
            "project_id": payload.project_id,
        })
        if existing:
            if set(existing.get("participants", [])) != set(participants):
                await db.conversations.update_one(
                    {"_id": existing["_id"]},
                    {"$set": {"participants": participants}},
                )
                existing["participants"] = participants
            return _str_id(existing)

    doc = {
        "type": payload.type,
        "project_id": payload.project_id,
        "created_at": utc_now_iso(),
        "participants": participants if payload.type == ConversationType.project and payload.project_id else [user_id],
    }
    result = await db.conversations.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    doc.pop("_id", None)
    return doc


@router.post("/conversations/dm", status_code=201)
async def create_or_get_dm(target_user_id: str, request: Request):
    """Create or retrieve a private DM conversation between two users."""
    current_user = await get_current_user(request)
    user_id = _current_user_id(current_user)

    if user_id == target_user_id:
        raise HTTPException(status_code=400, detail="Cannot DM yourself.")

    # Find existing DM between these two users
    existing = await db.conversations.find_one({
        "type": "private",
        "participants": {"$all": [user_id, target_user_id]},
    })
    if existing:
        return _str_id(existing)

    doc = {
        "type": "private",
        "project_id": None,
        "participants": [user_id, target_user_id],
        "created_at": utc_now_iso(),
    }
    result = await db.conversations.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    doc.pop("_id", None)
    return doc


@router.get("/conversations")
async def get_user_conversations(request: Request):
    current_user = await get_current_user(request)
    user_id = _current_user_id(current_user)
    convs = await db.conversations.find({"participants": user_id}).to_list(100)
    return [_str_id(c) for c in convs]


# --- Message Endpoints ---

@router.post("/messages", status_code=201)
async def send_message(payload: MessageCreate, request: Request):
    current_user = await get_current_user(request)
    user_id = _current_user_id(current_user)

    # Verify conversation exists and user is a participant
    conv = await db.conversations.find_one({"_id": ObjectId(payload.conversation_id)})
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found.")

    participants = conv.get("participants", [])
    if conv.get("type") == "project" and conv.get("project_id"):
        participants = await _ensure_project_chat_access(conv, user_id)
    elif user_id not in participants:
        raise HTTPException(status_code=403, detail="Not a participant of this conversation.")

    doc = {
        "conversation_id": payload.conversation_id,
        "sender_id": user_id,
        "sender_username": current_user.get("username", ""),
        "content": payload.content,
        "is_read": False,
        "created_at": utc_now_iso(),
    }
    result = await db.messages.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    doc.pop("_id", None)

    # Broadcast real-time event to all participants
    for participant_id in participants:
        await manager.send_to_user(participant_id, {
            "type": "chat_message",
            "conversation_id": payload.conversation_id,
            "message": doc,
        })

    # Create in-app notifications for other participants
    for participant_id in participants:
        if participant_id != user_id:
            notif = {
                "user_id": participant_id,
                "message": f"New message from {current_user.get('username', 'Someone')}",
                "is_read": False,
                "created_at": utc_now_iso(),
            }
            result = await db.notifications.insert_one(notif)
            notif["id"] = str(result.inserted_id)
            await manager.send_to_user(participant_id, {
                "type": "notification",
                "notification": notif,
            })

    return doc


@router.get("/messages/{conversation_id}")
async def get_conversation_messages(conversation_id: str, request: Request):
    current_user = await get_current_user(request)
    user_id = _current_user_id(current_user)

    conv = await db.conversations.find_one({"_id": ObjectId(conversation_id)})
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found.")

    if conv.get("type") == "project" and conv.get("project_id"):
        await _ensure_project_chat_access(conv, user_id)
    elif user_id not in conv.get("participants", []):
        raise HTTPException(status_code=403, detail="Not a participant of this conversation.")

    messages = await db.messages.find(
        {"conversation_id": conversation_id}
    ).sort("created_at", 1).to_list(500)
    return [_str_id(m) for m in messages]


# --- Notification Endpoints ---

@router.get("/notifications")
async def get_user_notifications(request: Request):
    current_user = await get_current_user(request)
    user_id = _current_user_id(current_user)
    notifications = await db.notifications.find(
        {"user_id": user_id}
    ).sort("created_at", -1).to_list(50)
    return {"notifications": [_str_id(n) for n in notifications]}


@router.put("/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str, request: Request):
    current_user = await get_current_user(request)
    user_id = _current_user_id(current_user)
    result = await db.notifications.update_one(
        {"_id": ObjectId(notification_id), "user_id": user_id},
        {"$set": {"is_read": True}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found.")
    return {"success": True}


@router.put("/notifications/read-all")
async def mark_all_notifications_read(request: Request):
    current_user = await get_current_user(request)
    user_id = _current_user_id(current_user)
    await db.notifications.update_many(
        {"user_id": user_id, "is_read": False},
        {"$set": {"is_read": True}},
    )
    return {"success": True}
