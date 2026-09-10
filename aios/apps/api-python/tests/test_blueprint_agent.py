import json
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from langchain_core.exceptions import OutputParserException
from langchain_core.output_parsers import PydanticOutputParser

from src.ai.blueprint_agent import (
    BLUEPRINT_TEMPERATURE,
    GEMINI_FALLBACK_MODEL,
    PROMPT_TEMPLATE,
    BlueprintGenerationResult,
    generate_blueprint_from_prompt,
)
from src.config import Settings
from src.providers.errors import AdapterAuthError, AdapterRateLimitError
from src.providers.types import TextPart

SETTINGS_WITH_KEY = Settings(DATABASE_URL="postgresql://x", JWT_SECRET="x" * 32, OPENAI_API_KEY="sk-test")
SETTINGS_GEMINI_ONLY = Settings(DATABASE_URL="postgresql://x", JWT_SECRET="x" * 32, GEMINI_API_KEY="gem-test")
SETTINGS_BOTH_KEYS = Settings(DATABASE_URL="postgresql://x", JWT_SECRET="x" * 32, OPENAI_API_KEY="sk-test", GEMINI_API_KEY="gem-test")
# Both keys pinned explicitly — see the comment on settings_no_key below for why.
SETTINGS_NEITHER_KEY = Settings(DATABASE_URL="postgresql://x", JWT_SECRET="x" * 32, OPENAI_API_KEY="", GEMINI_API_KEY="")

VALID_RESULT = {
    "title": "E2E Physics Test",
    "duration": 60,
    "rules": [{"topicName": "Kinematics", "questionType": "MCQ", "difficulty": "MEDIUM", "count": 5}],
}


def fake_adapter(content: dict | str | None = None, error: Exception | None = None):
    """P1 B1 Stage 4: the seam is now the ADAPTER, not ChatOpenAI. The previous
    fake had to be a genuine langchain Runnable (RunnableLambda) because LCEL's
    `prompt_template | llm | parser` composition requires `__ror__`; with the
    chain replaced by explicit calls, a plain mock suffices. Adapted to the new
    boundary rather than weakening the production design."""
    if error is not None:
        generate = AsyncMock(side_effect=error)
    else:
        text = content if isinstance(content, str) else json.dumps(content or VALID_RESULT)
        generate = AsyncMock(return_value=SimpleNamespace(text=text))
    return MagicMock(return_value=SimpleNamespace(generate=generate))


def patch_agent(adapter, version=SimpleNamespace(id="version-1", versionLabel="gpt-4o"), settings=SETTINGS_WITH_KEY):
    return (
        patch("src.ai.blueprint_agent.get_settings", return_value=settings),
        patch("src.ai.blueprint_agent.OpenAIAdapter", adapter),
        patch("src.ai.blueprint_agent.resolve_blueprint_ai_model_id", AsyncMock(return_value="model-1")),
        patch("src.ai.blueprint_agent.resolve_active_blueprint_model_version", AsyncMock(return_value=version)),
    )


def sent_request(adapter):
    return adapter.return_value.generate.await_args.args[0]


# ---- B5 invariants: preserved verbatim across the Stage 4 migration ---------


@pytest.mark.asyncio
async def test_active_blueprint_model_is_used_for_generation():
    """Active Blueprint model version -> generation uses the registry-selected
    model. The model string reaching the provider must be the registry's
    versionLabel, not a hardcoded literal."""
    adapter = fake_adapter()
    a, b, c, d = patch_agent(adapter, version=SimpleNamespace(id="version-1", versionLabel="gpt-4o-registry-selected"))
    with a, b, c, d:
        result = await generate_blueprint_from_prompt("A medium physics test")

    assert sent_request(adapter).model == "gpt-4o-registry-selected"
    assert result.title == "E2E Physics Test"
    assert result.rules[0].topicName == "Kinematics"


@pytest.mark.asyncio
async def test_existing_generation_behavior_is_intact_when_the_configured_version_is_active():
    """Regression: the pre-B5/pre-B1 happy path (a normally-configured, active
    model) still produces a correctly-parsed BlueprintGenerationResult end to end."""
    adapter = fake_adapter()
    a, b, c, d = patch_agent(adapter)
    with a, b, c, d:
        result = await generate_blueprint_from_prompt("A 60 minute mixed test")

    assert isinstance(result, BlueprintGenerationResult)
    assert result.duration == 60
    assert len(result.rules) == 1


