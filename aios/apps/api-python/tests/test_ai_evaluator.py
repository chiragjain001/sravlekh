import hashlib
import json
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from langchain_core.output_parsers import PydanticOutputParser
from prisma import Json

from src.config import Settings
from src.evaluation.ai_evaluator import (
    EVALUATION_MAX_TOKENS,
    EVALUATION_TEMPERATURE,
    AIEvaluationResult,
    _build_prompt,
    evaluate_delivery_batch,
    evaluate_response,
)
from src.evaluation.ai_model_registry import PROMPT_TEMPLATE
from src.providers.types import GenerateResult

SETTINGS_WITH_KEY = Settings(DATABASE_URL="postgresql://x", JWT_SECRET="x" * 32, OPENAI_API_KEY="sk-test")


def make_question(solution="Photosynthesis converts light to chemical energy.", rubric=None):
    return SimpleNamespace(content="Explain photosynthesis.", solution=solution, rubric=rubric)


def make_response(question, evidence_type="DIGITAL_VALUE", student_answer="Plants use sunlight.", question_region_id=None, evaluation=None, institute_id="inst-1"):
    return SimpleNamespace(
        id="resp-1",
        attemptId="att-1",
        questionId="q-1",
        evidenceType=evidence_type,
        questionRegionId=question_region_id,
        studentAnswer=student_answer,
        marksAvailable=5,
        question=question,
        attempt=SimpleNamespace(
            assessmentDelivery=SimpleNamespace(
                evaluationPolicyId="policy-1",
                assessment=SimpleNamespace(instituteId=institute_id),
            )
        ),
        evaluation=evaluation,
    )


def make_db(response, ocr_block=None, ocr_result=None, question_version=None, criterion_scores_captured=None, claimed=1):
    """`claimed` is the row count returned by the conditional evaluation.update_many
    compare-and-swap — 1 means this call won the claim, 0 means a concurrent
    execution already committed (see the race guard in evaluate_response)."""
    if criterion_scores_captured is None:
        criterion_scores_captured = []
    return SimpleNamespace(
        response=SimpleNamespace(find_unique=AsyncMock(return_value=response), find_many=AsyncMock(return_value=[])),
        pageregion=SimpleNamespace(find_unique=AsyncMock(return_value=SimpleNamespace(id="region-1", boundingBox={"x": 0.1, "y": 0.2, "width": 0.6, "height": 0.3}))),
        ocrblock=SimpleNamespace(find_many=AsyncMock(return_value=[ocr_block] if ocr_block else [])),
        ocrresult=SimpleNamespace(find_first=AsyncMock(return_value=ocr_result)),
        rubriccriterion=SimpleNamespace(find_many=AsyncMock(return_value=[])),
        questionversion=SimpleNamespace(find_first=AsyncMock(return_value=question_version)),
        airecommendation=SimpleNamespace(
            create=AsyncMock(side_effect=lambda data: SimpleNamespace(id="rec-1", **data)),
            delete=AsyncMock(),
        ),
        evaluation=SimpleNamespace(
            create=AsyncMock(return_value=SimpleNamespace(id="eval-1", currentEvaluationVersionId=None)),
            update=AsyncMock(return_value=SimpleNamespace(id="eval-1")),
            update_many=AsyncMock(return_value=claimed),
        ),
        evaluationversion=SimpleNamespace(
            create=AsyncMock(side_effect=lambda data: SimpleNamespace(id="ev-ai-1", **data)),
            delete=AsyncMock(),
        ),
        evaluationcriterionscore=SimpleNamespace(create=AsyncMock(side_effect=lambda data: criterion_scores_captured.append(data) or SimpleNamespace(**data))),
    )


def mock_llm(result_dict):
    """P1 B1 Stage 2: fakes the ADAPTER, not ChatOpenAI — evaluation no longer
    constructs a vendor client, so the seam these tests hold is now
    OpenAIAdapter(...).generate(GenerateRequest) -> GenerateResult. Kept under
    the original name and MagicMock-returning-an-instance shape so the twelve
    existing call sites keep working unchanged; `.return_value.generate` is the
    adapter-boundary equivalent of the old `.return_value.ainvoke`."""
    fake_adapter_instance = SimpleNamespace(
        generate=AsyncMock(return_value=GenerateResult(text=json.dumps(result_dict)))
    )
    return MagicMock(return_value=fake_adapter_instance)


# Each test patches resolve_evaluation_ai_model_id/resolve_evaluation_model_version_id/
# resolve_evaluation_prompt_version_id directly (three separate patch() calls — not
# patch.dict, whose dotted string keys are literal dict keys, not attribute paths, so
# it silently no-ops against a module's __dict__ unless the key already matches exactly).


def registry_patches(adapter_class, prompt_version=None):
    """The five patches every LLM-reaching test needs, as one context manager."""
    from contextlib import ExitStack

    stack = ExitStack()
    stack.enter_context(patch("src.providers.factory.OpenAIAdapter", adapter_class))
    stack.enter_context(patch("src.evaluation.ai_evaluator.get_settings", return_value=SETTINGS_WITH_KEY))
    stack.enter_context(patch("src.evaluation.ai_evaluator.resolve_evaluation_ai_model_id", AsyncMock(return_value="model-1")))
    stack.enter_context(
        patch(
            "src.evaluation.ai_evaluator.resolve_active_evaluation_model_version",
            AsyncMock(return_value=SimpleNamespace(id="mv-1", versionLabel="gpt-4o")),
        )
    )
    stack.enter_context(
        patch(
            "src.evaluation.ai_evaluator.resolve_evaluation_prompt_version_id",
            prompt_version or AsyncMock(return_value="pv-1"),
        )
    )
    return stack


