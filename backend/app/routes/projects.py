from __future__ import annotations

import re

from bson import ObjectId
from fastapi import APIRouter, HTTPException, Query, Request

from ..core.database import db
from ..models.schemas import (
    CollaborationRequestCreate,
    CommentCreate,
    ProjectCreate,
    ProjectUpdate,
    UpdateCreate,
)
from ..services.auth import get_current_user, get_optional_user, validate_object_id
from ..services.email import email_service
from ..services.realtime import manager
from ..utils.common import clean_text, utc_now_iso

router = APIRouter(prefix="/projects", tags=["projects"])


@router.post("")
async def create_project(project_data: ProjectCreate, request: Request):
    user = await get_current_user(request)
    project_doc = {
        "user_id": user["_id"],
        "title": project_data.title,
        "description": project_data.description,
        "stage": project_data.stage,
        "support_needed": clean_text(project_data.support_needed),
        "like_count": 0,
        "comment_count": 0,
        "created_at": utc_now_iso(),
    }
    result = await db.projects.insert_one(project_doc)
    project_id = str(result.inserted_id)

    await manager.broadcast(
        {
            "type": "new_project",
            "data": {
                "id": project_id,
                "title": project_data.title,
                "description": project_data.description,
                "stage": project_data.stage,
                "support_needed": clean_text(project_data.support_needed),
                "user_id": user["_id"],
                "username": user["username"],
                "profile_picture_url": user.get("profile_picture_url"),
                "created_at": project_doc["created_at"],
            },
        }
    )

    return {
        "id": project_id,
        "title": project_data.title,
        "description": project_data.description,
        "stage": project_data.stage,
        "support_needed": clean_text(project_data.support_needed),
        "user_id": user["_id"],
        "username": user["username"],
        "created_at": project_doc["created_at"],
    }


@router.get("")
async def get_projects(
    stage: str | None = None,
    user_id: str | None = None,
    q: str | None = None,
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    request: Request = None,
):
    query: dict = {}
    if stage:
        query["stage"] = stage
    if user_id:
        query["user_id"] = user_id
    query["hidden"] = {"$ne": True}  # Exclude hidden projects
    
    if q and q.strip():
        pattern = {"$regex": re.escape(q.strip()), "$options": "i"}
        matching_users = await db.users.find({"username": pattern}, {"_id": 1}).to_list(100)
        search_filters = [
            {"title": pattern},
            {"description": pattern},
            {"support_needed": pattern},
        ]
        if matching_users:
            search_filters.append({"user_id": {"$in": [str(user["_id"]) for user in matching_users]}})
        query["$or"] = search_filters

    projects = await db.projects.find(query).sort("created_at", -1).skip(offset).limit(limit).to_list(limit)
    user_ids = list({project["user_id"] for project in projects})
    users = await db.users.find(
        {"_id": {"$in": [ObjectId(user_id_value) for user_id_value in user_ids]}},
        {"_id": 1, "username": 1, "profile_picture_url": 1},
    ).to_list(500)
    user_map = {str(user["_id"]): user for user in users}

    current_user = await get_optional_user(request) if request else None
    liked_project_ids: set[str] = set()
    if current_user:
        likes = await db.likes.find({"user_id": current_user["_id"], "project_id": {"$ne": None}}).to_list(500)
        liked_project_ids = {like["project_id"] for like in likes}

    result = []
    for project in projects:
        project_user = user_map.get(project["user_id"], {})
        result.append(
            {
                "id": str(project["_id"]),
                "title": project["title"],
                "description": project["description"],
                "stage": project["stage"],
                "support_needed": project.get("support_needed", ""),
                "user_id": project["user_id"],
                "username": project_user.get("username", "Unknown"),
                "profile_picture_url": project_user.get("profile_picture_url"),
                "like_count": project.get("like_count", 0),
                "comment_count": project.get("comment_count", 0),
                "is_liked": str(project["_id"]) in liked_project_ids,
                "created_at": project.get("created_at", ""),
            }
        )
    return result