@pytest.mark.asyncio
async def test_no_active_blueprint_model_fails_explicitly_without_calling_the_provider():
    """Required invariant: no active version -> explicit, safe failure — never a
    silent fallback to a hardcoded or replacement model."""
    adapter = fake_adapter()
    a, b, c, d = patch_agent(adapter, version=None)
    with a, b, c, d:
        with pytest.raises(ValueError, match="No active Blueprint AI model is configured"):
            await generate_blueprint_from_prompt("A hard chemistry test")

    adapter.assert_not_called()


@pytest.mark.asyncio
async def test_missing_api_key_fails_before_any_registry_resolution():
    """Pre-existing behavior, unchanged: the API-key check still runs first —
    confirms neither B5 nor Stage 4 reordered this or made it reachable past a
    misconfigured key."""
    # Both keys pinned explicitly: Settings() falls back to the real .env file
    # for any field not passed as a kwarg, and this developer's .env carries a
    # real GEMINI_API_KEY for the fallback path below — leaving it unset here
    # would silently pick that up and defeat the "no key at all" scenario.
    settings_no_key = Settings(DATABASE_URL="postgresql://x", JWT_SECRET="x" * 32, OPENAI_API_KEY="", GEMINI_API_KEY="")
    resolve_model_id = AsyncMock()
    adapter = fake_adapter()

    with patch("src.ai.blueprint_agent.get_settings", return_value=settings_no_key), \
         patch("src.ai.blueprint_agent.OpenAIAdapter", adapter), \
         patch("src.ai.blueprint_agent.resolve_blueprint_ai_model_id", resolve_model_id):
        with pytest.raises(ValueError, match="OPENAI_API_KEY"):
            await generate_blueprint_from_prompt("A test")

    resolve_model_id.assert_not_awaited()
    adapter.assert_not_called()


# ---- P1 B1 Stage 4: LCEL -> adapter conversion ------------------------------


@pytest.mark.asyncio
async def test_request_is_a_single_text_part_with_blueprint_temperature_and_no_max_tokens():
    """The LCEL chain sent exactly one HumanMessage whose content was a plain
    string; a lone TextPart reproduces that wire shape byte for byte. Blueprint
    never configured max_tokens and must not start now."""
    adapter = fake_adapter()
    a, b, c, d = patch_agent(adapter)
    with a, b, c, d:
        await generate_blueprint_from_prompt("A test")

    request = sent_request(adapter)
    assert len(request.content) == 1
    assert isinstance(request.content[0], TextPart)
    assert request.temperature == BLUEPRINT_TEMPERATURE == 0.2
    assert request.max_tokens is None


@pytest.mark.asyncio
async def test_prompt_rendering_is_unchanged_from_the_lcel_template():
    """PromptTemplate performed ONE str.format() pass with both variables
    supplied together. Asserting against PROMPT_TEMPLATE.format(...) pins that:
    the production path must render the same single-pass substitution."""
    adapter = fake_adapter()
    a, b, c, d = patch_agent(adapter)
    with a, b, c, d:
        await generate_blueprint_from_prompt("Hard physics test, 90 minutes")

    parser = PydanticOutputParser(pydantic_object=BlueprintGenerationResult)
    expected = PROMPT_TEMPLATE.format(
        user_prompt="Hard physics test, 90 minutes",
        format_instructions=parser.get_format_instructions(),
    )
    assert sent_request(adapter).content[0].text == expected


@pytest.mark.asyncio
async def test_format_instructions_are_present_in_the_rendered_prompt():
    """The parser's format instructions were injected as a PromptTemplate partial
    variable; losing them silently would degrade output quality without any
    error, so their presence is asserted independently of the full-string match."""
    adapter = fake_adapter()
    a, b, c, d = patch_agent(adapter)
    with a, b, c, d:
        await generate_blueprint_from_prompt("A test")

    text = sent_request(adapter).content[0].text
    parser = PydanticOutputParser(pydantic_object=BlueprintGenerationResult)
    assert parser.get_format_instructions() in text
    assert "JSON schema" in text
    assert "curriculum designer" in text  # the Blueprint system instruction itself


