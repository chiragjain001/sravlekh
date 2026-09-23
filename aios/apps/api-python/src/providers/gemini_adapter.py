"""The Gemini provider adapter.

Exists so blueprint_agent.py can run with only a Gemini key configured — see
its module docstring for the OpenAI-preferred, Gemini-fallback order. This is
the only file in the codebase that imports `google.genai`, matching the same
"vendor SDK stays inside the adapter layer" discipline openai_adapter.py
follows (27-AI-EVALUATION-ARCHITECTURE.md §8a).

Built on `google.genai` (the current official SDK, `pip install google-genai`)
rather than `google-generativeai` or `langchain-google-genai`: the former is
deprecated upstream (emits FutureWarning on import as of this writing), and
the latter adds a second wrapper layer this codebase's adapters don't need —
none of the three real call sites use LCEL chaining, so there is nothing for
langchain to buy here that talking to the SDK directly doesn't already give.
Gemini's new-style "authorization keys" (bound to a service account, as
opposed to the older unrestricted "standard keys") authenticate the same way
as any other API key on this client — `Client(api_key=...)` — so no separate
code path is needed for the two key types.

ImagePart is supported by fetching the image bytes here (http(s) URL or data:
URL) and sending them inline — Gemini has no "pass any URL" input like OpenAI's.
Fetch failures are normalized to AdapterInvalidRequestError WITHOUT the URL in the
message: OCR image URLs are pre-signed storage URLs and the signature is a secret.
"""

from google.genai import Client
from google.genai.errors import APIError, ClientError, ServerError
from google.genai.types import GenerateContentConfig, Part

from src.image_fetch import ImageFetchError, fetch_image_bytes
from src.providers.base import ModelProviderAdapter
from src.providers.errors import (
    AdapterAuthError,
    AdapterInvalidRequestError,
    AdapterProviderError,
    AdapterRateLimitError,
)
from src.providers.rate_limit import pace
from src.providers.types import ContentPart, GenerateRequest, GenerateResult, ImagePart, TextPart

# HTTP statuses the Gemini API uses for auth/rate-limit failures within the
# ClientError (4xx) family — everything else in that family is treated as a
# malformed request, matching openai.BadRequestError's mapping in the sibling
# adapter.
_AUTH_STATUS_CODES = frozenset({401, 403})
_RATE_LIMIT_STATUS_CODE = 429


async def _load_image(image_url: str) -> Part:
    """Resolves an ImagePart URL to an inline Gemini Part. Never puts the URL in
    an error message (see module docstring)."""
    try:
        data, mime = await fetch_image_bytes(image_url)
    except ImageFetchError as e:
        raise AdapterInvalidRequestError(str(e)) from None
    return Part.from_bytes(data=data, mime_type=mime)


class GeminiAdapter(ModelProviderAdapter):
    def __init__(self, api_key: str, max_rpm: int = 0):
        self._client = Client(api_key=api_key)
        # Paced per model: the quota that bites first is per-model RPM.
        self._max_rpm = max_rpm

    async def _to_contents(self, parts: list[ContentPart]):
        """Mirrors OpenAIAdapter's single-TextPart path: blueprint_agent.py's
        one HumanMessage-equivalent is a plain string, not a part list."""
        if len(parts) == 1 and isinstance(parts[0], TextPart):
            return parts[0].text
        contents = []
        for p in parts:
            if isinstance(p, TextPart):
                contents.append(p.text)
            elif isinstance(p, ImagePart):
                contents.append(await _load_image(p.image_url))
            else:
                raise AdapterInvalidRequestError(f"Unsupported content part type: {type(p).__name__}")
        return contents

    async def generate(self, request: GenerateRequest) -> GenerateResult:
        config_kwargs: dict[str, object] = {"temperature": request.temperature}
        if request.max_tokens is not None:
            config_kwargs["max_output_tokens"] = request.max_tokens

        contents = await self._to_contents(request.content)
        await pace(f"gemini:{request.model}", self._max_rpm)
        try:
            response = await self._client.aio.models.generate_content(
                model=request.model,
                contents=contents,
                config=GenerateContentConfig(**config_kwargs),
            )
        except ClientError as e:
            if e.code in _AUTH_STATUS_CODES:
                raise AdapterAuthError(str(e)) from e
            if e.code == _RATE_LIMIT_STATUS_CODE:
                raise AdapterRateLimitError(str(e)) from e
            raise AdapterInvalidRequestError(str(e)) from e
        except ServerError as e:
            raise AdapterProviderError(str(e)) from e
        except APIError as e:
            # Catch-all for APIError subclasses that are neither Client- nor
            # Server- (e.g. UnknownApiResponseError) — still normalized, still
            # carries the original exception as __cause__.
            raise AdapterProviderError(str(e)) from e

        if not response.text:
            raise AdapterProviderError("Gemini returned no text in its response.")

        # Gemini's equivalent of OpenAI's finish_reason == "length". Compared by
        # NAME rather than by importing the FinishReason enum: the google-genai
        # SDK has moved this symbol between modules across versions, and an
        # ImportError here would break every generation call to protect against a
        # truncation that mostly does not happen. Every access is defensive for
        # the same reason — an unreadable finish reason means "assume complete",
        # which is exactly today's behaviour.
        candidates = getattr(response, "candidates", None) or []
        finish_reason = getattr(candidates[0], "finish_reason", None) if candidates else None
        truncated = getattr(finish_reason, "name", str(finish_reason)) == "MAX_TOKENS"
        return GenerateResult(text=response.text, truncated=truncated)
