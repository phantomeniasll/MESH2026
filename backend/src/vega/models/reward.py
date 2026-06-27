"""Reward model — city services exchangeable for points."""

import uuid
from datetime import UTC, datetime

from sqlalchemy import Boolean, DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from ..database import Base


class Reward(Base):
    __tablename__ = "rewards"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    points_cost: Mapped[int] = mapped_column(Integer, nullable=False)
    category: Mapped[str] = mapped_column(String(32), nullable=False)  # transport, priority, ceremony, merch
    stock: Mapped[int | None] = mapped_column(Integer)  # None = unlimited
    image_url: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(UTC))

    def __repr__(self) -> str:
        return f"<Reward {self.name} ({self.points_cost}pts)>"


class RewardRedemption(Base):
    __tablename__ = "reward_redemptions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    reward_id: Mapped[str] = mapped_column(String(36), nullable=False)
    points_spent: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(16), default="pending")  # pending, fulfilled, cancelled
    redeemed_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(UTC))
    fulfilled_at: Mapped[datetime | None] = mapped_column(DateTime)

    def __repr__(self) -> str:
        return f"<Redemption user={self.user_id[:8]}… reward={self.reward_id[:8]}…>"
