import pytest

from src.config import Settings

# Found by staging verification: INTERNAL_SERVICE_TOKEN was unset in BOTH
# services, so verify_internal_token was a no-op and /evaluation/ai-evaluate and
# /ocr/extract would have served any caller that could reach the port. Those
# endpoints deliberately take no user JWT, so this credential is the only thing
# guarding them.
#
# This service is where the guard actually runs, so failing closed HERE is the
# half that matters most. apps/api/src/config/env.schema.spec.ts asserts the
# mirrored rule on the Node side; the two must not disagree about whether the
# credential is required, because a config that boots the caller but not the
# callee is how an unauthenticated service reaches production.

BASE = {"DATABASE_URL": "postgresql://u:p@localhost:5432/db", "JWT_SECRET": "x" * 32}
VALID_TOKEN = "i" * 32


def settings(**overrides) -> Settings:
    return Settings(**{**BASE, **overrides})


def test_production_refuses_to_start_without_the_token():
    with pytest.raises(RuntimeError, match="INTERNAL_SERVICE_TOKEN is required"):
        settings(NODE_ENV="production")


def test_production_refuses_an_empty_token():
    with pytest.raises(RuntimeError, match="INTERNAL_SERVICE_TOKEN is required"):
        settings(NODE_ENV="production", INTERNAL_SERVICE_TOKEN="")


def test_production_refuses_a_token_short_enough_to_guess():
    with pytest.raises(RuntimeError, match="at least 32 characters"):
        settings(NODE_ENV="production", INTERNAL_SERVICE_TOKEN="short")


def test_production_starts_once_a_long_enough_token_is_supplied():
    assert settings(NODE_ENV="production", INTERNAL_SERVICE_TOKEN=VALID_TOKEN).INTERNAL_SERVICE_TOKEN == VALID_TOKEN


def test_development_is_unaffected():
    """Local setups and the existing test suite keep working without a token —
    the guard is a production requirement, not a new dev prerequisite."""
    assert settings(NODE_ENV="development").INTERNAL_SERVICE_TOKEN == ""


def test_staging_is_unaffected_so_a_staging_stack_can_still_be_brought_up_stepwise():
    assert settings(NODE_ENV="staging").INTERNAL_SERVICE_TOKEN == ""


@pytest.mark.parametrize("secret", ["SHORT1", "leaky-token-value-do-not-print"])
def test_the_failure_message_never_contains_the_token_value(secret):
    """A failed boot lands in deploy logs, which are far more widely readable
    than the secret store the value came from.

    A SHORT secret is included deliberately: the first version of this guard
    raised ValueError, and pydantic wrapped it into a ValidationError echoing
    the whole input dict. A long secret happened to be truncated away and the
    test passed while the leak was real; a short one survives truncation and
    catches it."""
    with pytest.raises(RuntimeError) as exc:
        settings(NODE_ENV="production", INTERNAL_SERVICE_TOKEN=secret)

    assert secret not in str(exc.value)
