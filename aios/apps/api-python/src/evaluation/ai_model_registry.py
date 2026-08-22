"""Resolves the AIModelVersion/PromptVersion rows AIRecommendation requires.

04-DATABASE-SCHEMA.md fix #6 / 27-AI-EVALUATION-ARCHITECTURE.md §8a: no
evaluation-domain code hardcodes a vendor SDK call — every invocation
resolves AIProvider -> AIModel(purpose=EVALUATION) -> AIModelVersion +
PromptVersion from the registry. Mirrors src/ocr/ai_model_registry.py's
idempotent find-or-create bootstrap, kept as a separate module (not shared
with OCR's) so a change to one purpose's registry rows can't accidentally
affect the other's — same reasoning as keeping ocr/ and evaluation/ as
distinct packages.
"""

from src.database import db

PROVIDER_NAME = "OpenAI"
MODEL_NAME = "gpt-4o"
VERSION_LABEL = "gpt-4o"
PROMPT_VERSION_LABEL = "v1"

PROMPT_TEMPLATE = (
    "You are grading a student's answer to an exam question. Compare it against "
    "the reference answer and award marks fairly and consistently."
)


async def resolve_evaluation_ai_model_id() -> str:
    provider = await db.aiprovider.find_first(where={"name": PROVIDER_NAME})
    if provider is None:
        provider = await db.aiprovider.create(data={"name": PROVIDER_NAME})

    model = await db.aimodel.find_first(
        where={"aiProviderId": provider.id, "name": MODEL_NAME, "purpose": "EVALUATION"}
    )
    if model is None:
        model = await db.aimodel.create(
            data={"aiProviderId": provider.id, "name": MODEL_NAME, "purpose": "EVALUATION"}
        )
    return model.id


async def resolve_evaluation_model_version_id(ai_model_id: str) -> str:
    version = await db.aimodelversion.find_first(
        where={"aiModelId": ai_model_id, "versionLabel": VERSION_LABEL}
    )
    if version is None:
        version = await db.aimodelversion.create(
            data={"aiModelId": ai_model_id, "versionLabel": VERSION_LABEL, "isActive": True}
        )
    return version.id


async def resolve_evaluation_prompt_version_id(ai_model_id: str, created_by_user_id: str) -> str:
    prompt = await db.promptversion.find_first(
        where={"aiModelId": ai_model_id, "versionLabel": PROMPT_VERSION_LABEL}
    )
    if prompt is None:
        prompt = await db.promptversion.create(
            data={
                "aiModelId": ai_model_id,
                "versionLabel": PROMPT_VERSION_LABEL,
                "promptTemplate": PROMPT_TEMPLATE,
                "createdByUserId": created_by_user_id,
            }
        )
    return prompt.id