@pytest.mark.asyncio
async def test_no_reference_answer_is_graded_by_the_model_solving_it_itself_and_flagged():
    """No longer a skip: the no-reference template is sent, registered under its
    own prompt version, and the result carries the model's solution plus a
    no_reference_answer flag so the reviewing teacher can see it."""
    from src.evaluation.ai_model_registry import (
        PROMPT_TEMPLATE_NO_REFERENCE,
        PROMPT_VERSION_LABEL_NO_REFERENCE,
    )

    response = make_response(make_question(solution=None))
    fake_db = make_db(response)
    adapter_class = mock_llm({
        "suggestedMarks": 3, "confidence": 0.8, "offTopicSuspected": False,
        "verdict": "PARTIALLY_CORRECT", "mistakeTag": "CONCEPT_ERROR",
        "modelSolution": "Light energy is converted to chemical energy (glucose).",
        "breakdown": [
            {"tag": "concept", "maxMarks": 3, "marksAwarded": 2, "note": "Missing chlorophyll"},
            {"tag": "KEY_POINTS", "maxMarks": 2, "marksAwarded": 1},
        ],
    })
    prompt_version = AsyncMock(return_value="pv-noref")
    with patch("src.evaluation.ai_evaluator.db", fake_db), registry_patches(adapter_class, prompt_version):
        result = await evaluate_response("inst-1", "resp-1", "user-1")

    sent_prompt = adapter_class.return_value.generate.await_args.args[0].content[0].text
    assert "Reference answer" not in sent_prompt
    assert "First solve the question yourself" in sent_prompt
    assert prompt_version.await_args.args[2:] == (PROMPT_VERSION_LABEL_NO_REFERENCE, PROMPT_TEMPLATE_NO_REFERENCE)

    created = fake_db.airecommendation.create.await_args.kwargs["data"]
    assert created["flags"] == ["no_reference_answer"]
    assert created["suggestedMarks"] == 3
    breakdown = created["gradingBreakdown"].data
    assert breakdown["referenceUsed"] is False
    assert breakdown["modelSolution"].startswith("Light energy")
    assert breakdown["verdict"] == "PARTIALLY_CORRECT"
    assert [t["tag"] for t in breakdown["tags"]] == ["CONCEPT", "KEY_POINTS"]
    version = fake_db.evaluationversion.create.await_args.kwargs["data"]
    assert version["mistakeTagType"] == "CONCEPT_ERROR"
    assert result["gradingBreakdown"]["tags"][0]["marksAwarded"] == 2


@pytest.mark.asyncio
async def test_breakdown_total_wins_over_suggested_marks_and_each_part_is_clamped():
    """The teacher edits the parts, so the total is their sum — and a part
    awarded more than its own max cannot inflate it."""
    response = make_response(make_question())
    fake_db = make_db(response)
    adapter_class = mock_llm({
        "suggestedMarks": 5, "confidence": 0.9,
        "breakdown": [
            {"tag": "FORMULA", "maxMarks": 1, "marksAwarded": 3},
            {"tag": "CALCULATION", "maxMarks": 2, "marksAwarded": 1},
            {"tag": "FINAL_ANSWER", "maxMarks": 2, "marksAwarded": 0},
        ],
    })
    with patch("src.evaluation.ai_evaluator.db", fake_db), registry_patches(adapter_class):
        result = await evaluate_response("inst-1", "resp-1", "user-1")

    assert result["suggestedMarks"] == 2  # 1 (clamped from 3) + 1 + 0
    breakdown = fake_db.airecommendation.create.await_args.kwargs["data"]["gradingBreakdown"].data
    assert breakdown["tags"][0]["marksAwarded"] == 1
    assert breakdown["referenceUsed"] is True
    assert breakdown["modelSolution"] is None


@pytest.mark.asyncio
async def test_breakdown_whose_parts_do_not_add_up_to_the_question_marks_is_flagged():
    response = make_response(make_question())  # marksAvailable=5
    fake_db = make_db(response)
    adapter_class = mock_llm({
        "suggestedMarks": 3, "confidence": 0.9,
        "breakdown": [{"tag": "CONCEPT", "maxMarks": 2, "marksAwarded": 2}, {"tag": "EXAMPLE", "maxMarks": 2, "marksAwarded": 1}],
    })
    with patch("src.evaluation.ai_evaluator.db", fake_db), registry_patches(adapter_class):
        await evaluate_response("inst-1", "resp-1", "user-1")

    assert "breakdown_mismatch" in fake_db.airecommendation.create.await_args.kwargs["data"]["flags"]


@pytest.mark.asyncio
async def test_unknown_verdict_and_mistake_tag_are_dropped_not_written_to_the_enum_column():
    response = make_response(make_question())
    fake_db = make_db(response)
    adapter_class = mock_llm({"suggestedMarks": 2, "confidence": 0.9, "verdict": "MOSTLY_OK", "mistakeTag": "SPELLING"})
    with patch("src.evaluation.ai_evaluator.db", fake_db), registry_patches(adapter_class):
        await evaluate_response("inst-1", "resp-1", "user-1")

    breakdown = fake_db.airecommendation.create.await_args.kwargs["data"]["gradingBreakdown"].data
    assert breakdown["verdict"] is None and breakdown["mistakeTag"] is None
    assert "mistakeTagType" not in fake_db.evaluationversion.create.await_args.kwargs["data"]


@pytest.mark.asyncio
async def test_c3_rejects_a_response_belonging_to_a_different_institute():
    response = make_response(make_question(), institute_id="inst-OTHER")
    fake_db = make_db(response)
    with patch("src.evaluation.ai_evaluator.db", fake_db):
        result = await evaluate_response("inst-1", "resp-1", "user-1")
    assert result == {"skipped": True, "reason": "response_not_found"}
    fake_db.airecommendation.create.assert_not_awaited()


@pytest.mark.asyncio
async def test_c3_same_tenant_response_proceeds_normally():
    # Regression: the existing "inst-1" default on make_response must still
    # reach the LLM call unaffected by the new institute check.
    response = make_response(make_question(), institute_id="inst-1")
    fake_db = make_db(response)
    llm_class = mock_llm({"suggestedMarks": 4.0, "confidence": 0.9, "suggestedCriterionScores": None})
    with patch("src.evaluation.ai_evaluator.db", fake_db), \
         patch("src.providers.factory.OpenAIAdapter", llm_class), \
         patch("src.evaluation.ai_evaluator.get_settings", return_value=SETTINGS_WITH_KEY), \
         patch("src.evaluation.ai_evaluator.resolve_evaluation_ai_model_id", AsyncMock(return_value="model-1")), \
         patch("src.evaluation.ai_evaluator.resolve_active_evaluation_model_version", AsyncMock(return_value=SimpleNamespace(id="mv-1", versionLabel="gpt-4o"))), \
         patch("src.evaluation.ai_evaluator.resolve_evaluation_prompt_version_id", AsyncMock(return_value="pv-1")):
        result = await evaluate_response("inst-1", "resp-1", "user-1")
    assert result.get("skipped") is not True
    fake_db.airecommendation.create.assert_awaited_once()


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
    fake_db = make_db(response, ocr_block=SimpleNamespace(id="block-1", boundingBox={"x": 0.1, "y": 0.2, "width": 0.6, "height": 0.3}), ocr_result=ocr_result)
    with patch("src.evaluation.ai_evaluator.db", fake_db):
        result = await evaluate_response("inst-1", "resp-1", "user-1")
    assert result == {"skipped": True, "reason": "illegible_handwriting"}


