from __future__ import annotations

from bson import ObjectId
from fastapi import APIRouter, Query, Request

from ..core.database import db
from ..services.auth import get_current_user

router = APIRouter(prefix="/collaborations", tags=["collaborations"])


@router.get("/inbox")
async def get_collaboration_inbox(
    request: Request,
    status: str | None = Query(None, regex="^(pending|accepted|rejected)?$"),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    """
    Get all collaboration requests made by the current user (outbound inbox).
    Shows pending, accepted, and rejected collaboration requests across all projects.
    """
    user = await get_current_user(request)
    user_id = str(user["_id"])

    query = {"requester_id": user_id}
    if status:
        query["status"] = status

    total = await db.collaboration_requests.count_documents(query)
    requests = await db.collaboration_requests.find(query).sort("created_at", -1).skip(offset).limit(limit).to_list(limit)

    # Enrich with project and owner details
    enriched = []
    for req in requests:
        req["_id"] = str(req["_id"])
        
        # Get project details
        project = await db.projects.find_one({"_id": ObjectId(req["project_id"])})
        if project:
            req["project"] = {
                "id": str(project["_id"]),
                "title": project["title"],
                "stage": project.get("stage"),
            }

            # Get project owner details
            owner = await db.users.find_one({"_id": ObjectId(project["user_id"])})
            if owner:
                req["project_owner"] = {
                    "id": str(owner["_id"]),
                    "username": owner["username"],
                }

        enriched.append(req)

    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "requests": enriched,
    }


@router.get("/requests-received")
async def get_collaboration_requests_received(
    request: Request,
    status: str | None = Query(None, regex="^(pending|accepted|rejected)?$"),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    """
    Get all collaboration requests received for the current user's projects (inbound).
    Requires authentication.
    """
    user = await get_current_user(request)
    user_id = str(user["_id"])

    # Find all projects owned by the user
    user_projects = await db.projects.find({"user_id": user_id}).to_list(10000)
    project_ids = [str(p["_id"]) for p in user_projects]

    query = {"project_id": {"$in": project_ids}}
    if status:
        query["status"] = status

    total = await db.collaboration_requests.count_documents(query)
    requests = await db.collaboration_requests.find(query).sort("created_at", -1).skip(offset).limit(limit).to_list(limit)

    # Enrich with requester and project details
    enriched = []
    for req in requests:
        req["_id"] = str(req["_id"])
        
        # Get requester details
        requester = await db.users.find_one({"_id": ObjectId(req["requester_id"])})
        if requester:
            req["requester"] = {
                "id": str(requester["_id"]),
                "username": requester["username"],
            }

        # Get project details
        project = await db.projects.find_one({"_id": ObjectId(req["project_id"])})
        if project:
            req["project"] = {
                "id": str(project["_id"]),
                "title": project["title"],
            }

        enriched.append(req)

    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "requests": enriched,
    }
