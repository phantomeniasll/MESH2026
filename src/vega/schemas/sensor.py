"""Pydantic schemas for sensor data."""

from datetime import datetime

from pydantic import BaseModel, Field


class SensorReadingCreate(BaseModel):
    """Payload from a LoRaWAN device uplink.

    Ranges are deliberately wide — sensors may send error sentinel values
    (e.g. -99 °C, -1 %RH) during startup or fault conditions.
    Application logic, not the schema, decides what's plausible.
    """
    tree_id: str = Field(..., max_length=36, description="KA-##### id the firmware is provisioned with")
    device_eui: str | None = None
    moisture: float | None = Field(None, ge=-100, le=200)
    temperature: float | None = Field(None, ge=-100, le=125)
    humidity: float | None = Field(None, ge=-100, le=200)
    battery_voltage: float | None = Field(None, ge=-1, le=15)
    footfall_count: int | None = Field(None, ge=-1)
    tilt_angle: float | None = Field(None, ge=-1, le=360)
    sound_level: int | None = Field(None, ge=-1, le=100)
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
    sound_level: int | None
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
