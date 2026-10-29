from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

from src.config import Settings
from src.evaluation.ai_model_registry import resolve_evaluation_ai_model_id
from src.providers.factory import GEMINI, OPENAI, active_provider, adapter_for, select_adapter
from src.providers.gemini_adapter import GeminiAdapter
from src.providers.openai_adapter import OpenAIAdapter


def settings(**kw):
    return Settings(DATABASE_URL="postgresql://x", JWT_SECRET="x" * 32, **kw)


def test_openai_key_wins_when_both_are_configured():
    assert active_provider(settings(OPENAI_API_KEY="sk", GEMINI_API_KEY="g")) is OPENAI


def test_ai_provider_config_forces_gemini_even_if_openai_key_present():
    provider = active_provider(settings(AI_PROVIDER="gemini", OPENAI_API_KEY="sk", GEMINI_API_KEY="g"))
    assert provider.key == "gemini"
    assert provider.provider_name == "Google"


def test_ai_evaluation_model_overrides_model_name():
    provider = active_provider(settings(AI_PROVIDER="gemini", GEMINI_API_KEY="g", AI_EVALUATION_MODEL="gemini-3.5-flash-lite"))
    assert provider.model_name == "gemini-3.5-flash-lite"


def test_gemini_is_used_when_only_its_key_is_configured():
    assert active_provider(settings(OPENAI_API_KEY="", GEMINI_API_KEY="g")) is GEMINI


def test_no_key_raises_naming_both():
    with pytest.raises(ValueError, match="OPENAI_API_KEY.*GEMINI_API_KEY"):
        active_provider(settings(OPENAI_API_KEY="", GEMINI_API_KEY=""))


def test_deterministic_gemini_fails_fast_without_gemini_key():
    with pytest.raises(ValueError, match="AI_PROVIDER is set to 'gemini'.*GEMINI_API_KEY is not configured"):
        active_provider(settings(AI_PROVIDER="gemini", GEMINI_API_KEY="", OPENAI_API_KEY="sk"))


def test_deterministic_openai_fails_fast_without_openai_key():
    with pytest.raises(ValueError, match="AI_PROVIDER is set to 'openai'.*OPENAI_API_KEY is not configured"):
        active_provider(settings(AI_PROVIDER="openai", OPENAI_API_KEY="", GEMINI_API_KEY="g"))


def test_unsupported_ai_provider_raises():
    with pytest.raises(ValueError, match="Unsupported AI_PROVIDER: 'anthropic'"):
        active_provider(settings(AI_PROVIDER="anthropic", OPENAI_API_KEY="sk", GEMINI_API_KEY="g"))


def test_incompatible_model_and_provider_rejected():
    with pytest.raises(ValueError, match="belongs to OpenAI, but active provider is Google Gemini"):
        active_provider(settings(AI_PROVIDER="gemini", GEMINI_API_KEY="g", AI_EVALUATION_MODEL="gpt-4o"))

    with pytest.raises(ValueError, match="belongs to Google Gemini, but active provider is OpenAI"):
        active_provider(settings(AI_PROVIDER="openai", OPENAI_API_KEY="sk", AI_EVALUATION_MODEL="gemini-1.5-flash"))


def test_purpose_specific_model_resolution():
    s = settings(AI_PROVIDER="gemini", GEMINI_API_KEY="g", AI_OCR_MODEL="gemini-1.5-flash", AI_EVALUATION_MODEL="gemini-1.5-pro")
    prov_ocr = active_provider(s, purpose="ocr")
    assert prov_ocr.model_name == "gemini-1.5-flash"

    prov_eval = active_provider(s, purpose="evaluation")
    assert prov_eval.model_name == "gemini-1.5-pro"


def test_each_provider_gets_its_own_adapter():
    assert isinstance(adapter_for(settings(OPENAI_API_KEY="sk"), OPENAI), OpenAIAdapter)
    assert isinstance(adapter_for(settings(GEMINI_API_KEY="g"), GEMINI), GeminiAdapter)


def test_a_registry_resolved_label_is_used_as_given():
    adapter, model = select_adapter(settings(OPENAI_API_KEY="", GEMINI_API_KEY="g"), "gemini-3.6-flash")
    assert isinstance(adapter, GeminiAdapter) and model == "gemini-3.6-flash"


@pytest.mark.asyncio
async def test_registry_rows_are_resolved_per_provider_so_the_audit_names_the_real_model():
    created_providers, created_models = [], []
    fake_db = SimpleNamespace(
        aiprovider=SimpleNamespace(
            find_first=AsyncMock(return_value=None),
            create=AsyncMock(side_effect=lambda data: created_providers.append(data) or SimpleNamespace(id="prov-1", **data)),
        ),
        aimodel=SimpleNamespace(
            find_first=AsyncMock(return_value=None),
            create=AsyncMock(side_effect=lambda data: created_models.append(data) or SimpleNamespace(id="model-1", **data)),
        ),
    )
    with patch("src.evaluation.ai_model_registry.db", fake_db):
        await resolve_evaluation_ai_model_id(GEMINI.provider_name, GEMINI.model_name)

    assert created_providers[0]["name"] == "Google"
    assert created_models[0]["name"] == "gemini-3.6-flash"
    assert created_models[0]["purpose"] == "EVALUATION"


@pytest.mark.asyncio
async def test_openai_remains_the_default_registry_chain():
    fake_db = SimpleNamespace(
        aiprovider=SimpleNamespace(find_first=AsyncMock(return_value=SimpleNamespace(id="prov-1")), create=AsyncMock()),
        aimodel=SimpleNamespace(find_first=AsyncMock(return_value=SimpleNamespace(id="model-1")), create=AsyncMock()),
    )
    with patch("src.evaluation.ai_model_registry.db", fake_db):
        await resolve_evaluation_ai_model_id()

    assert fake_db.aiprovider.find_first.await_args.kwargs["where"] == {"name": OPENAI.provider_name}
    assert fake_db.aimodel.find_first.await_args.kwargs["where"]["name"] == OPENAI.model_name
