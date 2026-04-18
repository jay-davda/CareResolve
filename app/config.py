from pydantic_settings import BaseSettings
from dotenv import load_dotenv

# Load .env file into environment
load_dotenv()


class Settings(BaseSettings):
    """App-wide configuration pulled from environment variables."""

    APP_NAME: str = "CareResolve AI"
    DEBUG: bool = True
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/careresolve_db"

    class Config:
        env_file = ".env"


# Single shared settings instance used across the app
settings = Settings()
