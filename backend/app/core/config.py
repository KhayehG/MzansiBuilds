from __future__ import annotations

import logging
import os

import cloudinary
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("mzansibuilds")

APP_ENV = os.environ.get("APP_ENV", os.environ.get("ENVIRONMENT", "development")).lower()
IS_PRODUCTION = APP_ENV in {"production", "staging"}
USE_MOCK_DB = os.environ.get("USE_MOCK_DB", "false").lower() == "true"
DB_NAME = os.environ.get("DB_NAME", "mzansibuilds")
JWT_ALGORITHM = "HS256"


def get_jwt_secret() -> str:
    """Return the configured JWT secret, with a safe local fallback."""
    secret = os.environ.get("JWT_SECRET")
    if secret:
        return secret
    if IS_PRODUCTION:
        raise RuntimeError("JWT_SECRET environment variable must be set in production.")

    fallback_secret = "development-only-jwt-secret-change-me"
    logger.warning("JWT_SECRET is not set. Using a development fallback secret.")
    return fallback_secret


def get_cookie_settings() -> dict:
    """Centralize auth cookie security configuration."""
    same_site = os.environ.get("COOKIE_SAMESITE", "none" if IS_PRODUCTION else "lax").lower()
    secure_override = os.environ.get("COOKIE_SECURE")
    secure = (secure_override.lower() == "true") if secure_override is not None else IS_PRODUCTION

    if same_site == "none":
        secure = True

    cookie_settings = {
        "httponly": True,
        "secure": secure,
        "samesite": same_site,
        "path": "/",
    }

    cookie_domain = os.environ.get("COOKIE_DOMAIN")
    if cookie_domain:
        cookie_settings["domain"] = cookie_domain

    return cookie_settings


def get_allowed_origins() -> list[str]:
    cors_origins = os.environ.get("CORS_ORIGINS", "")
    frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:3000").strip()

    allowed_origins: list[str] = []
    if cors_origins:
        allowed_origins.extend(
            origin.strip().rstrip("/")
            for origin in cors_origins.split(",")
            if origin.strip()
        )

    if frontend_url:
        allowed_origins.append(frontend_url.rstrip("/"))

    allowed_origins.extend([
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
        "http://0.0.0.0:3000",
        "http://0.0.0.0:3001",
    ])

    return list(dict.fromkeys(allowed_origins))


allowed_origins = get_allowed_origins()
allow_origin_regex = os.environ.get("CORS_ORIGIN_REGEX")
if not allow_origin_regex:
    local_network_regex = (
        r"^https?://(localhost|127\.0\.0\.1|0\.0\.0\.0|"
        r"10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|"
        r"172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})(:\d+)?$"
    )
    allow_origin_regex = local_network_regex
    if os.environ.get("ALLOW_VERCEL_PREVIEW", "true").lower() == "true":
        allow_origin_regex = f"{local_network_regex}|https://.*\\.vercel\\.app"

if os.environ.get("CLOUDINARY_CLOUD_NAME"):
    cloudinary.config(
        cloud_name=os.environ.get("CLOUDINARY_CLOUD_NAME"),
        api_key=os.environ.get("CLOUDINARY_API_KEY"),
        api_secret=os.environ.get("CLOUDINARY_API_SECRET"),
        secure=True,
    )
    CLOUDINARY_CONFIGURED = True
else:
    CLOUDINARY_CONFIGURED = False
    logger.warning("Cloudinary not configured - profile picture uploads disabled")
