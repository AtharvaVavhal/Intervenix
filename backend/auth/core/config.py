from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    SECRET_KEY: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    ALGORITHM: str = "HS256"

    # Railway injects DATABASE_URL as postgresql://...
    # We normalise it to postgresql+psycopg2:// at read time.
    DATABASE_URL: str = "sqlite:///./intervenix_auth.db"

    @property
    def database_url(self) -> str:
        url = self.DATABASE_URL
        if url.startswith("postgres://"):
            # Heroku/Railway legacy scheme
            url = url.replace("postgres://", "postgresql+psycopg2://", 1)
        elif url.startswith("postgresql://"):
            url = url.replace("postgresql://", "postgresql+psycopg2://", 1)
        return url

    # CORS — set FRONTEND_ORIGIN in Railway dashboard
    # Multiple origins can be comma-separated: https://a.com,https://b.com
    FRONTEND_ORIGIN: str = "http://localhost:5173"

    @property
    def allowed_origins(self) -> list[str]:
        return [o.strip() for o in self.FRONTEND_ORIGIN.split(",") if o.strip()]

    # Admin bootstrap — first signup matching this email gets is_admin=True
    # Set in Railway env vars. Leave blank to disable auto-promotion.
    ADMIN_EMAIL: str = ""

    # Email notifications — leave blank to disable
    SMTP_HOST:    str = ""
    SMTP_PORT:    int = 587
    SMTP_USER:    str = ""
    SMTP_PASS:    str = ""
    NOTIFY_EMAIL: str = ""

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
    }


@lru_cache
def get_settings() -> Settings:
    return Settings()