@pytest.mark.asyncio
async def test_successful_holistic_evaluation_creates_recommendation_and_ai_version():
    response = make_response(make_question())
    fake_db = make_db(response)
    llm_class = mock_llm({"suggestedMarks": 4, "confidence": 0.9, "note": "Good answer", "offTopicSuspected": False})

    with patch("src.evaluation.ai_evaluator.db", fake_db), \
         patch("src.providers.factory.OpenAIAdapter", llm_class), \
         patch("src.evaluation.ai_evaluator.get_settings", return_value=SETTINGS_WITH_KEY), \
         patch("src.evaluation.ai_evaluator.resolve_evaluation_ai_model_id", AsyncMock(return_value="model-1")), \
         patch("src.evaluation.ai_evaluator.resolve_active_evaluation_model_version", AsyncMock(return_value=SimpleNamespace(id="mv-1", versionLabel="gpt-4o"))), \
         patch("src.evaluation.ai_evaluator.resolve_evaluation_prompt_version_id", AsyncMock(return_value="pv-1")):
        result = await evaluate_response("inst-1", "resp-1", "user-1")

    fake_db.airecommendation.create.assert_awaited_once()
    created = fake_db.airecommendation.create.await_args.kwargs["data"]
    assert created["suggestedMarks"] == 4
    assert created["flags"] == ["none"]
    fake_db.evaluationversion.create.assert_awaited_once()
    assert fake_db.evaluationversion.create.await_args.kwargs["data"]["source"] == "AI"
    # Conditional write: the where-clause pins currentEvaluationVersionId to what it
    # was when this call started, so a concurrent commit makes this a no-op rather
    # than a second write forking the chain.
    fake_db.evaluation.update_many.assert_awaited_once_with(
        where={"id": "eval-1", "currentEvaluationVersionId": None},
        data={"currentEvaluationVersionId": "ev-ai-1", "status": "AI_SUGGESTED"},
    )
    assert result["suggestedMarks"] == 4
    assert result["confidence"] == 0.9


@pytest.mark.asyncio
async def test_flags_low_confidence_below_threshold():
    response = make_response(make_question())
    fake_db = make_db(response)
    llm_class = mock_llm({"suggestedMarks": 2, "confidence": 0.4, "note": "Uncertain", "offTopicSuspected": False})

    with patch("src.evaluation.ai_evaluator.db", fake_db), \
         patch("src.providers.factory.OpenAIAdapter", llm_class), \
         patch("src.evaluation.ai_evaluator.get_settings", return_value=SETTINGS_WITH_KEY), \
         patch("src.evaluation.ai_evaluator.resolve_evaluation_ai_model_id", AsyncMock(return_value="model-1")), \
         patch("src.evaluation.ai_evaluator.resolve_active_evaluation_model_version", AsyncMock(return_value=SimpleNamespace(id="mv-1", versionLabel="gpt-4o"))), \
         patch("src.evaluation.ai_evaluator.resolve_evaluation_prompt_version_id", AsyncMock(return_value="pv-1")):
        await evaluate_response("inst-1", "resp-1", "user-1")

    created = fake_db.airecommendation.create.await_args.kwargs["data"]
    assert "low_confidence" in created["flags"]


@pytest.mark.asyncio
async def test_flags_ocr_low_confidence_from_the_underlying_ocr_result():
    response = make_response(make_question(), evidence_type="PAGE_REGION", question_region_id="region-1")
    ocr_result = SimpleNamespace(id="ocr-1", extractedText="plants use sunlight", confidence=0.5, requiresVisualEvaluation=False)
    fake_db = make_db(response, ocr_block=SimpleNamespace(id="block-1", boundingBox={"x": 0.1, "y": 0.2, "width": 0.6, "height": 0.3}), ocr_result=ocr_result)
    llm_class = mock_llm({"suggestedMarks": 3, "confidence": 0.9, "note": "ok", "offTopicSuspected": False})

    with patch("src.evaluation.ai_evaluator.db", fake_db), \
         patch("src.providers.factory.OpenAIAdapter", llm_class), \
         patch("src.evaluation.ai_evaluator.get_settings", return_value=SETTINGS_WITH_KEY), \
         patch("src.evaluation.ai_evaluator.resolve_evaluation_ai_model_id", AsyncMock(return_value="model-1")), \
         patch("src.evaluation.ai_evaluator.resolve_active_evaluation_model_version", AsyncMock(return_value=SimpleNamespace(id="mv-1", versionLabel="gpt-4o"))), \
         patch("src.evaluation.ai_evaluator.resolve_evaluation_prompt_version_id", AsyncMock(return_value="pv-1")):
        await evaluate_response("inst-1", "resp-1", "user-1")

    created = fake_db.airecommendation.create.await_args.kwargs["data"]
    assert "ocr_low_confidence" in created["flags"]
    # Json columns are wrapped in prisma.Json — a bare dict is rejected by the
    # query engine at runtime, so the wrapper is part of the contract, not noise.
    assert isinstance(created["evidenceRef"], Json)
    assert created["evidenceRef"].data == {"evidenceType": "PAGE_REGION", "ocrResultId": "ocr-1"}


# P1 D2: 24-OCR-HANDWRITING-ARCHITECTURE.md §5's routing table, implemented exactly.
# | < 0.5        | AI evaluation SKIPPED, flag illegible_handwriting            |
# | 0.5 – 0.85   | AI evaluation proceeds, flag ocr_low_confidence               |
# | >= 0.85      | AI evaluation proceeds, no OCR flag                           |
# Full boundary matrix — both edges of both bands, not just interior samples.
@pytest.mark.parametrize(
    "confidence,should_skip,expect_ocr_low_confidence_flag",
    [
        (0.0, True, None),      # far below floor
        (0.3, True, None),      # "below 0.5" — the case the audit named directly
        (0.49, True, None),     # just under the floor
        (0.5, False, True),     # exactly 0.5 — inclusive lower edge of the proceed band
        (0.6, False, True),     # interior of 0.5-0.85
        (0.84, False, True),    # just under the ceiling
        (0.85, False, False),   # exactly 0.85 — inclusive lower edge of "clean", per
                                 # the pre-existing `< 0.85` flag check this doesn't touch
        (0.95, False, False),   # above 0.85
    ],
)
@pytest.mark.asyncio
async def test_ocr_confidence_routing_boundary_matrix(confidence, should_skip, expect_ocr_low_confidence_flag):
    response = make_response(make_question(), evidence_type="PAGE_REGION", question_region_id="region-1")
    ocr_result = SimpleNamespace(id="ocr-1", extractedText="plants use sunlight", confidence=confidence, requiresVisualEvaluation=False)
    fake_db = make_db(response, ocr_block=SimpleNamespace(id="block-1", boundingBox={"x": 0.1, "y": 0.2, "width": 0.6, "height": 0.3}), ocr_result=ocr_result)
    llm_class = mock_llm({"suggestedMarks": 3, "confidence": 0.9, "note": "ok", "offTopicSuspected": False})

    with patch("src.evaluation.ai_evaluator.db", fake_db), \
         patch("src.providers.factory.OpenAIAdapter", llm_class), \
         patch("src.evaluation.ai_evaluator.get_settings", return_value=SETTINGS_WITH_KEY), \
         patch("src.evaluation.ai_evaluator.resolve_evaluation_ai_model_id", AsyncMock(return_value="model-1")), \
         patch("src.evaluation.ai_evaluator.resolve_active_evaluation_model_version", AsyncMock(return_value=SimpleNamespace(id="mv-1", versionLabel="gpt-4o"))), \
         patch("src.evaluation.ai_evaluator.resolve_evaluation_prompt_version_id", AsyncMock(return_value="pv-1")):
        result = await evaluate_response("inst-1", "resp-1", "user-1")

    if should_skip:
        assert result == {"skipped": True, "reason": "illegible_handwriting"}, f"confidence={confidence}"
        llm_class.assert_not_called()
        fake_db.airecommendation.create.assert_not_awaited()
        fake_db.evaluationversion.create.assert_not_awaited()
    else:
        assert result.get("skipped") is not True, f"confidence={confidence} should have proceeded, got {result}"
        created = fake_db.airecommendation.create.await_args.kwargs["data"]
        assert ("ocr_low_confidence" in created["flags"]) is expect_ocr_low_confidence_flag, f"confidence={confidence}"


