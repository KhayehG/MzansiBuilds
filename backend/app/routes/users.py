from __future__ import annotations

import re

from bson import ObjectId
from fastapi import APIRouter, HTTPException, Query, Request

from ..core.database import db
from ..models.schemas import UserProfileUpdate
from ..services.auth import get_current_user, get_optional_user, validate_object_id
from ..services.email import email_service
from ..services.realtime import manager
from ..utils.common import clean_text, utc_now_iso

router = APIRouter(prefix="/users", tags=["users"])


@router.get("")
async def list_users(
    q: str | None = None,
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    request: Request = None,
):
    query: dict = {}

    if q and q.strip():
        pattern = {"$regex": re.escape(q.strip()), "$options": "i"}
        query["$or"] = [
            {"username": pattern},
            {"bio": pattern},
            {"skills": pattern},
        ]

    users = await db.users.find(query, {"password_hash": 0}).sort("created_at", -1).skip(offset).limit(limit).to_list(limit)
    if not users:
        return []

    user_ids = [str(user["_id"]) for user in users]
    projects = await db.projects.find({"user_id": {"$in": user_ids}}, {"user_id": 1, "stage": 1}).to_list(1000)

    project_counts = {user_id: 0 for user_id in user_ids}
    completed_counts = {user_id: 0 for user_id in user_ids}
    for project in projects:
        project_user_id = project["user_id"]
        project_counts[project_user_id] = project_counts.get(project_user_id, 0) + 1
        if project.get("stage") == "completed":
            completed_counts[project_user_id] = completed_counts.get(project_user_id, 0) + 1

    current_user = await get_optional_user(request) if request else None
    following_ids: set[str] = set()
    if current_user:
        follows = await db.follows.find(
            {"follower_id": current_user["_id"], "following_id": {"$in": user_ids}}
        ).to_list(limit)
        following_ids = {follow["following_id"] for follow in follows}

    return [
        {
            "id": str(user["_id"]),
            "username": user["username"],
            "bio": user.get("bio", ""),
            "profile_picture_url": user.get("profile_picture_url"),
            "skills": user.get("skills", []),
            "follower_count": user.get("follower_count", 0),
            "following_count": user.get("following_count", 0),
            "project_count": project_counts.get(str(user["_id"]), 0),
            "completed_count": completed_counts.get(str(user["_id"]), 0),
            "is_following": bool(current_user and current_user["_id"] != str(user["_id"]) and str(user["_id"]) in following_ids),
            "created_at": user.get("created_at", ""),
        }
        for user in users
    ]


