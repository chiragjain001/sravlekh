"""C2 authorization regression for the Blueprint endpoint.

P1 B1 Stage 4 changed how Blueprint reaches the provider, and changed nothing
about who may call it. These tests pin that: the role gate is exercised through
the real FastAPI app with real JWTs and the real `require_role` dependency —
only the agent itself (and therefore the provider) is stubbed.
"""

import warnings
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient
from jose import jwt

from src.ai.blueprint_agent import BlueprintGenerationResult, DistributionRuleModel
from src.ai.blueprint_model_registry import NoActiveBlueprintModelError
from src.config import get_settings
from src.main import app
from src.providers.errors import AdapterAuthError, AdapterRateLimitError

BLUEPRINT = BlueprintGenerationResult(
    title="Physics Test",
    duration=60,
    rules=[DistributionRuleModel(topicName="Kinematics", questionType="MCQ", difficulty="MEDIUM", count=5)],
)


def token_for(role: str) -> str:
    return jwt.encode({"sub": "user-1", "role": role}, get_settings().JWT_SECRET, algorithm="HS256")


def call_as(role: str, generate=None):
    """Real route, real guards. `db.user.find_unique` is stubbed because
    get_current_user verifies the subject exists — the role under test comes
    from that row, exactly as in production."""
    user = SimpleNamespace(id="user-1", role=role, instituteId="inst-1")
    fake_db = SimpleNamespace(user=SimpleNamespace(find_unique=AsyncMock(return_value=user)))
    agent = generate if generate is not None else AsyncMock(return_value=BLUEPRINT)

    with patch("src.auth.db", fake_db), \
         patch("src.routers.ai.generate_blueprint_from_prompt", agent):
        client = TestClient(app)
        response = client.post(
            "/ai/generate-blueprint",
            json={"prompt": "A medium physics test"},
            headers={"Authorization": f"Bearer {token_for(role)}"},
        )
    return response, agent


@pytest.mark.parametrize("role", ["TEACHER", "ADMIN", "FOUNDER"])
def test_authorized_roles_can_generate_a_blueprint(role):
    response, agent = call_as(role)
    assert response.status_code == 200
    assert response.json()["data"]["title"] == "Physics Test"
    agent.assert_awaited_once()


def test_the_response_body_shape_is_unchanged_by_the_model_dump_migration():
    """Post-B1 hardening: routers/ai.py moved from the Pydantic-v1 .dict() to
    model_dump(). Both produce identical output for this model (no aliases, no
    custom serializers); this pins the full serialized body so the swap cannot
    quietly alter the HTTP contract the web client consumes."""
    response, _ = call_as("TEACHER")
    assert response.json() == {
        "success": True,
        "data": {
            "title": "Physics Test",
            "duration": 60,
            "rules": [
                {"topicName": "Kinematics", "questionType": "MCQ", "difficulty": "MEDIUM", "count": 5}
            ],
        },
    }


def test_no_pydantic_deprecation_warning_is_emitted_by_the_route():
    """The deprecation this fix removes: .dict() warned on every blueprint
    request and is removed entirely in Pydantic v3."""
    with warnings.catch_warnings(record=True) as caught:
        warnings.simplefilter("always")
        response, _ = call_as("TEACHER")

    assert response.status_code == 200
    pydantic_deprecations = [w for w in caught if "PydanticDeprecated" in type(w.message).__name__]
    assert not pydantic_deprecations, [str(w.message) for w in pydantic_deprecations]


@pytest.mark.parametrize("role", ["STUDENT", "PARENT"])
def test_unauthorized_roles_are_rejected_and_never_reach_the_agent(role):
    """The gate must stop the request before any model is resolved or any
    provider call is made — not merely hide the response."""
    response, agent = call_as(role)
    assert response.status_code == 403
    agent.assert_not_awaited()


def test_an_unauthenticated_request_is_rejected():
    client = TestClient(app)
    response = client.post("/ai/generate-blueprint", json={"prompt": "A test"})
    assert response.status_code in (401, 403)


def test_a_deconfigured_blueprint_registry_surfaces_as_an_actionable_503():
    """A deconfigured registry is the one failure whose text the caller SHOULD see:
    we author the message, it names no provider internals, and it says what an
    administrator has to do. 503 (not 500) matches the OCR router's identical case —
    a well-formed request the service is configured not to serve.

    Previously this was a 500 carrying str(e) from a bare ValueError, which worked
    only because the router echoed *every* exception's text — see the sibling tests
    below for what that leaked."""
    deconfigured = AsyncMock(
        side_effect=NoActiveBlueprintModelError("No active Blueprint AI model is configured. Ask an administrator to activate one before generating blueprints.")
    )
    response, _ = call_as("TEACHER", generate=deconfigured)
    assert response.status_code == 503
    assert "No active Blueprint AI model is configured" in response.json()["detail"]


def test_provider_auth_failure_never_echoes_the_vendor_message_to_the_caller():
    """Regression: the router used to return `detail=str(e)` for ANY exception.
    An openai.AuthenticationError's message names the model, the organisation id, a
    request id and a partially-redacted API key — handed to any authenticated
    teacher who clicked "generate" while the key was misconfigured."""
    leaky = AsyncMock(
        side_effect=AdapterAuthError(
            "Error code: 401 — Incorrect API key provided: sk-proj-AbC1********xyz. "
            "org: org-aios-prod-9931, request_id: req_7f3a1"
        )
    )
    response, _ = call_as("TEACHER", generate=leaky)

    assert response.status_code == 502
    body = response.json()["detail"]
    for secret in ("sk-proj", "org-aios-prod-9931", "req_7f3a1", "401"):
        assert secret not in body, f"leaked {secret!r} to the caller: {body!r}"


def test_unconfigured_api_key_is_not_reported_to_the_caller():
    """The other shape of the same leak: a bare ValueError whose message was
    "OPENAI_API_KEY is not configured in the environment." — our own infrastructure
    state, disclosed on a failed request."""
    unconfigured = AsyncMock(side_effect=ValueError("OPENAI_API_KEY is not configured in the environment."))
    response, _ = call_as("TEACHER", generate=unconfigured)

    assert response.status_code == 500
    assert "OPENAI_API_KEY" not in response.json()["detail"]


def test_provider_rate_limit_is_surfaced_as_429_without_provider_text():
    rate_limited = AsyncMock(side_effect=AdapterRateLimitError("Rate limit reached for gpt-4o in org-aios-prod-9931"))
    response, _ = call_as("TEACHER", generate=rate_limited)

    assert response.status_code == 429
    assert "org-aios-prod-9931" not in response.json()["detail"]
