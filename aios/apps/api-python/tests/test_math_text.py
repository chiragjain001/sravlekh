import pytest

from src.evaluation.math_text import to_display_text


@pytest.mark.parametrize(
    "raw,expected",
    [
        (r"\frac{a}{b}+x^2", "a/b+x²"),
        (r"\sqrt{2} \leq \pi", "√2 ≤ π"),
        (r"\int_0^1 x^{2} dx", "∫₀¹ x² dx"),
        (r"s = ut + \frac{1}{2}at^2", "s = ut + 1/2at²"),
        (r"H_{2}SO_{4}", "H₂SO₄"),
        (r"\text{hello} \times 3 \div 2 \neq 4", "hello × 3 ÷ 2 ≠ 4"),
        (r"Find $x$ if $x^2=4$", "Find x if x²=4"),
        (r"a^{-1} + e^{i\pi}", "a⁻¹ + e^(iπ)"),
        (r"\frac{\sqrt{3}}{2}", "(√3)/2"),
        (r"10^{-19} C", "10⁻¹⁹ C"),
        (r"\sqrt[3]{8}", "∛8"),
        (r"\alpha + \beta = \gamma", "α + β = γ"),
    ],
)
def test_common_latex_becomes_readable_unicode(raw, expected):
    assert to_display_text(raw) == expected


@pytest.mark.parametrize(
    "plain",
    [
        "plain 5% off, cost is $5 and $6",  # a % is not a comment, $5 is not math
        "user_name and snake_case words",  # a bare underscore outside $…$ is text
        "प्रकाश संश्लेषण क्या है? CO2 + H2O",
        "Explain Newton's second law.",
        "",
    ],
)
def test_plain_text_passes_through_unchanged(plain):
    assert to_display_text(plain) == plain


def test_unknown_commands_stay_visible_rather_than_vanishing():
    assert to_display_text(r"\weirdmacro{x} = 2") == r"\weirdmacrox = 2"


def test_unbalanced_braces_do_not_drop_text():
    assert "abc" in to_display_text(r"\frac{abc")


def test_none_is_empty():
    assert to_display_text(None) == ""
