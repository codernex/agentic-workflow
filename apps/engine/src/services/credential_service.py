import logging
from typing import Tuple, Optional
from fastapi import HTTPException, status
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from config import settings
from models.credential import Credential
from models.user import User

logger = logging.getLogger("engine.credential_service")

async def resolve_credential(
    service_type: str,
    user: Optional[User],
    session: AsyncSession
) -> Tuple[str, bool]:
    """
    Smart Credential Resolution:
    1. Checks if the user has a personal Credential stored for `service_type` in the database.
       If found, decrypts and returns (api_key, is_free_tier=False) with UNLIMITED usage.
    2. If no personal key is stored:
       a) Checks if system application key exists (e.g., OPENROUTER_API_KEY).
       b) If user is provided, verifies `user.free_credits > 0`.
          Decrements user.free_credits by 1 and returns (system_key, is_free_tier=True).
       c) If free_credits <= 0, raises HTTP 402 Payment Required exception.
    """
    # 1. Look for user's personal stored credential if user is authenticated
    if user:
        statement = (
            select(Credential)
            .where(Credential.user_id == user.id)
            .where(Credential.service_type.ilike(service_type))
            .order_by(Credential.created_at.desc())
        )
        result = await session.exec(statement)
        personal_cred = result.first()

        if personal_cred:
            logger.info(f"Using personal stored credential for user {user.id} ({service_type})")
            return personal_cred.get_secret(), False

    # 2. Fall back to application system key
    system_key = settings.OPENROUTER_API_KEY
    if not system_key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"No API key available for service '{service_type}'. Please store your key in Credentials Vault."
        )

    # If user is logged in, check & decrement free credits
    if user:
        if user.free_credits <= 0:
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail="Free-tier execution limit reached (0 credits remaining). Please add your API key in the Credentials Vault to continue."
            )

        user.free_credits -= 1
        session.add(user)
        await session.commit()
        await session.refresh(user)
        logger.info(f"Subtracted 1 free execution credit for user {user.id}. Credits remaining: {user.free_credits}")

    return system_key, True
