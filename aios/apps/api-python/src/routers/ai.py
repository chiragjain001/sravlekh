import logging

from fastapi import APIRouter, Depends, HTTPException
from langchain_core.exceptions import OutputParserException
from pydantic import BaseModel

from src.ai.blueprint_agent import generate_blueprint_from_prompt
from src.ai.blueprint_model_registry import NoActiveBlueprintModelError
from src.auth import get_current_user, require_role
from src.providers.errors import AdapterError, AdapterRateLimitError

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ai", tags=["AI Generation"])

class BlueprintPromptRequest(BaseModel):
    prompt: str

@router.post(
    "/generate-blueprint",
    dependencies=[Depends(require_role(["TEACHER", "ADMIN", "FOUNDER"]))],
)
async def generate_blueprint(request: BlueprintPromptRequest, current_user = Depends(get_current_user)):
    """
    Takes a natural language prompt and returns a structured blueprint configuration.
    Requires an authenticated user (Teacher, Admin, or Founder).
    """
    try:
        # Pass the prompt to the Blueprint agent (P1 B1: it reaches the provider
        # through src/providers/, no longer a LangChain LCEL chain).
        blueprint_data = await generate_blueprint_from_prompt(request.prompt)
        return {
            "success": True,
            # model_dump() replaces the Pydantic-v1 .dict(), deprecated since v2
            # and removed in v3. Identical output for this model — no aliases and
            # no custom serializers — so the HTTP response contract is unchanged.
            "data": blueprint_data.model_dump()
        }
    except NoActiveBlueprintModelError as e:
        # The one message here we author ourselves and deliberately show the
        # caller: it names no provider internals and tells them exactly what an
        # administrator must do. 503 matches the OCR router's identical case —
        # a correctly-formed request the service is configured not to serve.
        raise HTTPException(status_code=503, detail=str(e))
    except AdapterRateLimitError:
        # Distinguishable because it is the one category the caller can act on by
        # simply waiting. Still no provider text in the body.
        logger.warning("Blueprint generation rate-limited by provider", exc_info=True)
        raise HTTPException(
            status_code=429,
            detail="The AI provider is rate-limiting requests right now. Please try again shortly.",
        )
    except (AdapterError, OutputParserException):
        # `detail=str(e)` used to go straight into the HTTP body here. For an
        # AdapterAuthError that string is the vendor SDK's own message, which
        # names the failing model, the organisation id, a request id and a
        # partially-redacted API key; for a ValueError it was
        # "OPENAI_API_KEY is not configured in the environment." Either way an
        # authenticated teacher learned about our provider configuration from a
        # failed request. The real exception goes to the logs, where it belongs.
        logger.error("Blueprint generation failed", exc_info=True)
        raise HTTPException(
            status_code=502,
            detail="The AI provider could not generate a blueprint. Please try again.",
        )
    except Exception:
        logger.exception("Unexpected failure generating blueprint")
        raise HTTPException(status_code=500, detail="Could not generate a blueprint.")
