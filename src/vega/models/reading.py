"""Sensor reading model — moisture, temperature, accelerometer."""

import uuid
from datetime import UTC, datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base


class Reading(Base):
    __tablename__ = "readings"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tree_id: Mapped[str] = mapped_column(String(36), ForeignKey("trees.id"), nullable=False, index=True)
    moisture: Mapped[float | None] = mapped_column(Float)          # 0-100% VWC
    temperature: Mapped[float | None] = mapped_column(Float)        # Celsius
    humidity: Mapped[float | None] = mapped_column(Float)           # %RH
    battery_voltage: Mapped[float | None] = mapped_column(Float)    # V
    footfall_count: Mapped[int | None] = mapped_column(Integer)     # since last reading
    tilt_angle: Mapped[float | None] = mapped_column(Float)         # degrees
    rssi: Mapped[int | None] = mapped_column(Integer)               # LoRa signal
    snr: Mapped[float | None] = mapped_column(Float)                # LoRa SNR
    raw_payload: Mapped[str | None] = mapped_column(String(512))
    recorded_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(UTC), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(UTC))

    tree: Mapped["Tree"] = relationship(back_populates="readings")

    def __repr__(self) -> str:
        return f"<Reading tree={self.tree_id[:8]}… moisture={self.moisture}>"
