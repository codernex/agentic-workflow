import random
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, Request, status, BackgroundTasks
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from config import settings
from core.limiter import limiter
from db.session import get_async_session
from models.user import User, UserCreate, UserRead, UserLogin, UserVerify, UserResendCode, Token
from auth.security import get_password_hash, verify_password, create_access_token, get_current_user
from services.email_service import send_verification_email

router = APIRouter(prefix="/auth", tags=["Auth"])

@router.post("/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
@limiter.limit(settings.AUTH_RATE_LIMIT)
async def register_user(
    request: Request,
    user_in: UserCreate,
    background_tasks: BackgroundTasks,
    session: AsyncSession = Depends(get_async_session)
):
    """Registers a new user and sends an email verification code via Mailtrap SDK."""
    statement = select(User).where(User.email == user_in.email.lower().strip())
    result = await session.exec(statement)
    existing_user = result.first()

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User with this email already exists."
        )

    verification_code = str(random.randint(100000, 999999))
    user = User(
        email=user_in.email.lower().strip(),
        hashed_password=get_password_hash(user_in.password),
        full_name=user_in.full_name,
        is_verified=False,
        verification_token=verification_code
    )
    session.add(user)
    await session.commit()
    await session.refresh(user)

    # Dispatch email verification asynchronously via Mailtrap SDK
    background_tasks.add_task(send_verification_email, user.email, verification_code)

    return user


@router.post("/verify-email", response_model=UserRead)
@limiter.limit(settings.AUTH_RATE_LIMIT)
async def verify_email(
    request: Request,
    verify_in: UserVerify,
    session: AsyncSession = Depends(get_async_session)
):
    """Verifies a user's email using the 6-digit verification code sent via Mailtrap."""
    statement = select(User).where(User.email == verify_in.email.lower().strip())
    result = await session.exec(statement)
    user = result.first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    if user.is_verified:
        return user

    if not user.verification_token or user.verification_token != verify_in.token.strip():
        raise HTTPException(status_code=400, detail="Invalid verification code.")

    user.is_verified = True
    user.verification_token = None
    session.add(user)
    await session.commit()
    await session.refresh(user)

    return user


@router.post("/resend-code")
@limiter.limit(settings.AUTH_RATE_LIMIT)
async def resend_verification_code(
    request: Request,
    resend_in: UserResendCode,
    background_tasks: BackgroundTasks,
    session: AsyncSession = Depends(get_async_session)
):
    """Resends a new 6-digit email verification code via Mailtrap SDK if the user is unverified."""
    statement = select(User).where(User.email == resend_in.email.lower().strip())
    result = await session.exec(statement)
    user = result.first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    if user.is_verified:
        raise HTTPException(status_code=400, detail="This email address is already verified.")

    verification_code = str(random.randint(100000, 999999))
    user.verification_token = verification_code
    session.add(user)
    await session.commit()

    # Dispatch new verification email via Mailtrap SDK
    background_tasks.add_task(send_verification_email, user.email, verification_code)

    return {"message": f"Verification code resent successfully to {user.email} via Mailtrap."}


@router.post("/login", response_model=Token)
@limiter.limit(settings.AUTH_RATE_LIMIT)
async def login(
    request: Request,
    login_in: UserLogin,
    session: AsyncSession = Depends(get_async_session)
):
    """Authenticates a user and returns a JWT bearer access token."""
    statement = select(User).where(User.email == login_in.email.lower().strip())
    result = await session.exec(statement)
    user = result.first()

    if not user or not verify_password(login_in.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password."
        )

    if not user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email address is not verified. Please check your email for the verification code."
        )

    access_token = create_access_token(data={"sub": user.id, "email": user.email})
    return Token(access_token=access_token, user=user)


@router.get("/me", response_model=UserRead)
@limiter.limit(settings.GENERAL_RATE_LIMIT)
async def get_me(
    request: Request,
    current_user: User = Depends(get_current_user)
):
    """Returns profile information for the authenticated user."""
    return current_user

