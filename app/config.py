from pydantic_settings import BaseSettings
from dotenv import load_dotenv

# Load .env file into environment
load_dotenv()


class Settings(BaseSettings):
    """App-wide configuration pulled from environment variables."""

    APP_NAME: str = "CareResolve AI"
    DEBUG: bool = True
    DATABASE_URL: str = "sqlite:///./wellsense.db"

    # JWT Authentication settings
    SECRET_KEY: str = "change-me-in-production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    ALGORITHM: str = "HS256"

    class Config:
        env_file = ".env"


# Single shared settings instance used across the app
settings = Settings()