@router.get("/{project_id}")
async def get_project(project_id: str, request: Request):
    project = await db.projects.find_one({"_id": validate_object_id(project_id)})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    user = await db.users.find_one(
        {"_id": ObjectId(project["user_id"])},
        {"_id": 0, "username": 1, "bio": 1, "profile_picture_url": 1},
    )
    current_user = await get_optional_user(request)
    is_liked = False
    has_requested_collab = False
    collaboration_status = None
    if current_user:
        is_liked = await db.likes.find_one({"user_id": current_user["_id"], "project_id": project_id}) is not None
        if current_user["_id"] != project["user_id"]:
            collab_request = await db.collaboration_requests.find_one(
                {"project_id": project_id, "requester_id": current_user["_id"]}
            )
            if collab_request:
                collaboration_status = collab_request.get("status")
                has_requested_collab = collaboration_status == "pending"

    return {
        "id": str(project["_id"]),
        "title": project["title"],
        "description": project["description"],
        "stage": project["stage"],
        "support_needed": project.get("support_needed", ""),
        "user_id": project["user_id"],
        "username": user["username"] if user else "Unknown",
        "user_bio": user.get("bio", "") if user else "",
        "profile_picture_url": user.get("profile_picture_url") if user else None,
        "like_count": project.get("like_count", 0),
        "comment_count": project.get("comment_count", 0),
        "is_liked": is_liked,
        "has_requested_collab": has_requested_collab,
        "collaboration_status": collaboration_status,
        "created_at": project.get("created_at", ""),
    }


@router.put("/{project_id}")
async def update_project(project_id: str, project_data: ProjectUpdate, request: Request):
    user = await get_current_user(request)
    oid = validate_object_id(project_id)
    project = await db.projects.find_one({"_id": oid})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project["user_id"] != user["_id"]:
        raise HTTPException(status_code=403, detail="Not authorized to update this project")

    update_data = {key: value for key, value in project_data.model_dump().items() if value is not None}
    if update_data:
        update_data["updated_at"] = utc_now_iso()
        await db.projects.update_one({"_id": oid}, {"$set": update_data})

    updated = await db.projects.find_one({"_id": oid})
    return {
        "id": str(updated["_id"]),
        "title": updated["title"],
        "description": updated["description"],
        "stage": updated["stage"],
        "support_needed": updated.get("support_needed", ""),
        "user_id": updated["user_id"],
        "created_at": updated.get("created_at", ""),
    }


@router.delete("/{project_id}")
async def delete_project(project_id: str, request: Request):
    user = await get_current_user(request)
    oid = validate_object_id(project_id)
    project = await db.projects.find_one({"_id": oid})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project["user_id"] != user["_id"]:
        raise HTTPException(status_code=403, detail="Not authorized to delete this project")

    await db.projects.delete_one({"_id": oid})
    await db.updates.delete_many({"project_id": project_id})
    await db.comments.delete_many({"project_id": project_id})
    await db.collaboration_requests.delete_many({"project_id": project_id})
    await db.likes.delete_many({"project_id": project_id})
    return {"message": "Project deleted successfully"}


@router.post("/{project_id}/updates")
async def create_update(project_id: str, update_data: UpdateCreate, request: Request):
    user = await get_current_user(request)
    oid = validate_object_id(project_id)
    project = await db.projects.find_one({"_id": oid})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project["user_id"] != user["_id"]:
        raise HTTPException(status_code=403, detail="Only project owner can add updates")

    update_doc = {
        "project_id": project_id,
        "user_id": user["_id"],
        "content": update_data.content,
        "like_count": 0,
        "created_at": utc_now_iso(),
    }
    result = await db.updates.insert_one(update_doc)
    update_id = str(result.inserted_id)

    await manager.broadcast(
        {
            "type": "new_update",
            "data": {
                "id": update_id,
                "project_id": project_id,
                "project_title": project["title"],
                "content": update_data.content,
                "username": user["username"],
                "profile_picture_url": user.get("profile_picture_url"),
                "created_at": update_doc["created_at"],
            },
        }
    )
    return {
        "id": update_id,
        "project_id": project_id,
        "content": update_data.content,
        "username": user["username"],
        "like_count": 0,
        "created_at": update_doc["created_at"],
    }


