import os
import socket
from pathlib import Path
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Find root .env file
ROOT_DIR = Path(__file__).resolve().parent.parent.parent.parent
ENV_FILE = ROOT_DIR / ".env"

def sanitize_db_url(url: str) -> str:
    if not url:
        return url
    
    # 1. Automatically convert postgres:// or postgresql:// to postgresql+asyncpg://
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql+asyncpg://", 1)
    elif url.startswith("postgresql://") and not url.startswith("postgresql+asyncpg://"):
        url = url.replace("postgresql://", "postgresql+asyncpg://", 1)

    # 2. Convert host.docker.internal if unresolvable
    if "host.docker.internal" in url:
        try:
            socket.gethostbyname("host.docker.internal")
        except socket.gaierror:
            return url.replace("host.docker.internal", "127.0.0.1")
            
    return url

class Settings(BaseSettings):
    PROJECT_NAME: str = "Agentic Workflow Engine"
    API_V1_STR: str = "/api/v1"
    
    # Database & Redis
    DATABASE_URL: str = "postgresql+asyncpg://postgres:123456@127.0.0.1:5432/workflow"
    REDIS_URL: str = "redis://127.0.0.1:6379/0"
    
    # Security & JWT
    JWT_SECRET: str = "b3be0a9d28500a7f3b8a439140bcce6aa13adfa033919739cf274cedac9245f5"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440
    
    # Mailtrap Email Verification SDK Settings
    MAILTRAP_API_TOKEN: str = ""
    SENDER_EMAIL: str = "no-reply@codernex.dev"
    SENDER_NAME: str = "Agentic Workflow Team"

    OPENROUTER_API_KEY: str = ""
    OPENROUTER_MODEL: str = "openai/gpt-4o"
    SUPERMEMORY_API_KEY: str = ""

    @field_validator("DATABASE_URL", mode="after")
    @classmethod
    def validate_database_url(cls, v: str) -> str:
        return sanitize_db_url(v)

    model_config = SettingsConfigDict(
        env_file=str(ENV_FILE) if ENV_FILE.exists() else None,
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
