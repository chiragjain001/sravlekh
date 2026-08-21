from unittest.mock import patch

import pytest
from fastapi import HTTPException

from src.auth import verify_internal_token
from src.config import Settings


@pytest.mark.asyncio
async def test_unconfigured_token_is_unenforced_dev_fallback():
    settings = Settings(DATABASE_URL="postgresql://x", JWT_SECRET="x" * 32, INTERNAL_SERVICE_TOKEN="")
    with patch("src.auth.get_settings", return_value=settings):
        await verify_internal_token(x_internal_token="anything-or-nothing")  # must not raise


@pytest.mark.asyncio
async def test_configured_token_rejects_a_mismatch():
    settings = Settings(
        DATABASE_URL="postgresql://x", JWT_SECRET="x" * 32, INTERNAL_SERVICE_TOKEN="the-real-secret"
    )
    with patch("src.auth.get_settings", return_value=settings):
        with pytest.raises(HTTPException) as exc_info:
            await verify_internal_token(x_internal_token="wrong-guess")
    assert exc_info.value.status_code == 401


@pytest.mark.asyncio
async def test_configured_token_accepts_an_exact_match():
    settings = Settings(
        DATABASE_URL="postgresql://x", JWT_SECRET="x" * 32, INTERNAL_SERVICE_TOKEN="the-real-secret"
    )
    with patch("src.auth.get_settings", return_value=settings):
        await verify_internal_token(x_internal_token="the-real-secret")  # must not raise
