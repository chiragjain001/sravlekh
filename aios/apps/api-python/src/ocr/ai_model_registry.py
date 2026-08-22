"""Resolves the AIModelVersion row OCRResult.aiModelVersionId requires.

04-DATABASE-SCHEMA.md (V2 section) fix #6: no evaluation-domain code may
hardcode a vendor SDK call — every AI invocation resolves
AIProvider -> AIModel -> AIModelVersion from the registry Phase 7 built,
never a bare string. That registry has never been wired to anything real
until now (no admin CRUD exists yet either), so this module bootstraps the
one row OCR needs on first use, idempotently (find-or-create), rather than
requiring a separate seed script or registry-management module Phase 11
doesn't otherwise need.
"""

from src.database import db

PROVIDER_NAME = "OpenAI"
MODEL_NAME = "gpt-4o"
VERSION_LABEL = "gpt-4o"


async def resolve_ocr_model_version_id() -> str:
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

    version = await db.aimodelversion.find_first(
        where={"aiModelId": model.id, "versionLabel": VERSION_LABEL}
    )
    if version is None:
        version = await db.aimodelversion.create(
            data={"aiModelId": model.id, "versionLabel": VERSION_LABEL, "isActive": True}
        )

    return version.id
