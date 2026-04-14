from __future__ import annotations

from typing import Literal

from bson import ObjectId
from fastapi import APIRouter, HTTPException, Query, Request

from ..core.database import db
from ..models.schemas import LikeCreate
from ..services.auth import get_current_user, get_optional_user, validate_object_id
from ..services.email import email_service
from ..services.realtime import manager
from ..utils.common import utc_now_iso

router = APIRouter(tags=["community"])


def _merge_user_filter(existing_filter: str | dict | None, allowed_user_ids: list[str]) -> str | dict:
    if isinstance(existing_filter, str):
        return existing_filter if existing_filter in allowed_user_ids else {"$in": []}
    if isinstance(existing_filter, dict) and "$in" in existing_filter:
        return {"$in": [user_id for user_id in existing_filter["$in"] if user_id in allowed_user_ids]}
    return {"$in": allowed_user_ids}


@router.post("/like")
async def add_like(like_data: LikeCreate, request: Request):
    user = await get_current_user(request)
    targets = [like_data.project_id, like_data.update_id, like_data.comment_id]
    if sum(1 for target in targets if target) != 1:
        raise HTTPException(status_code=400, detail="Must specify exactly one of: project_id, update_id, comment_id")

    like_query = {"user_id": user["_id"]}
    target_collection = None
    target_id = None
    target_type = None

    if like_data.project_id:
        validate_object_id(like_data.project_id)
        like_query["project_id"] = like_data.project_id
        target_collection = db.projects
        target_id = like_data.project_id
        target_type = "project"
    elif like_data.update_id:
        validate_object_id(like_data.update_id)
        like_query["update_id"] = like_data.update_id
        target_collection = db.updates
        target_id = like_data.update_id
        target_type = "update"
    elif like_data.comment_id:
        validate_object_id(like_data.comment_id)
        like_query["comment_id"] = like_data.comment_id
        target_collection = db.comments
        target_id = like_data.comment_id
        target_type = "comment"

    existing = await db.likes.find_one(like_query)
    if existing:
        await db.likes.delete_one({"_id": existing["_id"]})
        await target_collection.update_one({"_id": ObjectId(target_id)}, {"$inc": {"like_count": -1}})
        return {"liked": False, "message": "Like removed"}

    await db.likes.insert_one(
        {
            "user_id": user["_id"],
            "project_id": like_data.project_id,
            "update_id": like_data.update_id,
            "comment_id": like_data.comment_id,
            "created_at": utc_now_iso(),
        }
    )
    await target_collection.update_one({"_id": ObjectId(target_id)}, {"$inc": {"like_count": 1}})

    target_doc = await target_collection.find_one({"_id": ObjectId(target_id)})
    if target_doc and target_doc.get("user_id") != user["_id"]:
        await email_service.send_notification_email(
            target_doc["user_id"],
            "new_like",
            {"liker_name": user["username"], "content_type": target_type},
        )
        notification_doc = {
            "user_id": target_doc["user_id"],
            "type": "new_like",
            "message": f"@{user['username']} liked your {target_type}",
            "actor_id": user["_id"],
            "reference_id": target_doc.get("project_id") or target_id,
            "route": f"/project/{target_doc.get('project_id') or target_id}",
            "is_read": False,
            "created_at": utc_now_iso(),
        }
        result_notif = await db.notifications.insert_one(notification_doc)
        await manager.send_to_user(target_doc["user_id"], {
            "type": "notification",
            "data": {**notification_doc, "id": str(result_notif.inserted_id)},
        })

    await manager.broadcast(
        {
            "type": "new_like",
            "data": {
                "user_id": user["_id"],
                "username": user["username"],
                "target_type": target_type,
                "target_id": target_id,
            },
        }
    )
    return {"liked": True, "message": "Like added"}


@router.delete("/like")
async def remove_like(like_data: LikeCreate, request: Request):
    user = await get_current_user(request)
    like_query = {"user_id": user["_id"]}
    target_collection = None
    target_id = None

    if like_data.project_id:
        like_query["project_id"] = like_data.project_id
        target_collection = db.projects
        target_id = like_data.project_id
    elif like_data.update_id:
        like_query["update_id"] = like_data.update_id
        target_collection = db.updates
        target_id = like_data.update_id
    elif like_data.comment_id:
        like_query["comment_id"] = like_data.comment_id
        target_collection = db.comments
        target_id = like_data.comment_id

    existing = await db.likes.find_one(like_query)
    if not existing:
        raise HTTPException(status_code=404, detail="Like not found")

    await db.likes.delete_one({"_id": existing["_id"]})
    await target_collection.update_one({"_id": ObjectId(target_id)}, {"$inc": {"like_count": -1}})
    return {"message": "Like removed"}


