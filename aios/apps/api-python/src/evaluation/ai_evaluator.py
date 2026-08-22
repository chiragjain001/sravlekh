"""27-AI-EVALUATION-ARCHITECTURE.md. Produces an AIRecommendation + a new
chained EvaluationVersion(source=AI) for one subjective Response.

Uses the same real ChatOpenAI pattern already established in
blueprint_agent.py and ocr/handwriting_ocr.py — not a separate integration.
"Confidence" here is the model's own self-report, elicited via structured
output, the same honest caveat already documented for OCR: real, but not a
calibrated metric.

25-EVALUATION-ENGINE.md §2: a Response is never graded in place. This module
only ever appends a new EvaluationVersion — it never mutates an existing one,
and it never writes to Response.marksAwarded directly.
"""

import asyncio
import hashlib

from langchain_core.messages import HumanMessage
from langchain_core.output_parsers import PydanticOutputParser
from langchain_openai import ChatOpenAI
from pydantic import BaseModel, Field

from src.config import get_settings
from src.database import db
from src.evaluation.ai_model_registry import (
    resolve_evaluation_ai_model_id,
    resolve_evaluation_model_version_id,
    resolve_evaluation_prompt_version_id,
)

LOW_CONFIDENCE_THRESHOLD = 0.6  # 27 §5
OCR_LOW_CONFIDENCE_THRESHOLD = 0.85  # 24 §5's own high-confidence bar, reused


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
            "attempt": {"include": {"assessmentDelivery": True}},
            "evaluation": True,
        },
    )
    if response is None or response.attemptId is None:
        return Skipped(reason="response_not_found").model_dump()

    reference_answer = response.question.solution
    if not reference_answer:
        return Skipped(reason="no_reference_answer").model_dump()

    ocr_result = None
    if response.evidenceType == "PAGE_REGION":
        if response.questionRegionId is None:
            return Skipped(reason="illegible_handwriting").model_dump()
        ocr_block = await db.ocrblock.find_first(where={"questionRegionId": response.questionRegionId})
        if ocr_block is not None:
            ocr_result = await db.ocrresult.find_first(
                where={"ocrBlockId": ocr_block.id}, order={"processedAt": "desc"}
            )
        if ocr_result is None or ocr_result.requiresVisualEvaluation or not ocr_result.extractedText:
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
    if not settings.OPENAI_API_KEY:
        raise ValueError("OPENAI_API_KEY is not configured in the environment.")

    result_model = AIEvaluationResult
    parser = PydanticOutputParser(pydantic_object=result_model)
    prompt_text = _build_prompt(
        question_content=response.question.content,
        reference_answer=reference_answer,
        student_answer=student_answer_text,
        max_marks=response.marksAvailable,
        criteria=rubric_version_criteria,
        format_instructions=parser.get_format_instructions(),
    )

    model_parameters = {"model": "gpt-4o", "temperature": 0.2, "maxTokens": 800}
    llm = ChatOpenAI(api_key=settings.OPENAI_API_KEY, model=model_parameters["model"], temperature=model_parameters["temperature"])
    response_message = await llm.ainvoke([HumanMessage(content=prompt_text)])
    result: AIEvaluationResult = parser.parse(response_message.content)

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
    if not flags:
        flags.append("none")

    latest_question_version = await db.questionversion.find_first(
        where={"questionId": response.questionId}, order={"versionNo": "desc"}
    )

    ai_model_id = await resolve_evaluation_ai_model_id()
    ai_model_version_id = await resolve_evaluation_model_version_id(ai_model_id)
    prompt_version_id = await resolve_evaluation_prompt_version_id(ai_model_id, requested_by_user_id)

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
            "evidenceRef": evidence_ref,
            "ocrResultId": ocr_result.id if ocr_result else None,
            "evaluationPolicyId": response.attempt.assessmentDelivery.evaluationPolicyId,
            "aiModelVersionId": ai_model_version_id,
            "promptVersionId": prompt_version_id,
            "modelParameters": model_parameters,
            "inputArtifactHash": input_artifact_hash,
            "suggestedMarks": total_marks,
            "suggestedCriterionScores": (
                [c.model_dump() for c in result.suggestedCriterionScores] if result.suggestedCriterionScores else None
            ),
            "confidence": result.confidence,
            "flags": flags,
        }
    )

    evaluation = response.evaluation
    if evaluation is None:
        evaluation = await db.evaluation.create(data={"responseId": response_id})

    new_version = await db.evaluationversion.create(
        data={
            "evaluationId": evaluation.id,
            "previousVersionId": evaluation.currentEvaluationVersionId,
            "source": "AI",
            "marksAwarded": total_marks,
            "aiRecommendationId": recommendation.id,
        }
    )

    if result.suggestedCriterionScores:
        for c in result.suggestedCriterionScores:
            await db.evaluationcriterionscore.create(
                data={"evaluationVersionId": new_version.id, "rubricCriterionId": c.rubricCriterionId, "marksAwarded": c.marksAwarded, "note": c.note}
            )

    await db.evaluation.update(
        where={"id": evaluation.id}, data={"currentEvaluationVersionId": new_version.id, "status": "AI_SUGGESTED"}
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


def _build_prompt(question_content, reference_answer, student_answer, max_marks, criteria, format_instructions) -> str:
    criteria_block = ""
    if criteria:
        lines = [f"- {c.description} (max {c.maxMarks} marks)" for c in criteria]
        criteria_block = "\nScore against these specific criteria:\n" + "\n".join(lines)

    return (
        f"Question (worth {max_marks} marks):\n{question_content}\n\n"
        f"Reference answer:\n{reference_answer}\n\n"
        f"Student's answer:\n{student_answer}\n"
        f"{criteria_block}\n\n"
        "Grade the student's answer against the reference answer. Be fair and consistent. "
        "If the student's answer appears to have little relevance to the question, set offTopicSuspected=true.\n\n"
        f"{format_instructions}"
    )
