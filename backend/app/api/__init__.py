from fastapi import APIRouter
from app.api.workflows import router as workflows_router

api_router = APIRouter()
api_router.include_router(workflows_router, prefix="/workflows", tags=["Workflows"])
