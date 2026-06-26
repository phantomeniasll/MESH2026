"""Pydantic schemas for gamification."""

from datetime import datetime
from pydantic import BaseModel


class BadgeInfo(BaseModel):
    id: str
    name: str
    description: str
    icon: str  # emoji
    earned_at: datetime | None = None


class PointsSummary(BaseModel):
    user_id: str
    total_points: int
    current_streak: int
    longest_streak: int
    level: int
    points_to_next_level: int
    badges: list[BadgeInfo]


class StreakStatus(BaseModel):
    current_streak: int
    longest_streak: int
    streak_active: bool
    last_activity_at: datetime | None
    streak_bonus_active: bool


class RewardResponse(BaseModel):
    id: str
    name: str
    description: str
    points_cost: int
    category: str
    stock: int | None
    image_url: str | None
    is_active: bool

    model_config = {"from_attributes": True}


class RedeemRequest(BaseModel):
    user_id: str
    reward_id: str


class RedeemResponse(BaseModel):
    success: bool
    redemption_id: str
    points_spent: int
    remaining_points: int
    message: str
