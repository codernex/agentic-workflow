from fastapi import APIRouter

from api.v1.workflows import router as workflows_router
from api.v1.executions import router as executions_router
from api.v1.credentials import router as credentials_router
from api.v1.tools import router as tools_router
from api.v1.websocket import router as websocket_router
from api.v1.auth import router as auth_router
from api.v1.gdpr import router as gdpr_router

api_v1_router = APIRouter(prefix="/api/v1")
api_v1_router.include_router(auth_router)
api_v1_router.include_router(gdpr_router)
api_v1_router.include_router(workflows_router)
api_v1_router.include_router(executions_router)
api_v1_router.include_router(credentials_router)
api_v1_router.include_router(tools_router)
api_v1_router.include_router(websocket_router)
