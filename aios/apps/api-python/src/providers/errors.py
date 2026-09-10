"""P1 B1 Stage 1: normalized adapter errors.

Every adapter implementation must raise one of these (never a bare vendor SDK
exception) so calling code can react to a category (auth vs. rate-limit vs.
malformed-request vs. everything-else) without importing a vendor SDK's own
exception types — the same "no vendor SDK outside the adapter layer" discipline
27-AI-EVALUATION-ARCHITECTURE.md §8a applies to imports applies to exception
types too. Every raise site uses `raise AdapterXxxError(...) from original_exc`
so the real provider error is never lost — always available via `__cause__` for
logging/diagnostics, just categorized rather than swallowed.

Deliberately does NOT define a timeout category: timeout is owned above the
adapter (each call site wraps its own `adapter.generate(...)` call in whatever
timeout policy it needs, or none — see ai_evaluator.py's asyncio.wait_for, which
stays exactly where it is). A stdlib TimeoutError from that wrapper propagates
through normally; the adapter has no opinion about it.
"""


class AdapterError(Exception):
    """Base for every error an adapter raises."""


class AdapterAuthError(AdapterError):
    """The configured API key/credentials were rejected."""


class AdapterRateLimitError(AdapterError):
    """The provider rejected the request due to rate limiting."""


class AdapterInvalidRequestError(AdapterError):
    """The provider rejected the request as malformed (bad model name, invalid
    parameters, etc.) — not a transient failure, retrying unchanged won't help."""


class AdapterProviderError(AdapterError):
    """A provider-side failure that doesn't fit a more specific category above
    (e.g. an internal server error, a connection failure) — still not swallowed,
    still carries the original exception as __cause__."""
