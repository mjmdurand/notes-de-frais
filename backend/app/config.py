from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    database_url: str = "postgresql://ndf:ndfpassword@localhost:5432/ndf_db"
    redis_url: str = "redis://localhost:6379/0"

    minio_endpoint: str = "localhost:9000"
    minio_access_key: str = "minioadmin"
    minio_secret_key: str = "minioadmin123"
    minio_bucket_name: str = "ndf-documents"
    minio_secure: bool = False

    smtp_host: str = "localhost"
    smtp_port: int = 1025
    smtp_user: Optional[str] = None
    smtp_password: Optional[str] = None
    smtp_from: str = "ndf@company.com"

    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 1440

    minio_public_base_url: Optional[str] = None  # ex: https://ged.domain.test

    frontend_url: str = "http://localhost:3000"

    class Config:
        env_file = ".env"
        case_sensitive = False
        extra = "ignore"


settings = Settings()
