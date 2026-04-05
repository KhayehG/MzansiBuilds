from __future__ import annotations

import os
import time
from datetime import datetime, timedelta, timezone

import cloudinary.utils
import jwt
from bson import ObjectId
from fastapi import APIRouter, HTTPException, Query, Request, Response

from ..core.config import CLOUDINARY_CONFIGURED, JWT_ALGORITHM, get_cookie_settings, get_jwt_secret
from ..core.database import db
from ..models.schemas import UserCreate, UserLogin
from ..services.auth import (
    clear_auth_cookies,
    create_access_token,
    create_refresh_token,
    get_current_user,
    hash_password,
    set_auth_cookies,
    verify_password,
)
from ..utils.common import clean_text, utc_now_iso

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register")
async def register(user_data: UserCreate, response: Response):
    email = user_data.email.lower().strip()
    username = user_data.username.strip()

    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already registered")
    if await db.users.find_one({"username": username}):
        raise HTTPException(status_code=400, detail="Username already taken")

    user_doc = {
        "email": email,
        "username": username,
        "password_hash": hash_password(user_data.password),
        "bio": clean_text(user_data.bio),
        "profile_picture_url": None,
        "skills": [],
        "github_url": None,
        "linkedin_url": None,
        "is_online": False,
        "last_seen": None,
        "follower_count": 0,
        "following_count": 0,
        "created_at": utc_now_iso(),
    }
    result = await db.users.insert_one(user_doc)
    user_id = str(result.inserted_id)

    access_token = create_access_token(user_id, email)
    refresh_token = create_refresh_token(user_id)
    set_auth_cookies(response, access_token, refresh_token)

    return {
        "id": user_id,
        "email": email,
        "username": username,
        "bio": user_doc["bio"],
        "created_at": user_doc["created_at"],
    }


@router.post("/login")
async def login(user_data: UserLogin, response: Response, request: Request):
    email = user_data.email.lower().strip()
    ip = request.client.host if request.client else "unknown"
    identifier = f"{ip}:{email}"

    attempts = await db.login_attempts.find_one({"identifier": identifier})
    if attempts and attempts.get("count", 0) >= 5:
        lockout_time = attempts.get("last_attempt")
        if lockout_time:
            lockout_dt = datetime.fromisoformat(lockout_time) if isinstance(lockout_time, str) else lockout_time
            if datetime.now(timezone.utc) - lockout_dt < timedelta(minutes=15):
                raise HTTPException(status_code=429, detail="Too many login attempts. Please try again later.")

    user = await db.users.find_one({"email": email})
    if not user or not verify_password(user_data.password, user["password_hash"]):
        await db.login_attempts.update_one(
            {"identifier": identifier},
            {"$inc": {"count": 1}, "$set": {"last_attempt": utc_now_iso()}},
            upsert=True,
        )
        raise HTTPException(status_code=401, detail="Invalid email or password")

    await db.login_attempts.delete_one({"identifier": identifier})

    user_id = str(user["_id"])
    access_token = create_access_token(user_id, email)
    refresh_token = create_refresh_token(user_id)
    set_auth_cookies(response, access_token, refresh_token)

    return {
        "id": user_id,
        "email": user["email"],
        "username": user["username"],
        "bio": user.get("bio", ""),
        "created_at": user.get("created_at", ""),
    }


@router.post("/logout")
async def logout(response: Response):
    clear_auth_cookies(response)
    return {"message": "Logged out successfully"}


@router.get("/me")
async def get_me(request: Request):
    user = await get_current_user(request)
    return {
        "id": user["_id"],
        "email": user["email"],
        "username": user["username"],
        "bio": user.get("bio", ""),
        "profile_picture_url": user.get("profile_picture_url"),
        "skills": user.get("skills", []),
        "github_url": user.get("github_url"),
        "linkedin_url": user.get("linkedin_url"),
        "follower_count": user.get("follower_count", 0),
        "following_count": user.get("following_count", 0),
        "created_at": user.get("created_at", ""),
    }


@router.post("/refresh")
async def refresh_token(request: Request, response: Response):
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status_code=401, detail="No refresh token")

    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")

        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")

        access_token = create_access_token(str(user["_id"]), user["email"])
        response.set_cookie(key="access_token", value=access_token, **{**get_cookie_settings(), "max_age": 3600})
        return {"message": "Token refreshed"}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Refresh token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")


@router.get("/cloudinary/signature")
async def generate_cloudinary_signature(
    request: Request,
    resource_type: str = Query("image", enum=["image"]),
    folder: str = Query("users"),
):
    await get_current_user(request)

    if not CLOUDINARY_CONFIGURED:
        raise HTTPException(status_code=503, detail="Image upload service not configured")

    allowed_folders = ("users/", "users")
    if not folder.startswith(allowed_folders):
        raise HTTPException(status_code=400, detail="Invalid folder path")

    timestamp = int(time.time())
    params = {"timestamp": timestamp, "folder": folder, "resource_type": resource_type}
    signature = cloudinary.utils.api_sign_request(params, os.environ.get("CLOUDINARY_API_SECRET"))

    return {
        "signature": signature,
        "timestamp": timestamp,
        "cloud_name": os.environ.get("CLOUDINARY_CLOUD_NAME"),
        "api_key": os.environ.get("CLOUDINARY_API_KEY"),
        "folder": folder,
        "resource_type": resource_type,
    }
