"""24-OCR-HANDWRITING-ARCHITECTURE.md §4: extraction strategy by block type.

Uses the same real, already-proven LLM pattern as src/ai/blueprint_agent.py
(ChatOpenAI, gated on OPENAI_API_KEY) rather than inventing a separate
integration — gpt-4o is multimodal and can read an image directly. This is
NOT a calibrated OCR/HWR confidence score in the traditional sense; it is
the model's own self-reported confidence, which is a real but imperfect
signal — documented here rather than presented as more rigorous than it is.

DIAGRAM_SKETCH/TABLE never reach the LLM at all: §3.3 says no text
extraction is attempted for those block types, so calling a vision model
for them would be spending a real API call on work the architecture
explicitly says not to do.
"""

from langchain_core.messages import HumanMessage
from langchain_core.output_parsers import PydanticOutputParser
from langchain_openai import ChatOpenAI
from pydantic import BaseModel, Field

from src.config import get_settings

NO_EXTRACTION_BLOCK_TYPES = {"DIAGRAM_SKETCH", "TABLE"}

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


async def extract_text(image_url: str, block_type: str) -> OCRExtractionResult | NoExtractionResult:
    if block_type in NO_EXTRACTION_BLOCK_TYPES:
        return NoExtractionResult()

    prompt_text = PROMPT_BY_BLOCK_TYPE.get(block_type)
    if prompt_text is None:
        raise ValueError(f"Unknown OCR block type: {block_type}")

    settings = get_settings()
    if not settings.OPENAI_API_KEY:
        raise ValueError("OPENAI_API_KEY is not configured in the environment.")

    llm = ChatOpenAI(api_key=settings.OPENAI_API_KEY, model="gpt-4o", temperature=0.0)
    parser = PydanticOutputParser(pydantic_object=OCRExtractionResult)

    message = HumanMessage(
        content=[
            {"type": "text", "text": f"{prompt_text}\n\n{parser.get_format_instructions()}"},
            {"type": "image_url", "image_url": {"url": image_url}},
        ]
    )

    response = await llm.ainvoke([message])
    return parser.parse(response.content)
