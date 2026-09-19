"""27-AI-EVALUATION-ARCHITECTURE.md. Produces an AIRecommendation + a new
chained EvaluationVersion(source=AI) for one subjective Response.

P1 B1 Stage 2: the vendor SDK is reached only through providers/openai_adapter.py
(27 §8a) — this module no longer imports langchain_openai/openai at all. Prompt
construction, timeout policy, response parsing and all persistence stay here;
the adapter's sole job is "send this content to this model, return the text".

"Confidence" here is the model's own self-report, elicited via structured
output, the same honest caveat already documented for OCR: real, but not a
calibrated metric.

25-EVALUATION-ENGINE.md §2: a Response is never graded in place. This module
only ever appends a new EvaluationVersion — it never mutates an existing one,
and it never writes to Response.marksAwarded directly.
"""

import asyncio
import hashlib
import logging

from langchain_core.exceptions import OutputParserException
from langchain_core.output_parsers import PydanticOutputParser
from prisma import Json
from pydantic import BaseModel, Field

from src.config import get_settings
from src.database import db
from src.evaluation.ai_model_registry import (
    PROMPT_TEMPLATE,
    PROMPT_TEMPLATE_V3,
    resolve_active_evaluation_model_version,
    resolve_evaluation_ai_model_id,
    resolve_evaluation_prompt_version_id,
)
from src.providers.factory import select_adapter
from src.providers.types import GenerateRequest, TextPart

logger = logging.getLogger(__name__)

LOW_CONFIDENCE_THRESHOLD = 0.6  # 27 §5
# P1 D2: 24 §5's own routing table, acceptance criterion "Confidence below 0.5
# always routes to human evaluation without an AI scoring attempt" — was
# unimplemented (this file only ever checked for a null/empty transcript or an
# explicit requiresVisualEvaluation flag, never the confidence NUMBER itself), so
# a non-empty but near-unreadable transcript (e.g. confidence=0.05) previously
# still reached the LLM, tagged only with the softer ocr_low_confidence flag below.
OCR_ILLEGIBLE_CONFIDENCE_THRESHOLD = 0.5  # 24 §5: strictly below this, skip entirely
OCR_LOW_CONFIDENCE_THRESHOLD = 0.85  # 24 §5's own high-confidence bar, reused
AI_CALL_HARD_TIMEOUT_SECONDS = 20  # 27 §6

# 27 §4's modelParameters. Named rather than inlined so the regression test can
# assert the enforced value by reference. EVALUATION_MAX_TOKENS was previously
# recorded in AIRecommendation.modelParameters as "maxTokens": 800 but never
# actually passed to the vendor call — a dead parameter, fixed in P1 B1 Stage 2
# by deriving the persisted metadata from the real request (see below).
EVALUATION_TEMPERATURE = 0.2
EVALUATION_MAX_TOKENS = 800


class SuggestedCriterionScore(BaseModel):
    rubricCriterionId: str
    marksAwarded: float = Field(ge=0)
    note: str


class AIEvaluationResult(BaseModel):
    suggestedMarks: float = Field(ge=0)
    suggestedCriterionScores: list[SuggestedCriterionScore] | None = None
    confidence: float = Field(ge=0.0, le=1.0)
    note: str | None = Field(default=None, description="Free-text justification, required for holistic scoring")
    offTopicSuspected: bool = False


class Skipped(BaseModel):
    skipped: bool = True
    reason: str


