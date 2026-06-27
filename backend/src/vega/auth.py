"""Authentication dependencies for VEGA API.

Provides a simple pre-shared API-key check for ESP32 sensor boxes.
The key travels as the ``X-API-Key`` header and is verified against
the ``VEGA_API_KEY`` environment variable.

Routes that require device auth can depend on ``require_api_key``.
"""

import secrets
from typing import Annotated

from fastapi import Header, HTTPException, status

from .config import settings


async def require_api_key(
    x_api_key: Annotated[str, Header(alias="X-API-Key")] = "",
) -> str:
    """Validate the X-API-Key header against the configured secret.

    Returns the validated key on success so route handlers can
    optionally use it (e.g. to log which device sent data).

    Raises 401 if the key is missing, empty, or mismatched.
    """
    if not settings.api_key:
        # No key configured — auth is effectively disabled.
        # In production you MUST set VEGA_API_KEY.
        return x_api_key

    if not x_api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing X-API-Key header",
        )

    # Constant-time comparison to prevent timing attacks.
    if not secrets.compare_digest(x_api_key, settings.api_key):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key",
        )

    return x_api_key
