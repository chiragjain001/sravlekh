"""Suggests where each answer sits on a scanned page.

Marking every answer region by hand is the slowest step in the whole flow — for
a 30-student, 8-question set it is 240 boxes dragged with a mouse. This asks the
vision model to propose them, with a confidence per box.

Suggestions only. Nothing here decides marks, and a low-confidence box is
returned as an UNMAPPED suggestion (no question attached) so a teacher has to
say which question it belongs to. The teacher can always move, resize, delete or
add boxes; that is the contract the rest of the pipeline relies on
(23-DOCUMENT-PROCESSING-ARCHITECTURE.md §5's human checkpoints).
"""

import logging

from langchain_core.exceptions import OutputParserException
from langchain_core.output_parsers import PydanticOutputParser
from pydantic import BaseModel, Field

from src.config import get_settings
from src.providers.types import GenerateRequest, ImagePart, TextPart

logger = logging.getLogger(__name__)

DETECTION_TEMPERATURE = 0.0
DETECTION_MAX_TOKENS = 2048
# Below this the box is still offered, but unmapped: the teacher picks the
# question. Chosen conservatively — a wrong mapping is worse than no mapping,
# because OCR would then read one answer as another question's.
MAP_CONFIDENCE_THRESHOLD = 0.7
MIN_BOX_SIDE = 0.02

PROMPT = (
    "This image is one page of a student's handwritten exam answer booklet.\n"
    "Find the region of the page containing the student's answer to each question.\n"
    "{question_block}\n"
    "Rules:\n"
    "- Return one region per answer you can see on THIS page, in reading order.\n"
    "- The region must cover the whole written answer, including working, diagrams and continuation lines, "
    "but not the next answer.\n"
    "- questionNumber: the number written by the student (or the question list above) if you can tell which "
    "question it is; use null when you cannot.\n"
    "- box: fractions of the page, 0-1, where x,y is the top-left corner. x + width and y + height must not exceed 1.\n"
    "- confidence: how sure you are that this box holds that question's complete answer.\n"
    "- If the page is blank, a cover page or unreadable, return an empty list.\n\n"
    "{format_instructions}"
)


class DetectedBox(BaseModel):
    x: float = Field(ge=0, le=1)
    y: float = Field(ge=0, le=1)
    width: float = Field(gt=0, le=1)
    height: float = Field(gt=0, le=1)


class DetectedRegion(BaseModel):
    questionNumber: int | None = Field(default=None, description="The question this answer belongs to, or null if unclear")
    box: DetectedBox
    confidence: float = Field(ge=0.0, le=1.0)


class DetectedRegions(BaseModel):
    regions: list[DetectedRegion] = Field(default_factory=list)


class QuestionHint(BaseModel):
    questionNumber: int
    text: str = ""
    marks: float | None = None


class RegionDetectRequest(BaseModel):
    imageUrl: str
    questions: list[QuestionHint] = Field(default_factory=list)


class RegionSuggestion(BaseModel):
    questionNumber: int | None
    boundingBox: DetectedBox
    confidence: float
    mapped: bool


def _clamp(region: DetectedRegion) -> DetectedRegion | None:
    """Keeps a box inside the page and drops slivers the teacher would only have to delete."""
    box = region.box
    x = min(max(box.x, 0.0), 1.0)
    y = min(max(box.y, 0.0), 1.0)
    width = min(box.width, 1.0 - x)
    height = min(box.height, 1.0 - y)
    if width < MIN_BOX_SIDE or height < MIN_BOX_SIDE:
        return None
    return DetectedRegion(
        questionNumber=region.questionNumber,
        box=DetectedBox(x=round(x, 4), y=round(y, 4), width=round(width, 4), height=round(height, 4)),
        confidence=region.confidence,
    )


async def detect_regions(request: RegionDetectRequest) -> list[RegionSuggestion]:
    from src.providers.factory import (  # local: keeps import cost off startup
        active_provider,
        adapter_for,
    )

    settings = get_settings()
    provider = active_provider(settings)
    adapter = adapter_for(settings, provider)
    parser = PydanticOutputParser(pydantic_object=DetectedRegions)

    if request.questions:
        lines = "\n".join(
            f"- Q{q.questionNumber}" + (f" ({q.marks:g} marks)" if q.marks is not None else "") + (f": {q.text[:120]}" if q.text else "")
            for q in request.questions
        )
        question_block = "The paper's questions are:\n" + lines + "\n"
    else:
        question_block = "The question list is not available; use the numbers the student wrote.\n"

    prompt = PROMPT.format(question_block=question_block, format_instructions=parser.get_format_instructions())
    generated = await adapter.generate(
        GenerateRequest(
            content=[TextPart(prompt), ImagePart(request.imageUrl)],
            model=provider.model_name,
            temperature=DETECTION_TEMPERATURE,
            max_tokens=DETECTION_MAX_TOKENS,
        )
    )

    try:
        detected = parser.parse(generated.text)
    except OutputParserException:
        # Unusable output is "no suggestions", never an error the teacher has to
        # decode — they can still mark regions by hand, which is the fallback.
        logger.warning("Region detection returned unparseable output; falling back to manual marking")
        return []

    known_numbers = {q.questionNumber for q in request.questions}
    suggestions: list[RegionSuggestion] = []
    for region in detected.regions:
        clamped = _clamp(region)
        if clamped is None:
            continue
        number = clamped.questionNumber
        # A number the paper doesn't have is a misread, not a mapping.
        if number is not None and known_numbers and number not in known_numbers:
            number = None
        mapped = number is not None and clamped.confidence >= MAP_CONFIDENCE_THRESHOLD
        suggestions.append(
            RegionSuggestion(
                questionNumber=number,
                boundingBox=clamped.box,
                confidence=clamped.confidence,
                mapped=mapped,
            )
        )
    return suggestions