async def evaluate_response(institute_id: str, response_id: str, requested_by_user_id: str) -> dict:
    response = await db.response.find_unique(
        where={"id": response_id},
        include={
            "question": {"include": {"rubric": {"include": {"versions": True}}}},
            "attempt": {"include": {"assessmentDelivery": {"include": {"assessment": True}}}},
            "evaluation": True,
        },
    )
    if response is None or response.attemptId is None:
        return Skipped(reason="response_not_found").model_dump()

    # C3: institute_id is accepted from the (internal-only) caller and, until now,
    # never checked. Every current NestJS caller already validates tenant ownership
    # before enqueueing (evaluations.service.ts's getEvaluableResponse,
    # assessments.service.ts's getDeliveryWithTenantCheck) — this is defense-in-depth
    # against a future/buggy caller, not a fix for an active leak. Same
    # indistinguishable-from-missing convention used throughout the Node side.
    if response.attempt.assessmentDelivery.assessment.instituteId != institute_id:
        return Skipped(reason="response_not_found").model_dump()

    reference_answer = response.question.solution or ""
    # Reference answer is now optional — if not provided, LLM evaluates independently

    ocr_result = None
    if response.evidenceType == "PAGE_REGION":
        if response.questionRegionId is None:
            return Skipped(reason="illegible_handwriting").model_dump()
        ocr_block = await db.ocrblock.find_first(where={"questionRegionId": response.questionRegionId})
        if ocr_block is not None:
            ocr_result = await db.ocrresult.find_first(
                where={"ocrBlockId": ocr_block.id}, order={"processedAt": "desc"}
            )
        if (
            ocr_result is None
            or ocr_result.requiresVisualEvaluation
            or not ocr_result.extractedText
            # P1 D2: confidence < 0.5 is illegible per 24 §5's routing table, even
            # when a (likely garbled) transcript exists — the number itself is the
            # signal, not just its presence. 0.5 itself is the inclusive floor of
            # the "proceed, flagged ocr_low_confidence" band, so strictly `<`.
            or ocr_result.confidence < OCR_ILLEGIBLE_CONFIDENCE_THRESHOLD
        ):
            return Skipped(reason="illegible_handwriting").model_dump()
        student_answer_text = ocr_result.extractedText
    else:
        student_answer_text = response.studentAnswer or ""

    rubric = response.question.rubric
    # versions come back unordered from the include above; take the highest versionNumber.
    rubric_version = None
    if rubric and rubric.versions:
        rubric_version = max(rubric.versions, key=lambda v: v.versionNumber)
        rubric_version_criteria = await db.rubriccriterion.find_many(where={"rubricVersionId": rubric_version.id})
    else:
        rubric_version_criteria = []

    settings = get_settings()
    if not settings.OPENAI_API_KEY and not settings.GEMINI_API_KEY:
        raise ValueError("Neither OPENAI_API_KEY nor GEMINI_API_KEY is configured in the environment.")

    result_model = AIEvaluationResult
    parser = PydanticOutputParser(pydantic_object=result_model)

    # Choose prompt template based on reference answer availability
    template_to_use = PROMPT_TEMPLATE if reference_answer else PROMPT_TEMPLATE_V3

    prompt_text = _build_prompt(
        template=template_to_use,
        question_content=response.question.content,
        reference_answer=reference_answer,
        student_answer=student_answer_text,
        max_marks=response.marksAvailable,
        criteria=rubric_version_criteria,
        format_instructions=parser.get_format_instructions(),
    )

    # 27 §8a: the registry decides WHICH model runs — resolved before the call, and
    # its versionLabel IS the model identifier. Previously this resolution happened
    # after the LLM call and only stamped FK ids onto the AIRecommendation, while the
    # model name was a separate hardcoded literal — making isActive unenforceable.
    ai_model_id = await resolve_evaluation_ai_model_id()
    ai_model_version = await resolve_active_evaluation_model_version(ai_model_id)
    if ai_model_version is None:
        return Skipped(reason="no_active_model_configured").model_dump()
    prompt_version_id = await resolve_evaluation_prompt_version_id(ai_model_id, requested_by_user_id)

    # P1 B1 Stage 2: the vendor SDK is no longer constructed here — the adapter owns
    # it (27 §8a). Registry resolution above is unchanged and still authoritative:
    # the adapter receives the already-resolved versionLabel as a plain string and
    # has no ability to choose a model itself.
    adapter, model_label = select_adapter(settings, ai_model_version.versionLabel)
    generate_request = GenerateRequest(
        content=[TextPart(prompt_text)],
        model=model_label,
        temperature=EVALUATION_TEMPERATURE,
        max_tokens=EVALUATION_MAX_TOKENS,
    )
    # Persisted audit metadata is DERIVED from the request actually sent, so the two
    # cannot silently diverge. Previously these were two independent literals and
    # maxTokens was recorded but never sent (P1 B1 Stage 2 fix). Key names stay
    # camelCase — this is the existing persisted JSON shape, unchanged.
    model_parameters = {
        "model": generate_request.model,
        "temperature": generate_request.temperature,
        "maxTokens": generate_request.max_tokens,
    }

    # 27 §6: 20s hard timeout, enforced here rather than only at the NestJS caller's
    # axios timeout — that one abandons the HTTP connection while this coroutine keeps
    # running, which is how a queue retry ends up racing a still-live first attempt.
    # Deliberately OUTSIDE the adapter: timeout policy is this call site's concern,
    # not the provider's (B1 Stage 1 contract).
    try:
        generated = await asyncio.wait_for(
            adapter.generate(generate_request), timeout=AI_CALL_HARD_TIMEOUT_SECONDS
        )
    except TimeoutError:
        logger.warning(
            "AI evaluation timed out after %ss for response %s — routing to human queue",
            AI_CALL_HARD_TIMEOUT_SECONDS,
            response_id,
        )
        return Skipped(reason="ai_evaluation_timeout").model_dump()
    if generated.truncated:
        # The model ran out of max_tokens mid-answer. This does NOT surface as a
        # parse error: langchain's PydanticOutputParser repairs cut-off JSON, so
        # `{"suggestedMarks": 3, "confidence": 0.9, "not` parses into a perfectly
        # well-formed AIEvaluationResult — with `note` and `suggestedCriterionScores`
        # silently absent because they are Optional. The teacher would then see a
        # confident-looking mark with no justification and no per-criterion
        # breakdown, indistinguishable from a model that genuinely had nothing to
        # add. A partial grade is not a grade; route it to a human like every other
        # unusable outcome here.
        logger.warning(
            "AI evaluation hit the %s-token ceiling for response %s — partial output discarded, routing to human queue",
            EVALUATION_MAX_TOKENS,
            response_id,
        )
        return Skipped(reason="ai_output_truncated").model_dump()

    try:
        result: AIEvaluationResult = parser.parse(generated.text)
    except OutputParserException:
        # A model that answers in prose ("I can't grade this"), truncates its JSON at
        # max_tokens, or returns a score outside the schema's bounds is an UNUSABLE
        # RESULT, not a transient fault — every one of this function's other failure
        # modes (timeout, illegible OCR, no active model) already routes to the human
        # queue rather than raising, and this one is no different.
        #
        # It used to propagate: out of here, out of the /evaluation/ai-evaluate route
        # as a 500, into the BullMQ caller's `attempts: 3` — which re-sent the IDENTICAL
        # prompt at temperature 0.2 twice more, paid for all three calls, failed the same
        # way each time, and dead-lettered the job leaving the Response stuck PENDING with
        # no recorded reason. The batch path never showed this because run_one() catches
        # everything; only the single-response path was exposed.
        #
        # The response text is logged, never persisted or returned — it is provider
        # output of unknown shape and this is the one place that has seen it.
        logger.warning(
            "AI evaluation returned unparseable output for response %s — routing to human queue. Raw: %r",
            response_id,
            generated.text[:500],
        )
        return Skipped(reason="ai_output_unparseable").model_dump()

    input_artifact_hash = "sha256:" + hashlib.sha256(prompt_text.encode("utf-8")).hexdigest()

    flags: list[str] = []
    if result.confidence < LOW_CONFIDENCE_THRESHOLD:
        flags.append("low_confidence")
    if ocr_result is not None and ocr_result.confidence < OCR_LOW_CONFIDENCE_THRESHOLD:
        flags.append("ocr_low_confidence")
    if result.offTopicSuspected:
        flags.append("off_topic_suspected")
    if reference_answer and len(student_answer_text) > 3 * len(reference_answer):
        flags.append("answer_exceeds_expected_length")
    if not reference_answer:
        flags.append("no_reference_used")  # Tag when LLM evaluated independently
    if not flags:
        flags.append("none")

    latest_question_version = await db.questionversion.find_first(
        where={"questionId": response.questionId}, order={"versionNo": "desc"}
    )

    evidence_ref = (
        {"evidenceType": "PAGE_REGION", "ocrResultId": ocr_result.id}
        if ocr_result is not None
        else {"evidenceType": response.evidenceType, "digitalValue": response.studentAnswer}
    )

    total_marks = min(
        sum(c.marksAwarded for c in result.suggestedCriterionScores) if result.suggestedCriterionScores else result.suggestedMarks,
        response.marksAvailable,
    )

    recommendation = await db.airecommendation.create(
        data={
            "responseId": response_id,
            "questionVersionId": latest_question_version.id if latest_question_version else None,
            "rubricVersionId": rubric_version.id if rubric_version else None,
            # Json columns must be wrapped in prisma.Json — a bare dict/list is
            # rejected by the query engine at runtime ("should be of any of the
            # following types: JsonNullValueInput, Json"). Not caught by the unit
            # suite, which substitutes db entirely; found by running this path
            # against a real Postgres.
            "evidenceRef": Json(evidence_ref),
            "ocrResultId": ocr_result.id if ocr_result else None,
            "evaluationPolicyId": response.attempt.assessmentDelivery.evaluationPolicyId,
            "aiModelVersionId": ai_model_version.id,
            "promptVersionId": prompt_version_id,
            "modelParameters": Json(model_parameters),
            "inputArtifactHash": input_artifact_hash,
            "suggestedMarks": total_marks,
            "confidence": result.confidence,
            "flags": flags,
            # Optional Json: the key is omitted entirely when there are no criterion
            # scores. Passing None is rejected by the engine ("a value is required
            # but not set") — for a nullable Json column, absent and null are
            # different inputs in prisma-client-py.
            **(
                {"suggestedCriterionScores": Json([c.model_dump() for c in result.suggestedCriterionScores])}
                if result.suggestedCriterionScores
                else {}
            ),
        }
    )

    evaluation = response.evaluation
    if evaluation is None:
        evaluation = await db.evaluation.create(data={"responseId": response_id})

    # Read at the START of this call (response was fetched before the LLM ran), so it
    # is the compare-and-swap key below — same discipline as the Node side's
    # withVersionGuard (apps/api/src/shared/version-guard.ts).
    expected_current_version_id = evaluation.currentEvaluationVersionId

    new_version = await db.evaluationversion.create(
        data={
            "evaluationId": evaluation.id,
            "previousVersionId": expected_current_version_id,
            "source": "AI",
            "marksAwarded": total_marks,
            "aiRecommendationId": recommendation.id,
        }
    )

    # Conditional on the pointer not having moved since this call started. A NestJS
    # queue retry can race a still-running first attempt (its axios timeout abandons
    # the connection, not this coroutine); without this guard both attempts would
    # write, forking the version chain off one previousVersionId.
    claimed = await db.evaluation.update_many(
        where={"id": evaluation.id, "currentEvaluationVersionId": expected_current_version_id},
        data={"currentEvaluationVersionId": new_version.id, "status": "AI_SUGGESTED"},
    )
    if not claimed:
        # Another execution already committed an evaluation for this response. Roll
        # back this attempt's rows so it leaves no orphan chained off a stale parent.
        await db.evaluationversion.delete(where={"id": new_version.id})
        await db.airecommendation.delete(where={"id": recommendation.id})
        logger.info(
            "Concurrent AI evaluation already committed for response %s — discarding this attempt",
            response_id,
        )
        return Skipped(reason="concurrent_evaluation_already_committed").model_dump()

    if result.suggestedCriterionScores:
        for c in result.suggestedCriterionScores:
            await db.evaluationcriterionscore.create(
                data={"evaluationVersionId": new_version.id, "rubricCriterionId": c.rubricCriterionId, "marksAwarded": c.marksAwarded, "note": c.note}
            )

    return {
        "aiRecommendationId": recommendation.id,
        "evaluationVersionId": new_version.id,
        "suggestedMarks": total_marks,
        "confidence": result.confidence,
        "flags": flags,
    }


