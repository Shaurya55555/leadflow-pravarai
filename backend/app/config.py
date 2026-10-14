from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "sqlite:///./leadflow.db"
    cors_origins: str = "http://localhost:3000"

    # Auth. Change SECRET_KEY outside local development.
    secret_key: str = "dev-only-secret-change-me-please-use-a-long-random-value"
    access_token_minutes: int = 60 * 12
    # Demo account created on first start when no users exist.
    demo_email: str = "demo@leadflow.test"
    demo_password: str = "leadflow123"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
