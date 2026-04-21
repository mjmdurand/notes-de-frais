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

    # SMTP — mode : plain | starttls | oauth2
    # plain    → relais non authentifié O365 : <domaine>.mail.protection.outlook.com port 25
    # starttls → SMTP authentifié O365       : smtp.office365.com port 587 (TLS 1.2/1.3)
    # oauth2   → Microsoft Graph API (prévu)
    smtp_mode: str = "starttls"
    smtp_host: str = "smtp.office365.com"
    smtp_port: int = 587
    smtp_from: str = "ndf@company.com"
    smtp_from_name: Optional[str] = None  # ex: "Notes de Frais"
    # Authentification login/password (mode starttls)
    smtp_user: Optional[str] = None
    smtp_password: Optional[str] = None
    # OAuth2 / Exchange Online (mode oauth2, usage futur)
    smtp_oauth_tenant_id: Optional[str] = None
    smtp_oauth_client_id: Optional[str] = None
    smtp_oauth_client_secret: Optional[str] = None

    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 1440

    minio_public_base_url: Optional[str] = None  # ex: https://ged.domain.test

    frontend_url: str = "http://localhost:3000"
    demo_accounts: bool = True
    admin_email: str = "admin@company.com"
    admin_password: str = "Admin1234!"
    admin_first_name: str = "Admin"
    admin_last_name: str = "Système"

    class Config:
        env_file = ".env"
        case_sensitive = False
        extra = "ignore"


settings = Settings()
