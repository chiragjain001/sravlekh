from functools import lru_cache

from pydantic_settings import BaseSettings


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

    # Internal NestJS -> FastAPI service contract (02-SYSTEM-ARCHITECTURE.md: never a
    # user JWT, never browser-exposed). Empty means unenforced — dev-only fallback,
    # same "optional, warn, degrade" pattern used for Redis/S3 on the Node side.
    INTERNAL_SERVICE_TOKEN: str = ""

    class Config:
        env_file = ".env"

@lru_cache
def get_settings():
    return Settings()
