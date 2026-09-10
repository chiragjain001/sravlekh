"""Resolves the AIModel/AIModelVersion row that controls which model Blueprint
generation uses.

P1 B5: brings the Blueprint Agent under the same registry discipline as
evaluation/ai_model_registry.py and ocr/ai_model_registry.py (27-AI-EVALUATION-
ARCHITECTURE.md §8a) — isActive genuinely controls which model runs, not just an
audit label applied after the fact.

Deliberately scoped narrower than the evaluation/OCR registries: this resolves a
model VERSION only, no PromptVersion. Blueprint generation persists no lineage
row to attach one to — Blueprint has no aiModelVersionId-equivalent column, and
adding one is a separate, deliberate schema decision, explicitly deferred rather
than bundled into this increment. Resolving an unused PromptVersion here would be
inventing complexity with no observable effect.

Kept as its own module rather than shared with evaluation's/OCR's, for the same
reason those two are already separate: a change to one purpose's registry rows
must never accidentally affect another's.
"""

from src.database import db


class NoActiveBlueprintModelError(Exception):
    """Blueprint generation is deconfigured: version rows exist but none is active.

    A distinct type rather than a bare ValueError so the router can map THIS to an
    operator-actionable 503 while still refusing to echo any other exception's text
    to the caller. Message-sniffing a ValueError would be the alternative, and it
    breaks silently the first time someone rewords the string.
    """


PROVIDER_NAME = "OpenAI"
MODEL_NAME = "gpt-4o"
VERSION_LABEL = "gpt-4o"


async def resolve_blueprint_ai_model_id() -> str:
    provider = await db.aiprovider.find_first(where={"name": PROVIDER_NAME})
    if provider is None:
        provider = await db.aiprovider.create(data={"name": PROVIDER_NAME})

    model = await db.aimodel.find_first(
        where={"aiProviderId": provider.id, "name": MODEL_NAME, "purpose": "BLUEPRINT"}
    )
    if model is None:
        model = await db.aimodel.create(
            data={"aiProviderId": provider.id, "name": MODEL_NAME, "purpose": "BLUEPRINT"}
        )
    return model.id


async def resolve_active_blueprint_model_version(ai_model_id: str):
    """Returns the active AIModelVersion row, or None if Blueprint generation is
    deconfigured. Same two-case "not found" distinction as evaluation/
    ai_model_registry.resolve_active_evaluation_model_version (see its docstring
    for the full reasoning):

      * No version rows at all for this model (fresh install) -> bootstrap one.
      * Rows exist but none are active -> return None. An admin deactivating the
        last version is a deliberate "stop generating blueprints with this"
        instruction, never silently replaced with a hardcoded fallback.

    Additionally orders by createdAt desc: AIModelVersion carries no uniqueness
    constraint on (aiModelId, versionLabel), so two rows could in principle both
    be active at once (e.g. mid-rollout). Resolving deterministically to the most
    recently activated one — rather than leaving it to unspecified database row
    order — means "which model actually runs" is always answerable the same way
    twice in a row, not just in the common single-active-row case.

    Returns the row rather than a bare id: the caller uses versionLabel as the
    actual model identifier passed to the vendor SDK, matching the same
    registry-decides-not-audits-after-the-fact discipline as evaluation's resolver.
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