@pytest.mark.asyncio
async def test_a_user_prompt_containing_braces_renders_without_a_format_error():
    """The single-pass .format() contract, from the other direction. Braces in
    the teacher's prompt are substituted VALUES and are never re-scanned; a
    two-pass implementation would raise KeyError here (and on the JSON schema
    braces inside format_instructions)."""
    braced = 'Use {this} and {"json": true}'
    adapter = fake_adapter()
    a, b, c, d = patch_agent(adapter)
    with a, b, c, d:
        result = await generate_blueprint_from_prompt(braced)

    assert braced in sent_request(adapter).content[0].text
    assert result.title == "E2E Physics Test"


@pytest.mark.asyncio
async def test_parser_output_is_unchanged_for_a_valid_provider_response():
    """Parsing stays ABOVE the adapter — the adapter returns raw text and the
    same PydanticOutputParser produces the same typed object as under LCEL."""
    payload = {
        "title": "Thermodynamics Mid-Term",
        "duration": 90,
        "rules": [
            {"topicName": "Heat", "questionType": "MCQ", "difficulty": "HARD", "count": 10},
            {"topicName": "Entropy", "questionType": "SUBJECTIVE", "difficulty": "MEDIUM", "count": 3},
        ],
    }
    adapter = fake_adapter(payload)
    a, b, c, d = patch_agent(adapter)
    with a, b, c, d:
        result = await generate_blueprint_from_prompt("A hard thermo test")

    assert result.model_dump() == payload


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "malformed",
    ["not json at all", '{"title":"T"}', '{"title":"T","duration":"NaN","rules":[]}'],
    ids=["non-json", "missing-fields", "wrong-type"],
)
async def test_malformed_provider_output_still_fails_through_the_parser(malformed):
    """Unchanged failure mode: OutputParserException from the same parser, not a
    new adapter-level error and not a silently-degraded result."""
    adapter = fake_adapter(malformed)
    a, b, c, d = patch_agent(adapter)
    with a, b, c, d:
        with pytest.raises(OutputParserException):
            await generate_blueprint_from_prompt("A test")


@pytest.mark.asyncio
@pytest.mark.parametrize("error", [AdapterAuthError("bad key"), AdapterRateLimitError("slow down")])
async def test_provider_errors_propagate_as_normalized_adapter_errors(error):
    """Vendor exception types are normalized at the adapter boundary; Blueprint
    adds no handling of its own, so the normalized error surfaces to the router
    (which maps any exception to a 500, exactly as before)."""
    adapter = fake_adapter(error=error)
    a, b, c, d = patch_agent(adapter)
    with a, b, c, d:
        with pytest.raises(type(error)):
            await generate_blueprint_from_prompt("A test")


@pytest.mark.asyncio
async def test_the_registry_is_resolved_exactly_once_per_generation():
    """No second model-resolution path: one resolution feeds the one request."""
    adapter = fake_adapter()
    resolve_id = AsyncMock(return_value="model-1")
    resolve_version = AsyncMock(return_value=SimpleNamespace(id="version-1", versionLabel="gpt-4o"))

    with patch("src.ai.blueprint_agent.get_settings", return_value=SETTINGS_WITH_KEY), \
         patch("src.ai.blueprint_agent.OpenAIAdapter", adapter), \
         patch("src.ai.blueprint_agent.resolve_blueprint_ai_model_id", resolve_id), \
         patch("src.ai.blueprint_agent.resolve_active_blueprint_model_version", resolve_version):
        await generate_blueprint_from_prompt("A test")

    resolve_id.assert_awaited_once()
    resolve_version.assert_awaited_once()
    assert adapter.return_value.generate.await_count == 1


# ---- Gemini fallback (dev-only, used when OPENAI_API_KEY is unset) ---------


