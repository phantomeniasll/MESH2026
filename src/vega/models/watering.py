"""Watering log — citizen actions tracked for gamification."""

import uuid
from datetime import datetime
from sqlalchemy import Float, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base


class Watering(Base):
    __tablename__ = "waterings"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tree_id: Mapped[str] = mapped_column(String(36), ForeignKey("trees.id"), nullable=False, index=True)
    user_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"), index=True)
    nfc_tap_id: Mapped[str | None] = mapped_column(String(64))
    estimated_liters: Mapped[float | None] = mapped_column(Float)
    photo_url: Mapped[str | None] = mapped_column(Text)
    notes: Mapped[str | None] = mapped_column(Text)
    points_earned: Mapped[int] = mapped_column(default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)

    tree: Mapped["Tree"] = relationship(back_populates="waterings")
    user: Mapped["User | None"] = relationship(back_populates="waterings")

    def __repr__(self) -> str:
        return f"<Watering tree={self.tree_id[:8]}… user={self.user_id[:8] if self.user_id else 'anon'}>"
