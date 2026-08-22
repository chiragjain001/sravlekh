import json
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.config import Settings
from src.evaluation.ai_evaluator import evaluate_delivery_batch, evaluate_response

SETTINGS_WITH_KEY = Settings(DATABASE_URL="postgresql://x", JWT_SECRET="x" * 32, OPENAI_API_KEY="sk-test")


def make_question(solution="Photosynthesis converts light to chemical energy.", rubric=None):
    return SimpleNamespace(content="Explain photosynthesis.", solution=solution, rubric=rubric)


def make_response(question, evidence_type="DIGITAL_VALUE", student_answer="Plants use sunlight.", question_region_id=None, evaluation=None):
    return SimpleNamespace(
        id="resp-1",
        attemptId="att-1",
        questionId="q-1",
        evidenceType=evidence_type,
        questionRegionId=question_region_id,
        studentAnswer=student_answer,
        marksAvailable=5,
        question=question,
        attempt=SimpleNamespace(assessmentDelivery=SimpleNamespace(evaluationPolicyId="policy-1")),
        evaluation=evaluation,
    )


def make_db(response, ocr_block=None, ocr_result=None, question_version=None, criterion_scores_captured=None):
    if criterion_scores_captured is None:
        criterion_scores_captured = []
    return SimpleNamespace(
        response=SimpleNamespace(find_unique=AsyncMock(return_value=response), find_many=AsyncMock(return_value=[])),
        ocrblock=SimpleNamespace(find_first=AsyncMock(return_value=ocr_block)),
        ocrresult=SimpleNamespace(find_first=AsyncMock(return_value=ocr_result)),
        rubriccriterion=SimpleNamespace(find_many=AsyncMock(return_value=[])),
        questionversion=SimpleNamespace(find_first=AsyncMock(return_value=question_version)),
        airecommendation=SimpleNamespace(create=AsyncMock(side_effect=lambda data: SimpleNamespace(id="rec-1", **data))),
        evaluation=SimpleNamespace(
            create=AsyncMock(return_value=SimpleNamespace(id="eval-1", currentEvaluationVersionId=None)),
            update=AsyncMock(return_value=SimpleNamespace(id="eval-1")),
        ),
        evaluationversion=SimpleNamespace(create=AsyncMock(side_effect=lambda data: SimpleNamespace(id="ev-ai-1", **data))),
        evaluationcriterionscore=SimpleNamespace(create=AsyncMock(side_effect=lambda data: criterion_scores_captured.append(data) or SimpleNamespace(**data))),
    )


def mock_llm(result_dict):
    fake_llm_instance = SimpleNamespace(ainvoke=AsyncMock(return_value=SimpleNamespace(content=json.dumps(result_dict))))
    return MagicMock(return_value=fake_llm_instance)


# Each test patches resolve_evaluation_ai_model_id/resolve_evaluation_model_version_id/
# resolve_evaluation_prompt_version_id directly (three separate patch() calls — not
# patch.dict, whose dotted string keys are literal dict keys, not attribute paths, so
# it silently no-ops against a module's __dict__ unless the key already matches exactly).


@pytest.mark.asyncio
async def test_skips_when_the_question_has_no_reference_answer():
    response = make_response(make_question(solution=None))
    fake_db = make_db(response)
    with patch("src.evaluation.ai_evaluator.db", fake_db):
        result = await evaluate_response("inst-1", "resp-1", "user-1")
    assert result == {"skipped": True, "reason": "no_reference_answer"}
    fake_db.airecommendation.create.assert_not_awaited()


@pytest.mark.asyncio
async def test_skips_page_region_evidence_with_no_ocr_result():
    response = make_response(make_question(), evidence_type="PAGE_REGION", question_region_id="region-1")
    fake_db = make_db(response, ocr_block=None, ocr_result=None)
    with patch("src.evaluation.ai_evaluator.db", fake_db):
        result = await evaluate_response("inst-1", "resp-1", "user-1")
    assert result == {"skipped": True, "reason": "illegible_handwriting"}


