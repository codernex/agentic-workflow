from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Request, BackgroundTasks, status, Header, Query
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from config import settings
from core.limiter import limiter
from db.session import get_async_session, async_session_maker
from models.workflow import Workflow, WorkflowCreate, WorkflowUpdate, WorkflowRead, generate_webhook_secret
from models.execution import WorkflowRun, WorkflowRunRead, ExecutionStatus
from models.user import User
from engine.executor import WorkflowExecutor

router = APIRouter(prefix="/workflows", tags=["Workflows"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/auth/login", auto_error=False)

async def get_optional_current_user(
    token: Optional[str] = Depends(oauth2_scheme),
    session: AsyncSession = Depends(get_async_session)
) -> Optional[User]:
    if not token:
        return None
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id:
            return await session.get(User, user_id)
    except JWTError:
        pass
    return None

def verify_trigger_permission(
    workflow: Workflow,
    current_user: Optional[User],
    secret_param: Optional[str],
    x_webhook_secret: Optional[str],
    authorization: Optional[str]
):
    """Verifies that execution was triggered by owner JWT or valid Webhook Secret Token."""
    if current_user and (not workflow.user_id or workflow.user_id == current_user.id):
        return True

    given_secret = secret_param or x_webhook_secret
    if not given_secret and authorization:
        if authorization.lower().startswith("bearer "):
            given_secret = authorization[7:].strip()
        else:
            given_secret = authorization.strip()

    if given_secret and given_secret == workflow.webhook_secret:
        return True

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Unauthorized trigger attempt. Invalid or missing webhook secret. Provide 'X-Webhook-Secret' header or '?secret=' parameter."
    )

async def _run_executor_task(workflow_run_id: str):
    """Background task to instantiate and execute a workflow run."""
    async with async_session_maker() as session:
        executor = WorkflowExecutor(session, workflow_run_id)
        await executor.execute()

@router.post("/", response_model=WorkflowRead, status_code=status.HTTP_201_CREATED)
async def create_workflow(
    workflow_in: WorkflowCreate,
    session: AsyncSession = Depends(get_async_session),
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    workflow = Workflow.model_validate(workflow_in)
    if current_user:
        workflow.user_id = current_user.id
    if not workflow.webhook_secret:
        workflow.webhook_secret = generate_webhook_secret()
    session.add(workflow)
    await session.commit()
    await session.refresh(workflow)
    return workflow

@router.get("/", response_model=List[WorkflowRead])
async def list_workflows(
    session: AsyncSession = Depends(get_async_session),
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    statement = select(Workflow).order_by(Workflow.created_at.desc())
    if current_user:
        statement = statement.where((Workflow.user_id == current_user.id) | (Workflow.user_id == None))
    result = await session.exec(statement)
    return result.all()

@router.get("/{workflow_id}", response_model=WorkflowRead)
async def get_workflow(
    workflow_id: str,
    session: AsyncSession = Depends(get_async_session),
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    workflow = await session.get(Workflow, workflow_id)
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    if current_user and workflow.user_id and workflow.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied. Cannot view workflow owned by another user.")
    return workflow

@router.put("/{workflow_id}", response_model=WorkflowRead)
async def update_workflow(
    workflow_id: str,
    workflow_in: WorkflowUpdate,
    session: AsyncSession = Depends(get_async_session),
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    workflow = await session.get(Workflow, workflow_id)
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    if current_user and workflow.user_id and workflow.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied. Cannot edit workflow owned by another user.")

    update_data = workflow_in.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(workflow, key, value)
    
    session.add(workflow)
    await session.commit()
    await session.refresh(workflow)
    return workflow

@router.delete("/{workflow_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_workflow(
    workflow_id: str,
    session: AsyncSession = Depends(get_async_session),
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    workflow = await session.get(Workflow, workflow_id)
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    if current_user and workflow.user_id and workflow.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied. Cannot delete workflow owned by another user.")

    await session.delete(workflow)
    await session.commit()

@router.post("/{workflow_id}/regenerate-secret", response_model=WorkflowRead)
async def regenerate_webhook_secret(
    workflow_id: str,
    session: AsyncSession = Depends(get_async_session),
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    """Regenerates a fresh webhook secret token for the workflow."""
    workflow = await session.get(Workflow, workflow_id)
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    if current_user and workflow.user_id and workflow.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied.")

    workflow.webhook_secret = generate_webhook_secret()
    session.add(workflow)
    await session.commit()
    await session.refresh(workflow)
    return workflow

@router.post("/{workflow_id}/execute", response_model=WorkflowRunRead)
@limiter.limit(settings.EXECUTION_RATE_LIMIT)
async def execute_workflow(
    request: Request,
    workflow_id: str,
    background_tasks: BackgroundTasks,
    payload: Dict[str, Any] = {},
    secret: Optional[str] = Query(None),
    x_webhook_secret: Optional[str] = Header(None),
    authorization: Optional[str] = Header(None),
    session: AsyncSession = Depends(get_async_session),
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    workflow = await session.get(Workflow, workflow_id)
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")

    verify_trigger_permission(workflow, current_user, secret, x_webhook_secret, authorization)

    workflow_run = WorkflowRun(
        workflow_id=workflow_id,
        status=ExecutionStatus.PENDING,
        trigger_type="manual",
        input_data=payload
    )
    session.add(workflow_run)
    await session.commit()
    await session.refresh(workflow_run)

    background_tasks.add_task(_run_executor_task, workflow_run.id)
    return workflow_run

@router.post("/webhooks/{workflow_id}", response_model=WorkflowRunRead)
@router.post("/{workflow_id}/webhook", response_model=WorkflowRunRead)
@limiter.limit(settings.WEBHOOK_RATE_LIMIT)
async def handle_webhook_trigger(
    request: Request,
    workflow_id: str,
    background_tasks: BackgroundTasks,
    payload: Dict[str, Any] = {},
    secret: Optional[str] = Query(None),
    x_webhook_secret: Optional[str] = Header(None),
    authorization: Optional[str] = Header(None),
    session: AsyncSession = Depends(get_async_session),
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    workflow = await session.get(Workflow, workflow_id)
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")

    verify_trigger_permission(workflow, current_user, secret, x_webhook_secret, authorization)

    workflow_run = WorkflowRun(
        workflow_id=workflow_id,
        status=ExecutionStatus.PENDING,
        trigger_type="webhook",
        input_data=payload
    )
    session.add(workflow_run)
    await session.commit()
    await session.refresh(workflow_run)

    background_tasks.add_task(_run_executor_task, workflow_run.id)
    return workflow_run