@pytest.mark.asyncio
async def test_gemini_is_used_when_only_a_gemini_key_is_configured():
    """The environment this fallback exists for: no OpenAI billing set up,
    only a free-tier Gemini key available."""
    adapter = fake_adapter()
    resolve_id = AsyncMock()
    resolve_version = AsyncMock()

    with patch("src.ai.blueprint_agent.get_settings", return_value=SETTINGS_GEMINI_ONLY), \
         patch("src.ai.blueprint_agent.GeminiAdapter", adapter), \
         patch("src.ai.blueprint_agent.resolve_blueprint_ai_model_id", resolve_id), \
         patch("src.ai.blueprint_agent.resolve_active_blueprint_model_version", resolve_version):
        result = await generate_blueprint_from_prompt("A medium physics test")

    assert result.title == "E2E Physics Test"
    assert sent_request(adapter).model == GEMINI_FALLBACK_MODEL
    adapter.assert_called_once_with(api_key="gem-test")
    # The OpenAI-specific registry is not this fallback's business — resolving
    # it would ask "is OpenAI's Blueprint model active" to authorize a call
    # that was never going to use OpenAI.
    resolve_id.assert_not_awaited()
    resolve_version.assert_not_awaited()


@pytest.mark.asyncio
async def test_openai_is_preferred_when_both_keys_are_configured():
    """OpenAI stays the default the moment it's genuinely configured — the
    Gemini fallback only ever fires for its one purpose, an environment with
    no working OpenAI key, never as a silent alternate path once OpenAI works."""
    openai_adapter = fake_adapter()
    gemini_adapter = fake_adapter()
    a, b, c, d = patch_agent(openai_adapter, settings=SETTINGS_BOTH_KEYS)
    with a, b, c, d, patch("src.ai.blueprint_agent.GeminiAdapter", gemini_adapter):
        await generate_blueprint_from_prompt("A test")

    openai_adapter.assert_called_once_with(api_key="sk-test")
    gemini_adapter.assert_not_called()


@pytest.mark.asyncio
async def test_missing_both_keys_fails_before_any_registry_resolution_or_call():
    resolve_id = AsyncMock()
    openai_adapter = fake_adapter()
    gemini_adapter = fake_adapter()

    with patch("src.ai.blueprint_agent.get_settings", return_value=SETTINGS_NEITHER_KEY), \
         patch("src.ai.blueprint_agent.OpenAIAdapter", openai_adapter), \
         patch("src.ai.blueprint_agent.GeminiAdapter", gemini_adapter), \
         patch("src.ai.blueprint_agent.resolve_blueprint_ai_model_id", resolve_id):
        with pytest.raises(ValueError, match="OPENAI_API_KEY.*GEMINI_API_KEY"):
            await generate_blueprint_from_prompt("A test")

    resolve_id.assert_not_awaited()
    openai_adapter.assert_not_called()
    gemini_adapter.assert_not_called()


@pytest.mark.asyncio
async def test_gemini_fallback_still_uses_blueprint_temperature_and_single_text_part():
    """Same request-shape guarantees as the OpenAI path — the fallback changes
    which adapter runs, not what gets sent to it."""
    adapter = fake_adapter()
    with patch("src.ai.blueprint_agent.get_settings", return_value=SETTINGS_GEMINI_ONLY), \
         patch("src.ai.blueprint_agent.GeminiAdapter", adapter):
        await generate_blueprint_from_prompt("A test")

    request = sent_request(adapter)
    assert len(request.content) == 1
    assert isinstance(request.content[0], TextPart)
    assert request.temperature == BLUEPRINT_TEMPERATURE == 0.2
    assert request.max_tokens is None


@pytest.mark.asyncio
async def test_gemini_provider_errors_propagate_as_normalized_adapter_errors():
    """Same normalized-error contract as the OpenAI path (test above) — the
    fallback must not swallow or reshape what GeminiAdapter raises."""
    error = AdapterRateLimitError("slow down")
    adapter = fake_adapter(error=error)
    with patch("src.ai.blueprint_agent.get_settings", return_value=SETTINGS_GEMINI_ONLY), \
         patch("src.ai.blueprint_agent.GeminiAdapter", adapter):
        with pytest.raises(AdapterRateLimitError):
            await generate_blueprint_from_prompt("A test")
