"""Which provider runs, and the adapter that talks to it.

Order:
- When AI_PROVIDER is explicitly set, that provider is enforced deterministically.
  Missing API keys or incompatible models fail fast immediately.
- When AI_PROVIDER is omitted (legacy/backward-compatible mode):
  OpenAI when OPENAI_API_KEY is set, otherwise Gemini when GEMINI_API_KEY is set.

The chosen provider also decides WHICH registry rows are resolved
(AIProvider -> AIModel -> AIModelVersion). That matters for more than tidiness:
those rows are the audit trail stamped onto every AIRecommendation and the
kill switch an admin uses to stop a model.
"""

from dataclasses import dataclass

from src.providers.base import ModelProviderAdapter
from src.providers.gemini_adapter import GeminiAdapter
from src.providers.openai_adapter import OpenAIAdapter

GEMINI_MODEL = "gemini-3.6-flash"
OPENAI_MODEL = "gpt-4o"


@dataclass(frozen=True)
class ProviderSpec:
    key: str           # internal identifier ("openai" | "gemini")
    provider_name: str  # AIProvider.name in the registry ("OpenAI" | "Google")
    model_name: str     # AIModel.name / default AIModelVersion.versionLabel


OPENAI = ProviderSpec("openai", "OpenAI", OPENAI_MODEL)
GEMINI = ProviderSpec("gemini", "Google", GEMINI_MODEL)


def _validate_model_provider_compatibility(provider_key: str, model: str) -> None:
    norm_model = model.strip().lower()
    if provider_key == "gemini":
        if "gpt-" in norm_model or norm_model.startswith("o1") or norm_model.startswith("o3") or "text-embedding" in norm_model:
            raise ValueError(f"Configured model '{model}' belongs to OpenAI, but active provider is Google Gemini.")
    elif provider_key == "openai":
        if "gemini" in norm_model or "palm" in norm_model:
            raise ValueError(f"Configured model '{model}' belongs to Google Gemini, but active provider is OpenAI.")


def active_provider(settings, purpose: str = "evaluation") -> ProviderSpec:
    """Returns the active ProviderSpec deterministically with independent model
    selection per purpose ('evaluation', 'ocr', 'blueprint')."""
    forced = (getattr(settings, "AI_PROVIDER", "") or "").lower().strip()

    if forced:
        if forced == "gemini":
            if not getattr(settings, "GEMINI_API_KEY", ""):
                raise ValueError("AI_PROVIDER is set to 'gemini', but GEMINI_API_KEY is not configured in the environment.")
            provider_key = "gemini"
        elif forced == "openai":
            if not getattr(settings, "OPENAI_API_KEY", ""):
                raise ValueError("AI_PROVIDER is set to 'openai', but OPENAI_API_KEY is not configured in the environment.")
            provider_key = "openai"
        else:
            raise ValueError(f"Unsupported AI_PROVIDER: '{forced}'. Supported providers are 'openai' and 'gemini'.")
    else:
        # Backward compatibility when AI_PROVIDER is not explicitly specified
        if getattr(settings, "OPENAI_API_KEY", ""):
            provider_key = "openai"
        elif getattr(settings, "GEMINI_API_KEY", ""):
            provider_key = "gemini"
        else:
            raise ValueError("Neither OPENAI_API_KEY nor GEMINI_API_KEY is configured in the environment.")

    # Purpose-specific model resolution
    purpose_norm = (purpose or "evaluation").lower().strip()
    if purpose_norm == "ocr":
        custom_model = getattr(settings, "AI_OCR_MODEL", "")
    elif purpose_norm == "blueprint":
        custom_model = getattr(settings, "AI_BLUEPRINT_MODEL", "")
    else:
        custom_model = getattr(settings, "AI_EVALUATION_MODEL", "")

    default_model = OPENAI_MODEL if provider_key == "openai" else GEMINI_MODEL
    model = custom_model.strip() if custom_model and custom_model.strip() else default_model

    _validate_model_provider_compatibility(provider_key, model)

    if provider_key == "openai":
        return OPENAI if model == OPENAI_MODEL else ProviderSpec("openai", "OpenAI", model)
    else:
        return GEMINI if model == GEMINI_MODEL else ProviderSpec("gemini", "Google", model)


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
