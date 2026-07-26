from datetime import datetime, timezone
from typing import Optional, Any, Dict
from enum import Enum
import uuid
from sqlmodel import SQLModel, Field, Column, JSON

class ToolType(str, Enum):
    PYTHON_CODE = "python_code"
    HTTP_API = "http_api"
    BUILTIN = "builtin"

class CustomToolBase(SQLModel):
    name: str = Field(index=True, unique=True)
    description: str
    tool_type: ToolType = Field(default=ToolType.PYTHON_CODE)
    code_or_url: str
    input_schema: Dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))
    output_schema: Dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))

def utc_now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)

class CustomTool(CustomToolBase, table=True):
    __tablename__ = "custom_tools"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    created_at: datetime = Field(default_factory=utc_now)

class CustomToolCreate(CustomToolBase):
    pass

class CustomToolRead(CustomToolBase):
    id: str
    created_at: datetime