@pytest.mark.asyncio
async def test_skips_page_region_evidence_flagged_requires_visual_evaluation():
    response = make_response(make_question(), evidence_type="PAGE_REGION", question_region_id="region-1")
    ocr_result = SimpleNamespace(id="ocr-1", extractedText=None, confidence=0.0, requiresVisualEvaluation=True)
    fake_db = make_db(response, ocr_block=SimpleNamespace(id="block-1"), ocr_result=ocr_result)
    with patch("src.evaluation.ai_evaluator.db", fake_db):
        result = await evaluate_response("inst-1", "resp-1", "user-1")
    assert result == {"skipped": True, "reason": "illegible_handwriting"}


@pytest.mark.asyncio
async def test_successful_holistic_evaluation_creates_recommendation_and_ai_version():
    response = make_response(make_question())
    fake_db = make_db(response)
    llm_class = mock_llm({"suggestedMarks": 4, "confidence": 0.9, "note": "Good answer", "offTopicSuspected": False})

    with patch("src.evaluation.ai_evaluator.db", fake_db), \
         patch("src.evaluation.ai_evaluator.ChatOpenAI", llm_class), \
         patch("src.evaluation.ai_evaluator.get_settings", return_value=SETTINGS_WITH_KEY), \
         patch("src.evaluation.ai_evaluator.resolve_evaluation_ai_model_id", AsyncMock(return_value="model-1")), \
         patch("src.evaluation.ai_evaluator.resolve_evaluation_model_version_id", AsyncMock(return_value="mv-1")), \
         patch("src.evaluation.ai_evaluator.resolve_evaluation_prompt_version_id", AsyncMock(return_value="pv-1")):
        result = await evaluate_response("inst-1", "resp-1", "user-1")

    fake_db.airecommendation.create.assert_awaited_once()
    created = fake_db.airecommendation.create.await_args.kwargs["data"]
    assert created["suggestedMarks"] == 4
    assert created["flags"] == ["none"]
    fake_db.evaluationversion.create.assert_awaited_once()
    assert fake_db.evaluationversion.create.await_args.kwargs["data"]["source"] == "AI"
    fake_db.evaluation.update.assert_awaited_once_with(where={"id": "eval-1"}, data={"currentEvaluationVersionId": "ev-ai-1", "status": "AI_SUGGESTED"})
    assert result["suggestedMarks"] == 4
    assert result["confidence"] == 0.9


@pytest.mark.asyncio
async def test_flags_low_confidence_below_threshold():
    response = make_response(make_question())
    fake_db = make_db(response)
    llm_class = mock_llm({"suggestedMarks": 2, "confidence": 0.4, "note": "Uncertain", "offTopicSuspected": False})

    with patch("src.evaluation.ai_evaluator.db", fake_db), \
         patch("src.evaluation.ai_evaluator.ChatOpenAI", llm_class), \
         patch("src.evaluation.ai_evaluator.get_settings", return_value=SETTINGS_WITH_KEY), \
         patch("src.evaluation.ai_evaluator.resolve_evaluation_ai_model_id", AsyncMock(return_value="model-1")), \
         patch("src.evaluation.ai_evaluator.resolve_evaluation_model_version_id", AsyncMock(return_value="mv-1")), \
         patch("src.evaluation.ai_evaluator.resolve_evaluation_prompt_version_id", AsyncMock(return_value="pv-1")):
        await evaluate_response("inst-1", "resp-1", "user-1")

    created = fake_db.airecommendation.create.await_args.kwargs["data"]
    assert "low_confidence" in created["flags"]


