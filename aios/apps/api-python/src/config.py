from pydantic_settings import BaseSettings
from functools import lru_cache

class Settings(BaseSettings):
    # App
    NODE_ENV: str = "development"
    PORT: int = 4000

    # Database
    DATABASE_URL: str

    # JWT
    JWT_SECRET: str
    
    # AI (OpenAI)
    OPENAI_API_KEY: str = ""

    class Config:
        env_file = ".env"

@lru_cache()
def get_settings():
    return Settings()
