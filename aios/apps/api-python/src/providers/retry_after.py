"""How long to wait after a provider says "too many requests".

Providers put the answer in the error body — Gemini as `'retryDelay': '37s'`.
Using it beats guessing: the caller's queue waits exactly long enough instead of
retrying in a second, failing again and dead-lettering work that would have
succeeded.
"""

import re

DEFAULT_RETRY_AFTER_SECONDS = 30
MAX_RETRY_AFTER_SECONDS = 300

_RETRY_DELAY = re.compile(r"retryDelay['\"]?\s*[:=]\s*['\"]?(\d+(?:\.\d+)?)s", re.IGNORECASE)


def retry_after_seconds(message: str, default: int = DEFAULT_RETRY_AFTER_SECONDS) -> int:
    match = _RETRY_DELAY.search(message or "")
    if not match:
        return default
    seconds = int(float(match.group(1)) + 0.999)  # round up: waiting a moment longer is free
    return max(1, min(seconds, MAX_RETRY_AFTER_SECONDS))
