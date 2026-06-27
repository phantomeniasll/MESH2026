"""Citizen-facing routes — NFC tap, watering, profile, leaderboard."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models.tree import Tree
from ..models.user import User
from ..models.watering import Watering
from ..schemas.citizen import (
    LeaderboardEntry,
    LoginRequest,
    UserCreate,
    UserProfile,
    WateringLogCreate,
    WateringLogResponse,
)
from ..services.points import award_points_for_watering, update_user_after_watering

router = APIRouter(prefix="/api/citizens", tags=["citizens"])


def _build_profile(user: User) -> UserProfile:
    badges = [b for b in user.badges.split(",") if b] if user.badges else []
    favorites = [t for t in user.favorite_trees.split(",") if t] if user.favorite_trees else []
    return UserProfile(
        id=user.id,
        display_name=user.display_name,
        username=user.username,
        neighborhood=user.neighborhood,
        total_points=user.total_points,
        current_streak=user.current_streak,
        longest_streak=user.longest_streak,
        trees_adopted=user.trees_adopted,
        waterings_count=user.waterings_count,
        level=user.level,
        badges=badges,
        favorite_trees=favorites,
        created_at=user.created_at,
    )


@router.post("/register", response_model=UserProfile, status_code=201)
async def register(payload: UserCreate, db: AsyncSession = Depends(get_db)):
    """Register a new citizen."""
    if payload.username:
        existing = (await db.execute(select(User).where(User.username == payload.username))).scalar_one_or_none()
        if existing:
            raise HTTPException(status_code=409, detail="Username already taken")
    user = User(**payload.model_dump())
    db.add(user)
    await db.flush()
    return _build_profile(user)


@router.post("/login", response_model=UserProfile)
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Login by username (demo auth — no password)."""
    result = await db.execute(select(User).where(User.username == payload.username))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Username not found")
    return _build_profile(user)


@router.post("/water", response_model=WateringLogResponse, status_code=201)
async def log_watering(payload: WateringLogCreate, db: AsyncSession = Depends(get_db)):
    """Citizen taps NFC and waters a tree."""
    tree = None
    if payload.tree_id:
        result = await db.execute(select(Tree).where(Tree.id == payload.tree_id))
        tree = result.scalar_one_or_none()
    if not tree:
        result = await db.execute(
            select(Tree).where(Tree.nfc_tag_id == payload.nfc_tag_id)
        )
        tree = result.scalar_one_or_none()
    if not tree:
        raise HTTPException(status_code=404, detail=f"No tree found for NFC tag: {payload.nfc_tag_id}")

    user = None
    if payload.user_id:
        result = await db.execute(select(User).where(User.id == payload.user_id))
        user = result.scalar_one_or_none()

    points = await award_points_for_watering(user, tree)  # type: ignore[arg-type]

    watering = Watering(
        tree_id=tree.id,
        user_id=user.id if user else None,
        nfc_tap_id=payload.nfc_tag_id,
        estimated_liters=payload.estimated_liters,
        photo_url=payload.photo_url,
        notes=payload.notes,
        points_earned=points,
    )
    db.add(watering)

    if user:
        update_user_after_watering(user, points)  # type: ignore[arg-type]

    await db.flush()
    return WateringLogResponse(
        id=watering.id,
        tree_id=watering.tree_id,
        user_id=watering.user_id,
        estimated_liters=watering.estimated_liters,
        photo_url=watering.photo_url,
        points_earned=watering.points_earned,
        total_points=user.total_points if user else 0,  # type: ignore
        current_streak=user.current_streak if user else 0,  # type: ignore
        created_at=watering.created_at,
    )


@router.get("/profile/{user_id}", response_model=UserProfile)
async def get_profile(user_id: str, db: AsyncSession = Depends(get_db)):
    """Get a citizen's profile."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return _build_profile(user)


@router.get("/{user_id}/favorites", response_model=list[str])
async def get_favorites(user_id: str, db: AsyncSession = Depends(get_db)):
    """Get a citizen's favorite tree IDs."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return [t for t in user.favorite_trees.split(",") if t] if user.favorite_trees else []


@router.post("/{user_id}/favorites/{tree_id}", status_code=200)
async def add_favorite(user_id: str, tree_id: str, db: AsyncSession = Depends(get_db)):
    """Add a tree to a citizen's favorites."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    favorites = [t for t in user.favorite_trees.split(",") if t] if user.favorite_trees else []
    if tree_id not in favorites:
        favorites.append(tree_id)
        user.favorite_trees = ",".join(favorites)
    await db.flush()
    return {"favorite_trees": favorites}


@router.delete("/{user_id}/favorites/{tree_id}", status_code=200)
async def remove_favorite(user_id: str, tree_id: str, db: AsyncSession = Depends(get_db)):
    """Remove a tree from a citizen's favorites."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    favorites = [t for t in user.favorite_trees.split(",") if t and t != tree_id]
    user.favorite_trees = ",".join(favorites)
    await db.flush()
    return {"favorite_trees": favorites}


@router.get("/leaderboard", response_model=list[LeaderboardEntry])
async def leaderboard(
    neighborhood: str | None = Query(None),
    limit: int = Query(20, le=100),
    db: AsyncSession = Depends(get_db),
):
    """Top citizens by points, optionally filtered by neighborhood."""
    stmt = select(User).where(User.is_active).order_by(User.total_points.desc()).limit(limit)
    if neighborhood:
        stmt = stmt.where(User.neighborhood == neighborhood).order_by(User.total_points.desc()).limit(limit)

    result = await db.execute(stmt)
    users = result.scalars().all()

    return [
        LeaderboardEntry(
            rank=i + 1,
            user_id=u.id,
            display_name=u.display_name,
            neighborhood=u.neighborhood,
            total_points=u.total_points,
            level=u.level,
        )
        for i, u in enumerate(users)
    ]
