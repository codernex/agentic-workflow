from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from config import settings
from db.session import get_async_session, async_session_maker
from models.workflow import Workflow, WorkflowCreate, WorkflowUpdate, WorkflowRead
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

async def _run_executor_task(run_id: str):
    async with async_session_maker() as session:
        executor = WorkflowExecutor(session, run_id)
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
    session.add(workflow)
    await session.commit()
    await session.refresh(workflow)
    return workflow

@router.get("/", response_model=List[WorkflowRead])
async def list_workflows(
    session: AsyncSession = Depends(get_async_session),
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    statement = select(Workflow)
    if current_user:
        statement = statement.where((Workflow.user_id == current_user.id) | (Workflow.user_id == None))
    statement = statement.order_by(Workflow.updated_at.desc())
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
        raise HTTPException(status_code=403, detail="Access denied. Workflow belongs to another user.")
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
        raise HTTPException(status_code=403, detail="Access denied. Cannot modify workflow owned by another user.")

    update_data = workflow_in.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(workflow, key, value)

    if current_user and not workflow.user_id:
        workflow.user_id = current_user.id

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

@router.post("/{workflow_id}/execute", response_model=WorkflowRunRead)
async def execute_workflow(
    workflow_id: str,
    background_tasks: BackgroundTasks,
    payload: Dict[str, Any] = {},
    session: AsyncSession = Depends(get_async_session),
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    workflow = await session.get(Workflow, workflow_id)
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    if current_user and workflow.user_id and workflow.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied. Cannot execute workflow owned by another user.")

    workflow_run = WorkflowRun(
        workflow_id=workflow_id,
        status=ExecutionStatus.PENDING,
        trigger_type="manual",
        input_data=payload
    )
    session.add(workflow_run)
    await session.commit()
    await session.refresh(workflow_run)

    # Schedule async background task to run the executor
    background_tasks.add_task(_run_executor_task, workflow_run.id)

    return workflow_run

@router.post("/webhooks/{workflow_id}", response_model=WorkflowRunRead)
@router.post("/{workflow_id}/webhook", response_model=WorkflowRunRead)
async def handle_webhook_trigger(
    workflow_id: str,
    background_tasks: BackgroundTasks,
    payload: Dict[str, Any] = {},
    session: AsyncSession = Depends(get_async_session)
):
    workflow = await session.get(Workflow, workflow_id)
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")

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
