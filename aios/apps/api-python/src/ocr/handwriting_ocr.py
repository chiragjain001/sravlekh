"""24-OCR-HANDWRITING-ARCHITECTURE.md §4: extraction strategy by block type.

The vendor model is multimodal — it reads the page image directly alongside the
instruction text. This is NOT a calibrated OCR/HWR confidence score in the
traditional sense; it is the model's own self-reported confidence, which is a
real but imperfect signal — documented here rather than presented as more
rigorous than it is.

DIAGRAM_SKETCH/TABLE never reach the LLM at all: §3.3 says no text
extraction is attempted for those block types, so calling a vision model
for them would be spending a real API call on work the architecture
explicitly says not to do.

P1 B1 Stage 3: the vendor SDK is reached only through
providers/openai_adapter.py (27 §8a) — this module no longer imports
langchain_openai/openai. The model is now a required parameter supplied by the
caller from the OCR registry, replacing the hardcoded "gpt-4o" literal that
previously made that registry decorative for OCR.
"""

from langchain_core.output_parsers import PydanticOutputParser
from pydantic import BaseModel, Field

from src.config import get_settings
from src.providers.factory import select_adapter
from src.providers.types import GenerateRequest, ImagePart, TextPart

NO_EXTRACTION_BLOCK_TYPES = {"DIAGRAM_SKETCH", "TABLE"}

# Unchanged from the pre-adapter call — transcription is a deterministic task,
# not a creative one. Named rather than inlined so the request-shape test can
# assert it by reference.
OCR_TEMPERATURE = 0.0

PROMPT_BY_BLOCK_TYPE = {
    "PRINTED_TEXT": (
        "This image is a printed/typed text region from a scanned exam document. "
        "Transcribe the text exactly as written, preserving line breaks."
    ),
    "HANDWRITTEN_TEXT": (
        "This image is a handwritten answer region from a student's exam booklet. "
        "Transcribe the handwriting as accurately as you can. If a word or phrase is "
        "genuinely illegible, mark it with [illegible] rather than guessing confidently."
    ),
    "MATHEMATICAL_EXPRESSION": (
        "This image contains a mathematical expression or equation, possibly handwritten. "
        "Transcribe it using LaTeX notation (e.g. \\frac{a}{b}, x^2, \\int)."
    ),
}


class OCRExtractionResult(BaseModel):
    extractedText: str | None = Field(description="The transcribed text, or null if nothing readable was found")
    confidence: float = Field(description="Self-assessed confidence 0.0-1.0 that the transcription is accurate", ge=0.0, le=1.0)
    alternativeReadings: list[str] | None = Field(
        default=None, description="Up to 3 alternative transcriptions, only when confidence is below 0.85"
    )


class NoExtractionResult(BaseModel):
    """DIAGRAM_SKETCH/TABLE — 24 §3.3: routed straight to human/visual evaluation, no text extraction attempted."""

    requires_visual_evaluation: bool = True


async def extract_text(image_url: str, block_type: str, model: str) -> OCRExtractionResult | NoExtractionResult:
    """`model` is the registry-resolved AIModelVersion.versionLabel, supplied by
    the caller (routers/ocr.py). Required, not defaulted: a default would
    reintroduce exactly the hardcoded fallback P1 B1 Stage 3 removes."""
    if block_type in NO_EXTRACTION_BLOCK_TYPES:
        return NoExtractionResult()

    prompt_text = PROMPT_BY_BLOCK_TYPE.get(block_type)
    if prompt_text is None:
        raise ValueError(f"Unknown OCR block type: {block_type}")

    settings = get_settings()
    adapter, model = select_adapter(settings, model)

    parser = PydanticOutputParser(pydantic_object=OCRExtractionResult)

    # Multimodal: instruction text first, then the page image — the same ordering
    # and the same combined "prompt + format instructions" text as before, now
    # expressed in the adapter's content-part vocabulary rather than a raw
    # langchain HumanMessage. temperature 0.0 unchanged; max_tokens deliberately
    # not set, matching the previous call exactly (it never passed one).
    request = GenerateRequest(
        content=[
            TextPart(f"{prompt_text}\n\n{parser.get_format_instructions()}"),
            ImagePart(image_url),
        ],
        model=model,
        temperature=OCR_TEMPERATURE,
    )

    generated = await adapter.generate(request)
    return parser.parse(generated.text)
