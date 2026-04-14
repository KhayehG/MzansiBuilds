from fastapi import APIRouter, HTTPException, Request

from ..core.database import db
from ..services.auth import get_current_user

from ..services.realtime import manager

router = APIRouter(tags=["system"])


@router.get("/")
async def root():
    return {"message": "MzansiBuilds API is running"}


@router.get("/health")
async def health():
    return {"status": "healthy", "online_users": len(manager.online_users)}


@router.get("/admin/overview")
async def admin_overview(request: Request):
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    pending_reports = await db.reports.count_documents({"status": "pending"})
    under_review_reports = await db.reports.count_documents({"status": "under_review"})
    hidden_projects = await db.projects.count_documents({"hidden": True})
    hidden_comments = await db.comments.count_documents({"hidden": True})
    suspended_users = await db.users.count_documents({"is_suspended": True})
    total_users = await db.users.count_documents({})
    total_projects = await db.projects.count_documents({})

    return {
        "pending_reports": pending_reports,
        "under_review_reports": under_review_reports,
        "hidden_projects": hidden_projects,
        "hidden_comments": hidden_comments,
        "suspended_users": suspended_users,
        "total_users": total_users,
        "total_projects": total_projects,
        "online_users": len(manager.online_users),
    }
