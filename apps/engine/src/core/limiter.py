import logging
from fastapi import Request
from slowapi import Limiter
from slowapi.util import get_remote_address

from config import settings

logger = logging.getLogger(__name__)

def get_client_ip(request: Request) -> str:
    """
    Extract client IP address, handling proxy headers (X-Forwarded-For / X-Real-IP)
    for Nginx or reverse proxies.
    """
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        # Take the first untrusted IP in the chain
        return forwarded.split(",")[0].strip()
    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip.strip()
    return get_remote_address(request)

# Configure storage URI: try Redis first, fallback to memory if error
storage_uri = settings.REDIS_URL if settings.REDIS_URL else "memory://"

limiter = Limiter(
    key_func=get_client_ip,
    default_limits=[settings.GENERAL_RATE_LIMIT],
    enabled=settings.RATE_LIMIT_ENABLED,
    storage_uri=storage_uri,
    strategy="fixed-window"
)
