import os
from pydantic import ConfigDict
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "HD2Lab BabyCare"
    API_V1_STR: str = "/api/babycare/v1"
    SECRET_KEY: str = os.getenv("SECRET_KEY", "hd2lab-babycare-dev-secret-key-change-in-prod-1234567890")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL", 
        "sqlite:///./babycare.db"
    )
    
    # Static files upload directory
    UPLOAD_DIR: str = os.getenv("UPLOAD_DIR", "./uploads")
    MAX_UPLOAD_SIZE_BYTES: int = 5 * 1024 * 1024  # 5MB
    
    # Auth configuration
    AUTH_MODE: str = os.getenv("AUTH_MODE", "hybrid")  # "hybrid", "hd2lab_proxy", "local"
    HD2LAB_HEADER_USER_ID: str = "X-User-Id"
    HD2LAB_HEADER_USER_EMAIL: str = "X-User-Email"
    
    # AI Gateway
    AI_PROVIDER: str = os.getenv("AI_PROVIDER", "mock")  # "gemini", "llama", "mock"
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    LOCAL_LLAMA_URL: str = os.getenv("LOCAL_LLAMA_URL", "http://127.0.0.1:8080/v1")
    
    # CORS
    CORS_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "https://hd2lab.duckdns.org"
    ]

    model_config = ConfigDict(case_sensitive=True)

settings = Settings()