@router.get("/{user_id}")
async def get_user_profile(user_id: str, request: Request):
    oid = validate_object_id(user_id)
    user = await db.users.find_one({"_id": oid}, {"password_hash": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    projects = await db.projects.find({"user_id": user_id}).to_list(100)
    completed_count = len([project for project in projects if project["stage"] == "completed"])

    current_user = await get_optional_user(request)
    is_self = bool(current_user and current_user["_id"] == user_id)
    is_following = False
    if current_user and not is_self:
        follow = await db.follows.find_one({
            "follower_id": current_user["_id"],
            "following_id": user_id,
        })
        is_following = follow is not None

    profile = {
        "id": user_id,
        "username": user["username"],
        "bio": user.get("bio", ""),
        "profile_picture_url": user.get("profile_picture_url"),
        "skills": user.get("skills", []),
        "github_url": user.get("github_url"),
        "linkedin_url": user.get("linkedin_url"),
        "is_online": manager.is_user_online(user_id),
        "last_seen": user.get("last_seen"),
        "follower_count": user.get("follower_count", 0),
        "following_count": user.get("following_count", 0),
        "project_count": len(projects),
        "completed_count": completed_count,
        "is_following": is_following,
        "created_at": user.get("created_at", ""),
    }
    if is_self:
        profile["email"] = user["email"]

    return profile


@router.put("/me")
async def update_profile(profile_data: UserProfileUpdate, request: Request):
    user = await get_current_user(request)
    update_data: dict = {}

    if profile_data.username:
        username = profile_data.username.strip()
        existing = await db.users.find_one({"username": username, "_id": {"$ne": ObjectId(user["_id"])}})
        if existing:
            raise HTTPException(status_code=400, detail="Username already taken")
        update_data["username"] = username

    if profile_data.bio is not None:
        update_data["bio"] = clean_text(profile_data.bio)
    if profile_data.profile_picture_url is not None:
        update_data["profile_picture_url"] = profile_data.profile_picture_url
    if profile_data.skills is not None:
        update_data["skills"] = profile_data.skills[:10]
    if profile_data.github_url is not None:
        update_data["github_url"] = profile_data.github_url
    if profile_data.linkedin_url is not None:
        update_data["linkedin_url"] = profile_data.linkedin_url
    if update_data:
        update_data["updated_at"] = utc_now_iso()
        await db.users.update_one({"_id": ObjectId(user["_id"])}, {"$set": update_data})

    updated = await db.users.find_one({"_id": ObjectId(user["_id"])})
    return {
        "id": user["_id"],
        "username": updated["username"],
        "email": updated["email"],
        "bio": updated.get("bio", ""),
        "profile_picture_url": updated.get("profile_picture_url"),
        "skills": updated.get("skills", []),
        "github_url": updated.get("github_url"),
        "linkedin_url": updated.get("linkedin_url"),
        "created_at": updated.get("created_at", ""),
    }


@router.post("/{user_id}/follow")
async def follow_user(user_id: str, request: Request):
    current_user = await get_current_user(request)
    if current_user["_id"] == user_id:
        raise HTTPException(status_code=400, detail="Cannot follow yourself")

    target_oid = validate_object_id(user_id)
    target_user = await db.users.find_one({"_id": target_oid})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    existing = await db.follows.find_one({
        "follower_id": current_user["_id"],
        "following_id": user_id,
    })
    if existing:
        raise HTTPException(status_code=400, detail="Already following this user")

    await db.follows.insert_one(
        {
            "follower_id": current_user["_id"],
            "following_id": user_id,
            "created_at": utc_now_iso(),
        }
    )
    await db.users.update_one({"_id": ObjectId(current_user["_id"])}, {"$inc": {"following_count": 1}})
    await db.users.update_one({"_id": target_oid}, {"$inc": {"follower_count": 1}})

    await email_service.send_notification_email(user_id, "new_follower", {"follower_name": current_user["username"]})
    notification_doc = {
        "user_id": user_id,
        "type": "new_follow",
        "message": f"@{current_user['username']} started following you",
        "actor_id": current_user["_id"],
        "is_read": False,
        "created_at": utc_now_iso(),
    }
    result_notif = await db.notifications.insert_one(notification_doc)
    await manager.send_to_user(user_id, {
        "type": "notification",
        "data": {**notification_doc, "id": str(result_notif.inserted_id)},
    })
    await manager.broadcast(
        {
            "type": "new_follow",
            "data": {
                "follower_id": current_user["_id"],
                "follower_username": current_user["username"],
                "following_id": user_id,
            },
        }
    )
    return {"message": f"Now following {target_user['username']}"}


@router.delete("/{user_id}/follow")
async def unfollow_user(user_id: str, request: Request):
    current_user = await get_current_user(request)
    if current_user["_id"] == user_id:
        raise HTTPException(status_code=400, detail="Cannot unfollow yourself")

    target_oid = validate_object_id(user_id)
    existing = await db.follows.find_one({
        "follower_id": current_user["_id"],
        "following_id": user_id,
    })
    if not existing:
        raise HTTPException(status_code=400, detail="Not following this user")

    await db.follows.delete_one({"_id": existing["_id"]})
    await db.users.update_one({"_id": ObjectId(current_user["_id"])}, {"$inc": {"following_count": -1}})
    await db.users.update_one({"_id": target_oid}, {"$inc": {"follower_count": -1}})
    return {"message": "Unfollowed successfully"}


@router.get("/{user_id}/followers")
async def get_followers(user_id: str, request: Request, skip: int = 0, limit: int = 20):
    validate_object_id(user_id)
    follows = await db.follows.find({"following_id": user_id}).skip(skip).limit(limit).to_list(limit)
    follower_ids = [follow["follower_id"] for follow in follows]

    users = await db.users.find(
        {"_id": {"$in": [ObjectId(user_id_value) for user_id_value in follower_ids]}},
        {"_id": 1, "username": 1, "bio": 1, "profile_picture_url": 1},
    ).to_list(500)
    user_map = {str(user["_id"]): user for user in users}

    current_user = await get_optional_user(request)
    my_following_ids: set[str] = set()
    if current_user:
        my_follows = await db.follows.find({"follower_id": current_user["_id"]}).to_list(500)
        my_following_ids = {f["following_id"] for f in my_follows}

    return [
        {
            "id": follow["follower_id"],
            "username": user_map[follow["follower_id"]]["username"],
            "bio": user_map[follow["follower_id"]].get("bio", ""),
            "profile_picture_url": user_map[follow["follower_id"]].get("profile_picture_url"),
            "followed_at": follow.get("created_at", ""),
            "is_following": follow["follower_id"] in my_following_ids,
        }
        for follow in follows
        if follow["follower_id"] in user_map
    ]


@router.get("/{user_id}/following")
async def get_following(user_id: str, skip: int = 0, limit: int = 20):
    validate_object_id(user_id)
    follows = await db.follows.find({"follower_id": user_id}).skip(skip).limit(limit).to_list(limit)
    following_ids = [follow["following_id"] for follow in follows]

    users = await db.users.find(
        {"_id": {"$in": [ObjectId(user_id_value) for user_id_value in following_ids]}},
        {"_id": 1, "username": 1, "bio": 1, "profile_picture_url": 1},
    ).to_list(500)
    user_map = {str(user["_id"]): user for user in users}

    return [
        {
            "id": follow["following_id"],
            "username": user_map[follow["following_id"]]["username"],
            "bio": user_map[follow["following_id"]].get("bio", ""),
            "profile_picture_url": user_map[follow["following_id"]].get("profile_picture_url"),
            "followed_at": follow.get("created_at", ""),
        }
        for follow in follows
        if follow["following_id"] in user_map
    ]