@router.get("/{project_id}/updates")
async def get_updates(project_id: str, request: Request):
    updates = await db.updates.find({"project_id": project_id}).sort("created_at", -1).to_list(100)
    user_ids = list({update["user_id"] for update in updates})
    users = await db.users.find(
        {"_id": {"$in": [ObjectId(user_id_value) for user_id_value in user_ids]}},
        {"_id": 1, "username": 1, "profile_picture_url": 1},
    ).to_list(500)
    user_map = {str(user["_id"]): user for user in users}

    current_user = await get_optional_user(request)
    liked_update_ids: set[str] = set()
    if current_user:
        likes = await db.likes.find({"user_id": current_user["_id"], "update_id": {"$ne": None}}).to_list(500)
        liked_update_ids = {like["update_id"] for like in likes}

    result = []
    for update in updates:
        update_user = user_map.get(update["user_id"], {})
        result.append(
            {
                "id": str(update["_id"]),
                "project_id": update["project_id"],
                "content": update["content"],
                "username": update_user.get("username", "Unknown"),
                "profile_picture_url": update_user.get("profile_picture_url"),
                "like_count": update.get("like_count", 0),
                "is_liked": str(update["_id"]) in liked_update_ids,
                "created_at": update.get("created_at", ""),
            }
        )
    return result


@router.post("/{project_id}/comments")
async def create_comment(project_id: str, comment_data: CommentCreate, request: Request):
    user = await get_current_user(request)
    oid = validate_object_id(project_id)
    project = await db.projects.find_one({"_id": oid})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    parent_oid = None
    if comment_data.parent_id:
        parent_oid = validate_object_id(comment_data.parent_id)
        parent_comment = await db.comments.find_one({"_id": parent_oid, "project_id": project_id})
        if not parent_comment:
            raise HTTPException(status_code=404, detail="Parent comment not found")
        if parent_comment.get("parent_id"):
            raise HTTPException(status_code=400, detail="Cannot reply to a reply (max depth reached)")

    comment_doc = {
        "project_id": project_id,
        "user_id": user["_id"],
        "content": comment_data.content,
        "parent_id": comment_data.parent_id,
        "like_count": 0,
        "reply_count": 0,
        "created_at": utc_now_iso(),
    }
    result = await db.comments.insert_one(comment_doc)
    comment_id = str(result.inserted_id)

    if parent_oid:
        await db.comments.update_one({"_id": parent_oid}, {"$inc": {"reply_count": 1}})
    await db.projects.update_one({"_id": oid}, {"$inc": {"comment_count": 1}})

    if project["user_id"] != user["_id"]:
        await email_service.send_notification_email(
            project["user_id"],
            "new_comment",
            {"commenter_name": user["username"], "project_title": project["title"]},
        )

    await manager.broadcast(
        {
            "type": "new_comment",
            "data": {
                "id": comment_id,
                "project_id": project_id,
                "parent_id": comment_data.parent_id,
                "content": comment_data.content,
                "username": user["username"],
                "profile_picture_url": user.get("profile_picture_url"),
                "created_at": comment_doc["created_at"],
            },
        }
    )
    return {
        "id": comment_id,
        "project_id": project_id,
        "parent_id": comment_data.parent_id,
        "content": comment_data.content,
        "username": user["username"],
        "profile_picture_url": user.get("profile_picture_url"),
        "like_count": 0,
        "reply_count": 0,
        "created_at": comment_doc["created_at"],
    }


