from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from db.session import get_async_session
from models.credential import Credential, CredentialCreate, CredentialRead, encrypt_secret

router = APIRouter(prefix="/credentials", tags=["Credentials"])

@router.post("/", response_model=CredentialRead, status_code=status.HTTP_201_CREATED)
async def create_credential(
    credential_in: CredentialCreate,
    session: AsyncSession = Depends(get_async_session)
):
    encrypted = encrypt_secret(credential_in.raw_secret)
    cred = Credential(
        name=credential_in.name,
        service_type=credential_in.service_type,
        encrypted_data=encrypted
    )
    session.add(cred)
    await session.commit()
    await session.refresh(cred)
    return cred

@router.get("/", response_model=List[CredentialRead])
async def list_credentials(
    session: AsyncSession = Depends(get_async_session)
):
    statement = select(Credential).order_by(Credential.created_at.desc())
    result = await session.exec(statement)
    return result.all()

@router.delete("/{credential_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_credential(
    credential_id: str,
    session: AsyncSession = Depends(get_async_session)
):
    cred = await session.get(Credential, credential_id)
    if not cred:
        raise HTTPException(status_code=404, detail="Credential not found")
    await session.delete(cred)
    await session.commit()
