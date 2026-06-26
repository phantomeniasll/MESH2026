"""Pydantic schemas for sensor data."""

from datetime import datetime
from pydantic import BaseModel, Field


class SensorReadingCreate(BaseModel):
    """Payload from a LoRaWAN device uplink."""
    device_eui: str = Field(..., max_length=32)
    moisture: float | None = Field(None, ge=0, le=100)
    temperature: float | None = Field(None, ge=-40, le=85)
    humidity: float | None = Field(None, ge=0, le=100)
    battery_voltage: float | None = Field(None, ge=0, le=5)
    footfall_count: int | None = Field(None, ge=0)
    tilt_angle: float | None = Field(None, ge=0, le=180)
    rssi: int | None = None
    snr: float | None = None
    raw_payload: str | None = None


class SensorReadingResponse(BaseModel):
    id: str
    tree_id: str
    moisture: float | None
    temperature: float | None
    humidity: float | None
    battery_voltage: float | None
    footfall_count: int | None
    tilt_angle: float | None
    rssi: int | None
    snr: float | None
    recorded_at: datetime

    model_config = {"from_attributes": True}


class TreeHealthSummary(BaseModel):
    """Aggregated health data for dashboard."""
    tree_id: str
    tree_name: str
    current_moisture: float | None
    moisture_trend: str | None  # rising, falling, stable
    footfall_24h: int
    last_reading_at: datetime | None
    battery_voltage: float | None
    status: str