@router.get("/{project_id}/comments")
async def get_comments(project_id: str, request: Request):
    comments = await db.comments.find({"project_id": project_id, "parent_id": None}).sort("created_at", -1).to_list(100)
    comment_ids = [str(comment["_id"]) for comment in comments]
    replies = await db.comments.find({"project_id": project_id, "parent_id": {"$in": comment_ids}}).sort("created_at", 1).to_list(500)

    reply_map: dict[str, list] = {}
    for reply in replies:
        reply_map.setdefault(reply["parent_id"], []).append(reply)

    all_user_ids = list({comment["user_id"] for comment in comments} | {reply["user_id"] for reply in replies})
    users = await db.users.find(
        {"_id": {"$in": [ObjectId(user_id_value) for user_id_value in all_user_ids]}},
        {"_id": 1, "username": 1, "profile_picture_url": 1},
    ).to_list(500)
    user_map = {str(user["_id"]): user for user in users}

    current_user = await get_optional_user(request)
    liked_comment_ids: set[str] = set()
    if current_user:
        likes = await db.likes.find({"user_id": current_user["_id"], "comment_id": {"$ne": None}}).to_list(500)
        liked_comment_ids = {like["comment_id"] for like in likes}

    def format_comment(comment: dict, include_replies: bool = True) -> dict:
        comment_user = user_map.get(comment["user_id"], {})
        data = {
            "id": str(comment["_id"]),
            "project_id": comment["project_id"],
            "parent_id": comment.get("parent_id"),
            "content": comment["content"],
            "username": comment_user.get("username", "Unknown"),
            "profile_picture_url": comment_user.get("profile_picture_url"),
            "like_count": comment.get("like_count", 0),
            "reply_count": comment.get("reply_count", 0),
            "is_liked": str(comment["_id"]) in liked_comment_ids,
            "created_at": comment.get("created_at", ""),
        }
        if include_replies:
            data["replies"] = [format_comment(reply, include_replies=False) for reply in reply_map.get(str(comment["_id"]), [])]
        return data

    return [format_comment(comment) for comment in comments]


@router.post("/{project_id}/collaborate")
async def create_collaboration_request(project_id: str, collab_data: CollaborationRequestCreate, request: Request):
    user = await get_current_user(request)
    oid = validate_object_id(project_id)
    project = await db.projects.find_one({"_id": oid})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project["user_id"] == user["_id"]:
        raise HTTPException(status_code=400, detail="Cannot request collaboration on your own project")

    existing = await db.collaboration_requests.find_one(
        {"project_id": project_id, "requester_id": user["_id"], "status": "pending"}
    )
    if existing:
        raise HTTPException(status_code=400, detail="You already have a pending request for this project")

    collab_doc = {
        "project_id": project_id,
        "requester_id": user["_id"],
        "message": clean_text(collab_data.message),
        "status": "pending",
        "created_at": utc_now_iso(),
    }
    result = await db.collaboration_requests.insert_one(collab_doc)
    collab_id = str(result.inserted_id)

    await email_service.send_notification_email(
        project["user_id"],
        "collaboration_request",
        {"requester_name": user["username"], "project_title": project["title"]},
    )
    await manager.broadcast(
        {
            "type": "new_collaboration_request",
            "data": {
                "id": collab_id,
                "project_id": project_id,
                "project_title": project["title"],
                "requester_username": user["username"],
                "requester_profile_picture": user.get("profile_picture_url"),
                "status": "pending",
            },
        }
    )
    return {
        "id": collab_id,
        "project_id": project_id,
        "requester_id": user["_id"],
        "requester_username": user["username"],
        "message": collab_doc["message"],
        "status": "pending",
        "created_at": collab_doc["created_at"],
    }


@router.get("/{project_id}/collaborations")
async def get_collaboration_requests(project_id: str, request: Request):
    user = await get_current_user(request)
    project = await db.projects.find_one({"_id": validate_object_id(project_id)})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project["user_id"] != user["_id"]:
        raise HTTPException(status_code=403, detail="Only the project owner can view collaboration requests")

    collabs = await db.collaboration_requests.find({"project_id": project_id}).sort("created_at", -1).to_list(100)
    requester_ids = list({collab["requester_id"] for collab in collabs})
    users = await db.users.find(
        {"_id": {"$in": [ObjectId(user_id_value) for user_id_value in requester_ids]}},
        {"_id": 1, "username": 1, "profile_picture_url": 1},
    ).to_list(500)
    user_map = {str(user["_id"]): user for user in users}

    return [
        {
            "id": str(collab["_id"]),
            "project_id": collab["project_id"],
            "requester_id": collab["requester_id"],
            "requester_username": user_map.get(collab["requester_id"], {}).get("username", "Unknown"),
            "requester_profile_picture": user_map.get(collab["requester_id"], {}).get("profile_picture_url"),
            "message": collab.get("message", ""),
            "status": collab["status"],
            "created_at": collab.get("created_at", ""),
        }
        for collab in collabs
    ]

