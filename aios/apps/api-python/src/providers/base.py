"""P1 B1 Stage 1: the adapter contract every provider implementation must satisfy.

One method, because one operation is all any of the three real call sites need
today: send some content to a specific model, get text back. Deliberately does
NOT include prompt construction, response parsing, retry, or timeout — see the
module docstrings in providers/types.py and providers/errors.py, and the B1
Stage 1 report, for exactly which concerns stay above the adapter and why.
"""

from abc import ABC, abstractmethod

from src.providers.types import GenerateRequest, GenerateResult


class ModelProviderAdapter(ABC):
    @abstractmethod
    async def generate(self, request: GenerateRequest) -> GenerateResult:
        """Send `request` to the vendor model and return its raw text output.

        Must raise one of providers.errors.AdapterError's subclasses on any
        provider-side failure — never let a vendor SDK exception escape
        un-normalized, and never swallow one silently either (always `raise ...
        from original_exc`).
        """
        raise NotImplementedError