@pytest.mark.asyncio
async def test_illegible_handwriting_skip_never_writes_anything_an_authoritative_consumer_could_read():
    """The other half of D2's requirement: a skip must not merely return the right
    reason string, it must leave zero trace for mastery/ScoreRecord to pick up. This
    directly protects the P0 invariant (evaluation_status.is_authoritative_response
    already excludes a v2 response with no Evaluation row) by confirming this skip
    path is exactly that — no Evaluation, no EvaluationVersion, no AIRecommendation."""
    response = make_response(make_question(), evidence_type="PAGE_REGION", question_region_id="region-1")
    ocr_result = SimpleNamespace(id="ocr-1", extractedText="garbled illegible text", confidence=0.1, requiresVisualEvaluation=False)
    fake_db = make_db(response, ocr_block=SimpleNamespace(id="block-1", boundingBox={"x": 0.1, "y": 0.2, "width": 0.6, "height": 0.3}), ocr_result=ocr_result)

    with patch("src.evaluation.ai_evaluator.db", fake_db):
        result = await evaluate_response("inst-1", "resp-1", "user-1")

    assert result == {"skipped": True, "reason": "illegible_handwriting"}
    fake_db.airecommendation.create.assert_not_awaited()
    fake_db.evaluationversion.create.assert_not_awaited()
    fake_db.evaluation.update_many.assert_not_awaited()
    # response.evaluation is still None here (make_db's response has no .evaluation
    # set) — the exact shape is_authoritative_response(response) treats as "not yet
    # graded" for a v2 subjective response, per test_mastery_engine.py's
    # test_v2_subjective_response_with_no_evaluation_row_is_excluded_not_scored_zero.
    assert response.evaluation is None


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
         patch("src.providers.factory.OpenAIAdapter", llm_class), \
         patch("src.evaluation.ai_evaluator.get_settings", return_value=SETTINGS_WITH_KEY), \
         patch("src.evaluation.ai_evaluator.resolve_evaluation_ai_model_id", AsyncMock(return_value="model-1")), \
         patch("src.evaluation.ai_evaluator.resolve_active_evaluation_model_version", AsyncMock(return_value=SimpleNamespace(id="mv-1", versionLabel="gpt-4o"))), \
         patch("src.evaluation.ai_evaluator.resolve_evaluation_prompt_version_id", AsyncMock(return_value="pv-1")):
        result = await evaluate_response("inst-1", "resp-1", "user-1")

    assert result["suggestedMarks"] == 5  # 4 + 4 = 8, capped at marksAvailable=5
    assert len(captured) == 2


# 27 §8a — the registry is an execution control, not an audit label: with no active
# model version, evaluation does not fall back to a hardcoded default.
@pytest.mark.asyncio
async def test_no_active_model_configured_skips_to_human_queue_without_calling_the_llm():
    response = make_response(make_question())
    fake_db = make_db(response)
    llm_class = mock_llm({"suggestedMarks": 4, "confidence": 0.9, "offTopicSuspected": False})

    with patch("src.evaluation.ai_evaluator.db", fake_db), \
         patch("src.providers.factory.OpenAIAdapter", llm_class), \
         patch("src.evaluation.ai_evaluator.get_settings", return_value=SETTINGS_WITH_KEY), \
         patch("src.evaluation.ai_evaluator.resolve_evaluation_ai_model_id", AsyncMock(return_value="model-1")), \
         patch("src.evaluation.ai_evaluator.resolve_active_evaluation_model_version", AsyncMock(return_value=None)), \
         patch("src.evaluation.ai_evaluator.resolve_evaluation_prompt_version_id", AsyncMock(return_value="pv-1")):
        result = await evaluate_response("inst-1", "resp-1", "user-1")

    assert result == {"skipped": True, "reason": "no_active_model_configured"}
    llm_class.assert_not_called()
    fake_db.airecommendation.create.assert_not_awaited()


# 27 §6 — the hard timeout lives here, not only at the NestJS caller.
@pytest.mark.asyncio
async def test_slow_llm_call_times_out_and_routes_to_the_human_queue():
    response = make_response(make_question())
    fake_db = make_db(response)
    # The timeout wrapper sits OUTSIDE the adapter (B1 Stage 1 contract), so the
    # adapter itself is what stalls/raises here — the wrapper is what turns it
    # into the skip. Adapter boundary, same behavior.
    hanging_llm = MagicMock(return_value=SimpleNamespace(generate=AsyncMock(side_effect=TimeoutError())))

    with patch("src.evaluation.ai_evaluator.db", fake_db), \
         patch("src.providers.factory.OpenAIAdapter", hanging_llm), \
         patch("src.evaluation.ai_evaluator.get_settings", return_value=SETTINGS_WITH_KEY), \
         patch("src.evaluation.ai_evaluator.resolve_evaluation_ai_model_id", AsyncMock(return_value="model-1")), \
         patch("src.evaluation.ai_evaluator.resolve_active_evaluation_model_version", AsyncMock(return_value=SimpleNamespace(id="mv-1", versionLabel="gpt-4o"))), \
         patch("src.evaluation.ai_evaluator.resolve_evaluation_prompt_version_id", AsyncMock(return_value="pv-1")):
        result = await evaluate_response("inst-1", "resp-1", "user-1")

    assert result == {"skipped": True, "reason": "ai_evaluation_timeout"}
    fake_db.airecommendation.create.assert_not_awaited()


