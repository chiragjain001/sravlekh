import pytest
from src.evaluation.benchmark_harness import (
    SYNTHETIC_BENCHMARK_SUITE,
    BenchmarkItem,
    ModelEvalResult,
    calculate_benchmark_metrics,
)


def test_benchmark_metrics_with_high_accuracy_passes_gate():
    items = SYNTHETIC_BENCHMARK_SUITE
    # Simulated model outputs very close to teacher marks
    results = [
        ModelEvalResult(suggested_marks=2.0, confidence=0.95, latency_ms=120.0, tokens_used=800, cost_usd=0.0002),
        ModelEvalResult(suggested_marks=1.0, confidence=0.90, mistake_tag="FORMULA_ERROR", latency_ms=140.0, tokens_used=950, cost_usd=0.0003),
        ModelEvalResult(suggested_marks=2.0, confidence=0.92, latency_ms=110.0, tokens_used=750, cost_usd=0.0002),
        ModelEvalResult(suggested_marks=2.5, confidence=0.88, mistake_tag="CALCULATION_ERROR", latency_ms=150.0, tokens_used=1100, cost_usd=0.0004),
        ModelEvalResult(suggested_marks=3.0, confidence=0.96, latency_ms=130.0, tokens_used=850, cost_usd=0.0002),
    ]

    metrics = calculate_benchmark_metrics(items, results)
    assert metrics.exact_agreement_rate == 1.0
    assert metrics.mean_absolute_error == 0.0
    assert metrics.overmarking_rate == 0.0
    assert metrics.mistake_tag_agreement_rate == 1.0
    assert metrics.passed_acceptance_gate is True


def test_benchmark_metrics_with_serious_overmarking_fails_gate():
    items = SYNTHETIC_BENCHMARK_SUITE
    # Simulated model with significant score inflation
    results = [
        ModelEvalResult(suggested_marks=2.0, confidence=0.95),
        # Teacher gave 1.0, model gave 3.0 (severe overmarking > 15% of max marks)
        ModelEvalResult(suggested_marks=3.0, confidence=0.90),
        ModelEvalResult(suggested_marks=2.0, confidence=0.92),
        # Teacher gave 2.5, model gave 4.0 (severe overmarking)
        ModelEvalResult(suggested_marks=4.0, confidence=0.88),
        ModelEvalResult(suggested_marks=3.0, confidence=0.96),
    ]

    metrics = calculate_benchmark_metrics(items, results)
    assert metrics.mean_absolute_error > 0.5
    assert metrics.overmarking_rate >= 0.40  # 40% over-marking exceeds 8% gate
    assert metrics.passed_acceptance_gate is False

