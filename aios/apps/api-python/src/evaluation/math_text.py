"""LaTeX-ish math to readable Unicode text, for the checked-copy PDF.

Question text, OCR transcripts (MATHEMATICAL_EXPRESSION blocks are transcribed
as LaTeX) and model solutions can contain \\frac{1}{2}, x^{2}, \\sqrt{2},
\\alpha … — printed raw, a teacher or parent reads backslashes. This rewrites the
common constructs into Unicode (½-style fractions stay a/b, x², √2, α) and
leaves everything else exactly as written.

Deliberately NOT a general LaTeX parser (pylatexenc was tried and rejected: it
treats every "%" as a comment and drops the rest of the line — "5% off" became
"5" — and it discards spacing and grouping). Anything this does not recognise
passes through unchanged, which is the safe failure: a stray backslash is
readable, silently deleted text is not.
"""

import re

_SUPERSCRIPT = str.maketrans("0123456789+-=()niabcdehklmoprstuvwxyz", "⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾ⁿⁱᵃᵇᶜᵈᵉʰᵏˡᵐᵒᵖʳˢᵗᵘᵛʷˣʸᶻ")
_SUPERSCRIPTABLE = set("0123456789+-=()niabcdehklmoprstuvwxyz")
_SUBSCRIPT = str.maketrans("0123456789+-=()aehijklmnoprstuvx", "₀₁₂₃₄₅₆₇₈₉₊₋₌₍₎ₐₑₕᵢⱼₖₗₘₙₒₚᵣₛₜᵤᵥₓ")
_SUBSCRIPTABLE = set("0123456789+-=()aehijklmnoprstuvx")

_SYMBOLS = {
    "alpha": "α", "beta": "β", "gamma": "γ", "delta": "δ", "epsilon": "ε", "varepsilon": "ε", "zeta": "ζ",
    "eta": "η", "theta": "θ", "lambda": "λ", "mu": "μ", "nu": "ν", "xi": "ξ", "pi": "π", "rho": "ρ",
    "sigma": "σ", "tau": "τ", "phi": "φ", "varphi": "φ", "chi": "χ", "psi": "ψ", "omega": "ω",
    "Gamma": "Γ", "Delta": "Δ", "Theta": "Θ", "Lambda": "Λ", "Pi": "Π", "Sigma": "Σ", "Phi": "Φ", "Omega": "Ω",
    "leq": "≤", "le": "≤", "geq": "≥", "ge": "≥", "neq": "≠", "ne": "≠", "approx": "≈", "equiv": "≡",
    "times": "×", "div": "÷", "pm": "±", "mp": "∓", "cdot": "·", "infty": "∞", "propto": "∝",
    "int": "∫", "iint": "∬", "oint": "∮", "sum": "∑", "prod": "∏", "partial": "∂", "nabla": "∇",
    "rightarrow": "→", "to": "→", "leftarrow": "←", "Rightarrow": "⇒", "Leftrightarrow": "⇔", "leftrightarrow": "↔",
    "rightleftharpoons": "⇌", "uparrow": "↑", "downarrow": "↓",
    "degree": "°", "circ": "°", "angle": "∠", "perp": "⊥", "parallel": "∥", "triangle": "△",
    "therefore": "∴", "because": "∵", "in": "∈", "notin": "∉", "subset": "⊂", "cup": "∪", "cap": "∩",
    "forall": "∀", "exists": "∃", "emptyset": "∅", "hbar": "ℏ", "ldots": "…", "cdots": "⋯", "quad": " ", "qquad": "  ",
    "sin": "sin", "cos": "cos", "tan": "tan", "log": "log", "ln": "ln", "lim": "lim", "%": "%", "$": "$",
    ",": " ", ";": " ", "!": "", " ": " ",
}
_WRAPPERS = {"text", "mathrm", "mathbf", "mathit", "operatorname", "textbf", "textit", "mathsf", "boldsymbol", "left", "right"}


def _group(s: str, i: int) -> tuple[str, int]:
    """The argument starting at s[i]: a {braced} group or a single character. Returns (content, index after)."""
    while i < len(s) and s[i] == " ":
        i += 1
    if i >= len(s):
        return "", i
    if s[i] != "{":
        if s[i] == "\\":
            m = re.match(r"\\([A-Za-z]+|.)", s[i:])
            if m:
                return m.group(0), i + len(m.group(0))
        return s[i], i + 1
    depth, j = 0, i
    while j < len(s):
        if s[j] == "{":
            depth += 1
        elif s[j] == "}":
            depth -= 1
            if depth == 0:
                return s[i + 1 : j], j + 1
        j += 1
    return s[i + 1 :], len(s)  # unbalanced: take the rest rather than lose it


