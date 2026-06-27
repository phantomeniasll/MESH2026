"""Points economy engine — award calculation and streak logic."""

from datetime import UTC, datetime, timedelta

from ..config import settings
from ..models.tree import Tree
from ..models.user import User


async def award_points_for_watering(user: User | None, tree: Tree) -> int:
    """Calculate and award points for a watering action.

    Base points + streak multiplier + critical tree bonus.
    Returns the number of points awarded.
    """
    base = settings.points_per_watering
    multiplier = 1.0

    if user:
        # Streak bonus
        if user.current_streak >= 7:
            multiplier = settings.streak_bonus_multiplier

        # Critical tree bonus — double points for trees in need
        if tree.status == "critical":
            multiplier *= 2.0
        elif tree.status == "stressed":
            multiplier *= 1.5

    return max(1, int(base * multiplier))


def update_user_after_watering(user: User, points: int) -> None:
    """Apply a watering's effects to the user: counts, points, streak, level.

    Streak rolls forward if the last activity was yesterday, holds if it was
    today, and resets to 1 otherwise.
    """
    now = datetime.now(UTC)

    user.waterings_count += 1
    user.total_points += points

    if user.last_activity_at is not None:
        last_date = user.last_activity_at.date()
        today = now.date()
        if last_date == today - timedelta(days=1):
            user.current_streak += 1
        elif last_date == today:
            pass  # already counted today
        else:
            user.current_streak = 1
    else:
        user.current_streak = 1

    user.longest_streak = max(user.longest_streak, user.current_streak)
    user.level = int((user.total_points / 100) ** 0.5) + 1
    user.last_activity_at = now
