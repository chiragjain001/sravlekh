from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

from src.ocr.ai_model_registry import resolve_active_ocr_model_version, resolve_ocr_ai_model_id

# P1 B1 Stage 3: this registry previously exposed a single
# resolve_ocr_model_version_id() -> str that never filtered isActive, and whose
# result was used only to stamp OCRResult.aiModelVersionId while
# handwriting_ocr.py hardcoded model="gpt-4o" separately. Now mirrors the
# evaluation/blueprint registries exactly: resolve the model, then resolve the
# ACTIVE version row, and let the caller use both .versionLabel (what runs) and
# .id (what's recorded).


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
        model_id = await resolve_ocr_ai_model_id()
        version = await resolve_active_ocr_model_version(model_id)

    fake_db.aiprovider.create.assert_awaited_once()
    fake_db.aimodel.create.assert_awaited_once()
    assert fake_db.aimodel.create.await_args.kwargs["data"]["purpose"] == "OCR"
    fake_db.aimodelversion.create.assert_awaited_once()
    assert (model_id, version.id) == ("model-new", "version-new")


@pytest.mark.asyncio
async def test_reuses_an_existing_chain_without_creating_duplicates():
    fake_db = make_db(
        provider=SimpleNamespace(id="provider-1"),
        model=SimpleNamespace(id="model-1"),
        version=SimpleNamespace(id="version-1"),
    )
    with patch("src.ocr.ai_model_registry.db", fake_db):
        model_id = await resolve_ocr_ai_model_id()
        version = await resolve_active_ocr_model_version(model_id)

    fake_db.aiprovider.create.assert_not_awaited()
    fake_db.aimodel.create.assert_not_awaited()
    fake_db.aimodelversion.create.assert_not_awaited()
    assert (model_id, version.id) == ("model-1", "version-1")


@pytest.mark.asyncio
async def test_resolve_filters_on_isactive():
    fake_db = make_db(version=SimpleNamespace(id="version-1"))
    with patch("src.ocr.ai_model_registry.db", fake_db):
        await resolve_active_ocr_model_version("model-1")

    assert fake_db.aimodelversion.find_first.await_args_list[0].kwargs["where"]["isActive"] is True


@pytest.mark.asyncio
async def test_resolve_orders_deterministically_for_the_multiple_active_case():
    """No uniqueness constraint stops two rows both matching (aiModelId,
    versionLabel, isActive) — the order clause is what makes "which model runs"
    answerable the same way twice. Same guard as blueprint's registry (B5)."""
    fake_db = make_db(version=SimpleNamespace(id="version-1"))
    with patch("src.ocr.ai_model_registry.db", fake_db):
        await resolve_active_ocr_model_version("model-1")

    assert fake_db.aimodelversion.find_first.await_args_list[0].kwargs.get("order") == {"createdAt": "desc"}


@pytest.mark.asyncio
async def test_all_versions_inactive_returns_none_and_does_not_bootstrap_a_replacement():
    """An admin deactivating every OCR version is an explicit "stop running OCR"
    instruction, not a cue to silently recreate the default."""
    fake_db = make_db()
    # First lookup (isActive=True) misses; the follow-up "any version at all" hits.
    fake_db.aimodelversion.find_first = AsyncMock(
        side_effect=[None, SimpleNamespace(id="version-deactivated")]
    )

    with patch("src.ocr.ai_model_registry.db", fake_db):
        version = await resolve_active_ocr_model_version("model-1")

    assert version is None
    fake_db.aimodelversion.create.assert_not_awaited()
