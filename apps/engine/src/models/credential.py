import base64
import hashlib
from datetime import datetime, timezone
from typing import Optional
import uuid
from cryptography.fernet import Fernet
from sqlmodel import SQLModel, Field

from config import settings

def _get_fernet_key() -> bytes:
    """Derive a 32-byte url-safe base64 key from JWT_SECRET."""
    key_bytes = hashlib.sha256(settings.JWT_SECRET.encode("utf-8")).digest()
    return base64.urlsafe_b64encode(key_bytes)

def encrypt_secret(secret_text: str) -> str:
    f = Fernet(_get_fernet_key())
    return f.encrypt(secret_text.encode("utf-8")).decode("utf-8")

def decrypt_secret(encrypted_text: str) -> str:
    f = Fernet(_get_fernet_key())
    return f.decrypt(encrypted_text.encode("utf-8")).decode("utf-8")

def utc_now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)

class CredentialBase(SQLModel):
    name: str = Field(index=True)
    service_type: str = Field(index=True)  # e.g., 'openai', 'linkedin', 'facebook', 'generic'

class Credential(CredentialBase, table=True):
    __tablename__ = "credentials"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    encrypted_data: str
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)

    def get_secret(self) -> str:
        return decrypt_secret(self.encrypted_data)

class CredentialCreate(CredentialBase):
    raw_secret: str

class CredentialRead(CredentialBase):
    id: str
    created_at: datetime
    updated_at: datetime
