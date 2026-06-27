"""Application configuration via environment variables."""

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """VEGA settings loaded from environment / .env file."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # Application
    app_name: str = "VEGA"
    app_version: str = "0.1.0"
    debug: bool = False
    host: str = "0.0.0.0"
    port: int = 8000

    # Database
    database_url: str = "sqlite+aiosqlite:///vega.db"

    # MQTT / TTN
    mqtt_broker: str = "eu1.cloud.thethings.network"
    mqtt_port: int = 1883
    mqtt_username: str = ""
    mqtt_password: str = ""
    mqtt_topic_prefix: str = "v3/+/devices/+/up"

    # Citizen web app
    citizen_base_url: str = "http://localhost:8000"

    # Gamification defaults
    points_per_watering: int = 10
    points_per_photo: int = 5
    points_per_referral: int = 25
    streak_bonus_multiplier: float = 1.5

    @property
    def db_path(self) -> Path:
        """Absolute path to the SQLite database file."""
        if self.database_url.startswith("sqlite"):
            db_part = self.database_url.split("///")[-1]
            return Path(db_part).resolve()
        return Path("vega.db").resolve()


settings = Settings()
