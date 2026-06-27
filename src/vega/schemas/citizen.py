"""Pydantic schemas for citizen-facing API."""

from datetime import datetime

from pydantic import BaseModel, Field


class WateringLogCreate(BaseModel):
    """When a citizen taps NFC and waters a tree."""
    nfc_tag_id: str = Field(..., max_length=64)
    user_id: str | None = None
    estimated_liters: float | None = Field(None, ge=0)
    photo_url: str | None = None
    notes: str | None = None


class UserCreate(BaseModel):
    """Register a new citizen."""
    display_name: str = Field(..., min_length=1, max_length=64)
    email: str | None = None
    neighborhood: str | None = None


class WateringLogResponse(BaseModel):
    id: str
    tree_id: str
    user_id: str | None
    estimated_liters: float | None
    photo_url: str | None
    points_earned: int
    created_at: datetime

    model_config = {"from_attributes": True}


class UserProfile(BaseModel):
    id: str
    display_name: str
    neighborhood: str | None
    total_points: int
    current_streak: int
    longest_streak: int
    trees_adopted: int
    waterings_count: int
    level: int
    badges: list[str]
    created_at: datetime

    model_config = {"from_attributes": True}


class LeaderboardEntry(BaseModel):
    rank: int
    user_id: str
    display_name: str
    neighborhood: str | None
    total_points: int
    level: int
