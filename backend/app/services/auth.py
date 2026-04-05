from __future__ import annotations

from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from bson import ObjectId
from bson.errors import InvalidId
from fastapi import HTTPException, Request, Response

from ..core.config import JWT_ALGORITHM, get_cookie_settings, get_jwt_secret
from ..core.database import db


def validate_object_id(id_str: str) -> ObjectId:
    try:
        return ObjectId(id_str)
    except (InvalidId, TypeError):
        raise HTTPException(status_code=404, detail="Invalid ID format")


def hash_password(password: str) -> str:
    """Passwords are stored as bcrypt hashes only."""
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))


def create_access_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=60),
        "type": "access",
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


def create_refresh_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
        "type": "refresh",
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


def set_auth_cookies(response: Response, access_token: str, refresh_token: str) -> None:
    access_cookie_settings = {**get_cookie_settings(), "max_age": 3600}
    refresh_cookie_settings = {**get_cookie_settings(), "max_age": 604800}
    response.set_cookie(key="access_token", value=access_token, **access_cookie_settings)
    response.set_cookie(key="refresh_token", value=refresh_token, **refresh_cookie_settings)


def clear_auth_cookies(response: Response) -> None:
    cookie_settings = get_cookie_settings()
    for cookie_name in ("access_token", "refresh_token"):
        response.delete_cookie(
            key=cookie_name,
            path=cookie_settings.get("path", "/"),
            domain=cookie_settings.get("domain"),
            secure=cookie_settings.get("secure", False),
            httponly=True,
            samesite=cookie_settings.get("samesite", "lax"),
        )


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]

    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")

        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")

        user["_id"] = str(user["_id"])
        user.pop("password_hash", None)
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


async def get_optional_user(request: Request) -> dict | None:
    try:
        return await get_current_user(request)
    except HTTPException:
        return None