@pytest.mark.asyncio
async def test_losing_a_concurrent_claim_discards_its_rows_instead_of_forking_the_chain():
    """A NestJS queue retry racing a still-live first attempt must not leave a second
    EvaluationVersion chained off the same previousVersionId."""
    response = make_response(make_question())
    fake_db = make_db(response, claimed=0)  # another execution already committed
    llm_class = mock_llm({"suggestedMarks": 4, "confidence": 0.9, "offTopicSuspected": False})

    with patch("src.evaluation.ai_evaluator.db", fake_db), \
         patch("src.providers.factory.OpenAIAdapter", llm_class), \
         patch("src.evaluation.ai_evaluator.get_settings", return_value=SETTINGS_WITH_KEY), \
         patch("src.evaluation.ai_evaluator.resolve_evaluation_ai_model_id", AsyncMock(return_value="model-1")), \
         patch("src.evaluation.ai_evaluator.resolve_active_evaluation_model_version", AsyncMock(return_value=SimpleNamespace(id="mv-1", versionLabel="gpt-4o"))), \
         patch("src.evaluation.ai_evaluator.resolve_evaluation_prompt_version_id", AsyncMock(return_value="pv-1")):
        result = await evaluate_response("inst-1", "resp-1", "user-1")

    assert result == {"skipped": True, "reason": "concurrent_evaluation_already_committed"}
    fake_db.evaluationversion.delete.assert_awaited_once_with(where={"id": "ev-ai-1"})
    fake_db.airecommendation.delete.assert_awaited_once_with(where={"id": "rec-1"})
    # The losing attempt must not write criterion scores against its discarded version.
    fake_db.evaluationcriterionscore.create.assert_not_awaited()


@pytest.mark.asyncio
async def test_batch_isolates_a_single_response_failure_from_the_rest():
    async def fake_evaluate(institute_id, response_id, requested_by_user_id):
        if response_id == "resp-bad":
            raise RuntimeError("boom")
        return {"suggestedMarks": 3}

    fake_db = SimpleNamespace(
        assessmentdelivery=SimpleNamespace(
            find_unique=AsyncMock(return_value=SimpleNamespace(assessment=SimpleNamespace(instituteId="inst-1")))
        ),
        response=SimpleNamespace(
            find_many=AsyncMock(return_value=[SimpleNamespace(id="resp-good-1"), SimpleNamespace(id="resp-bad"), SimpleNamespace(id="resp-good-2")])
        ),
    )

    with patch("src.evaluation.ai_evaluator.db", fake_db), \
         patch("src.evaluation.ai_evaluator.evaluate_response", fake_evaluate):
        result = await evaluate_delivery_batch("inst-1", "delivery-1", "user-1")

    assert result == {"totalResponses": 3, "succeeded": 2, "skipped": 0, "failed": 1}


@pytest.mark.asyncio
async def test_c3_same_tenant_batch_request_proceeds_normally():
    fake_db = SimpleNamespace(
        assessmentdelivery=SimpleNamespace(
            find_unique=AsyncMock(return_value=SimpleNamespace(assessment=SimpleNamespace(instituteId="inst-1")))
        ),
        response=SimpleNamespace(find_many=AsyncMock(return_value=[SimpleNamespace(id="resp-1")])),
    )

    async def fake_evaluate(institute_id, response_id, requested_by_user_id):
        return {"suggestedMarks": 3}

    with patch("src.evaluation.ai_evaluator.db", fake_db), \
         patch("src.evaluation.ai_evaluator.evaluate_response", fake_evaluate):
        result = await evaluate_delivery_batch("inst-1", "delivery-1", "user-1")

    assert result == {"totalResponses": 1, "succeeded": 1, "skipped": 0, "failed": 0}


@pytest.mark.asyncio
async def test_c3_rejects_a_batch_request_for_a_delivery_in_a_different_institute():
    fake_db = SimpleNamespace(
        assessmentdelivery=SimpleNamespace(
            find_unique=AsyncMock(return_value=SimpleNamespace(assessment=SimpleNamespace(instituteId="inst-OTHER")))
        ),
        response=SimpleNamespace(find_many=AsyncMock()),
    )

    with patch("src.evaluation.ai_evaluator.db", fake_db):
        result = await evaluate_delivery_batch("inst-1", "delivery-1", "user-1")

    assert result == {"totalResponses": 0, "succeeded": 0, "skipped": 0, "failed": 0}
    fake_db.response.find_many.assert_not_called()


@pytest.mark.asyncio
async def test_c3_rejects_a_batch_request_for_a_nonexistent_delivery():
    fake_db = SimpleNamespace(
        assessmentdelivery=SimpleNamespace(find_unique=AsyncMock(return_value=None)),
        response=SimpleNamespace(find_many=AsyncMock()),
    )

    with patch("src.evaluation.ai_evaluator.db", fake_db):
        result = await evaluate_delivery_batch("inst-1", "delivery-1", "user-1")

    assert result == {"totalResponses": 0, "succeeded": 0, "skipped": 0, "failed": 0}
    fake_db.response.find_many.assert_not_called()


# P1 B3: the registered PromptVersion.promptTemplate must correspond to the
# prompt actually sent to the model. ai_evaluator._build_prompt() now renders
# PROMPT_TEMPLATE — the same constant resolve_evaluation_prompt_version_id
# persists — rather than an independently-authored string, closing the gap the
# audit found (a static two-sentence placeholder that never matched reality).

def test_build_prompt_renders_the_registered_template_with_correctly_substituted_variables():
    """Unit-level proof of "prompt variables/template rendering are represented
    correctly" — a fixed fixture against the exact registered template, including
    the criteria_block conditional (holistic vs. rubric-scored)."""
    holistic = _build_prompt(
        template=PROMPT_TEMPLATE,
        question_content="Explain photosynthesis.",
        reference_answer="Plants convert light to chemical energy.",
        student_answer="Plants use sunlight.",
        max_marks=5,
        criteria=[],
        format_instructions="Return JSON.",
    )
    assert "Question (worth 5 marks):\nExplain photosynthesis." in holistic
    assert "Reference answer:\nPlants convert light to chemical energy." in holistic
    assert "Student's answer:\nPlants use sunlight." in holistic
    assert "Return JSON." in holistic
    assert "Score against these specific criteria" not in holistic  # no criteria -> no block

    rubric_scored = _build_prompt(
        template=PROMPT_TEMPLATE,
        question_content="Explain photosynthesis.",
        reference_answer="Plants convert light to chemical energy.",
        student_answer="Plants use sunlight.",
        max_marks=5,
        criteria=[SimpleNamespace(description="Mentions chlorophyll", maxMarks=2)],
        format_instructions="Return JSON.",
    )
    assert "Score against these specific criteria:\n- Mentions chlorophyll (max 2 marks)" in rubric_scored


def test_build_prompt_safely_handles_curly_braces_in_free_text_fields():
    """format_instructions (Pydantic's JSON schema) and user/teacher-authored
    text can both contain literal `{`/`}` — str.format() must insert them
    literally, not attempt to re-parse them as further placeholders."""
    rendered = _build_prompt(
        template=PROMPT_TEMPLATE,
        question_content="What is {x} if {x} + 2 = 5?",
        reference_answer="x = 3",
        student_answer="{not a placeholder}",
        max_marks=5,
        criteria=[],
        format_instructions='{"type": "object", "properties": {"suggestedMarks": {"type": "number"}}}',
    )
    assert "What is {x} if {x} + 2 = 5?" in rendered
    assert "{not a placeholder}" in rendered
    assert '{"type": "object", "properties": {"suggestedMarks": {"type": "number"}}}' in rendered


