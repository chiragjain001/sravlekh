from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

from src.ocr.ai_model_registry import resolve_ocr_model_version_id


def make_db(provider=None, model=None, version=None):
    return SimpleNamespace(
        aiprovider=SimpleNamespace(
            find_first=AsyncMock(return_value=provider),
            create=AsyncMock(return_value=SimpleNamespace(id="provider-new")),
        ),
        aimodel=SimpleNamespace(
            find_first=AsyncMock(return_value=model),
            create=AsyncMock(return_value=SimpleNamespace(id="model-new")),
        ),
        aimodelversion=SimpleNamespace(
            find_first=AsyncMock(return_value=version),
            create=AsyncMock(return_value=SimpleNamespace(id="version-new")),
        ),
    )


@pytest.mark.asyncio
async def test_creates_the_full_chain_when_nothing_exists_yet():
    fake_db = make_db()
    with patch("src.ocr.ai_model_registry.db", fake_db):
        result = await resolve_ocr_model_version_id()

    fake_db.aiprovider.create.assert_awaited_once()
    fake_db.aimodel.create.assert_awaited_once()
    fake_db.aimodelversion.create.assert_awaited_once()
    assert result == "version-new"


@pytest.mark.asyncio
async def test_reuses_an_existing_chain_without_creating_duplicates():
    fake_db = make_db(
        provider=SimpleNamespace(id="provider-1"),
        model=SimpleNamespace(id="model-1"),
        version=SimpleNamespace(id="version-1"),
    )
    with patch("src.ocr.ai_model_registry.db", fake_db):
        result = await resolve_ocr_model_version_id()

    fake_db.aiprovider.create.assert_not_awaited()
    fake_db.aimodel.create.assert_not_awaited()
    fake_db.aimodelversion.create.assert_not_awaited()
    assert result == "version-1"
