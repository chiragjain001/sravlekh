"""AI Blueprint Agent (v1, unchanged scope) — selects/suggests a question
distribution for paper assembly from a teacher's natural-language prompt. Distinct
from the v2 AI Evaluation Engine (evaluation/ai_evaluator.py): different input,
different model purpose, different risk profile — 32-AI-GOVERNANCE-POLICY.md §3's
scope table is explicit that this agent may select/suggest question distribution
and must never author content, alter marks/rubrics, or make an evaluation decision.
This file only ever returns a BlueprintGenerationResult; it writes nothing.

P1 B5: brought under the same model-registry discipline as evaluation/
ai_evaluator.py (27 §8a) — the registry resolves which model actually runs,
rather than a hardcoded "gpt-4o" literal, so deactivating a model version is a
genuine kill switch here too. No Blueprint database lineage/audit row is written
(that remains a separate, deliberately deferred schema decision) — this
increment's scope is execution control only: if no active Blueprint model
version is configured, generation fails explicitly rather than silently falling
back to a hardcoded or replacement model.

P1 B1 Stage 4: the vendor SDK is reached only through
providers/openai_adapter.py (27 §8a) — this module no longer imports
langchain_openai/openai. The LCEL chain `prompt_template | llm | parser` is
replaced by the equivalent explicit three steps (render -> adapter -> parse).
Behavioral equivalence was captured from the LCEL pipeline before the change and
is asserted by test_blueprint_agent.py:

  * PromptTemplate rendered to a StringPromptValue which ChatOpenAI converted to
    exactly ONE HumanMessage whose content was a plain `str` (not a content-part
    list). The adapter's single-TextPart path emits that identical wire shape, so
    the provider sees byte-identical input.
  * PromptTemplate performs ONE str.format() pass with user_prompt and
    format_instructions supplied together. That single pass is load-bearing and
    not merely a tidiness choice: get_format_instructions() embeds a JSON schema
    containing literal braces, so formatting the two variables in two sequential
    passes raises KeyError on the schema's own braces. PROMPT_TEMPLATE.format()
    below is therefore called exactly once with both keywords.
  * Parsing stays above the adapter (the adapter returns raw text), so malformed
    provider output still surfaces as langchain's OutputParserException from the
    same PydanticOutputParser as before — unchanged error type and message.
"""

from langchain_core.output_parsers import PydanticOutputParser
from pydantic import BaseModel, Field

from src.ai.blueprint_model_registry import (
    resolve_active_blueprint_model_version,
    resolve_blueprint_ai_model_id,
)
from src.config import get_settings
from src.providers.gemini_adapter import GeminiAdapter
from src.providers.openai_adapter import OpenAIAdapter
from src.providers.types import GenerateRequest, TextPart

# Dev-only fallback, same shape as StorageService's local-disk fallback when S3
# isn't configured: an environment with only a Gemini key (no OpenAI billing
# set up) can still exercise this feature instead of it being hard-down. Not
# governed by blueprint_model_registry.py — that registry's isActive kill
# switch and versionLabel are specifically an OpenAI model's, bootstrapped as
# such (PROVIDER_NAME = "OpenAI"). Extending it into a generic multi-provider
# registry is a real design decision (does deactivating "the" Blueprint model
# mean OpenAI's, Gemini's, or both? does each provider get its own row?) that
# belongs to a deliberate increment, not a side effect of unblocking local
# testing — so this fallback path deliberately sits outside it, exactly the
# way the local-disk storage fallback sits outside S3 configuration instead of
# pretending to be another S3 bucket.
GEMINI_FALLBACK_MODEL = "gemini-3.6-flash"

# Unchanged from the pre-adapter call (was an inline `temperature=0.2` on the
# ChatOpenAI constructor). Named rather than inlined so the request-shape test
# can assert it by reference instead of restating the literal.
BLUEPRINT_TEMPERATURE = 0.2  # Low temperature for analytical consistency

