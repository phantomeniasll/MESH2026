"""Citizen user model — gamification participant."""

import uuid
from datetime import UTC, datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base

if TYPE_CHECKING:
    from .watering import Watering


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    display_name: Mapped[str] = mapped_column(String(64), nullable=False)
    email: Mapped[str | None] = mapped_column(String(256), unique=True)
    neighborhood: Mapped[str | None] = mapped_column(String(64))
    total_points: Mapped[int] = mapped_column(Integer, default=0)
    current_streak: Mapped[int] = mapped_column(Integer, default=0)
    longest_streak: Mapped[int] = mapped_column(Integer, default=0)
    trees_adopted: Mapped[int] = mapped_column(Integer, default=0)
    waterings_count: Mapped[int] = mapped_column(Integer, default=0)
    photos_uploaded: Mapped[int] = mapped_column(Integer, default=0)
    level: Mapped[int] = mapped_column(Integer, default=1)
    badges: Mapped[str] = mapped_column(String(512), default="")  # comma-separated badge IDs
    username: Mapped[str | None] = mapped_column(String(64), unique=True, index=True)
    favorite_trees: Mapped[str] = mapped_column(String(2048), default="")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(UTC))
    last_activity_at: Mapped[datetime | None] = mapped_column(DateTime)

    waterings: Mapped[list["Watering"]] = relationship(back_populates="user", lazy="selectin")

    def __repr__(self) -> str:
        return f"<User {self.display_name} lv{self.level} pts={self.total_points}>"
