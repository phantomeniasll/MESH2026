"""Tests for ORM models — creation, relationships, constraints."""

import pytest
from sqlalchemy import select

from vega.models.tree import Tree
from vega.models.reading import Reading
from vega.models.user import User
from vega.models.watering import Watering
from vega.models.reward import Reward, RewardRedemption


@pytest.mark.asyncio
async def test_create_tree(db_session):
    """A Tree can be created and persisted."""
    tree = Tree(
        name="Test-Linde",
        species="Tilia cordata",
        latitude=49.0069,
        longitude=8.4037,
        neighborhood="Südstadt",
        nfc_tag_id="NFC001",
        device_eui="A84041FFFFFFFFFF",
    )
    db_session.add(tree)
    await db_session.flush()

    result = await db_session.execute(select(Tree).where(Tree.name == "Test-Linde"))
    saved = result.scalar_one()
    assert saved.species == "Tilia cordata"
    assert saved.latitude == 49.0069
    assert saved.status == "unknown"


@pytest.mark.asyncio
async def test_create_reading_for_tree(db_session):
    """A Reading is linked to a Tree."""
    tree = Tree(name="Eiche", latitude=49.0, longitude=8.4)
    db_session.add(tree)
    await db_session.flush()

    reading = Reading(
        tree_id=tree.id,
        moisture=45.2,
        temperature=22.1,
        humidity=60.0,
        battery_voltage=3.7,
        footfall_count=12,
    )
    db_session.add(reading)
    await db_session.flush()

    result = await db_session.execute(
        select(Reading).where(Reading.tree_id == tree.id)
    )
    readings = result.scalars().all()
    assert len(readings) == 1
    assert readings[0].moisture == 45.2


@pytest.mark.asyncio
async def test_user_points_and_streaks(db_session):
    """User tracks points, streaks, and level."""
    user = User(display_name="Julian", neighborhood="Oststadt", total_points=150)
    db_session.add(user)
    await db_session.flush()

    result = await db_session.execute(select(User).where(User.display_name == "Julian"))
    saved = result.scalar_one()
    assert saved.total_points == 150
    assert saved.level == 1
    assert saved.current_streak == 0


@pytest.mark.asyncio
async def test_watering_logs_points(db_session):
    """Watering records points earned."""
    tree = Tree(name="Ahorn", latitude=49.0, longitude=8.4)
    user = User(display_name="Tester", total_points=0)
    db_session.add_all([tree, user])
    await db_session.flush()

    watering = Watering(
        tree_id=tree.id,
        user_id=user.id,
        nfc_tap_id="NFC001",
        estimated_liters=5.0,
        points_earned=10,
    )
    db_session.add(watering)
    await db_session.flush()

    result = await db_session.execute(
        select(Watering).where(Watering.tree_id == tree.id)
    )
    saved = result.scalar_one()
    assert saved.points_earned == 10
    assert saved.estimated_liters == 5.0


@pytest.mark.asyncio
async def test_reward_redemption(db_session):
    """Rewards can be redeemed."""
    reward = Reward(
        name="Free Bus Day Pass",
        description="One day of free public transport",
        points_cost=200,
        category="transport",
        stock=50,
    )
    db_session.add(reward)
    await db_session.flush()

    redemption = RewardRedemption(
        user_id="user-1",
        reward_id=reward.id,
        points_spent=200,
    )
    db_session.add(redemption)
    await db_session.flush()

    assert redemption.status == "pending"
    assert redemption.points_spent == 200
