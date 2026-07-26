from datetime import datetime, timezone
from typing import Optional, Any, Dict, List
from enum import Enum
import uuid
from sqlmodel import SQLModel, Field, Column, JSON

def utc_now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)

class ExecutionStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"

class WorkflowRunBase(SQLModel):
    workflow_id: str = Field(index=True)
    status: ExecutionStatus = Field(default=ExecutionStatus.PENDING)
    trigger_type: str = Field(default="manual")
    input_data: Dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))
    output_data: Dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))
    error_message: Optional[str] = None

class WorkflowRun(WorkflowRunBase, table=True):
    __tablename__ = "workflow_runs"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    started_at: datetime = Field(default_factory=utc_now)
    finished_at: Optional[datetime] = None

class StepLogBase(SQLModel):
    run_id: str = Field(index=True)
    node_id: str = Field(index=True)
    node_name: str
    node_type: str
    status: ExecutionStatus = Field(default=ExecutionStatus.PENDING)
    input_data: Dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))
    output_data: Dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))
    thought_trace: Optional[str] = None
    error_message: Optional[str] = None
    execution_time_ms: float = 0.0

class StepLog(StepLogBase, table=True):
    __tablename__ = "step_logs"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    timestamp: datetime = Field(default_factory=utc_now)

class WorkflowRunRead(WorkflowRunBase):
    id: str
    started_at: datetime
    finished_at: Optional[datetime] = None

class StepLogRead(StepLogBase):
    id: str
    timestamp: datetime
