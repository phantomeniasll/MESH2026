"""Pydantic schemas for Tree API."""

from datetime import datetime
from pydantic import BaseModel, Field


class TreeCreate(BaseModel):
    name: str = Field(..., max_length=128)
    species: str | None = None
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    neighborhood: str | None = None
    address: str | None = None
    planting_date: datetime | None = None
    nfc_tag_id: str | None = None
    device_eui: str | None = None
    notes: str | None = None


class TreeUpdate(BaseModel):
    name: str | None = None
    species: str | None = None
    neighborhood: str | None = None
    address: str | None = None
    status: str | None = None
    photo_url: str | None = None
    notes: str | None = None


class TreeResponse(BaseModel):
    id: str
    name: str
    species: str | None
    latitude: float
    longitude: float
    neighborhood: str | None
    address: str | None
    planting_date: datetime | None
    nfc_tag_id: str | None
    device_eui: str | None
    status: str
    photo_url: str | None
    notes: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TreeSummary(BaseModel):
    """Lightweight tree info for map markers."""
    id: str
    name: str
    species: str | None
    latitude: float
    longitude: float
    status: str
    latest_moisture: float | None = None

    model_config = {"from_attributes": True}
