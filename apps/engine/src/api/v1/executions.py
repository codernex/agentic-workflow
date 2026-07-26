from typing import List
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from db.session import get_async_session
from models.execution import WorkflowRun, WorkflowRunRead, StepLog, StepLogRead, ExecutionStatus

router = APIRouter(prefix="/executions", tags=["Executions"])

@router.get("/", response_model=List[WorkflowRunRead])
async def list_executions(
    workflow_id: str = None,
    session: AsyncSession = Depends(get_async_session)
):
    statement = select(WorkflowRun)
    if workflow_id:
        statement = statement.where(WorkflowRun.workflow_id == workflow_id)
    statement = statement.order_by(WorkflowRun.started_at.desc())
    result = await session.exec(statement)
    return result.all()

@router.get("/{run_id}", response_model=WorkflowRunRead)
async def get_execution_run(
    run_id: str,
    session: AsyncSession = Depends(get_async_session)
):
    run = await session.get(WorkflowRun, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Execution run not found")
    return run

@router.get("/{run_id}/logs", response_model=List[StepLogRead])
async def get_execution_step_logs(
    run_id: str,
    session: AsyncSession = Depends(get_async_session)
):
    statement = select(StepLog).where(StepLog.run_id == run_id).order_by(StepLog.timestamp.asc())
    result = await session.exec(statement)
    return result.all()

@router.post("/{run_id}/cancel", response_model=WorkflowRunRead)
async def cancel_execution_run(
    run_id: str,
    session: AsyncSession = Depends(get_async_session)
):
    run = await session.get(WorkflowRun, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Execution run not found")

    if run.status in [ExecutionStatus.PENDING, ExecutionStatus.RUNNING]:
        run.status = ExecutionStatus.CANCELLED
        run.finished_at = datetime.now(timezone.utc).replace(tzinfo=None)
        session.add(run)
        await session.commit()
        await session.refresh(run)

    return run
