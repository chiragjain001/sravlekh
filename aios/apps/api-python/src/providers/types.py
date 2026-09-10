"""P1 B1 Stage 1: the adapter's request/response shapes.

Deliberately minimal — represents exactly the two content-part kinds the three
real call sites (evaluation, OCR, Blueprint) actually use today (plain text, and
OCR's text+image), not a speculative "any modality" surface. No video, no audio,
no multi-image: none of that exists in this codebase, and inventing placeholders
for it would be exactly the "universal interface for its own sake" this stage is
required to avoid.

model/temperature/max_tokens are explicit typed fields, not a loose kwargs dict,
because those are the only parameters any current call site configures — see
each adapter method's docstring for how they map onto the underlying SDK call.
"""

from dataclasses import dataclass
from typing import Literal


@dataclass(frozen=True)
class TextPart:
    text: str
    type: Literal["text"] = "text"


@dataclass(frozen=True)
class ImagePart:
    image_url: str
    type: Literal["image"] = "image"


ContentPart = TextPart | ImagePart


@dataclass(frozen=True)
class GenerateRequest:
    content: list[ContentPart]
    # The registry-resolved model identifier (e.g. AIModelVersion.versionLabel).
    # The adapter never chooses or resolves this itself — registry resolution
    # stays entirely above the adapter, in each call site, exactly as it is
    # today (B2/B5's "the registry decides which model runs" discipline).
    model: str
    temperature: float
    max_tokens: int | None = None


@dataclass(frozen=True)
class GenerateResult:
    text: str
    # True when the provider stopped because it hit max_tokens rather than because
    # the model finished. Normalized to a provider-neutral boolean here — the same
    # discipline errors.py applies to provider exceptions — so call sites never
    # branch on a vendor's finish_reason spelling ("length" vs MAX_TOKENS).
    #
    # This is not a speculative field. Without it a truncated completion is
    # INDISTINGUISHABLE FROM A COMPLETE ONE at the call site: langchain's
    # PydanticOutputParser repairs cut-off JSON rather than rejecting it, so
    # `{"suggestedMarks": 3, "confidence": 0.9, "not` parses cleanly into a
    # well-formed result whose optional fields (note, suggestedCriterionScores)
    # are simply absent — a partial grade presented as a whole one.
    #
    # Defaults to False so a provider that cannot report it degrades to today's
    # behaviour rather than blocking every call.
    truncated: bool = False
