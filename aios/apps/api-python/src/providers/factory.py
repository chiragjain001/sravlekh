"""Picks the provider adapter (and the model it should run) for a call site.

Order matches blueprint_agent.py: OpenAI when OPENAI_API_KEY is set, otherwise
Gemini when GEMINI_API_KEY is set. With OpenAI the registry-resolved model label
is used unchanged. The AIModelVersion registry rows are OpenAI's (see
evaluation/ and ocr/ai_model_registry.py), so on the Gemini path the label is
replaced with GEMINI_MODEL — the registry's isActive kill switch is still
resolved and enforced by the caller before this is reached, it just doesn't name
the model when Gemini is the provider.
"""

from src.providers.base import ModelProviderAdapter
from src.providers.gemini_adapter import GeminiAdapter
from src.providers.openai_adapter import OpenAIAdapter

GEMINI_MODEL = "gemini-3.6-flash"


def select_adapter(settings, registry_model: str) -> tuple[ModelProviderAdapter, str]:
    if settings.OPENAI_API_KEY:
        return OpenAIAdapter(api_key=settings.OPENAI_API_KEY), registry_model
    if settings.GEMINI_API_KEY:
        return GeminiAdapter(api_key=settings.GEMINI_API_KEY), GEMINI_MODEL
    raise ValueError("Neither OPENAI_API_KEY nor GEMINI_API_KEY is configured in the environment.")