# Verbatim the string previously held in PromptTemplate(template=...). Lifted to
# a module constant so the prompt-rendering regression test can assert against
# the same source the production path uses, rather than a copy that could drift.
PROMPT_TEMPLATE = """You are an expert academic curriculum designer.
A teacher wants to generate a blueprint (distribution of questions) for an upcoming exam.

Teacher's Request: "{user_prompt}"

Based on their request, intelligently deduce a fair distribution of questions.
- If they ask for a "Hard" exam, skew the distribution towards HARD difficulty.
- If they specify a time but not question count, estimate a reasonable number (e.g. 1 MCQ = 1-2 mins).
- If they mention specific topics, create rules ONLY for those topics.

{format_instructions}"""


class DistributionRuleModel(BaseModel):
    topicName: str = Field(description="The name of the academic topic to test (e.g., Kinematics, Algebra)")
    questionType: str = Field(description="Type of question: MCQ, NUMERICAL, SUBJECTIVE")
    difficulty: str = Field(description="Difficulty level: EASY, MEDIUM, HARD")
    count: int = Field(description="Number of questions to select")


class BlueprintGenerationResult(BaseModel):
    title: str = Field(description="A descriptive title for the exam")
    duration: int = Field(description="Duration of the exam in minutes (default to 60 if not specified)")
    rules: list[DistributionRuleModel] = Field(description="List of rules dictating the distribution of questions")


async def generate_blueprint_from_prompt(user_prompt: str) -> BlueprintGenerationResult:
    """Takes a natural language prompt from a teacher and converts it into a
    structured Blueprint rule set using an LLM.

    Async (P1 B5): the registry resolution below is Prisma-backed and therefore
    async-only — this function was synchronous before, calling get_settings() at
    *module* import time. Moved get_settings() inside the function body to match
    the per-call convention already used in ai_evaluator.py/handwriting_ocr.py;
    since get_settings() is itself @lru_cache-d, this changes no behavior (same
    cached Settings object either way) but removes the only module-level state
    this file had, so there is no cross-request staleness question left to ask.
    """
    settings = get_settings()
    use_gemini_fallback = not settings.OPENAI_API_KEY and bool(settings.GEMINI_API_KEY)
    if not settings.OPENAI_API_KEY and not use_gemini_fallback:
        raise ValueError(
            "Neither OPENAI_API_KEY nor GEMINI_API_KEY is configured in the environment."
        )

    # 27 §8a: the registry decides WHICH model runs — resolved before the call,
    # same discipline as ai_evaluator.py. No active version configured is an
    # explicit, safe failure: never a silent fallback to a hardcoded/replacement
    # model (the exact bug this increment exists to close). This governs the
    # OpenAI path only — see GEMINI_FALLBACK_MODEL above for why the Gemini
    # fallback intentionally isn't run through it.
    model_label = GEMINI_FALLBACK_MODEL
    if not use_gemini_fallback:
        ai_model_id = await resolve_blueprint_ai_model_id()
        ai_model_version = await resolve_active_blueprint_model_version(ai_model_id)
        if ai_model_version is None:
            raise ValueError(
                "No active Blueprint AI model is configured. Ask an administrator to "
                "activate one before generating blueprints."
            )
        model_label = ai_model_version.versionLabel

    parser = PydanticOutputParser(pydantic_object=BlueprintGenerationResult)

    # ONE format pass with both variables — see the module docstring: two passes
    # would raise KeyError on the JSON schema braces inside format_instructions.
    prompt_text = PROMPT_TEMPLATE.format(
        user_prompt=user_prompt,
        format_instructions=parser.get_format_instructions(),
    )

    # A single TextPart reproduces exactly what the LCEL chain sent: one
    # HumanMessage carrying a plain string. max_tokens deliberately unset,
    # matching the previous ChatOpenAI call, which never passed one.
    generate_request = GenerateRequest(
        content=[TextPart(prompt_text)],
        model=model_label,
        temperature=BLUEPRINT_TEMPERATURE,
    )

    adapter = (
        GeminiAdapter(api_key=settings.GEMINI_API_KEY)
        if use_gemini_fallback
        else OpenAIAdapter(api_key=settings.OPENAI_API_KEY)
    )
    generated = await adapter.generate(generate_request)

    return parser.parse(generated.text)
