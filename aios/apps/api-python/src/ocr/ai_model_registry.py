"""Resolves the AIModelVersion row that controls which model OCR extraction uses.

04-DATABASE-SCHEMA.md (V2 section) fix #6 / 27-AI-EVALUATION-ARCHITECTURE.md §8a:
no AI-domain code hardcodes a vendor model — every invocation resolves
AIProvider -> AIModel(purpose=OCR) -> AIModelVersion from the registry. This
module bootstraps the row OCR needs on first use, idempotently (find-or-create),
since no admin CRUD exists yet.

P1 B1 Stage 3: upgraded from returning a bare id to returning the row, and from
no isActive filtering to the same two-case discipline as
evaluation/ai_model_registry.py and ai/blueprint_model_registry.py. Previously
this returned an id used ONLY to stamp OCRResult.aiModelVersionId, while
handwriting_ocr.py separately hardcoded model="gpt-4o" — so the registry was
decorative for OCR exactly as it had been for evaluation before B2:
deactivating a version changed nothing about which model actually ran.
"""

from src.database import db

PROVIDER_NAME = "OpenAI"
MODEL_NAME = "gpt-4o"
VERSION_LABEL = "gpt-4o"


async def resolve_ocr_ai_model_id() -> str:
    provider = await db.aiprovider.find_first(where={"name": PROVIDER_NAME})
    if provider is None:
        provider = await db.aiprovider.create(data={"name": PROVIDER_NAME})

    model = await db.aimodel.find_first(
        where={"aiProviderId": provider.id, "name": MODEL_NAME, "purpose": "OCR"}
    )
    if model is None:
        model = await db.aimodel.create(
            data={"aiProviderId": provider.id, "name": MODEL_NAME, "purpose": "OCR"}
        )
    return model.id


async def resolve_active_ocr_model_version(ai_model_id: str):
    """Returns the active AIModelVersion row, or None if OCR is deconfigured.

    Two distinct "not found" cases, deliberately handled differently — identical
    reasoning to the evaluation and blueprint registries:
      * No version rows at all (fresh install) -> bootstrap one, as before.
      * Rows exist but none are active -> return None. An admin deactivating the
        last version is an explicit "stop running OCR with this" instruction;
        silently bootstrapping a replacement would make isActive unenforceable.

    order={"createdAt": "desc"} because AIModelVersion has no uniqueness
    constraint on (aiModelId, versionLabel) — two rows can both be active (e.g.
    mid-rollout), and "which model actually runs" must be answerable the same way
    twice, not left to unspecified row order. Same guard added for Blueprint in B5.

    Returns the row rather than a bare id because the caller needs BOTH
    .versionLabel (the actual model identifier sent to the provider) and .id (the
    FK stamped onto OCRResult) — resolving once and using both is what keeps the
    audited model and the executed model the same thing.
    """
    version = await db.aimodelversion.find_first(
        where={"aiModelId": ai_model_id, "versionLabel": VERSION_LABEL, "isActive": True},
        order={"createdAt": "desc"},
    )
    if version is not None:
        return version

    any_version = await db.aimodelversion.find_first(where={"aiModelId": ai_model_id})
    if any_version is not None:
        return None

    return await db.aimodelversion.create(
        data={"aiModelId": ai_model_id, "versionLabel": VERSION_LABEL, "isActive": True}
    )
