from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Configuration centrale du backend.

    Les valeurs viennent du fichier .env. En production, ne jamais commiter le .env.
    """

    APP_NAME: str = "Ecole RDC"
    ENVIRONMENT: str = "development"
    DATABASE_URL: str = "postgresql+psycopg2://ecole:ecole_password@localhost:5432/ecole_rdc"
    JWT_SECRET_KEY: str = "change-this-secret-in-production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 720
    FRONTEND_URL: str = "http://localhost:5173"
    GENERATED_DIR: str = "generated"
    MINISTRY_VERIFICATION_BASE_URL: str = "http://localhost:5173"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


settings = Settings()
