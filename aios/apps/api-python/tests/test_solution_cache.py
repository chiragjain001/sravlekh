import pytest
from src.evaluation.ai_evaluator import _VERSIONED_SOLUTION_CACHE
from src.evaluation.pricing import estimate_call_cost_usd, get_model_pricing


def test_pricing_registry_resolves_correct_rates():
    gemini_pricing = get_model_pricing("gemini-1.5-flash")
    assert gemini_pricing.prompt_per_million == 0.075
    assert gemini_pricing.completion_per_million == 0.30

    openai_pricing = get_model_pricing("gpt-4o")
    assert openai_pricing.prompt_per_million == 2.50
    assert openai_pricing.completion_per_million == 10.00


def test_estimate_call_cost_usd_calculation():
    # 1,000 prompt tokens + 500 completion tokens on gemini-1.5-flash
    # (1000/1M * 0.075) + (500/1M * 0.30) = 0.000075 + 0.00015 = 0.000225
    cost = estimate_call_cost_usd("gemini-1.5-flash", 1000, 500)
    assert abs(cost - 0.000225) < 1e-6

    # 1,000 prompt tokens + 500 completion tokens on gpt-4o
    # (1000/1M * 2.50) + (500/1M * 10.00) = 0.0025 + 0.0050 = 0.0075
    cost_4o = estimate_call_cost_usd("gpt-4o", 1000, 500)
    assert abs(cost_4o - 0.0075) < 1e-6


def test_versioned_solution_cache_insertion_and_lookup():
    cache_key = "q-version-101:rubric-v2"
    _VERSIONED_SOLUTION_CACHE[cache_key] = "Step 1: Expand. Step 2: Factorize to (x+2)(x-3)."
    
    assert _VERSIONED_SOLUTION_CACHE.get(cache_key) == "Step 1: Expand. Step 2: Factorize to (x+2)(x-3)."
    # Different rubric or question version should miss
    assert _VERSIONED_SOLUTION_CACHE.get("q-version-101:rubric-v3") is None
    assert _VERSIONED_SOLUTION_CACHE.get("q-version-102:rubric-v2") is None

