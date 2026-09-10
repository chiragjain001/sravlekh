"""V2 Analytics/Mastery Integration phase.

Deployment-wide defaults today (env-driven, via src/config.py), wrapped
behind an institute_id-shaped accessor on purpose: neither function reads
the parameter yet, but the signature is what a future per-institute lookup
(e.g. an Institute-level settings row) would need — call sites never have
to change, only these two function bodies would.
"""

from src.config import get_settings


def get_mastery_threshold(institute_id: str | None = None) -> float:
    del institute_id  # not yet used — see module docstring
    return get_settings().MASTERY_INTERVENTION_THRESHOLD


def get_max_weak_topics(institute_id: str | None = None) -> int:
    del institute_id  # not yet used — see module docstring
    return get_settings().MASTERY_MAX_WEAK_TOPICS


def get_heatmap_critical_threshold_pct(institute_id: str | None = None) -> float:
    """P1 D1: the batch heatmap's CRITICAL band cutoff, 0-100 scale. A genuinely
    different question from get_mastery_threshold() above — see config.py's
    MASTERY_HEATMAP_CRITICAL_PCT comment for why this is not derived from it."""
    del institute_id  # not yet used — see module docstring
    return get_settings().MASTERY_HEATMAP_CRITICAL_PCT


def get_heatmap_warning_threshold_pct(institute_id: str | None = None) -> float:
    """P1 D1: the batch heatmap's WARNING band cutoff, 0-100 scale."""
    del institute_id  # not yet used — see module docstring
    return get_settings().MASTERY_HEATMAP_WARNING_PCT
