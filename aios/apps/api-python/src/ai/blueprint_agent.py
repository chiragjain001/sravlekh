import json
from pydantic import BaseModel, Field
from typing import List
from langchain_core.prompts import PromptTemplate
from langchain_openai import ChatOpenAI
from langchain_core.output_parsers import PydanticOutputParser
from src.config import get_settings

settings = get_settings()

# Define the expected output structure using Pydantic
class DistributionRuleModel(BaseModel):
    topicName: str = Field(description="The name of the academic topic to test (e.g., Kinematics, Algebra)")
    questionType: str = Field(description="Type of question: MCQ, NUMERICAL, SUBJECTIVE")
    difficulty: str = Field(description="Difficulty level: EASY, MEDIUM, HARD")
    count: int = Field(description="Number of questions to select")

class BlueprintGenerationResult(BaseModel):
    title: str = Field(description="A descriptive title for the exam")
    duration: int = Field(description="Duration of the exam in minutes (default to 60 if not specified)")
    rules: List[DistributionRuleModel] = Field(description="List of rules dictating the distribution of questions")

def generate_blueprint_from_prompt(user_prompt: str) -> BlueprintGenerationResult:
    """
    Takes a natural language prompt from a teacher and converts it into a structured
    Blueprint rule set using an LLM.
    """
    
    if not settings.OPENAI_API_KEY:
        raise ValueError("OPENAI_API_KEY is not configured in the environment.")

    # Initialize the LLM (using gpt-4o or gpt-3.5-turbo based on preference/cost)
    llm = ChatOpenAI(
        api_key=settings.OPENAI_API_KEY,
        model="gpt-4o",
        temperature=0.2  # Low temperature for analytical consistency
    )

    # Set up the parser
    parser = PydanticOutputParser(pydantic_object=BlueprintGenerationResult)

    # Create the prompt template
    prompt_template = PromptTemplate(
        template="""You are an expert academic curriculum designer.
A teacher wants to generate a blueprint (distribution of questions) for an upcoming exam.

Teacher's Request: "{user_prompt}"

Based on their request, intelligently deduce a fair distribution of questions.
- If they ask for a "Hard" exam, skew the distribution towards HARD difficulty.
- If they specify a time but not question count, estimate a reasonable number (e.g. 1 MCQ = 1-2 mins).
- If they mention specific topics, create rules ONLY for those topics.

{format_instructions}""",
        input_variables=["user_prompt"],
        partial_variables={"format_instructions": parser.get_format_instructions()},
    )

    # Build the LangChain pipeline
    chain = prompt_template | llm | parser

    # Execute the chain
    result = chain.invoke({"user_prompt": user_prompt})
    
    return result
