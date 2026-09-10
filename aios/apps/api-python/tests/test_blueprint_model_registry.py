from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

from src.ai.blueprint_model_registry import (
    resolve_active_blueprint_model_version,
    resolve_blueprint_ai_model_id,
)

# P1 B5: mirrors test_ai_evaluation_registry.py's conventions for the same reason
# the two registries mirror each other — deliberately narrower here, since this
# registry resolves a model VERSION only (no PromptVersion; see
# blueprint_model_registry.py's module docstring for why).


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
    """No Blueprint-purpose AIModel row exists at all -> bootstrap, exactly like
    evaluation's registry on a fresh install."""
    fake_db = make_db()
    with patch("src.ai.blueprint_model_registry.db", fake_db):
        model_id = await resolve_blueprint_ai_model_id()
        version = await resolve_active_blueprint_model_version(model_id)

    fake_db.aiprovider.create.assert_awaited_once()
    fake_db.aimodel.create.assert_awaited_once()
    assert fake_db.aimodel.create.await_args.kwargs["data"]["purpose"] == "BLUEPRINT"
    fake_db.aimodelversion.create.assert_awaited_once()
    assert (model_id, version.id) == ("model-new", "version-new")


@pytest.mark.asyncio
async def test_reuses_an_existing_chain_without_creating_duplicates():
    fake_db = make_db(
        provider=SimpleNamespace(id="provider-1"),
        model=SimpleNamespace(id="model-1"),
        version=SimpleNamespace(id="version-1"),
    )
    with patch("src.ai.blueprint_model_registry.db", fake_db):
        model_id = await resolve_blueprint_ai_model_id()
        version = await resolve_active_blueprint_model_version(model_id)

    fake_db.aiprovider.create.assert_not_awaited()
    fake_db.aimodel.create.assert_not_awaited()
    fake_db.aimodelversion.create.assert_not_awaited()
    assert (model_id, version.id) == ("model-1", "version-1")


@pytest.mark.asyncio
async def test_resolve_filters_on_isactive():
    # "one Blueprint model version is active" — the isActive filter is what makes
    # that the one actually resolved, not incidental.
    fake_db = make_db(version=SimpleNamespace(id="version-1"))
    with patch("src.ai.blueprint_model_registry.db", fake_db):
        await resolve_active_blueprint_model_version("model-1")

    call = fake_db.aimodelversion.find_first.await_args_list[0]
    assert call.kwargs["where"]["isActive"] is True


@pytest.mark.asyncio
async def test_resolve_orders_deterministically_for_the_multiple_active_case():
    """"multiple versions active" must resolve the same way every call, not
    whatever a mock or a real query engine happens to hand back first. Asserts
    the contract (order requested), not the DB's own behavior — see
    test_blueprint_model_registry_real_db.py for proof against a real engine."""
    fake_db = make_db(version=SimpleNamespace(id="version-1"))
    with patch("src.ai.blueprint_model_registry.db", fake_db):
        await resolve_active_blueprint_model_version("model-1")

    call = fake_db.aimodelversion.find_first.await_args_list[0]
    assert call.kwargs.get("order") == {"createdAt": "desc"}


@pytest.mark.asyncio
async def test_all_versions_inactive_returns_none_and_does_not_bootstrap_a_replacement():
    """An admin deactivating every version is an explicit "stop generating
    blueprints with this" instruction, not a cue to silently recreate the
    default — that would make isActive unenforceable, exactly the bug this
    registry exists to close (mirrors evaluation's registry test 1:1)."""
    fake_db = make_db()
    # First lookup (isActive=True) misses; the follow-up "any version at all" hits.
    fake_db.aimodelversion.find_first = AsyncMock(
        side_effect=[None, SimpleNamespace(id="version-deactivated")]
    )

    with patch("src.ai.blueprint_model_registry.db", fake_db):
        version = await resolve_active_blueprint_model_version("model-1")

    assert version is None
    fake_db.aimodelversion.create.assert_not_awaited()


@pytest.mark.asyncio
async def test_no_blueprint_purpose_model_row_yet_bootstraps_rather_than_failing():
    """"no Blueprint-purpose model" (the very first call, ever) is not an error
    state — it is the fresh-install case, handled by resolve_blueprint_ai_model_id
    itself creating the AIModel row before a version is ever resolved."""
    fake_db = make_db(provider=SimpleNamespace(id="provider-1"))
    with patch("src.ai.blueprint_model_registry.db", fake_db):
        model_id = await resolve_blueprint_ai_model_id()

    fake_db.aimodel.create.assert_awaited_once()
    assert model_id == "model-new"