def _atom(text: str) -> str:
    """Parenthesise a multi-token expression so a/b and √ stay unambiguous."""
    return text if re.fullmatch(r"[\w.′]+", text) else f"({text})"


def _script(content: str, table: dict, allowed: set, marker: str) -> str:
    if content and all(ch in allowed for ch in content if ch != " "):
        return content.replace(" ", "").translate(table)
    # Not every character has a Unicode super/subscript form: keep the marker and
    # group anything longer than one character so e^(iπ) stays unambiguous.
    return f"{marker}{content if len(content) == 1 else f'({content})'}"


def _convert(s: str) -> str:
    out: list[str] = []
    i = 0
    while i < len(s):
        ch = s[i]
        if ch == "\\":
            m = re.match(r"\\([A-Za-z]+|.)", s[i:])
            if not m:
                out.append(ch)
                i += 1
                continue
            name = m.group(1)
            i += len(m.group(0))
            if name == "frac" or name == "dfrac" or name == "tfrac":
                num, i = _group(s, i)
                den, i = _group(s, i)
                out.append(f"{_atom(_convert(num))}/{_atom(_convert(den))}")
            elif name == "sqrt":
                root = ""
                if i < len(s) and s[i] == "[":
                    end = s.find("]", i)
                    if end != -1:
                        root, i = s[i + 1 : end], end + 1
                arg, i = _group(s, i)
                prefix = {"3": "∛", "4": "∜"}.get(root.strip(), (_script(root, _SUPERSCRIPT, _SUPERSCRIPTABLE, "^") if root else "") + "√")
                out.append(prefix + _atom(_convert(arg)))
            elif name == "vec":
                arg, i = _group(s, i)
                out.append(_convert(arg) + "\u20d7")
            elif name == "hat":
                arg, i = _group(s, i)
                out.append(_convert(arg) + "\u0302")
            elif name == "bar" or name == "overline":
                arg, i = _group(s, i)
                out.append(_convert(arg) + "\u0305")
            elif name in _WRAPPERS:
                if name in ("left", "right"):
                    continue  # \left( … \right) — the delimiter itself follows
                arg, i = _group(s, i)
                out.append(_convert(arg))
            elif name in _SYMBOLS:
                out.append(_SYMBOLS[name])
            else:
                out.append(m.group(0))  # unknown command: keep it visible
        elif ch in "^_":
            arg, i = _group(s, i + 1)
            converted = _convert(arg)
            if ch == "^":
                out.append(_script(converted, _SUPERSCRIPT, _SUPERSCRIPTABLE, "^"))
            else:
                out.append(_script(converted, _SUBSCRIPT, _SUBSCRIPTABLE, "_"))
        elif ch in "{}":
            i += 1  # bare grouping braces carry no meaning once scripts are resolved
        else:
            out.append(ch)
            i += 1
    return "".join(out)


_MATH_SEGMENT = re.compile(r"\$\$(.+?)\$\$|\$(.+?)\$|\\\((.+?)\\\)|\\\[(.+?)\\\]", re.DOTALL)
# Inside $…$: any script or command. Outside delimiters: only unmistakable
# LaTeX — a command, a braced script, or a caret. A bare underscore is not
# enough there: "user_name" is ordinary text.
_LOOKS_LIKE_MATH = re.compile(r"\\[A-Za-z]+|[\^_]\{|[A-Za-z0-9)][\^_][A-Za-z0-9(]")
_UNDELIMITED_MATH = re.compile(r"\\[A-Za-z]+|[\^_]\{|\^")
_SHORT_SYMBOL = re.compile(r"[A-Za-z][A-Za-z0-9]{0,2}")


def to_display_text(text: str | None) -> str:
    """Readable Unicode for a string that may contain LaTeX math. Plain text is returned unchanged."""
    if not text:
        return ""

    def seg(m: re.Match) -> str:
        inner = next(g for g in m.groups() if g is not None)
        # "$5 and $6" is currency, not math: only unwrap when the inside looks like math.
        if _LOOKS_LIKE_MATH.search(inner) or "=" in inner or _SHORT_SYMBOL.fullmatch(inner.strip()):
            return _convert(inner)
        return m.group(0)

    text = _MATH_SEGMENT.sub(seg, text)
    # Undelimited LaTeX (common in question banks): convert only if it clearly is LaTeX.
    if _UNDELIMITED_MATH.search(text):
        text = _convert(text)
    return text
