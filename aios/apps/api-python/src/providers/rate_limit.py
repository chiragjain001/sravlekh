"""Paces provider calls so a burst does not trip the provider's own rate limit.

A booklet fans out fast: region detection on every page, then OCR on every
answer, then an evaluation per answer. Against a free-tier key that is far more
requests per minute than the quota allows, and the provider answers 429 for the
rest — which cost a real API call, a retry storm and, on staging, four
dead-lettered OCR jobs before anything was graded.

So requests wait their turn here instead. PROVIDER_MAX_RPM is the ceiling
(0 disables pacing); the limiter is per model, because quotas are.

This is a within-process limiter, deliberately: it protects the common case of
one API/worker pair. Several worker processes would each pace themselves, so
set the env value to the quota divided by the number of processes, or move to a
shared limiter when that is what a deployment actually needs.
"""

import asyncio
import time
from collections import defaultdict

_locks: dict[str, asyncio.Lock] = defaultdict(asyncio.Lock)
_next_free_at: dict[str, float] = defaultdict(float)


async def pace(key: str, max_rpm: int) -> None:
    """Waits until a call for `key` may be made at `max_rpm` requests per minute."""
    if max_rpm <= 0:
        return
    interval = 60.0 / max_rpm
    async with _locks[key]:
        now = time.monotonic()
        wait_for = _next_free_at[key] - now
        if wait_for > 0:
            await asyncio.sleep(wait_for)
            now = time.monotonic()
        _next_free_at[key] = now + interval


def reset() -> None:
    """Test helper — forgets all pacing state."""
    _next_free_at.clear()
