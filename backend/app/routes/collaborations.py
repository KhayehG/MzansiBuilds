from __future__ import annotations

from bson import ObjectId
from fastapi import APIRouter, HTTPException, Request

from ..core.database import db
from ..services.auth import get_current_user, validate_object_id
from ..services.realtime import manager
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
    collab_notif = {
        "user_id": collab["requester_id"],
        "type": "collaboration_update",
        "message": f"Your collaboration request on \"{project['title']}\" was {status}",
        "actor_id": user["_id"],
        "reference_id": collab["project_id"],
        "route": f"/project/{collab['project_id']}",
        "is_read": False,
        "created_at": utc_now_iso(),
    }
    result_notif = await db.notifications.insert_one(collab_notif)
    await manager.send_to_user(collab["requester_id"], {
        "type": "notification",
        "data": {**collab_notif, "id": str(result_notif.inserted_id)},
    })
    return {"message": f"Collaboration request {status}"}