@pytest.mark.asyncio
async def test_flags_ocr_low_confidence_from_the_underlying_ocr_result():
    response = make_response(make_question(), evidence_type="PAGE_REGION", question_region_id="region-1")
    ocr_result = SimpleNamespace(id="ocr-1", extractedText="plants use sunlight", confidence=0.5, requiresVisualEvaluation=False)
    fake_db = make_db(response, ocr_block=SimpleNamespace(id="block-1"), ocr_result=ocr_result)
    llm_class = mock_llm({"suggestedMarks": 3, "confidence": 0.9, "note": "ok", "offTopicSuspected": False})

    with patch("src.evaluation.ai_evaluator.db", fake_db), \
         patch("src.evaluation.ai_evaluator.ChatOpenAI", llm_class), \
         patch("src.evaluation.ai_evaluator.get_settings", return_value=SETTINGS_WITH_KEY), \
         patch("src.evaluation.ai_evaluator.resolve_evaluation_ai_model_id", AsyncMock(return_value="model-1")), \
         patch("src.evaluation.ai_evaluator.resolve_evaluation_model_version_id", AsyncMock(return_value="mv-1")), \
         patch("src.evaluation.ai_evaluator.resolve_evaluation_prompt_version_id", AsyncMock(return_value="pv-1")):
        await evaluate_response("inst-1", "resp-1", "user-1")

    created = fake_db.airecommendation.create.await_args.kwargs["data"]
    assert "ocr_low_confidence" in created["flags"]
    assert created["evidenceRef"] == {"evidenceType": "PAGE_REGION", "ocrResultId": "ocr-1"}


@pytest.mark.asyncio
async def test_criterion_scores_are_persisted_and_total_is_capped_at_marks_available():
    rubric = SimpleNamespace(versions=[SimpleNamespace(id="rv-1", versionNumber=1)])
    question = make_question(rubric=rubric)
    response = make_response(question)
    response.marksAvailable = 5
    captured: list = []
    fake_db = make_db(response, criterion_scores_captured=captured)
    llm_class = mock_llm({
        "suggestedMarks": 0,
        "suggestedCriterionScores": [
            {"rubricCriterionId": "c1", "marksAwarded": 4, "note": "good"},
            {"rubricCriterionId": "c2", "marksAwarded": 4, "note": "also good"},
        ],
        "confidence": 0.9,
        "offTopicSuspected": False,
    })

    with patch("src.evaluation.ai_evaluator.db", fake_db), \
         patch("src.evaluation.ai_evaluator.ChatOpenAI", llm_class), \
         patch("src.evaluation.ai_evaluator.get_settings", return_value=SETTINGS_WITH_KEY), \
         patch("src.evaluation.ai_evaluator.resolve_evaluation_ai_model_id", AsyncMock(return_value="model-1")), \
         patch("src.evaluation.ai_evaluator.resolve_evaluation_model_version_id", AsyncMock(return_value="mv-1")), \
         patch("src.evaluation.ai_evaluator.resolve_evaluation_prompt_version_id", AsyncMock(return_value="pv-1")):
        result = await evaluate_response("inst-1", "resp-1", "user-1")

    assert result["suggestedMarks"] == 5  # 4 + 4 = 8, capped at marksAvailable=5
    assert len(captured) == 2


@pytest.mark.asyncio
async def test_batch_isolates_a_single_response_failure_from_the_rest():
    async def fake_evaluate(institute_id, response_id, requested_by_user_id):
        if response_id == "resp-bad":
            raise RuntimeError("boom")
        return {"suggestedMarks": 3}

    fake_db = SimpleNamespace(
        response=SimpleNamespace(
            find_many=AsyncMock(return_value=[SimpleNamespace(id="resp-good-1"), SimpleNamespace(id="resp-bad"), SimpleNamespace(id="resp-good-2")])
        )
    )

    with patch("src.evaluation.ai_evaluator.db", fake_db), \
         patch("src.evaluation.ai_evaluator.evaluate_response", fake_evaluate):
        result = await evaluate_delivery_batch("inst-1", "delivery-1", "user-1")

    assert result == {"totalResponses": 3, "succeeded": 2, "skipped": 0, "failed": 1}
