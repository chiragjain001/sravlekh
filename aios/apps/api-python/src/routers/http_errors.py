"""Turning provider failures into HTTP answers the caller can act on.

A rate limit is the one provider failure that is not a failure: the work is
fine, the provider is asking for a pause. Answering 500 makes the caller's queue
spend its retries in seconds and dead-letter a job that would have succeeded —
which is exactly what happened on staging before this existed. 429 plus
Retry-After lets the caller wait the right amount of time instead.
"""

from fastapi import HTTPException

from src.providers.errors import AdapterRateLimitError
from src.providers.retry_after import retry_after_seconds


def rate_limited(error: AdapterRateLimitError) -> HTTPException:
    """429 carrying the provider's own retry delay. Never echoes the provider message."""
    return HTTPException(
        status_code=429,
        detail="The AI provider is rate-limiting requests.",
        headers={"Retry-After": str(retry_after_seconds(str(error)))},
    )
