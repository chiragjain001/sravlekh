from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

from src.evaluation.ai_model_registry import (
    resolve_active_evaluation_model_version,
    resolve_evaluation_ai_model_id,
    resolve_evaluation_prompt_version_id,
)


def make_db(provider=None, model=None, version=None, prompt=None):
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
        promptversion=SimpleNamespace(
            find_first=AsyncMock(return_value=prompt),
            create=AsyncMock(return_value=SimpleNamespace(id="prompt-new")),
        ),
    )


@pytest.mark.asyncio
async def test_creates_the_full_chain_when_nothing_exists_yet():
    fake_db = make_db()
    with patch("src.evaluation.ai_model_registry.db", fake_db):
        model_id = await resolve_evaluation_ai_model_id()
        version = await resolve_active_evaluation_model_version(model_id)
        prompt_id = await resolve_evaluation_prompt_version_id(model_id, "user-1")

    fake_db.aiprovider.create.assert_awaited_once()
    fake_db.aimodel.create.assert_awaited_once()
    assert fake_db.aimodel.create.await_args.kwargs["data"]["purpose"] == "EVALUATION"
    fake_db.aimodelversion.create.assert_awaited_once()
    fake_db.promptversion.create.assert_awaited_once()
    assert fake_db.promptversion.create.await_args.kwargs["data"]["createdByUserId"] == "user-1"
    assert (model_id, version.id, prompt_id) == ("model-new", "version-new", "prompt-new")


@pytest.mark.asyncio
async def test_reuses_an_existing_chain_without_creating_duplicates():
    fake_db = make_db(
        provider=SimpleNamespace(id="provider-1"),
        model=SimpleNamespace(id="model-1"),
        version=SimpleNamespace(id="version-1"),
        prompt=SimpleNamespace(id="prompt-1"),
    )
    with patch("src.evaluation.ai_model_registry.db", fake_db):
        model_id = await resolve_evaluation_ai_model_id()
        version = await resolve_active_evaluation_model_version(model_id)
        prompt_id = await resolve_evaluation_prompt_version_id(model_id, "user-1")

    fake_db.aiprovider.create.assert_not_awaited()
    fake_db.aimodel.create.assert_not_awaited()
    fake_db.aimodelversion.create.assert_not_awaited()
    fake_db.promptversion.create.assert_not_awaited()
    assert (model_id, version.id, prompt_id) == ("model-1", "version-1", "prompt-1")


# 27 §8a: isActive is the admin's "stop using this version" lever. It was written on
# every row but never read, making it inert — these pin that it now has real effect.
@pytest.mark.asyncio
async def test_resolve_filters_on_isactive():
    fake_db = make_db(version=SimpleNamespace(id="version-1"))
    with patch("src.evaluation.ai_model_registry.db", fake_db):
        await resolve_active_evaluation_model_version("model-1")

    assert fake_db.aimodelversion.find_first.await_args_list[0].kwargs["where"]["isActive"] is True


@pytest.mark.asyncio
async def test_resolve_orders_deterministically_for_the_multiple_active_case():
    """Post-B1 hardening. AIModelVersion has no uniqueness constraint on
    (aiModelId, versionLabel), so two rows can both be active at once. The order
    clause is what makes "which model runs" answerable the same way twice — the
    same guard already proven in the Blueprint (B5) and OCR (B1 Stage 3)
    registries, which this brings evaluation into line with."""
    fake_db = make_db(version=SimpleNamespace(id="version-1"))
    with patch("src.evaluation.ai_model_registry.db", fake_db):
        await resolve_active_evaluation_model_version("model-1")

    assert fake_db.aimodelversion.find_first.await_args_list[0].kwargs.get("order") == {"createdAt": "desc"}


@pytest.mark.asyncio
async def test_deactivated_last_version_returns_none_and_does_not_bootstrap_a_replacement():
    """An admin deactivating every version is an explicit instruction to stop, not a
    cue to silently recreate the default — that would make isActive unenforceable."""
    fake_db = make_db()
    # First lookup (isActive=True) misses; the follow-up "any version at all" hits.
    fake_db.aimodelversion.find_first = AsyncMock(
        side_effect=[None, SimpleNamespace(id="version-deactivated")]
    )

    with patch("src.evaluation.ai_model_registry.db", fake_db):
        version = await resolve_active_evaluation_model_version("model-1")

    assert version is None
    fake_db.aimodelversion.create.assert_not_awaited()
