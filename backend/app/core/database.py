from __future__ import annotations

import os
from pathlib import Path

from bson import json_util
from motor.motor_asyncio import AsyncIOMotorClient

from .config import DB_NAME, IS_PRODUCTION, USE_MOCK_DB, logger
from ..utils.common import utc_now_iso

mongo_url = os.environ.get("MONGO_URL")
PERSIST_MOCK_DB = os.environ.get("PERSIST_MOCK_DB", "true" if USE_MOCK_DB else "false").lower() == "true"
MOCK_DB_FILE = Path(
    os.environ.get(
        "MOCK_DB_FILE",
        str(Path(__file__).resolve().parents[3] / "memory" / "mock_db.json"),
    )
)
PERSISTED_COLLECTIONS = (
    "users",
    "login_attempts",
    "projects",
    "updates",
    "comments",
    "collaboration_requests",
    "follows",
    "likes",
    "email_logs",
)

if IS_PRODUCTION and USE_MOCK_DB:
    raise RuntimeError("USE_MOCK_DB must be false in production.")

if IS_PRODUCTION and not mongo_url:
    raise RuntimeError("MONGO_URL must be set in production.")

if USE_MOCK_DB or not mongo_url:
    from mongomock_motor import AsyncMongoMockClient

    client = AsyncMongoMockClient()
    if PERSIST_MOCK_DB:
        logger.warning("Using persisted local mock MongoDB data at %s.", MOCK_DB_FILE)
    else:
        logger.warning("Using in-memory mock MongoDB. Data will reset when the server restarts.")
else:
    client = AsyncIOMotorClient(mongo_url)

db = client[DB_NAME]


async def load_mock_data() -> None:
    """Restore persisted mock data for local development when MongoDB is unavailable."""
    if not (USE_MOCK_DB and PERSIST_MOCK_DB and MOCK_DB_FILE.exists()):
        return

    persisted_data = json_util.loads(MOCK_DB_FILE.read_text(encoding="utf-8"))
    for collection_name in PERSISTED_COLLECTIONS:
        await db[collection_name].delete_many({})
        documents = persisted_data.get(collection_name, [])
        if documents:
            await db[collection_name].insert_many(documents)

    logger.info("Loaded persisted mock data from %s", MOCK_DB_FILE)


async def persist_mock_data() -> None:
    """Persist mock data to disk so local testing survives server restarts."""
    if not (USE_MOCK_DB and PERSIST_MOCK_DB):
        return

    MOCK_DB_FILE.parent.mkdir(parents=True, exist_ok=True)
    persisted_data = {}
    for collection_name in PERSISTED_COLLECTIONS:
        persisted_data[collection_name] = await db[collection_name].find({}).to_list(10000)

    MOCK_DB_FILE.write_text(json_util.dumps(persisted_data, indent=2), encoding="utf-8")
    logger.info("Saved mock data to %s", MOCK_DB_FILE)


async def initialize_database() -> None:
    """Create the indexes used by the live application."""
    await load_mock_data()
    await db.users.create_index("email", unique=True)
    await db.users.create_index("username", unique=True)
    await db.login_attempts.create_index("identifier")
    await db.projects.create_index("user_id")
    await db.projects.create_index("stage")
    await db.updates.create_index("project_id")
    await db.comments.create_index("project_id")
    await db.comments.create_index("parent_id")
    await db.collaboration_requests.create_index("project_id")
    await db.follows.create_index("follower_id")
    await db.follows.create_index("following_id")
    await db.follows.create_index([("follower_id", 1), ("following_id", 1)], unique=True)
    await db.likes.create_index("user_id")
    await db.likes.create_index("project_id")
    await db.likes.create_index("update_id")
    await db.likes.create_index("comment_id")
    await db.email_logs.create_index("sent_at")


async def seed_admin_user() -> None:
    """Seed a local admin account for demos and smoke tests."""
    from ..services.auth import hash_password

    admin_email = os.environ.get("ADMIN_EMAIL", "admin@example.com").lower()
    admin_password = os.environ.get("ADMIN_PASSWORD")
    if not admin_password:
        if IS_PRODUCTION:
            logger.warning("Skipping admin seeding in production because ADMIN_PASSWORD is not set.")
            return
        admin_password = "admin123"

    existing = await db.users.find_one({"email": admin_email})
    if existing is not None:
        return

    await db.users.insert_one(
        {
            "email": admin_email,
            "username": "admin",
            "password_hash": hash_password(admin_password),
            "bio": "Platform administrator",
            "profile_picture_url": None,
            "skills": ["Python", "FastAPI", "MongoDB"],
            "github_url": None,
            "linkedin_url": None,
            "is_online": False,
            "last_seen": None,
            "follower_count": 0,
            "following_count": 0,
            "role": "admin",
            "created_at": utc_now_iso(),
        }
    )
    logger.info("Admin user created: %s", admin_email)


def write_test_credentials() -> None:
    """Optionally write local QA instructions without persisting real secrets to disk."""
    if os.environ.get("WRITE_TEST_CREDENTIALS", "false").lower() != "true":
        return

    admin_email = os.environ.get("ADMIN_EMAIL", "admin@example.com").lower()
    default_memory_dir = Path(__file__).resolve().parents[3] / "memory"
    memory_dir = Path(os.environ.get("MEMORY_DIR", str(default_memory_dir)))
    memory_dir.mkdir(parents=True, exist_ok=True)

    credentials_path = memory_dir / "test_credentials.md"
    credentials_path.write_text(
        "# Local Test Notes\n\n"
        "## Admin Account\n"
        f"- Email: {admin_email}\n"
        "- Password: set locally via `ADMIN_PASSWORD` if you need a seeded admin user\n"
        "- Role: admin\n\n"
        "## Security Note\n"
        "This file intentionally avoids storing plaintext credentials on disk.\n",
        encoding="utf-8",
    )


async def close_database() -> None:
    await persist_mock_data()
    close_fn = getattr(client, "close", None)
    if callable(close_fn):
        close_fn()