@router.get("/feed")
async def get_feed(
    request: Request,
    mode: Literal["global", "following"] = Query("global"),
    q: str | None = None,
    sdlc_type: str | None = None,
    current_stage: str | None = None,
    tech_stack: str | None = None,
    owner_username: str | None = None,
):
    current_user = await get_optional_user(request)
    following_ids: list[str] = []
    if mode == "following" and current_user:
        follows = await db.follows.find({"follower_id": current_user["_id"]}).to_list(500)
        following_ids = [follow["following_id"] for follow in follows]
        if not following_ids:
            return []

    project_query: dict = {"hidden": {"$ne": True}}
    if mode == "following":
        project_query["user_id"] = {"$in": following_ids}
    if sdlc_type:
        project_query["sdlc_type"] = sdlc_type
    if current_stage:
        project_query["current_stage"] = current_stage
    if tech_stack and tech_stack.strip():
        project_query["tech_stack"] = {"$elemMatch": {"$regex": tech_stack.strip(), "$options": "i"}}
    if owner_username and owner_username.strip():
        owner_matches = await db.users.find(
            {"username": {"$regex": owner_username.strip(), "$options": "i"}},
            {"_id": 1},
        ).to_list(200)
        owner_ids = [str(user["_id"]) for user in owner_matches]
        project_query["user_id"] = _merge_user_filter(project_query.get("user_id"), owner_ids)

    if q and q.strip():
        pattern = {"$regex": q.strip(), "$options": "i"}
        matching_users = await db.users.find({"username": pattern}, {"_id": 1}).to_list(200)
        project_query["$or"] = [
            {"title": pattern},
            {"description": pattern},
            {"support_needed": pattern},
            {"tech_stack": {"$elemMatch": pattern}},
            {"user_id": {"$in": [str(user["_id"]) for user in matching_users]}} if matching_users else {"title": pattern},
        ]

    projects = await db.projects.find(project_query).sort("created_at", -1).to_list(40)
    visible_project_ids = [str(project["_id"]) for project in projects]

    update_query: dict = {"project_id": {"$in": visible_project_ids}}
    if mode == "following":
        update_query["user_id"] = {"$in": following_ids}
    if q and q.strip():
        update_query["$or"] = [
            {"content": {"$regex": q.strip(), "$options": "i"}},
            {"project_id": {"$in": visible_project_ids}},
        ]
    updates = await db.updates.find(update_query).sort("created_at", -1).to_list(40)

    user_ids = {project["user_id"] for project in projects} | {update["user_id"] for update in updates}
    project_ids = {update["project_id"] for update in updates}

    users = await db.users.find(
        {"_id": {"$in": [ObjectId(user_id_value) for user_id_value in user_ids]}},
        {"_id": 1, "username": 1, "profile_picture_url": 1},
    ).to_list(500)
    user_map = {str(user["_id"]): user for user in users}

    project_docs = await db.projects.find(
        {"_id": {"$in": [ObjectId(project_id) for project_id in project_ids]}, "hidden": {"$ne": True}},
        {"_id": 1, "title": 1},
    ).to_list(500)
    project_map = {str(project["_id"]): project["title"] for project in project_docs}

    liked_project_ids: set[str] = set()
    liked_update_ids: set[str] = set()
    if current_user:
        likes = await db.likes.find({"user_id": current_user["_id"]}).to_list(500)
        for like in likes:
            if like.get("project_id"):
                liked_project_ids.add(like["project_id"])
            if like.get("update_id"):
                liked_update_ids.add(like["update_id"])

    feed_items = []
    for project in projects:
        project_user = user_map.get(project["user_id"], {})
        feed_items.append(
            {
                "type": "project",
                "id": str(project["_id"]),
                "title": project["title"],
                "description": project["description"],
                "stage": project["stage"],
                "tech_stack": project.get("tech_stack", []),
                "support_needed": project.get("support_needed", ""),
                "username": project_user.get("username", "Unknown"),
                "profile_picture_url": project_user.get("profile_picture_url"),
                "user_id": project["user_id"],
                "like_count": project.get("like_count", 0),
                "comment_count": project.get("comment_count", 0),
                "is_liked": str(project["_id"]) in liked_project_ids,
                "created_at": project.get("created_at", ""),
            }
        )
    for update in updates:
        if update["project_id"] not in project_map:
            continue
        update_user = user_map.get(update["user_id"], {})
        feed_items.append(
            {
                "type": "update",
                "id": str(update["_id"]),
                "content": update["content"],
                "project_id": update["project_id"],
                "project_title": project_map.get(update["project_id"], "Unknown Project"),
                "username": update_user.get("username", "Unknown"),
                "profile_picture_url": update_user.get("profile_picture_url"),
                "user_id": update["user_id"],
                "like_count": update.get("like_count", 0),
                "is_liked": str(update["_id"]) in liked_update_ids,
                "created_at": update.get("created_at", ""),
            }
        )

    feed_items.sort(key=lambda item: item.get("created_at", ""), reverse=True)
    return feed_items[:40]


@router.get("/celebration-wall")
async def get_celebration_wall():
    projects = await db.projects.find({"stage": "completed", "hidden": {"$ne": True}}).sort("created_at", -1).to_list(50)
    user_ids = list({project["user_id"] for project in projects})
    users = await db.users.find(
        {"_id": {"$in": [ObjectId(user_id_value) for user_id_value in user_ids]}},
        {"_id": 1, "username": 1, "profile_picture_url": 1},
    ).to_list(500)
    user_map = {str(user["_id"]): user for user in users}

    return [
        {
            "id": str(project["_id"]),
            "title": project["title"],
            "description": project["description"],
            "username": user_map.get(project["user_id"], {}).get("username", "Unknown"),
            "profile_picture_url": user_map.get(project["user_id"], {}).get("profile_picture_url"),
            "user_id": project["user_id"],
            "like_count": project.get("like_count", 0),
            "created_at": project.get("created_at", ""),
        }
        for project in projects
    ]


@router.get("/online-users")
async def get_online_users():
    online_ids = list(manager.online_users)
    if not online_ids:
        return []

    users = await db.users.find(
        {"_id": {"$in": [ObjectId(user_id_value) for user_id_value in online_ids]}},
        {"_id": 1, "username": 1, "profile_picture_url": 1},
    ).to_list(100)
    return [
        {
            "id": str(user["_id"]),
            "username": user["username"],
            "profile_picture_url": user.get("profile_picture_url"),
        }
        for user in users
    ]