@pytest.mark.asyncio
async def test_resolved_prompt_template_matches_what_is_actually_sent_to_the_llm():
    """The core proof, end to end: what evaluate_response actually sends —
    now the GenerateRequest handed to the adapter — is exactly
    PROMPT_TEMPLATE.format(...) with this call's real values, not the old,
    independently-authored, wrong-content string."""
    response = make_response(make_question())
    fake_db = make_db(response)
    chat_openai = mock_llm({"suggestedMarks": 4, "confidence": 0.9, "note": "Good answer", "offTopicSuspected": False})

    with patch("src.evaluation.ai_evaluator.db", fake_db), \
         patch("src.providers.factory.OpenAIAdapter", chat_openai), \
         patch("src.evaluation.ai_evaluator.get_settings", return_value=SETTINGS_WITH_KEY), \
         patch("src.evaluation.ai_evaluator.resolve_evaluation_ai_model_id", AsyncMock(return_value="model-1")), \
         patch("src.evaluation.ai_evaluator.resolve_active_evaluation_model_version", AsyncMock(return_value=SimpleNamespace(id="mv-1", versionLabel="gpt-4o"))), \
         patch("src.evaluation.ai_evaluator.resolve_evaluation_prompt_version_id", AsyncMock(return_value="pv-2")):
        await evaluate_response("inst-1", "resp-1", "user-1")

    sent_request = chat_openai.return_value.generate.await_args.args[0]
    assert len(sent_request.content) == 1  # text-only, no image parts
    actual_prompt_sent = sent_request.content[0].text

    assert actual_prompt_sent.startswith("Question (worth 5 marks):\nExplain photosynthesis.")
    assert "Reference answer:\nPhotosynthesis converts light to chemical energy." in actual_prompt_sent
    assert "Student's answer:\nPlants use sunlight." in actual_prompt_sent

    # Independently compute format_instructions the same way the source does
    # (rather than parsing it back out of actual_prompt_sent, which would be
    # fragile), then confirm PROMPT_TEMPLATE — the literal registered artifact,
    # with its own placeholders — reproduces the exact sent string byte for
    # byte. This is the proof that one template drives both registration and
    # render, not two copies that merely happen to currently agree.
    format_instructions = PydanticOutputParser(pydantic_object=AIEvaluationResult).get_format_instructions()
    assert PROMPT_TEMPLATE.format(
        max_marks=5, question_content="Explain photosynthesis.",
        reference_answer="Photosynthesis converts light to chemical energy.",
        student_answer="Plants use sunlight.", criteria_block="",
        format_instructions=format_instructions,
    ) == actual_prompt_sent


@pytest.mark.asyncio
async def test_persisted_audit_metadata_is_consistent_with_the_actual_execution():
    """"persisted audit metadata remains consistent with execution": the
    AIRecommendation row's promptVersionId is exactly what the registry
    resolved, and inputArtifactHash is exactly the hash of the prompt that was
    actually sent — not independently-computed values that could each be
    individually correct yet mutually inconsistent."""
    response = make_response(make_question())
    fake_db = make_db(response)
    chat_openai = mock_llm({"suggestedMarks": 4, "confidence": 0.9, "note": "Good answer", "offTopicSuspected": False})

    with patch("src.evaluation.ai_evaluator.db", fake_db), \
         patch("src.providers.factory.OpenAIAdapter", chat_openai), \
         patch("src.evaluation.ai_evaluator.get_settings", return_value=SETTINGS_WITH_KEY), \
         patch("src.evaluation.ai_evaluator.resolve_evaluation_ai_model_id", AsyncMock(return_value="model-1")), \
         patch("src.evaluation.ai_evaluator.resolve_active_evaluation_model_version", AsyncMock(return_value=SimpleNamespace(id="mv-1", versionLabel="gpt-4o"))), \
         patch("src.evaluation.ai_evaluator.resolve_evaluation_prompt_version_id", AsyncMock(return_value="pv-2")):
        await evaluate_response("inst-1", "resp-1", "user-1")

    created = fake_db.airecommendation.create.await_args.kwargs["data"]
    sent_request = chat_openai.return_value.generate.await_args.args[0]
    actual_prompt_sent = sent_request.content[0].text

    assert created["promptVersionId"] == "pv-2"
    assert created["inputArtifactHash"] == "sha256:" + hashlib.sha256(actual_prompt_sent.encode("utf-8")).hexdigest()

    # P1 B1 Stage 2: persisted modelParameters must describe the request that was
    # actually sent, not independently-authored literals. maxTokens in particular
    # was previously recorded but never passed to the vendor call.
    assert created["modelParameters"].data == {
        "model": sent_request.model,
        "temperature": sent_request.temperature,
        "maxTokens": sent_request.max_tokens,
    }


# P1 B1 Stage 2: modelParameters.maxTokens=800 was recorded on every
# AIRecommendation but never actually passed to the vendor call — a dead
# parameter. These pin that the configured value now genuinely reaches the
# provider request, and that no other model parameter diverges from execution.
@pytest.mark.asyncio
async def test_configured_max_tokens_is_actually_enforced_in_the_provider_request():
    response = make_response(make_question())
    fake_db = make_db(response)
    adapter_class = mock_llm({"suggestedMarks": 4, "confidence": 0.9, "offTopicSuspected": False})

    with patch("src.evaluation.ai_evaluator.db", fake_db), \
         patch("src.providers.factory.OpenAIAdapter", adapter_class), \
         patch("src.evaluation.ai_evaluator.get_settings", return_value=SETTINGS_WITH_KEY), \
         patch("src.evaluation.ai_evaluator.resolve_evaluation_ai_model_id", AsyncMock(return_value="model-1")), \
         patch("src.evaluation.ai_evaluator.resolve_active_evaluation_model_version", AsyncMock(return_value=SimpleNamespace(id="mv-1", versionLabel="gpt-4o"))), \
         patch("src.evaluation.ai_evaluator.resolve_evaluation_prompt_version_id", AsyncMock(return_value="pv-2")):
        await evaluate_response("inst-1", "resp-1", "user-1")

    sent_request = adapter_class.return_value.generate.await_args.args[0]
    assert sent_request.max_tokens == EVALUATION_MAX_TOKENS == 4096


