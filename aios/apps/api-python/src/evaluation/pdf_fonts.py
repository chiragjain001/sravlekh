"""Finds the fonts the checked-copy PDF embeds.

Nothing is vendored: fonts come from the host. The production image installs
them (infra/docker/python.Dockerfile: fonts-noto-core, fonts-dejavu-core), CI
does the same, and a Windows development machine already ships usable ones.
PDF_FONT_DIRS (os.pathsep-separated) adds or overrides search directories.

Three roles, each with fallbacks in order of preference:

  sans        Latin text — the body font.
  devanagari  Hindi/Marathi/Sanskrit. Without it, Devanagari renders as empty
              boxes, so its absence is reported, never silently ignored.
  math        Symbols the body font lacks (∫ ∑ ≤ √ ∞ Greek …).

fpdf2 falls back from `sans` to the others glyph by glyph, and shapes text
with HarfBuzz, so matras and conjuncts (क्ष, श्र, ि) are placed correctly.
"""

import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

_SYSTEM_DIRS = [
    "/usr/share/fonts",
    "/usr/local/share/fonts",
    os.path.expanduser("~/.fonts"),
    os.path.join(os.environ.get("WINDIR", r"C:\Windows"), "Fonts"),
    "/System/Library/Fonts",
    "/Library/Fonts",
]

_CANDIDATES = {
    "sans": ["NotoSans-Regular.ttf", "DejaVuSans.ttf", "arial.ttf", "Arial.ttf"],
    "sans_bold": ["NotoSans-Bold.ttf", "DejaVuSans-Bold.ttf", "arialbd.ttf", "Arial Bold.ttf"],
    "devanagari": ["NotoSansDevanagari-Regular.ttf", "NotoSansDevanagariUI-Regular.ttf", "Nirmala.ttc", "Nirmala.ttf", "mangal.ttf"],
    "devanagari_bold": ["NotoSansDevanagari-Bold.ttf", "NotoSansDevanagariUI-Bold.ttf", "NirmalaB.ttf", "mangalb.ttf"],
    "math": ["NotoSansMath-Regular.ttf", "DejaVuSans.ttf", "seguisym.ttf", "cambria.ttc", "STIXTwoMath-Regular.otf"],
}


@dataclass(frozen=True)
class FontSet:
    sans: str | None
    sans_bold: str | None
    devanagari: str | None
    devanagari_bold: str | None
    math: str | None

    @property
    def missing(self) -> list[str]:
        return [role for role in ("sans", "devanagari", "math") if getattr(self, role) is None]


def _search_dirs() -> list[Path]:
    extra = [d for d in os.environ.get("PDF_FONT_DIRS", "").split(os.pathsep) if d]
    return [Path(d) for d in [*extra, *_SYSTEM_DIRS] if Path(d).is_dir()]


@lru_cache
def _index() -> dict[str, str]:
    """lower-cased file name -> first path found. Built once per process."""
    found: dict[str, str] = {}
    for root in _search_dirs():
        for path in root.rglob("*"):
            if path.suffix.lower() in (".ttf", ".ttc", ".otf"):
                found.setdefault(path.name.lower(), str(path))
    return found


@lru_cache
def resolve_fonts() -> FontSet:
    index = _index()

    def first(role: str) -> str | None:
        return next((index[n.lower()] for n in _CANDIDATES[role] if n.lower() in index), None)

    return FontSet(
        sans=first("sans"),
        sans_bold=first("sans_bold"),
        devanagari=first("devanagari"),
        devanagari_bold=first("devanagari_bold"),
        math=first("math"),
    )
