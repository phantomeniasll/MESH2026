"""Points economy engine — award calculation and streak logic."""


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
