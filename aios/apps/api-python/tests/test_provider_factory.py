import pytest

from src.config import Settings
from src.providers.factory import GEMINI_MODEL, select_adapter
from src.providers.gemini_adapter import GeminiAdapter
from src.providers.openai_adapter import OpenAIAdapter


def settings(**kw):
    return Settings(DATABASE_URL="postgresql://x", JWT_SECRET="x" * 32, **kw)


def test_openai_key_wins_and_keeps_the_registry_model():
    adapter, model = select_adapter(settings(OPENAI_API_KEY="sk", GEMINI_API_KEY="g"), "gpt-4o")
    assert isinstance(adapter, OpenAIAdapter) and model == "gpt-4o"


def test_gemini_only_uses_gemini_and_replaces_the_openai_registry_label():
    adapter, model = select_adapter(settings(OPENAI_API_KEY="", GEMINI_API_KEY="g"), "gpt-4o")
    assert isinstance(adapter, GeminiAdapter) and model == GEMINI_MODEL


def test_no_key_raises_naming_both():
    with pytest.raises(ValueError, match="OPENAI_API_KEY.*GEMINI_API_KEY"):
        select_adapter(settings(OPENAI_API_KEY="", GEMINI_API_KEY=""), "gpt-4o")
