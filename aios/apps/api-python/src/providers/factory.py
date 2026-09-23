"""Which provider runs, and the adapter that talks to it.

Order: OpenAI when OPENAI_API_KEY is set, otherwise Gemini when GEMINI_API_KEY
is — the same preference blueprint_agent.py has always used.

The chosen provider also decides WHICH registry rows are resolved
(AIProvider -> AIModel -> AIModelVersion). That matters for more than tidiness:
those rows are the audit trail stamped onto every AIRecommendation and the
kill switch an admin uses to stop a model. Before this, the rows always said
"OpenAI / gpt-4o" while Gemini did the work, so the recorded model was wrong
and deactivating it stopped nothing.
"""

from dataclasses import dataclass

from src.providers.base import ModelProviderAdapter
from src.providers.gemini_adapter import GeminiAdapter
from src.providers.openai_adapter import OpenAIAdapter

GEMINI_MODEL = "gemini-3.6-flash"
OPENAI_MODEL = "gpt-4o"


@dataclass(frozen=True)
class ProviderSpec:
    key: str           # internal identifier
    provider_name: str  # AIProvider.name in the registry
    model_name: str     # AIModel.name / default AIModelVersion.versionLabel


OPENAI = ProviderSpec("openai", "OpenAI", OPENAI_MODEL)
GEMINI = ProviderSpec("gemini", "Google", GEMINI_MODEL)


def active_provider(settings) -> ProviderSpec:
    if settings.OPENAI_API_KEY:
        return OPENAI
    if settings.GEMINI_API_KEY:
        return GEMINI
    raise ValueError("Neither OPENAI_API_KEY nor GEMINI_API_KEY is configured in the environment.")


def adapter_for(settings, provider: ProviderSpec) -> ModelProviderAdapter:
    if provider.key == OPENAI.key:
        return OpenAIAdapter(api_key=settings.OPENAI_API_KEY)
    if provider.key == GEMINI.key:
        return GeminiAdapter(api_key=settings.GEMINI_API_KEY, max_rpm=getattr(settings, "PROVIDER_MAX_RPM", 0))
    raise ValueError(f"Unknown provider: {provider.key}")


def select_adapter(settings, registry_model: str) -> tuple[ModelProviderAdapter, str]:
    """Adapter + model label for a call site that has already resolved a label
    from the registry for the ACTIVE provider (so the label is used as given)."""
    provider = active_provider(settings)
    return adapter_for(settings, provider), registry_model
