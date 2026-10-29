"""Versioned AI Model Pricing Registry and Cost Estimator.

Calculates estimated USD cost from token usage for accounting and governance.
Values are derived from official vendor pricing tables (per 1,000,000 tokens).
"""

from typing import NamedTuple


class ModelPricing(NamedTuple):
    prompt_per_million: float
    completion_per_million: float
    cached_prompt_per_million: float = 0.0


# Current pricing per 1M tokens as of 2026/production specs
MODEL_PRICING_REGISTRY: dict[str, ModelPricing] = {
    # OpenAI Models
    "gpt-4o": ModelPricing(prompt_per_million=2.50, completion_per_million=10.00, cached_prompt_per_million=1.25),
    "gpt-4o-mini": ModelPricing(prompt_per_million=0.15, completion_per_million=0.60, cached_prompt_per_million=0.075),
    "gpt-4-turbo": ModelPricing(prompt_per_million=10.00, completion_per_million=30.00),
    "o1": ModelPricing(prompt_per_million=15.00, completion_per_million=60.00),
    "o1-mini": ModelPricing(prompt_per_million=3.00, completion_per_million=12.00),
    "o3-mini": ModelPricing(prompt_per_million=1.10, completion_per_million=4.40),

    # Google Gemini Models
    "gemini-1.5-flash": ModelPricing(prompt_per_million=0.075, completion_per_million=0.30, cached_prompt_per_million=0.01875),
    "gemini-1.5-pro": ModelPricing(prompt_per_million=1.25, completion_per_million=5.00, cached_prompt_per_million=0.3125),
    "gemini-2.0-flash": ModelPricing(prompt_per_million=0.10, completion_per_million=0.40, cached_prompt_per_million=0.025),
    "gemini-2.5-flash": ModelPricing(prompt_per_million=0.10, completion_per_million=0.40),
    "gemini-3.5-flash-lite": ModelPricing(prompt_per_million=0.075, completion_per_million=0.30),
    "gemini-3.6-flash": ModelPricing(prompt_per_million=0.075, completion_per_million=0.30),
}

DEFAULT_FALLBACK_PRICING = ModelPricing(prompt_per_million=0.50, completion_per_million=1.50)


def get_model_pricing(model_name: str) -> ModelPricing:
    normalized = model_name.strip().lower()
    for key, pricing in MODEL_PRICING_REGISTRY.items():
        if key in normalized:
            return pricing
    return DEFAULT_FALLBACK_PRICING


def estimate_call_cost_usd(
    model_name: str,
    prompt_tokens: int | None,
    completion_tokens: int | None,
    cached_tokens: int | None = None,
) -> float:
    """Computes estimated cost in USD based on token counts."""
    pricing = get_model_pricing(model_name)
    p_tokens = prompt_tokens or 0
    c_tokens = completion_tokens or 0
    cached = cached_tokens or 0

    normal_prompt = max(0, p_tokens - cached)
    prompt_cost = (normal_prompt / 1_000_000) * pricing.prompt_per_million
    cached_cost = (cached / 1_000_000) * (pricing.cached_prompt_per_million or (pricing.prompt_per_million * 0.5))
    completion_cost = (c_tokens / 1_000_000) * pricing.completion_per_million

    total = prompt_cost + cached_cost + completion_cost
    return round(total, 6)

