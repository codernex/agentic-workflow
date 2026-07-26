from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from db.session import init_db
from api.v1 import api_v1_router
from engine.broadcaster import broadcaster

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup actions
    await init_db()
    yield
    # Shutdown actions
    await broadcaster.close()

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Agentic Workflow Automation Engine API",
    version="0.1.0",
    openapi_url="/openapi.json",
    lifespan=lifespan
)

# Enable CORS for Next.js frontend (apps/web)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_v1_router)

@app.get("/health", tags=["Health"])
async def health_check():
    return {"status": "ok", "service": "engine"}