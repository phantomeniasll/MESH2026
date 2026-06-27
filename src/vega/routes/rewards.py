"""Reward redemption routes."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models.reward import Reward, RewardRedemption
from ..models.user import User
from ..schemas.gamification import RedeemRequest, RedeemResponse, RewardResponse

router = APIRouter(prefix="/api/rewards", tags=["rewards"])


@router.get("", response_model=list[RewardResponse])
async def list_rewards(
    category: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """List available rewards, optionally filtered by category."""
    stmt = select(Reward).where(Reward.is_active)
    if category:
        stmt = stmt.where(Reward.category == category)

    result = await db.execute(stmt)
    rewards = result.scalars().all()
    return [RewardResponse.model_validate(r) for r in rewards]


@router.post("/redeem", response_model=RedeemResponse)
async def redeem_reward(payload: RedeemRequest, db: AsyncSession = Depends(get_db)):
    """Redeem points for a reward."""
    # Fetch user
    result = await db.execute(select(User).where(User.id == payload.user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Fetch reward
    result = await db.execute(select(Reward).where(Reward.id == payload.reward_id))
    reward = result.scalar_one_or_none()
    if not reward or not reward.is_active:
        raise HTTPException(status_code=404, detail="Reward not found or inactive")

    # Check stock
    if reward.stock is not None and reward.stock <= 0:
        raise HTTPException(status_code=400, detail="Reward out of stock")

    # Check points
    if user.total_points < reward.points_cost:
        raise HTTPException(status_code=400, detail=f"Not enough points. Need {reward.points_cost}, have {user.total_points}")

    # Deduct points, decrement stock
    user.total_points -= reward.points_cost
    if reward.stock is not None:
        reward.stock -= 1

    redemption = RewardRedemption(
        user_id=user.id,
        reward_id=reward.id,
        points_spent=reward.points_cost,
    )
    db.add(redemption)
    await db.flush()

    return RedeemResponse(
        success=True,
        redemption_id=redemption.id,
        points_spent=reward.points_cost,
        remaining_points=user.total_points,
        message=f"Redeemed: {reward.name}!",
    )