@pytest.mark.asyncio
async def test_no_evaluation_model_parameter_silently_diverges_from_the_actual_request():
    """Every key in the persisted modelParameters must correspond to a real field
    of the request that was sent — the general form of the maxTokens bug, so a
    future added-but-unwired parameter fails here rather than shipping silently."""
    response = make_response(make_question())
    fake_db = make_db(response)
    adapter_class = mock_llm({"suggestedMarks": 4, "confidence": 0.9, "offTopicSuspected": False})

    with patch("src.evaluation.ai_evaluator.db", fake_db), \
         patch("src.providers.factory.OpenAIAdapter", adapter_class), \
         patch("src.evaluation.ai_evaluator.get_settings", return_value=SETTINGS_WITH_KEY), \
         patch("src.evaluation.ai_evaluator.resolve_evaluation_ai_model_id", AsyncMock(return_value="model-1")), \
         patch("src.evaluation.ai_evaluator.resolve_active_evaluation_model_version", AsyncMock(return_value=SimpleNamespace(id="mv-1", versionLabel="gpt-4o-registry-selected"))), \
         patch("src.evaluation.ai_evaluator.resolve_evaluation_prompt_version_id", AsyncMock(return_value="pv-2")):
        await evaluate_response("inst-1", "resp-1", "user-1")

    persisted = fake_db.airecommendation.create.await_args.kwargs["data"]["modelParameters"].data
    sent_request = adapter_class.return_value.generate.await_args.args[0]

    assert persisted == {
        "model": "gpt-4o-registry-selected",   # the REGISTRY-resolved label, not a literal
        "temperature": EVALUATION_TEMPERATURE,
        "maxTokens": EVALUATION_MAX_TOKENS,
    }
    # ...and each of those is genuinely what the adapter received.
    assert sent_request.model == persisted["model"]
    assert sent_request.temperature == persisted["temperature"]
    assert sent_request.max_tokens == persisted["maxTokens"]


@pytest.mark.asyncio
async def test_prompt_resolution_failure_propagates_rather_than_falling_back_to_unregistered_text():
    """"inactive/missing prompt version does not silently fall back" — PromptVersion
    has no isActive column (only AIModelVersion does; deactivating the MODEL is
    already covered by test_no_active_model_configured_skips_to_human_queue_
    without_calling_the_llm), so the representable failure mode for the prompt
    resolver itself is a resolution error. Confirms it propagates — there is no
    hardcoded prompt text left in this module to silently fall back to."""
    response = make_response(make_question())
    fake_db = make_db(response)
    chat_openai = mock_llm({"suggestedMarks": 4, "confidence": 0.9, "note": "ok", "offTopicSuspected": False})

    with patch("src.evaluation.ai_evaluator.db", fake_db), \
         patch("src.providers.factory.OpenAIAdapter", chat_openai), \
         patch("src.evaluation.ai_evaluator.get_settings", return_value=SETTINGS_WITH_KEY), \
         patch("src.evaluation.ai_evaluator.resolve_evaluation_ai_model_id", AsyncMock(return_value="model-1")), \
         patch("src.evaluation.ai_evaluator.resolve_active_evaluation_model_version", AsyncMock(return_value=SimpleNamespace(id="mv-1", versionLabel="gpt-4o"))), \
         patch("src.evaluation.ai_evaluator.resolve_evaluation_prompt_version_id", AsyncMock(side_effect=RuntimeError("registry unavailable"))):
        with pytest.raises(RuntimeError, match="registry unavailable"):
            await evaluate_response("inst-1", "resp-1", "user-1")

    # resolve_evaluation_prompt_version_id runs BEFORE the LLM is even
    # constructed — a resolution failure here means the LLM is never called at
    # all, not just that no AIRecommendation gets written.
    chat_openai.assert_not_called()
    fake_db.airecommendation.create.assert_not_awaited()


@pytest.mark.asyncio
async def test_bumping_the_prompt_version_label_creates_a_new_row_never_edits_the_old_one():
    """32-AI-GOVERNANCE-POLICY.md §7: upgrading the prompt is an additive, audited
    action — never a retroactive rewrite of what a historical row claims."""
    from src.evaluation.ai_model_registry import (
        PROMPT_VERSION_LABEL,
        resolve_evaluation_prompt_version_id,
    )

    assert PROMPT_VERSION_LABEL == "v3"

    fake_db = SimpleNamespace(
        promptversion=SimpleNamespace(
            find_first=AsyncMock(return_value=None),  # no "v3" row yet — older labels are irrelevant to this lookup
            create=AsyncMock(return_value=SimpleNamespace(id="pv-v3-new")),
        )
    )
    with patch("src.evaluation.ai_model_registry.db", fake_db):
        prompt_id = await resolve_evaluation_prompt_version_id("model-1", "user-1")

    assert prompt_id == "pv-v3-new"
    assert fake_db.promptversion.find_first.await_args.kwargs["where"]["versionLabel"] == "v3"
    assert fake_db.promptversion.create.await_args.kwargs["data"]["versionLabel"] == "v3"
    assert fake_db.promptversion.create.await_args.kwargs["data"]["promptTemplate"] == PROMPT_TEMPLATE


# 27 §6 — malformed provider output is an unusable RESULT, not a transient fault.
@pytest.mark.parametrize(
    "raw_text,label",
    [
        ("I'm sorry, I can't grade this answer.", "prose refusal instead of JSON"),
        ('{"suggestedMarks": -5, "confidence": 0.9}', "schema-violating value (marks ge=0)"),
        ('{"suggestedMarks": 3, "confidence": 7.5}', "confidence outside 0..1"),
        ("", "empty completion"),
    ],
)
@pytest.mark.asyncio
async def test_unparseable_model_output_routes_to_human_queue_instead_of_raising(raw_text, label):
    """Regression: this used to propagate OutputParserException out of
    evaluate_response, out of /evaluation/ai-evaluate as a 500, and into the NestJS
    caller's `attempts: 3` — three paid calls with the IDENTICAL prompt at
    temperature 0.2, failing identically each time, then a dead-lettered job and a
    Response stuck PENDING with no recorded reason. The batch path masked it because
    run_one() catches everything; only the single-response route was exposed.

    Asserted as a skip (never a raise), and — as with every other skip in this
    module — leaving nothing an authoritative consumer could read."""
    response = make_response(make_question())
    fake_db = make_db(response)
    bad_adapter = MagicMock(
        return_value=SimpleNamespace(generate=AsyncMock(return_value=GenerateResult(text=raw_text)))
    )

    with patch("src.evaluation.ai_evaluator.db", fake_db), \
         patch("src.providers.factory.OpenAIAdapter", bad_adapter), \
         patch("src.evaluation.ai_evaluator.get_settings", return_value=SETTINGS_WITH_KEY), \
         patch("src.evaluation.ai_evaluator.resolve_evaluation_ai_model_id", AsyncMock(return_value="model-1")), \
         patch("src.evaluation.ai_evaluator.resolve_active_evaluation_model_version", AsyncMock(return_value=SimpleNamespace(id="mv-1", versionLabel="gpt-4o"))), \
         patch("src.evaluation.ai_evaluator.resolve_evaluation_prompt_version_id", AsyncMock(return_value="pv-1")):
        result = await evaluate_response("inst-1", "resp-1", "user-1")

    assert result == {"skipped": True, "reason": "ai_output_unparseable"}, label
    fake_db.airecommendation.create.assert_not_awaited()
    fake_db.evaluationversion.create.assert_not_awaited()
    fake_db.evaluation.update_many.assert_not_awaited()


