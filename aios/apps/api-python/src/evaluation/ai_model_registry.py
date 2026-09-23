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
# P1 B3 bumped "v1" -> "v2" because v1's stored template never matched what was
# sent. "v3" adds step/tag-wise marking (the `breakdown` in the output schema)
# and splits into two templates — with and without a reference answer — each
# its own PromptVersion row. 32-AI-GOVERNANCE-POLICY.md §7 forbids rewriting a
# historical PromptVersion's content, so changed text is always a new label;
# existing AIRecommendation rows keep pointing at "v2".
PROMPT_VERSION_LABEL = "v3"
PROMPT_VERSION_LABEL_NO_REFERENCE = "v3-no-reference"

# Shared by both templates below. Plain text with {max_marks} as its only
# placeholder — it is concatenated into each template before .format() runs.
_MARKING_INSTRUCTIONS = (
    "Mark it the way an experienced board examiner would, step by step:\n"
    "- Split the {max_marks} marks into 2-5 tagged parts that fit this question, whose maxMarks add up to exactly "
    "{max_marks}. For numericals/derivations use tags like FORMULA, SUBSTITUTION, CALCULATION, FINAL_ANSWER, UNITS; "
    "for theory use tags like CONCEPT, KEY_POINTS, EXPLANATION, EXAMPLE, DIAGRAM.\n"
    "- Award each part on its own merit: a wrong final answer does not cancel marks for a correct formula or method, "
    "and an early slip carried forward correctly is penalised once, not at every later step.\n"
    "- suggestedMarks must equal the sum of the parts' marksAwarded.\n"
    "- verdict: CORRECT (full marks), PARTIALLY_CORRECT, INCORRECT (zero marks), or NOT_ATTEMPTED (blank or unrelated).\n"
    "- mistakeTag: the main kind of error if any marks were lost (CONCEPT_ERROR, FORMULA_ERROR, CALCULATION_ERROR, "
    "CARELESS, NOT_ATTEMPTED, PRESENTATION_ERROR), otherwise null.\n"
    "- note: one or two sentences for the teacher saying where marks were lost.\n"
    "- The student's answer was transcribed from handwriting, so ignore obvious transcription noise.\n"
    "- If the answer has little relevance to the question, set offTopicSuspected=true."
)

# ai_evaluator.py renders these exact constants (imported, not copied), and
# resolve_evaluation_prompt_version_id persists the same one as
# PromptVersion.promptTemplate — so the audited text and the sent text cannot
# drift. str.format() does one pass over the template's own braces and does not
# re-scan substituted values, so format_instructions (JSON-schema braces) and
# free-text fields are inserted literally.
PROMPT_TEMPLATE = (
    "Question (worth {max_marks} marks):\n{question_content}\n\n"
    "Reference answer:\n{reference_answer}\n\n"
    "Student's answer:\n{student_answer}\n"
    "{criteria_block}\n\n"
    "Grade the student's answer against the reference answer. Be fair and consistent, and accept a correct "
    "method or wording even when it differs from the reference. Set modelSolution to null.\n"
    + _MARKING_INSTRUCTIONS
    + "\n\n{format_instructions}"
)

PROMPT_TEMPLATE_NO_REFERENCE = (
    "Question (worth {max_marks} marks):\n{question_content}\n\n"
    "Student's answer:\n{student_answer}\n"
    "{criteria_block}\n\n"
    "No reference answer was provided. First solve the question yourself and put a concise model answer in "
    "modelSolution (for a numerical: the key steps and the final value with units). Then grade the student's "
    "answer against your own solution. If the question is ambiguous or opinion-based, or you are not sure of the "
    "correct answer, lower your confidence accordingly — a teacher reviews every mark.\n"
    + _MARKING_INSTRUCTIONS
    + "\n\n{format_instructions}"
)


def prompt_for(has_reference: bool) -> tuple[str, str]:
    """(versionLabel, template) for this evaluation's branch."""
    if has_reference:
        return PROMPT_VERSION_LABEL, PROMPT_TEMPLATE
    return PROMPT_VERSION_LABEL_NO_REFERENCE, PROMPT_TEMPLATE_NO_REFERENCE


# The provider actually in use decides which rows these resolve
# (providers/factory.py). The defaults keep OpenAI's historical rows as the
# default so existing installs are unaffected; a Gemini-backed deployment
# resolves its own AIProvider/AIModel/AIModelVersion chain, so the model
# recorded on every AIRecommendation is the model that ran and deactivating
# it is a real kill switch for that provider.
async def resolve_evaluation_ai_model_id(provider_name: str = PROVIDER_NAME, model_name: str = MODEL_NAME) -> str:
    provider = await db.aiprovider.find_first(where={"name": provider_name})
    if provider is None:
        provider = await db.aiprovider.create(data={"name": provider_name})

    model = await db.aimodel.find_first(
        where={"aiProviderId": provider.id, "name": model_name, "purpose": "EVALUATION"}
    )
    if model is None:
        model = await db.aimodel.create(
            data={"aiProviderId": provider.id, "name": model_name, "purpose": "EVALUATION"}
        )
    return model.id


async def resolve_active_evaluation_model_version(ai_model_id: str, version_label: str = VERSION_LABEL):
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
        where={"aiModelId": ai_model_id, "versionLabel": version_label, "isActive": True},
        order={"createdAt": "desc"},
    )
    if version is not None:
        return version

    any_version = await db.aimodelversion.find_first(where={"aiModelId": ai_model_id})
    if any_version is not None:
        return None

    return await db.aimodelversion.create(
        data={"aiModelId": ai_model_id, "versionLabel": version_label, "isActive": True}
    )


async def resolve_evaluation_prompt_version_id(
    ai_model_id: str,
    created_by_user_id: str,
    version_label: str = PROMPT_VERSION_LABEL,
    template: str = PROMPT_TEMPLATE,
) -> str:
    prompt = await db.promptversion.find_first(
        where={"aiModelId": ai_model_id, "versionLabel": version_label}
    )
    if prompt is None:
        prompt = await db.promptversion.create(
            data={
                "aiModelId": ai_model_id,
                "versionLabel": version_label,
                "promptTemplate": template,
                "createdByUserId": created_by_user_id,
            }
        )
    return prompt.id
