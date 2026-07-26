import uuid
import pytest
import httpx
from main import app

@pytest.mark.asyncio
async def test_register_verify_and_login_user_flow():
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        unique_id = uuid.uuid4().hex[:8]
        email = f"user_{unique_id}@example.com"
        password = "SecretPassword123!"

        # 1. Register User
        user_data = {
            "email": email,
            "password": password,
            "full_name": "Async Test User"
        }
        resp = await client.post("/api/v1/auth/register", json=user_data)
        assert resp.status_code == 201
        created_user = resp.json()
        assert created_user["email"] == email
        assert created_user["is_verified"] is False

        # 2. Duplicate registration attempt should fail
        resp_dup = await client.post("/api/v1/auth/register", json=user_data)
        assert resp_dup.status_code == 400

        # 3. Resend verification code for unverified user
        resp_resend = await client.post("/api/v1/auth/resend-code", json={"email": email})
        assert resp_resend.status_code == 200
        assert "resent successfully" in resp_resend.json()["message"]

        # 4. Unverified login attempt should fail
        resp_login_unverified = await client.post("/api/v1/auth/login", json={
            "email": email,
            "password": password
        })
        assert resp_login_unverified.status_code == 403

        # 5. Verify email with incorrect token should fail
        resp_wrong_verify = await client.post("/api/v1/auth/verify-email", json={
            "email": email,
            "token": "000000"
        })
        assert resp_wrong_verify.status_code == 400