@pytest.mark.asyncio
async def test_truncated_completion_is_discarded_rather_than_graded_on_partial_output():
    """The failure mode that does NOT look like a failure.

    langchain's PydanticOutputParser repairs cut-off JSON instead of rejecting it,
    so a completion killed at max_tokens parses into a valid AIEvaluationResult
    whose Optional fields (note, suggestedCriterionScores) are merely absent. Before
    the adapter reported truncation there was no way to tell that apart from a model
    that simply had no note to give — so a half-finished grade was persisted as an
    AIRecommendation and shown to a teacher as a confident mark with no reasoning.

    Proven by parsing the exact truncated payload first: it does not raise, which is
    precisely why the `truncated` signal (not the parser) has to be what catches it."""
    truncated_json = '{"suggestedMarks": 3, "confidence": 0.9, "not'
    repaired = PydanticOutputParser(pydantic_object=AIEvaluationResult).parse(truncated_json)
    assert repaired.suggestedMarks == 3.0 and repaired.note is None, (
        "premise of this test: the parser repairs truncated JSON rather than raising"
    )

    response = make_response(make_question())
    fake_db = make_db(response)
    truncating_adapter = MagicMock(
        return_value=SimpleNamespace(
            generate=AsyncMock(return_value=GenerateResult(text=truncated_json, truncated=True))
        )
    )

    with patch("src.evaluation.ai_evaluator.db", fake_db), \
         patch("src.providers.factory.OpenAIAdapter", truncating_adapter), \
         patch("src.evaluation.ai_evaluator.get_settings", return_value=SETTINGS_WITH_KEY), \
         patch("src.evaluation.ai_evaluator.resolve_evaluation_ai_model_id", AsyncMock(return_value="model-1")), \
         patch("src.evaluation.ai_evaluator.resolve_active_evaluation_model_version", AsyncMock(return_value=SimpleNamespace(id="mv-1", versionLabel="gpt-4o"))), \
         patch("src.evaluation.ai_evaluator.resolve_evaluation_prompt_version_id", AsyncMock(return_value="pv-1")):
        result = await evaluate_response("inst-1", "resp-1", "user-1")

    assert result == {"skipped": True, "reason": "ai_output_truncated"}
    fake_db.airecommendation.create.assert_not_awaited()
    fake_db.evaluationversion.create.assert_not_awaited()
    fake_db.evaluation.update_many.assert_not_awaited()


# ── Teacher authority: a late AI result may never replace an approved mark ──


def approved_version(source="TEACHER"):
    return SimpleNamespace(id="v-teacher-1", source=source, marksAwarded=4.0)


@pytest.mark.parametrize("source", ["TEACHER", "REVIEWER"])
@pytest.mark.asyncio
async def test_an_ai_job_landing_after_the_teacher_approved_is_skipped(source):
    """A job queued before the teacher submitted can run after. Chaining an AI
    version on top would move the current-version pointer off the human's mark,
    which silently drops it out of ScoreRecord."""
    response = make_response(
        make_question(),
        evaluation=SimpleNamespace(id="eval-1", currentEvaluationVersionId="v-teacher-1", currentVersion=approved_version(source)),
    )
    fake_db = make_db(response)
    adapter_class = mock_llm({"suggestedMarks": 1, "confidence": 0.9})
    with patch("src.evaluation.ai_evaluator.db", fake_db), registry_patches(adapter_class):
        result = await evaluate_response("inst-1", "resp-1", "user-1")

    assert result == {"skipped": True, "reason": "already_reviewed_by_teacher"}
    adapter_class.return_value.generate.assert_not_awaited()
    fake_db.airecommendation.create.assert_not_awaited()
    fake_db.evaluationversion.create.assert_not_awaited()


@pytest.mark.asyncio
async def test_an_earlier_ai_suggestion_does_not_block_a_re_run():
    response = make_response(
        make_question(),
        evaluation=SimpleNamespace(id="eval-1", currentEvaluationVersionId="v-ai-1",
                                   currentVersion=SimpleNamespace(id="v-ai-1", source="AI", marksAwarded=2.0)),
    )
    fake_db = make_db(response)
    adapter_class = mock_llm({"suggestedMarks": 3, "confidence": 0.9})
    with patch("src.evaluation.ai_evaluator.db", fake_db), registry_patches(adapter_class):
        result = await evaluate_response("inst-1", "resp-1", "user-1")

    assert result["suggestedMarks"] == 3
    fake_db.evaluationversion.create.assert_awaited_once()


# ── OCR evidence belongs to the box it was read from ────────────────────────


@pytest.mark.asyncio
async def test_a_transcript_read_from_a_box_the_teacher_has_since_moved_is_not_used():
    """The region was resized after the reading, so that text is evidence for a
    different part of the page: route to the human queue, don't grade on it."""
    ocr_result = SimpleNamespace(id="ocr-1", extractedText="Answer text", confidence=0.95,
                                 requiresVisualEvaluation=False, processedAt=1)
    stale_block = SimpleNamespace(id="block-old", boundingBox={"x": 0.8, "y": 0.8, "width": 0.1, "height": 0.1})
    response = make_response(make_question(), evidence_type="PAGE_REGION", question_region_id="region-1")
    fake_db = make_db(response, ocr_block=stale_block, ocr_result=ocr_result)
    adapter_class = mock_llm({"suggestedMarks": 4, "confidence": 0.9})
    with patch("src.evaluation.ai_evaluator.db", fake_db), registry_patches(adapter_class):
        result = await evaluate_response("inst-1", "resp-1", "user-1")

    assert result == {"skipped": True, "reason": "illegible_handwriting"}
    adapter_class.return_value.generate.assert_not_awaited()


@pytest.mark.asyncio
async def test_a_transcript_read_from_the_current_box_is_used():
    ocr_result = SimpleNamespace(id="ocr-1", extractedText="Rayleigh scattering", confidence=0.95,
                                 requiresVisualEvaluation=False, processedAt=1)
    response = make_response(make_question(), evidence_type="PAGE_REGION", question_region_id="region-1")
    fake_db = make_db(response, ocr_block=SimpleNamespace(id="block-1", boundingBox={"x": 0.1, "y": 0.2, "width": 0.6, "height": 0.3}), ocr_result=ocr_result)
    adapter_class = mock_llm({"suggestedMarks": 4, "confidence": 0.9})
    with patch("src.evaluation.ai_evaluator.db", fake_db), registry_patches(adapter_class):
        result = await evaluate_response("inst-1", "resp-1", "user-1")

    assert result["suggestedMarks"] == 4
    sent_prompt = adapter_class.return_value.generate.await_args.args[0].content[0].text
    assert "Rayleigh scattering" in sent_prompt
