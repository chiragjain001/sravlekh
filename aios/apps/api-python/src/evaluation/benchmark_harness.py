"""Grading Accuracy and Model Comparison Benchmark Harness (Phase 3).

Provides a reproducible evaluation harness comparing candidate LLM evaluation models
against trusted teacher-assigned marks on:
- Exact-score agreement rate
- Within 0.5-mark agreement rate
- Mean Absolute Error (MAE)
- Serious over-marking (>15% marks over teacher grade)
- Serious under-marking (>15% marks under teacher grade)
- Mistake tag classification agreement
- Cost and latency efficiency
"""

from dataclasses import dataclass, field
import statistics
from typing import Callable, Awaitable


@dataclass
class BenchmarkItem:
    item_id: str
    subject: str
    question_content: str
    reference_answer: str
    student_answer: str
    max_marks: float
    teacher_awarded_marks: float
    teacher_mistake_tag: str | None = None
    is_handwritten: bool = False
    handwriting_quality: str = "HIGH"  # "HIGH", "MEDIUM", "LOW"
    rubric_criteria: list[dict] = field(default_factory=list)


@dataclass
class ModelEvalResult:
    suggested_marks: float
    confidence: float
    mistake_tag: str | None = None
    latency_ms: float = 0.0
    tokens_used: int = 0
    cost_usd: float = 0.0


@dataclass
class BenchmarkMetrics:
    total_items: int
    exact_agreement_rate: float
    within_half_mark_rate: float
    mean_absolute_error: float
    overmarking_rate: float
    undermarking_rate: float
    mistake_tag_agreement_rate: float
    average_latency_ms: float
    average_cost_usd: float
    passed_acceptance_gate: bool


# Acceptance criteria gates for candidate model promotion (Phase 3 §7)
MAE_THRESHOLD = 0.75
WITHIN_HALF_MARK_THRESHOLD = 0.80  # 80% within 0.5 marks of teacher grade
MAX_OVERMARKING_THRESHOLD = 0.08    # At most 8% serious over-marking


def calculate_benchmark_metrics(
    items: list[BenchmarkItem],
    results: list[ModelEvalResult],
) -> BenchmarkMetrics:
    if not items or len(items) != len(results):
        raise ValueError("Item count must match result count and be non-empty.")

    n = len(items)
    exact_count = 0
    within_half_count = 0
    abs_errors: list[float] = []
    overmark_count = 0
    undermark_count = 0
    tag_matches = 0
    tag_comparable = 0
    total_latency = 0.0
    total_cost = 0.0

    for item, res in zip(items, results):
        diff = res.suggested_marks - item.teacher_awarded_marks
        abs_err = abs(diff)
        abs_errors.append(abs_err)

        if abs_err < 0.01:
            exact_count += 1
        if abs_err <= 0.50:
            within_half_count += 1

        # Serious discrepancy: > 15% difference relative to question max marks
        discrepancy_threshold = max(0.5, item.max_marks * 0.15)
        if diff > discrepancy_threshold:
            overmark_count += 1
        elif diff < -discrepancy_threshold:
            undermark_count += 1

        if item.teacher_mistake_tag:
            tag_comparable += 1
            if res.mistake_tag == item.teacher_mistake_tag:
                tag_matches += 1

        total_latency += res.latency_ms
        total_cost += res.cost_usd

    mae = statistics.mean(abs_errors)
    exact_rate = exact_count / n
    within_half_rate = within_half_count / n
    over_rate = overmark_count / n
    under_rate = undermark_count / n
    tag_rate = (tag_matches / tag_comparable) if tag_comparable > 0 else 1.0

    passed = (
        mae <= MAE_THRESHOLD
        and within_half_rate >= WITHIN_HALF_MARK_THRESHOLD
        and over_rate <= MAX_OVERMARKING_THRESHOLD
    )

    return BenchmarkMetrics(
        total_items=n,
        exact_agreement_rate=round(exact_rate, 4),
        within_half_mark_rate=round(within_half_rate, 4),
        mean_absolute_error=round(mae, 4),
        overmarking_rate=round(over_rate, 4),
        undermarking_rate=round(under_rate, 4),
        mistake_tag_agreement_rate=round(tag_rate, 4),
        average_latency_ms=round(total_latency / n, 2),
        average_cost_usd=round(total_cost / n, 6),
        passed_acceptance_gate=passed,
    )


# Standard synthetic ground-truth benchmark suite for testing without external billable calls
SYNTHETIC_BENCHMARK_SUITE: list[BenchmarkItem] = [
    BenchmarkItem(
        item_id="math-001",
        subject="Mathematics",
        question_content="Solve for x: 2x + 6 = 14",
        reference_answer="2x = 14 - 6 = 8, so x = 4",
        student_answer="2x = 8, x = 4",
        max_marks=2.0,
        teacher_awarded_marks=2.0,
        is_handwritten=True,
    ),
    BenchmarkItem(
        item_id="math-002",
        subject="Mathematics",
        question_content="Find the area of a circle with radius 7 cm (use pi = 22/7)",
        reference_answer="Area = pi * r^2 = (22/7) * 7 * 7 = 154 cm^2",
        student_answer="Area = 2 * pi * r = 2 * (22/7) * 7 = 44 cm^2",
        max_marks=3.0,
        teacher_awarded_marks=1.0,
        teacher_mistake_tag="FORMULA_ERROR",
        is_handwritten=True,
    ),
    BenchmarkItem(
        item_id="science-001",
        subject="Science",
        question_content="State Newton's First Law of Motion.",
        reference_answer="An object remains in a state of rest or uniform motion in a straight line unless acted upon by an external unbalanced force.",
        student_answer="An object stays at rest or moves in a straight line unless an external force acts on it.",
        max_marks=2.0,
        teacher_awarded_marks=2.0,
    ),
    BenchmarkItem(
        item_id="science-002",
        subject="Science",
        question_content="What is photosynthesis? Write the chemical formula.",
        reference_answer="Process by which plants convert sunlight, water, and CO2 into glucose and O2. 6CO2 + 6H2O -> C6H12O6 + 6O2",
        student_answer="Plants make food from sunlight. CO2 + H2O -> sugar + O2 (unbalanced)",
        max_marks=4.0,
        teacher_awarded_marks=2.5,
        teacher_mistake_tag="CALCULATION_ERROR",
    ),
    BenchmarkItem(
        item_id="english-001",
        subject="English",
        question_content="Explain the metaphor 'All the world's a stage'.",
        reference_answer="It compares life to a theatre where humans are actors with entrances and exits playing different roles.",
        student_answer="It means life is like acting in a drama where everyone plays a role from birth to death.",
        max_marks=3.0,
        teacher_awarded_marks=3.0,
    ),
]

