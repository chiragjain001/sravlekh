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
# P1 B3: bumped from "v1". The old v1 row's promptTemplate was a two-sentence
# placeholder that never matched the prompt ai_evaluator.py actually sent (see
# PROMPT_TEMPLATE below) — 32-AI-GOVERNANCE-POLICY.md §7 forbids retroactively
# rewriting a historical PromptVersion's content, so the fix is a new labeled
# version, not an edit to "v1" in place. Existing AIRecommendation rows keep
# pointing at "v1" — an honest record of what was (wrongly) claimed at the time,
# not silently made to look correct in hindsight.
PROMPT_VERSION_LABEL = "v2"

# P1 B3: this is the actual template ai_evaluator.py's _build_prompt() renders —
# imported and used directly there (not copied), so the two are structurally the
# same text rather than two independently-maintained strings that drifted apart
# from day one. {format_instructions}/{question_content}/etc. are `.format()`
# placeholders; str.format() does one pass over THIS string's own braces and does
# not re-scan substituted values, so format_instructions (which itself contains
# literal JSON-schema braces) and free-text fields (question/answer/criteria,
# which may contain arbitrary characters) are inserted literally, not re-parsed.
PROMPT_TEMPLATE = (
    "Question (worth {max_marks} marks):\n{question_content}\n\n"
    "Reference answer:\n{reference_answer}\n\n"
    "Student's answer:\n{student_answer}\n"
    "{criteria_block}\n\n"
    "Grade the student's answer against the reference answer. Be fair and consistent. "
    "If the student's answer appears to have little relevance to the question, set offTopicSuspected=true.\n\n"
    "{format_instructions}"
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


async def resolve_active_evaluation_model_version(ai_model_id: str):
    """Returns the active AIModelVersion row, or None if evaluation is deconfigured.

    Two distinct "not found" cases, deliberately handled differently:
      * No version rows at all (fresh install) -> bootstrap one, as before.
      * Rows exist but none are active -> return None. An admin deactivating the
        last version is an explicit "stop evaluating with this" instruction;
        silently bootstrapping a replacement would make isActive unenforceable,
        which is exactly the bug this function previously had (it never filtered
        on isActive, so deactivating a version had no effect at all).

    Additionally orders by createdAt desc (post-B1 hardening, matching the guard
    already proven in blueprint_model_registry.py and ocr/ai_model_registry.py):
    AIModelVersion carries no uniqueness constraint on (aiModelId, versionLabel)
    — only an @@index([aiModelId, isActive]) — so two rows could in principle
    both be active at once (e.g. mid-rollout, or a race between two concurrent
    bootstraps on a fresh install). Resolving deterministically to the most
    recently created one, rather than leaving it to unspecified database row
    order, means "which model actually runs" is always answerable the same way
    twice in a row, not just in the common single-active-row case.

    Returns the row rather than a bare id because the caller uses versionLabel as
    the actual model identifier — the registry decides which model runs, it is not
    an audit label applied after the fact (27 §8a).
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
