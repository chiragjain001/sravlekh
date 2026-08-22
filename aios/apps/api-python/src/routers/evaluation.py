from fastapi import APIRouter, Depends
from pydantic import BaseModel

from src.auth import verify_internal_token
from src.evaluation.ai_evaluator import evaluate_delivery_batch, evaluate_response

router = APIRouter(prefix="/evaluation", tags=["AI Evaluation"])


class AIEvaluateRequest(BaseModel):
    instituteId: str
    responseId: str
    requestedByUserId: str


class AIEvaluateBatchRequest(BaseModel):
    instituteId: str
    assessmentDeliveryId: str
    requestedByUserId: str


@router.post("/ai-evaluate", dependencies=[Depends(verify_internal_token)])
async def ai_evaluate(request: AIEvaluateRequest):
    """Internal-only (05-API-SPECIFICATION.md V2 section §10). Single-response
    AI first pass — 27-AI-EVALUATION-ARCHITECTURE.md. Not the doc's literal
    request shape (instituteId, responseId, questionId, rubricVersionId?,
    referenceAnswer, studentAnswerText) — deviated to {instituteId, responseId,
    requestedByUserId}, matching the OCR precedent (Phase 11) of Python doing
    its own DB reads rather than the caller pre-fetching context NestJS would
    otherwise have to duplicate. See docs/33 Phase 13 write-up."""
    result = await evaluate_response(request.instituteId, request.responseId, request.requestedByUserId)
    return {"success": True, "data": result}


@router.post("/ai-evaluate-batch", dependencies=[Depends(verify_internal_token)])
async def ai_evaluate_batch(request: AIEvaluateBatchRequest):
    """27 §6: processes all pending subjective responses for a delivery as
    one queued job, bounded-concurrency internally rather than fanning out
    into many NestJS-side jobs — matches the doc's own framing literally."""
    result = await evaluate_delivery_batch(request.instituteId, request.assessmentDeliveryId, request.requestedByUserId)
    return {"success": True, "data": result}
