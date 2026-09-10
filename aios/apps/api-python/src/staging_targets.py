"""Target-safety logic for the disposable staging stack.

Mirrors infra/staging/staging-targets.js and
apps/api/src/config/staging-targets.ts. Three implementations exist because
three runtimes need the rule and none of them can import the others'; the Node
pair is held together by a conformance test, and tests/test_config_staging_targets.py
pins this one to the same table of cases.

Two independent guards, deliberately redundant:

  ALLOWLIST      the target must be nominated. No default: unset means nothing
                 was nominated, so nothing is permitted.
  SHARED MARKERS the target must not look like a hosted instance, even if
                 somebody nominated it.

A blocklist alone would fail open here: the shared database is a Supabase
pooler whose hostname contains neither "prod" nor "production", so a name-based
blocklist would wave it straight through.

CREDENTIAL SAFETY: every value returned, and every value interpolated into a
reason, is host:port. A connection URL is never echoed — a refused boot prints
these messages into deploy logs, which are far more widely readable than the
secret store the password came from.
"""

from dataclasses import dataclass
from urllib.parse import urlsplit

SHARED_DB_MARKERS: tuple[str, ...] = ("supabase", "pooler", "rds.amazonaws", "neon.tech")

DEFAULT_POSTGRES_PORT = 5432
DEFAULT_REDIS_PORT = 6379


@dataclass(frozen=True)
class TargetCheck:
    ok: bool
    target: str | None
    reason: str


def host_port(url: str, default_port: int) -> str | None:
    """`host:port` from a connection URL, lowercased. Credentials are discarded."""
    try:
        parts = urlsplit(url)
        if not parts.hostname:
            return None
        return f"{parts.hostname.lower()}:{parts.port or default_port}"
    except ValueError:
        # urlsplit raises on a malformed port, e.g. "host:not-a-number".
        return None


def parse_allowlist(raw: str | None) -> set[str]:
    """Comma-separated `host:port` entries -> set. Blanks are dropped, not defaulted."""
    return {entry.strip().lower() for entry in (raw or "").split(",") if entry.strip()}


def check_target(
    name: str,
    url: str | None,
    allowlist_raw: str | None,
    allowlist_var: str,
    default_port: int,
) -> TargetCheck:
    if not url:
        return TargetCheck(
            False,
            None,
            f"{name} is not set. A staging process must be told its target explicitly — "
            "falling back to a default is how a staging run reaches the shared instance.",
        )

    target = host_port(url, default_port)
    if target is None:
        # Deliberately does not echo the value: a malformed URL is still a URL
        # that may carry a password.
        return TargetCheck(False, None, f"{name} is not a URL this guard can parse a host:port out of.")

    marker = next((m for m in SHARED_DB_MARKERS if m in target), None)
    if marker is not None:
        return TargetCheck(
            False,
            target,
            f'{name} points at {target}, which contains "{marker}" — that is a '
            "shared/hosted instance, not disposable staging.",
        )

    allowed = parse_allowlist(allowlist_raw)
    if not allowed:
        return TargetCheck(
            False,
            target,
            f"{allowlist_var} is empty — no host has been nominated as safe, so nothing is permitted.",
        )

    if target not in allowed:
        return TargetCheck(
            False,
            target,
            f"{name} points at {target}, which is not in {allowlist_var} ({', '.join(sorted(allowed))}).",
        )

    return TargetCheck(True, target, "")


def check_postgres_target(
    name: str, url: str | None, allowlist_raw: str | None, allowlist_var: str = "STAGING_DB_ALLOWLIST"
) -> TargetCheck:
    return check_target(name, url, allowlist_raw, allowlist_var, DEFAULT_POSTGRES_PORT)


def check_redis_target(
    name: str, url: str | None, allowlist_raw: str | None, allowlist_var: str = "STAGING_REDIS_ALLOWLIST"
) -> TargetCheck:
    return check_target(name, url, allowlist_raw, allowlist_var, DEFAULT_REDIS_PORT)
