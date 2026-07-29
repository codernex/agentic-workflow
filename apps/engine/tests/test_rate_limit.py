import pytest
import httpx
from main import app
from core.limiter import limiter

@pytest.fixture(autouse=True)
def reset_limiter():
    limiter.reset()
    yield
    limiter.reset()

@pytest.mark.asyncio
async def test_rate_limiting_on_auth_endpoint():
    """Validates that exceeding the rate limit returns 429 Too Many Requests."""
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        responses = []
        # Send 15 consecutive login requests to exceed 10/minute auth rate limit
        for _ in range(15):
            res = await client.post(
                "/api/v1/auth/login",
                json={"email": "nonexistent@example.com", "password": "wrongpassword"}
            )
            responses.append(res.status_code)

        # At least one of the requests should be rate-limited with HTTP 429
        assert 429 in responses, f"Expected 429 in response statuses, got: {responses}"



