from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

from src.evaluation.ai_model_registry import (
    resolve_evaluation_ai_model_id,
    resolve_evaluation_model_version_id,
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
        version_id = await resolve_evaluation_model_version_id(model_id)
        prompt_id = await resolve_evaluation_prompt_version_id(model_id, "user-1")

    fake_db.aiprovider.create.assert_awaited_once()
    fake_db.aimodel.create.assert_awaited_once()
    assert fake_db.aimodel.create.await_args.kwargs["data"]["purpose"] == "EVALUATION"
    fake_db.aimodelversion.create.assert_awaited_once()
    fake_db.promptversion.create.assert_awaited_once()
    assert fake_db.promptversion.create.await_args.kwargs["data"]["createdByUserId"] == "user-1"
    assert (model_id, version_id, prompt_id) == ("model-new", "version-new", "prompt-new")


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
        version_id = await resolve_evaluation_model_version_id(model_id)
        prompt_id = await resolve_evaluation_prompt_version_id(model_id, "user-1")

    fake_db.aiprovider.create.assert_not_awaited()
    fake_db.aimodel.create.assert_not_awaited()
    fake_db.aimodelversion.create.assert_not_awaited()
    fake_db.promptversion.create.assert_not_awaited()
    assert (model_id, version_id, prompt_id) == ("model-1", "version-1", "prompt-1")
