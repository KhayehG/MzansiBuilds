from fastapi import APIRouter

from ..services.realtime import manager

router = APIRouter(tags=["system"])


@router.get("/")
async def root():
    return {"message": "MzansiBuilds API is running"}


@router.get("/health")
async def health():
    return {"status": "healthy", "online_users": len(manager.online_users)}
