from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from db.session import get_async_session
from models.tool import CustomTool, CustomToolCreate, CustomToolRead

router = APIRouter(prefix="/tools", tags=["Tools"])

BUILTIN_TOOLS = [
    {
        "id": "trigger_manual",
        "name": "Manual Trigger",
        "type": "trigger",
        "description": "Initial trigger node for manual or API payload workflow invocation."
    },
    {
        "id": "trigger_webhook",
        "name": "Webhook Trigger",
        "type": "webhook",
        "description": "Triggers execution upon receiving an inbound HTTP webhook POST."
    },
    {
        "id": "trigger_cron",
        "name": "Cron Scheduler",
        "type": "cron",
        "description": "Periodic UTC time-based trigger execution."
    },
    {
        "id": "agent_smolagents",
        "name": "AI Agent Node (smolagents)",
        "type": "agent",
        "description": "Dynamic reasoning agent execution loop using smolagents (Thought -> Action -> Observation)."
    },
    {
        "id": "code_python",
        "name": "Python Code Execution",
        "type": "code",
        "description": "Executes dynamic inline Python code block with access to parent node outputs."
    },
    {
        "id": "logger_node",
        "name": "Step Result Logger",
        "type": "logger",
        "description": "Captures, formats, and logs output results from all previous step calls."
    },
    {
        "id": "condition_node",
        "name": "Conditional Router",
        "type": "condition",
        "description": "Evaluates boolean conditions and routes workflow graph execution."
    },
    {
        "id": "filter_node",
        "name": "Data Filter & Mapper",
        "type": "filter",
        "description": "Transforms and projects nested JSON payloads."
    },
    {
        "id": "http_request",
        "name": "HTTP Request Node",
        "type": "http_request",
        "description": "Performs async REST HTTP requests (GET, POST, PUT, DELETE)."
    },
    {
        "id": "email_node",
        "name": "Email Notification",
        "type": "email",
        "description": "Dispatches email alert notifications to external channels."
    }
]

@router.get("/builtin", response_model=List[Dict[str, Any]])
async def get_builtin_tools():
    return BUILTIN_TOOLS

@router.post("/custom", response_model=CustomToolRead, status_code=status.HTTP_201_CREATED)
async def create_custom_tool(
    tool_in: CustomToolCreate,
    session: AsyncSession = Depends(get_async_session)
):
    tool = CustomTool.model_validate(tool_in)
    session.add(tool)
    await session.commit()
    await session.refresh(tool)
    return tool

@router.get("/custom", response_model=List[CustomToolRead])
async def list_custom_tools(
    session: AsyncSession = Depends(get_async_session)
):
    statement = select(CustomTool).order_by(CustomTool.created_at.desc())
    result = await session.exec(statement)
    return result.all()
