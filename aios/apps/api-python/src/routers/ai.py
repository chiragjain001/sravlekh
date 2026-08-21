from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from src.ai.blueprint_agent import generate_blueprint_from_prompt
from src.auth import get_current_user

router = APIRouter(prefix="/ai", tags=["AI Generation"])

class BlueprintPromptRequest(BaseModel):
    prompt: str

@router.post("/generate-blueprint")
async def generate_blueprint(request: BlueprintPromptRequest, current_user = Depends(get_current_user)):
    """
    Takes a natural language prompt and returns a structured blueprint configuration.
    Requires an authenticated user (Teacher, Admin, or Founder).
    """
    try:
        # Pass the prompt to our LangChain agent
        blueprint_data = generate_blueprint_from_prompt(request.prompt)
        return {
            "success": True,
            "data": blueprint_data.dict()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
