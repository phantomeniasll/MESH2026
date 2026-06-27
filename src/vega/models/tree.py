"""Tree model — the central entity."""

from datetime import UTC, datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, Float, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base

if TYPE_CHECKING:
    from .reading import Reading
    from .watering import Watering


from enum import StrEnum


class TreeStatus(StrEnum):
    HEALTHY = "healthy"
    STRESSED = "stressed"
    CRITICAL = "critical"
    UNKNOWN = "unknown"


class Tree(Base):
    __tablename__ = "trees"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    species: Mapped[str | None] = mapped_column(String(128))
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    neighborhood: Mapped[str | None] = mapped_column(String(64))
    address: Mapped[str | None] = mapped_column(String(256))
    planting_date: Mapped[datetime | None] = mapped_column(DateTime)
    planting_year: Mapped[int | None] = mapped_column(Integer)
    age_estimated: Mapped[bool] = mapped_column(Boolean, default=False)
    est_moisture: Mapped[float | None] = mapped_column(Float)
    est_heat: Mapped[float | None] = mapped_column(Float)
    liters_per_day: Mapped[float | None] = mapped_column(Float)
    nfc_tag_id: Mapped[str | None] = mapped_column(String(64), unique=True)
    device_eui: Mapped[str | None] = mapped_column(String(32), unique=True)
    status: Mapped[str] = mapped_column(String(16), default=TreeStatus.UNKNOWN)
    photo_url: Mapped[str | None] = mapped_column(Text)
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(UTC))
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC))

    readings: Mapped[list["Reading"]] = relationship(back_populates="tree", lazy="selectin")
    waterings: Mapped[list["Watering"]] = relationship(back_populates="tree", lazy="selectin")

    def __repr__(self) -> str:
        return f"<Tree {self.name} ({self.id[:8]}…)>"
