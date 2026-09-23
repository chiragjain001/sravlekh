from types import SimpleNamespace

import pytest

from src.analytics.evaluation_status import (
    is_authoritative_response,
    is_human_approved,
    needs_human_evaluation,
)


def response(question_type="LONG_ANSWER", evidence=None, attempt_id="att-1", evaluation=None):
    return SimpleNamespace(
        attemptId=attempt_id,
        evidenceType=evidence,
        question=SimpleNamespace(type=question_type),
        evaluation=evaluation,
    )


@pytest.mark.parametrize("question_type", ["SHORT_ANSWER", "LONG_ANSWER", "PASSAGE_BASED"])
def test_subjective_question_types_always_need_a_human(question_type):
    assert needs_human_evaluation(response(question_type, evidence="DIGITAL_VALUE")) is True


@pytest.mark.parametrize("question_type", ["NUMERICAL", "MCQ", "MATCH_THE_FOLLOWING"])
def test_anything_handwritten_on_a_page_needs_a_human_whatever_the_question_type(question_type):
    """A numerical worked out in a booklet has no capture-time mark. Treating it
    as objective scored a real answer as 0 and hid it from the queue."""
    assert needs_human_evaluation(response(question_type, evidence="PAGE_REGION")) is True


@pytest.mark.parametrize("evidence", ["DIGITAL_VALUE", "OMR_MARK"])
def test_objective_answers_captured_digitally_are_still_scored_at_capture(evidence):
    assert needs_human_evaluation(response("MCQ", evidence=evidence)) is False
    assert is_authoritative_response(response("MCQ", evidence=evidence)) is True


def test_an_ungraded_handwritten_numerical_is_not_authoritative():
    assert is_authoritative_response(response("NUMERICAL", evidence="PAGE_REGION")) is False


def test_an_ai_suggestion_is_never_authoritative_but_a_teacher_version_is():
    ai = SimpleNamespace(currentVersion=SimpleNamespace(source="AI"))
    teacher = SimpleNamespace(currentVersion=SimpleNamespace(source="TEACHER"))
    assert is_authoritative_response(response(evaluation=ai)) is False
    assert is_authoritative_response(response(evaluation=teacher)) is True
    assert is_human_approved(SimpleNamespace(source="REVIEWER")) is True


def test_a_v1_answer_sheet_response_stays_authoritative():
    assert is_authoritative_response(response("LONG_ANSWER", attempt_id=None)) is True
