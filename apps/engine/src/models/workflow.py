from datetime import datetime, timezone
from typing import Optional, Any, Dict, List
import uuid
from sqlmodel import SQLModel, Field, Column, JSON

def utc_now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)

def generate_webhook_secret() -> str:
    return f"wf_sec_{uuid.uuid4().hex}"

class WorkflowBase(SQLModel):
    name: str
    description: Optional[str] = None
    is_active: bool = True
    user_id: Optional[str] = Field(default=None, foreign_key="users.id", index=True, nullable=True)
    nodes: List[Dict[str, Any]] = Field(default_factory=list, sa_column=Column(JSON))
    edges: List[Dict[str, Any]] = Field(default_factory=list, sa_column=Column(JSON))

class Workflow(WorkflowBase, table=True):
    __tablename__ = "workflows"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    webhook_secret: str = Field(default_factory=generate_webhook_secret, index=True, nullable=False)
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)

class WorkflowCreate(WorkflowBase):
    pass

class WorkflowUpdate(SQLModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None
    nodes: Optional[List[Dict[str, Any]]] = None
    edges: Optional[List[Dict[str, Any]]] = None

class WorkflowRead(WorkflowBase):
    id: str
    user_id: Optional[str] = None
    webhook_secret: str
    created_at: datetime
    updated_at: datetime
