from __future__ import annotations

from bson import ObjectId
from fastapi import APIRouter, HTTPException, Query, Request

from ..core.database import db
from ..services.auth import get_current_user
from ..utils.common import utc_now_iso

router = APIRouter(prefix="/reports", tags=["reports"])

# Auto-flag threshold: when this many distinct users report the same item it moves to under_review
AUTO_FLAG_THRESHOLD = 5


@router.post("")
async def create_report(
    request: Request,
    report_type: str = Query(..., pattern="^(project|user|comment|system)$"),
    reason: str = Query(...),
    description: str = Query(""),
    reported_item_id: str | None = Query(None),
    reported_user_id: str | None = Query(None),
):
    """Submit a content or user report of any type."""
    user = await get_current_user(request)
    user_id = str(user["_id"])

    if report_type in ("project", "comment") and not reported_item_id:
        raise HTTPException(status_code=400, detail="reported_item_id required for project/comment reports")
    if report_type == "user" and not reported_user_id:
        raise HTTPException(status_code=400, detail="reported_user_id required for user reports")

    # Prevent self-reports
    if report_type == "user" and reported_user_id == user_id:
        raise HTTPException(status_code=400, detail="Cannot report yourself")

    # Build correct duplicate-check query per type
    if report_type == "user":
        dup_query = {
            "reported_by_user_id": user_id,
            "report_type": "user",
            "reported_user_id": reported_user_id,
        }
    else:
        dup_query = {
            "reported_by_user_id": user_id,
            "report_type": report_type,
            "reported_item_id": reported_item_id,
        }

    existing = await db.reports.find_one(dup_query)
    if existing and existing.get("status") in ("pending", "under_review"):
        raise HTTPException(status_code=400, detail="You have already reported this item")

    report = {
        "report_type": report_type,
        "reason": reason,
        "description": description,
        "reported_item_id": reported_item_id,
        "reported_user_id": reported_user_id,
        "reported_by_user_id": user_id,
        "status": "pending",
        "created_at": utc_now_iso(),
        "updated_at": utc_now_iso(),
        "admin_notes": "",
    }

    result = await db.reports.insert_one(report)
    report["_id"] = str(result.inserted_id)

    # Auto-flagging: if this item now has >= AUTO_FLAG_THRESHOLD distinct reporters, escalate all pending to under_review
    if report_type == "user":
        count_query = {"report_type": "user", "reported_user_id": reported_user_id}
    elif report_type == "system":
        count_query = {"report_type": "system"}
    else:
        count_query = {"report_type": report_type, "reported_item_id": reported_item_id}

    distinct_reporters = await db.reports.distinct("reported_by_user_id", count_query)
    if len(distinct_reporters) >= AUTO_FLAG_THRESHOLD:
        await db.reports.update_many(
            {**count_query, "status": "pending"},
            {"$set": {"status": "under_review", "updated_at": utc_now_iso()}},
        )

    return report


@router.get("/admin/all")
async def get_all_reports(
    request: Request,
    status: str | None = Query(None),
    report_type: str | None = Query(None),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    """Fetch all reports (admin only)."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    query = {}
    if status:
        query["status"] = status
    if report_type:
        query["report_type"] = report_type

    total = await db.reports.count_documents(query)
    reports = await db.reports.find(query).sort("created_at", -1).skip(offset).limit(limit).to_list(limit)

    # Enrich with reported user/item details
    enriched = []
    for report in reports:
        report["_id"] = str(report["_id"])
        reporter = await db.users.find_one(
            {"_id": ObjectId(report["reported_by_user_id"])} if report.get("reported_by_user_id") else {"_id": None},
            {"username": 1, "profile_picture_url": 1},
        )
        report["reported_by_user"] = (
            {
                "id": str(reporter["_id"]),
                "username": reporter["username"],
                "profile_picture_url": reporter.get("profile_picture_url"),
            }
            if reporter
            else None
        )
        if report.get("reported_user_id"):
            reported_user = await db.users.find_one(
                {"_id": ObjectId(report["reported_user_id"])},
                {"username": 1, "profile_picture_url": 1},
            )
            report["reported_user"] = {
                "id": str(reported_user["_id"]),
                "username": reported_user["username"],
                "profile_picture_url": reported_user.get("profile_picture_url"),
            } if reported_user else None
        if report.get("report_type") == "project" and report.get("reported_item_id"):
            project = await db.projects.find_one(
                {"_id": ObjectId(report["reported_item_id"])},
                {"title": 1, "description": 1, "user_id": 1, "hidden": 1},
            )
            report["reported_project"] = (
                {
                    "id": str(project["_id"]),
                    "title": project.get("title", "Untitled project"),
                    "description": project.get("description", ""),
                    "user_id": project.get("user_id"),
                    "hidden": project.get("hidden", False),
                }
                if project
                else None
            )
        if report.get("report_type") == "comment" and report.get("reported_item_id"):
            comment = await db.comments.find_one(
                {"_id": ObjectId(report["reported_item_id"])},
                {"content": 1, "project_id": 1, "user_id": 1, "hidden": 1},
            )
            report["reported_comment"] = (
                {
                    "id": str(comment["_id"]),
                    "content": comment.get("content", ""),
                    "project_id": comment.get("project_id"),
                    "user_id": comment.get("user_id"),
                    "hidden": comment.get("hidden", False),
                }
                if comment
                else None
            )
        enriched.append(report)

    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "reports": enriched,
    }


@router.put("/admin/{report_id}")
async def update_report_status(
    request: Request,
    report_id: str,
    status: str = Query(..., pattern="^(pending|under_review|resolved|dismissed)$"),
    admin_notes: str = Query(""),
):
    """Update report status and add admin notes (admin only)."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    try:
        result = await db.reports.update_one(
            {"_id": ObjectId(report_id)},
            {
                "$set": {
                    "status": status,
                    "admin_notes": admin_notes,
                    "updated_at": utc_now_iso(),
                }
            },
        )
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Report not found")
        
        updated_report = await db.reports.find_one({"_id": ObjectId(report_id)})
        updated_report["_id"] = str(updated_report["_id"])
        return updated_report
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/admin/{report_id}/hide-content")
async def hide_reported_content(
    request: Request,
    report_id: str,
):
    """Hide the reported content (mark as soft-deleted, admin only)."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    try:
        report = await db.reports.find_one({"_id": ObjectId(report_id)})
        if not report:
            raise HTTPException(status_code=404, detail="Report not found")

        if report.get("report_type") == "project":
            await db.projects.update_one(
                {"_id": ObjectId(report["reported_item_id"])},
                {"$set": {"hidden": True, "hidden_at": utc_now_iso(), "hidden_reason": report.get("reason")}},
            )
        elif report.get("report_type") == "comment":
            await db.comments.update_one(
                {"_id": ObjectId(report["reported_item_id"])},
                {"$set": {"hidden": True, "hidden_at": utc_now_iso(), "hidden_reason": report.get("reason")}},
            )

        await db.reports.update_one(
            {"_id": ObjectId(report_id)},
            {"$set": {"status": "resolved", "updated_at": utc_now_iso()}},
        )

        return {"message": f"Content hidden due to report {report_id}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
