import json
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

from src.config import Settings
from src.documents.region_detect import (
    MAP_CONFIDENCE_THRESHOLD,
    RegionDetectRequest,
    detect_regions,
)
from src.providers.types import GenerateResult

SETTINGS = Settings(DATABASE_URL="postgresql://x", JWT_SECRET="x" * 32, OPENAI_API_KEY="sk-test")


def mock_adapter(payload):
    text = payload if isinstance(payload, str) else json.dumps(payload)
    return MagicMock(return_value=SimpleNamespace(generate=AsyncMock(return_value=GenerateResult(text=text))))


def run(payload, questions=(1, 2)):
    adapter_class = mock_adapter(payload)
    request = RegionDetectRequest(
        imageUrl="https://signed/page1.jpg",
        questions=[{"questionNumber": n, "text": f"Question {n}", "marks": 5} for n in questions],
    )
    with patch("src.providers.factory.OpenAIAdapter", adapter_class), \
         patch("src.documents.region_detect.get_settings", return_value=SETTINGS):
        import asyncio

        result = asyncio.run(detect_regions(request))
    return result, adapter_class


def test_confident_boxes_come_back_mapped_to_their_question():
    result, adapter_class = run({"regions": [
        {"questionNumber": 1, "box": {"x": 0.08, "y": 0.1, "width": 0.84, "height": 0.25}, "confidence": 0.93},
        {"questionNumber": 2, "box": {"x": 0.08, "y": 0.4, "width": 0.84, "height": 0.3}, "confidence": 0.88},
    ]})

    assert [r.questionNumber for r in result] == [1, 2]
    assert all(r.mapped for r in result)
    # The page image goes to the model, with the question list in the prompt.
    sent = adapter_class.return_value.generate.await_args.args[0]
    assert sent.content[1].image_url == "https://signed/page1.jpg"
    assert "Q1" in sent.content[0].text


def test_a_low_confidence_box_is_offered_unmapped_so_a_teacher_decides():
    result, _ = run({"regions": [
        {"questionNumber": 1, "box": {"x": 0.1, "y": 0.1, "width": 0.8, "height": 0.2}, "confidence": MAP_CONFIDENCE_THRESHOLD - 0.2},
    ]})
    assert len(result) == 1
    assert result[0].mapped is False
    assert result[0].boundingBox.width == 0.8  # the box is still useful


def test_a_question_number_the_paper_does_not_have_is_not_mapped():
    result, _ = run({"regions": [
        {"questionNumber": 9, "box": {"x": 0.1, "y": 0.1, "width": 0.8, "height": 0.2}, "confidence": 0.99},
    ]})
    assert result[0].questionNumber is None and result[0].mapped is False


def test_boxes_are_clamped_to_the_page_and_slivers_are_dropped():
    result, _ = run({"regions": [
        {"questionNumber": 1, "box": {"x": 0.9, "y": 0.9, "width": 0.5, "height": 0.5}, "confidence": 0.9},
        {"questionNumber": 2, "box": {"x": 0.1, "y": 0.1, "width": 0.005, "height": 0.4}, "confidence": 0.9},
    ]})
    assert len(result) == 1
    box = result[0].boundingBox
    assert box.x + box.width <= 1.0 and box.y + box.height <= 1.0


def test_a_blank_page_yields_no_suggestions():
    result, _ = run({"regions": []})
    assert result == []


def test_unusable_model_output_falls_back_to_manual_marking_rather_than_failing():
    result, _ = run("I could not find any answers on this page.")
    assert result == []
