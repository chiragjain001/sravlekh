"""P1 B1 Stage 1: the OpenAI provider adapter.

Intended to become the ONLY file in this codebase that imports `langchain_openai`
or `openai` directly, once Stages 2-4 migrate the three existing call sites onto
it (currently: ai_evaluator.py, ocr/handwriting_ocr.py, ai/blueprint_agent.py —
each still imports ChatOpenAI directly; see the B1 Stage 1 report's before/after
vendor-import sweep). This stage only adds the adapter — no call site is
migrated yet, so those three imports are still present and correct.
"""

import openai
from langchain_core.messages import HumanMessage
from langchain_openai import ChatOpenAI

from src.providers.base import ModelProviderAdapter
from src.providers.errors import (
    AdapterAuthError,
    AdapterInvalidRequestError,
    AdapterProviderError,
    AdapterRateLimitError,
)
from src.providers.types import ContentPart, GenerateRequest, GenerateResult, ImagePart, TextPart


class OpenAIAdapter(ModelProviderAdapter):
    def __init__(self, api_key: str):
        self._api_key = api_key

    def _to_message_content(self, parts: list[ContentPart]):
        """A single TextPart becomes a plain string, matching exactly how
        ai_evaluator.py/blueprint_agent.py construct HumanMessage today
        (`HumanMessage(content=prompt_text)`, a bare string) — not a one-item
        list. Preserves the current wire shape byte-for-byte for the two
        text-only call sites, rather than switching them to a differently-
        shaped (if functionally equivalent) multimodal-style payload as an
        incidental side effect of adapting this file."""
        if len(parts) == 1 and isinstance(parts[0], TextPart):
            return parts[0].text

        content = []
        for part in parts:
            if isinstance(part, TextPart):
                content.append({"type": "text", "text": part.text})
            elif isinstance(part, ImagePart):
                content.append({"type": "image_url", "image_url": {"url": part.image_url}})
            else:
                raise AdapterInvalidRequestError(f"Unsupported content part type: {type(part).__name__}")
        return content

    async def generate(self, request: GenerateRequest) -> GenerateResult:
        llm_kwargs = {"api_key": self._api_key, "model": request.model, "temperature": request.temperature}
        if request.max_tokens is not None:
            llm_kwargs["max_tokens"] = request.max_tokens
        llm = ChatOpenAI(**llm_kwargs)

        message = HumanMessage(content=self._to_message_content(request.content))

        try:
            response = await llm.ainvoke([message])
        except openai.AuthenticationError as e:
            raise AdapterAuthError(str(e)) from e
        except openai.RateLimitError as e:
            raise AdapterRateLimitError(str(e)) from e
        except openai.BadRequestError as e:
            raise AdapterInvalidRequestError(str(e)) from e
        except openai.OpenAIError as e:
            raise AdapterProviderError(str(e)) from e

        # langchain surfaces the raw provider finish_reason here; "length" is
        # OpenAI's "I stopped because max_tokens ran out". Read defensively —
        # response_metadata is provider-populated and not guaranteed present —
        # so a missing key degrades to "not truncated" rather than raising.
        finish_reason = (getattr(response, "response_metadata", None) or {}).get("finish_reason")
        return GenerateResult(text=response.content, truncated=finish_reason == "length")