async def evaluate_delivery_batch(institute_id: str, assessment_delivery_id: str, requested_by_user_id: str) -> dict:
    """27 §6: batched, async — not a per-response synchronous call from the
    teacher's browser. Runs with bounded concurrency, not fully sequential,
    to have a chance at the <15min/200-response p95 target (§9). One
    response's failure never aborts the rest — mirrors mastery_engine.py's
    per-topic isolation discipline."""
    # C3: the per-response check inside evaluate_response would eventually catch a
    # cross-tenant assessment_delivery_id too — every response under it would fail
    # its own institute check and land in "skipped" — but only after querying and
    # iterating every response first. Checking the delivery itself up front is the
    # cheap, correct place to reject it, not a fallback.
    delivery = await db.assessmentdelivery.find_unique(
        where={"id": assessment_delivery_id}, include={"assessment": True}
    )
    if delivery is None or delivery.assessment.instituteId != institute_id:
        return {"totalResponses": 0, "succeeded": 0, "skipped": 0, "failed": 0}

    responses = await db.response.find_many(
        where={
            "attempt": {"is": {"assessmentDeliveryId": assessment_delivery_id}},
            "question": {"is": {"type": {"in": ["SHORT_ANSWER", "LONG_ANSWER", "PASSAGE_BASED"]}}},
            "OR": [{"evaluation": {"is": None}}, {"evaluation": {"is": {"status": "PENDING"}}}],
        }
    )

    semaphore = asyncio.Semaphore(5)
    results = {"succeeded": 0, "skipped": 0, "failed": 0}

    async def run_one(response_id: str) -> None:
        async with semaphore:
            try:
                outcome = await evaluate_response(institute_id, response_id, requested_by_user_id)
                results["skipped" if outcome.get("skipped") else "succeeded"] += 1
            except Exception:
                # 27 §6: AI failure never blocks human evaluation — the response
                # simply stays PENDING and surfaces in the manual queue as usual.
                results["failed"] += 1

    await asyncio.gather(*(run_one(r.id) for r in responses))
    return {"totalResponses": len(responses), **results}


def _build_prompt(template, question_content, reference_answer, student_answer, max_marks, criteria, format_instructions) -> str:
    """Renders `template` (PROMPT_TEMPLATE or PROMPT_TEMPLATE_V3 from the registry)
    against these inputs. Reference answer can be empty — for v3, LLM evaluates independently."""
    criteria_block = ""
    if criteria:
        lines = [f"- {c.description} (max {c.maxMarks} marks)" for c in criteria]
        criteria_block = "\nRubric criteria for evaluation:\n" + "\n".join(lines)

    # For v3 template (no reference), include a note that LLM should solve independently
    if reference_answer == "" and "Rubric criteria" not in template:
        criteria_block = "\nYou are an expert evaluator. Grade based on your own knowledge.\nRubric criteria:\n" + (
            "\n".join([f"- {c.description} (max {c.maxMarks} marks)" for c in criteria]) if criteria else ""
        )

    return template.format(
        max_marks=max_marks,
        question_content=question_content,
        reference_answer=reference_answer or "[No reference provided — evaluate using your expert knowledge]",
        student_answer=student_answer,
        criteria_block=criteria_block,
        format_instructions=format_instructions,
    )
