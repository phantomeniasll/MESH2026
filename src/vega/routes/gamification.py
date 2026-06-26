"""Gamification routes — badges, streaks, points."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..database import get_db
from ..models.user import User
from ..schemas.gamification import PointsSummary, StreakStatus, BadgeInfo

router = APIRouter(prefix="/api/gamification", tags=["gamification"])

# Badge definitions
BADGES = {
    "first_drop":      BadgeInfo(id="first_drop",   name="First Drop",        description="First tree watered", icon="💧"),
    "early_bird":      BadgeInfo(id="early_bird",   name="Early Bird",        description="Watered before 7am", icon="🌅"),
    "heat_wave_hero":  BadgeInfo(id="heat_wave_hero", name="Heat Wave Hero",  description="Watered 3 days in a row during heat wave", icon="🦸"),
    "sniper":          BadgeInfo(id="sniper",       name="Sniper",            description="Watered the tree that needed it most", icon="🎯"),
    "neighborhood_king": BadgeInfo(id="neighborhood_king", name="Neighborhood King", description="Top of your neighborhood leaderboard", icon="👑"),
    "centurion":       BadgeInfo(id="centurion",    name="Centurion",         description="100 waterings", icon="💯"),
    "night_owl":       BadgeInfo(id="night_owl",    name="Night Owl",         description="Watered after 10pm", icon="🦉"),
    "paparazzo":       BadgeInfo(id="paparazzo",    name="Paparazzo",         description="Uploaded 10 tree photos", icon="📸"),
    "recruiter":       BadgeInfo(id="recruiter",    name="Recruiter",         description="Referred a friend", icon="🤝"),
}


@router.get("/points/{user_id}", response_model=PointsSummary)
async def get_points(user_id: str, db: AsyncSession = Depends(get_db)):
    """Get a citizen's full points and badge summary."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    earned_ids = [b.strip() for b in user.badges.split(",") if b.strip()] if user.badges else []
    badges = []
    for bid in earned_ids:
        if bid in BADGES:
            badges.append(BADGES[bid])

    # Level formula: level = floor(sqrt(points / 100)) + 1
    level = user.level
    points_to_next = (level * level) * 100 - user.total_points

    return PointsSummary(
        user_id=user.id,
        total_points=user.total_points,
        current_streak=user.current_streak,
        longest_streak=user.longest_streak,
        level=level,
        points_to_next_level=max(0, points_to_next),
        badges=badges,
    )


@router.get("/streak/{user_id}", response_model=StreakStatus)
async def get_streak(user_id: str, db: AsyncSession = Depends(get_db)):
    """Get streak status for a citizen."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    streak_active = user.last_activity_at is not None
    return StreakStatus(
        current_streak=user.current_streak,
        longest_streak=user.longest_streak,
        streak_active=streak_active,
        last_activity_at=user.last_activity_at,
        streak_bonus_active=user.current_streak >= 7,
    )


@router.get("/badges")
async def list_badges():
    """List all available badges."""
    return list(BADGES.values())
