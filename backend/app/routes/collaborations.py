from __future__ import annotations

from bson import ObjectId
from fastapi import APIRouter, HTTPException, Request

from ..core.database import db
from ..services.auth import get_current_user, validate_object_id
from ..utils.common import utc_now_iso

router = APIRouter(prefix="/collaborations", tags=["collaborations"])


@router.put("/{collab_id}")
async def update_collaboration_status(collab_id: str, status: str, request: Request):
    user = await get_current_user(request)
    oid = validate_object_id(collab_id)
    collab = await db.collaboration_requests.find_one({"_id": oid})
    if not collab:
        raise HTTPException(status_code=404, detail="Collaboration request not found")

    project = await db.projects.find_one({"_id": ObjectId(collab["project_id"])})
    if not project or project["user_id"] != user["_id"]:
        raise HTTPException(status_code=403, detail="Only project owner can update collaboration status")
    if status not in ["accepted", "rejected"]:
        raise HTTPException(status_code=400, detail="Status must be 'accepted' or 'rejected'")

    await db.collaboration_requests.update_one(
        {"_id": oid},
        {"$set": {"status": status, "updated_at": utc_now_iso()}},
    )
    return {"message": f"Collaboration request {status}"}
