"""Seed the database with demo trees, rewards, and citizens for hackathon demos.

Usage:
    python -m vega.seed          # creates tables + seeds data (skips if data exists)
    python -m vega.seed --reset  # drops all tables first, then seeds
"""

import argparse
import asyncio
import sys
import uuid
from datetime import UTC, datetime, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from typing import Any

from sqlalchemy import func, select

from vega.config import settings
from vega.database import Base, async_session, engine, init_db
from vega.models.reward import Reward
from vega.models.tree import Tree
from vega.models.user import User
from vega.models.watering import Watering

# ── Karlsruhe demo trees ───────────────────────────────────────
DEMO_TREES: list[dict[str, Any]] = [
    {
        "id": "KA-00001",
        "name": "Marktplatz-Linde",
        "species": "Tilia cordata",
        "latitude": 49.0015270,
        "longitude": 8.3879422,
        "neighborhood": "Südweststadt",
        "address": "Roonstraße 23a, 76137 Karlsruhe",
        "nfc_tag_id": "NFC-KA-001",
        "device_eui": "tree-01",
        "status": "stressed",
    },
    {
        "id": "KA-00002",
        "name": "Schlossgarten-Eiche",
        "species": "Quercus robur",
        "latitude": 49.00163,
        "longitude": 8.38812,
        "neighborhood": "Innenstadt",
        "address": "Schlossplatz, 76131 Karlsruhe",
        "nfc_tag_id": "NFC-KA-002",
        "device_eui": "tree-02",
        "status": "healthy",
    },
    {
        "id": "KA-00003",
        "name": "Suedstadt-Ahorn",
        "species": "Acer platanoides",
        "latitude": 49.0015,
        "longitude": 8.4010,
        "neighborhood": "Südstadt",
        "address": "Werderplatz, 76137 Karlsruhe",
        "nfc_tag_id": "NFC-KA-003",
        "device_eui": "tree-03",
        "status": "critical",
    },
    {
        "id": "KA-00004",
        "name": "Oststadt-Platane",
        "species": "Platanus × hispanica",
        "latitude": 49.0100,
        "longitude": 8.4150,
        "neighborhood": "Oststadt",
        "address": "Durlacher Allee, 76131 Karlsruhe",
        "nfc_tag_id": "NFC-KA-004",
        "device_eui": "tree-04",
        "status": "critical",
    },
    {
        "id": "KA-00005",
        "name": "Weststadt-Buche",
        "species": "Fagus sylvatica",
        "latitude": 49.0055,
        "longitude": 8.3890,
        "neighborhood": "Weststadt",
        "address": "Kaiserallee, 76133 Karlsruhe",
        "nfc_tag_id": "NFC-KA-005",
        "device_eui": "tree-05",
        "status": "stressed",
    },
    {
        "id": "KA-00006",
        "name": "Steamworks Tree",
        "species": "Tilia cordata",
        "latitude": 49.0015270,
        "longitude": 8.3879422,
        "neighborhood": "Südweststadt",
        "address": "Roonstraße 23a, 76137 Karlsruhe",
        "nfc_tag_id": "NFC-KA-006",
        "device_eui": "tree-06",
        "status": "healthy",
        "notes": "HackXplore 2026 demo tree at Steamworks Karlsruhe",
    },
    {
        "id": "KA-00007",
        "name": "Nordstadt-Birke",
        "species": "Betula pendula",
        "latitude": 49.0180,
        "longitude": 8.3970,
        "neighborhood": "Nordstadt",
        "address": "Moltkestraße, 76133 Karlsruhe",
        "status": "critical",
    },
    {
        "id": "KA-00008",
        "name": "Mühlburg-Kastanie",
        "species": "Aesculus hippocastanum",
        "latitude": 49.0060,
        "longitude": 8.3700,
        "neighborhood": "Mühlburg",
        "address": "Rheinstraße, 76185 Karlsruhe",
        "status": "stressed",
    },
]

# ── Rewards catalogue ──────────────────────────────────────────
DEMO_REWARDS: list[dict[str, Any]] = [
    {
        "name": "Free Bus Day Pass",
        "description": "One day of free public transport in Karlsruhe (KVV).",
        "points_cost": 200,
        "category": "transport",
        "stock": 20,
    },
    {
        "name": "Priority Bürgeramt Slot",
        "description": "Skip the queue at the Bürgeramt — next-day appointment.",
        "points_cost": 500,
        "category": "priority",
        "stock": 10,
    },
    {
        "name": "Tree Plaque",
        "description": "Your name on a plaque by the tree you care for.",
        "points_cost": 1000,
        "category": "ceremony",
        "stock": 5,
    },
    {
        "name": "Official Adoption Certificate",
        "description": "City-issued adoption certificate for your tree.",
        "points_cost": 300,
        "category": "ceremony",
        "stock": None,
    },
    {
        "name": "Tree Planting Ceremony Invite",
        "description": "Invitation to the annual tree planting ceremony with the mayor.",
        "points_cost": 750,
        "category": "ceremony",
        "stock": 15,
    },
    {
        "name": "Be Tree T-Shirt",
        "description": "Limited edition Be Tree merch.",
        "points_cost": 150,
        "category": "merch",
        "stock": 30,
    },
    {
        "name": "Museum Entry (ZKM)",
        "description": "Free entry to ZKM | Center for Art and Media Karlsruhe.",
        "points_cost": 150,
        "category": "culture",
        "stock": 50,
    },
    {
        "name": "Public Pool Day Ticket",
        "description": "One day at a Karlsruhe public swimming pool (Bäder).",
        "points_cost": 120,
        "category": "leisure",
        "stock": 50,
    },
]

# ── Demo citizens ──────────────────────────────────────────────
# Each entry: username, display_name, neighborhood, total_points, current_streak,
#             longest_streak, trees_adopted, waterings_count, level, badges, favorite_trees
DEMO_CITIZENS: list[dict[str, Any]] = [
    {
        "id": "demo-user-001",
        "username": "emma_mueller",
        "display_name": "Emma Müller",
        "neighborhood": "Weststadt",
        "total_points": 2100,
        "current_streak": 21,
        "longest_streak": 21,
        "trees_adopted": 3,
        "waterings_count": 24,
        "level": 5,
        "badges": "first_drop,neighborhood_king,heat_wave_hero,early_bird",
        "favorite_trees": "KA-00005,KA-00002",
    },
    {
        "id": "demo-user-002",
        "username": "leon_wagner",
        "display_name": "Leon Wagner",
        "neighborhood": "Innenstadt",
        "total_points": 1250,
        "current_streak": 12,
        "longest_streak": 14,
        "trees_adopted": 2,
        "waterings_count": 14,
        "level": 4,
        "badges": "first_drop,early_bird,sniper",
        "favorite_trees": "KA-00001,KA-00002",
    },
    {
        "id": "demo-user-003",
        "username": "hannah_klein",
        "display_name": "Hannah Klein",
        "neighborhood": "Nordstadt",
        "total_points": 960,
        "current_streak": 9,
        "longest_streak": 11,
        "trees_adopted": 2,
        "waterings_count": 11,
        "level": 4,
        "badges": "first_drop,early_bird,paparazzo",
        "favorite_trees": "KA-00007,KA-00002",
    },
    {
        "id": "demo-user-004",
        "username": "mia_fischer",
        "display_name": "Mia Fischer",
        "neighborhood": "Südstadt",
        "total_points": 820,
        "current_streak": 5,
        "longest_streak": 8,
        "trees_adopted": 1,
        "waterings_count": 9,
        "level": 3,
        "badges": "first_drop,heat_wave_hero",
        "favorite_trees": "KA-00003",
    },
    {
        "id": "demo-user-005",
        "username": "sofia_hoffmann",
        "display_name": "Sofia Hoffmann",
        "neighborhood": "Südstadt",
        "total_points": 680,
        "current_streak": 7,
        "longest_streak": 9,
        "trees_adopted": 1,
        "waterings_count": 8,
        "level": 3,
        "badges": "first_drop,night_owl",
        "favorite_trees": "KA-00003,KA-00006",
    },
    {
        "id": "demo-user-006",
        "username": "noah_schneider",
        "display_name": "Noah Schneider",
        "neighborhood": "Oststadt",
        "total_points": 450,
        "current_streak": 3,
        "longest_streak": 5,
        "trees_adopted": 1,
        "waterings_count": 5,
        "level": 3,
        "badges": "first_drop",
        "favorite_trees": "KA-00004",
    },
    {
        "id": "demo-user-007",
        "username": "max_richter",
        "display_name": "Max Richter",
        "neighborhood": "Nordstadt",
        "total_points": 340,
        "current_streak": 2,
        "longest_streak": 4,
        "trees_adopted": 1,
        "waterings_count": 4,
        "level": 2,
        "badges": "first_drop",
        "favorite_trees": "KA-00007",
    },
    {
        "id": "demo-user-008",
        "username": "luca_becker",
        "display_name": "Luca Becker",
        "neighborhood": "Innenstadt",
        "total_points": 120,
        "current_streak": 0,
        "longest_streak": 2,
        "trees_adopted": 0,
        "waterings_count": 2,
        "level": 2,
        "badges": "first_drop",
        "favorite_trees": "",
    },
]


def _make_waterings(citizens: list[User], trees: list[Tree]) -> list[Watering]:
    """Generate back-filled watering history for demo citizens."""
    now = datetime.now(UTC)
    tree_map = {t.id: t for t in trees}
    waterings = []

    # Rough allocation: watering_count entries per user, spread over last 30 days
    plan: list[tuple[User, str, int]] = [
        # (user, tree_id, days_ago)
        ("demo-user-001", "KA-00005", 0), ("demo-user-001", "KA-00002", 1),
        ("demo-user-001", "KA-00001", 2), ("demo-user-001", "KA-00005", 3),
        ("demo-user-001", "KA-00002", 4), ("demo-user-001", "KA-00003", 5),
        ("demo-user-001", "KA-00005", 6), ("demo-user-001", "KA-00001", 8),
        ("demo-user-001", "KA-00002", 9), ("demo-user-001", "KA-00005", 10),
        ("demo-user-001", "KA-00003", 11), ("demo-user-001", "KA-00001", 12),
        ("demo-user-001", "KA-00002", 13), ("demo-user-001", "KA-00005", 14),
        ("demo-user-001", "KA-00003", 16), ("demo-user-001", "KA-00002", 18),
        ("demo-user-001", "KA-00001", 20), ("demo-user-001", "KA-00005", 21),
        ("demo-user-001", "KA-00002", 22), ("demo-user-001", "KA-00005", 24),
        ("demo-user-001", "KA-00003", 25), ("demo-user-001", "KA-00001", 26),
        ("demo-user-001", "KA-00005", 27), ("demo-user-001", "KA-00002", 28),

        ("demo-user-002", "KA-00001", 0), ("demo-user-002", "KA-00002", 1),
        ("demo-user-002", "KA-00001", 2), ("demo-user-002", "KA-00002", 3),
        ("demo-user-002", "KA-00001", 4), ("demo-user-002", "KA-00002", 5),
        ("demo-user-002", "KA-00001", 6), ("demo-user-002", "KA-00002", 8),
        ("demo-user-002", "KA-00001", 9), ("demo-user-002", "KA-00002", 10),
        ("demo-user-002", "KA-00001", 11), ("demo-user-002", "KA-00002", 12),
        ("demo-user-002", "KA-00001", 13), ("demo-user-002", "KA-00002", 14),

        ("demo-user-003", "KA-00007", 0), ("demo-user-003", "KA-00002", 1),
        ("demo-user-003", "KA-00007", 2), ("demo-user-003", "KA-00002", 3),
        ("demo-user-003", "KA-00007", 4), ("demo-user-003", "KA-00002", 5),
        ("demo-user-003", "KA-00007", 6), ("demo-user-003", "KA-00002", 8),
        ("demo-user-003", "KA-00007", 9), ("demo-user-003", "KA-00002", 10),
        ("demo-user-003", "KA-00007", 11),

        ("demo-user-004", "KA-00003", 0), ("demo-user-004", "KA-00003", 2),
        ("demo-user-004", "KA-00003", 4), ("demo-user-004", "KA-00003", 6),
        ("demo-user-004", "KA-00003", 8), ("demo-user-004", "KA-00008", 10),
        ("demo-user-004", "KA-00003", 12), ("demo-user-004", "KA-00003", 14),
        ("demo-user-004", "KA-00003", 16),

        ("demo-user-005", "KA-00003", 0), ("demo-user-005", "KA-00006", 1),
        ("demo-user-005", "KA-00003", 2), ("demo-user-005", "KA-00006", 3),
        ("demo-user-005", "KA-00003", 5), ("demo-user-005", "KA-00006", 6),
        ("demo-user-005", "KA-00003", 8), ("demo-user-005", "KA-00006", 10),

        ("demo-user-006", "KA-00004", 0), ("demo-user-006", "KA-00004", 3),
        ("demo-user-006", "KA-00004", 7), ("demo-user-006", "KA-00004", 14),
        ("demo-user-006", "KA-00004", 21),

        ("demo-user-007", "KA-00007", 1), ("demo-user-007", "KA-00007", 5),
        ("demo-user-007", "KA-00007", 12), ("demo-user-007", "KA-00007", 20),

        ("demo-user-008", "KA-00001", 3), ("demo-user-008", "KA-00002", 10),
    ]

    citizen_map = {c.id: c for c in citizens}

    for user_id, tree_id, days_ago in plan:
        user = citizen_map.get(user_id)
        tree = tree_map.get(tree_id)
        if not user or not tree:
            continue
        pts = 10
        if tree.status == "critical":
            pts = 20
        elif tree.status == "stressed":
            pts = 15
        waterings.append(Watering(
            id=str(uuid.uuid4()),
            tree_id=tree_id,
            user_id=user_id,
            nfc_tap_id=f"NFC-DEMO-{user_id[-3:]}-{days_ago}",
            estimated_liters=8.0,
            points_earned=pts,
            created_at=now - timedelta(days=days_ago, hours=(days_ago * 3) % 18),
        ))

    return waterings


async def seed(reset: bool = False) -> None:
    """Create tables and populate demo data."""
    await init_db()

    if reset:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
        await init_db()
        print("  Dropped all tables, recreated.")

    async with async_session() as session:
        # ── Insert trees ──
        tree_count: int | None = (await session.execute(
            select(func.count(Tree.id))
        )).scalar()

        if tree_count and tree_count > 0:
            print(f"  Skipping trees: {tree_count} already exist.")
            trees = (await session.execute(select(Tree))).scalars().all()
        else:
            trees = [Tree(**t) for t in DEMO_TREES]
            session.add_all(trees)
            await session.flush()
            print(f"  Seeded {len(trees)} demo trees.")

        # ── Insert rewards ──
        reward_count: int | None = (await session.execute(
            select(func.count(Reward.id))
        )).scalar()

        if reward_count and reward_count > 0:
            print(f"  Skipping rewards: {reward_count} already exist.")
        else:
            rewards = [Reward(**r) for r in DEMO_REWARDS]
            session.add_all(rewards)
            await session.flush()
            print(f"  Seeded {len(rewards)} demo rewards.")

        # ── Insert demo citizens ──
        citizen_count: int | None = (await session.execute(
            select(func.count(User.id))
        )).scalar()

        if citizen_count and citizen_count > 0:
            print(f"  Skipping citizens: {citizen_count} already exist.")
        else:
            now = datetime.now(UTC)
            citizens = []
            for c in DEMO_CITIZENS:
                user = User(
                    id=c["id"],
                    username=c["username"],
                    display_name=c["display_name"],
                    neighborhood=c["neighborhood"],
                    total_points=c["total_points"],
                    current_streak=c["current_streak"],
                    longest_streak=c["longest_streak"],
                    trees_adopted=c["trees_adopted"],
                    waterings_count=c["waterings_count"],
                    level=c["level"],
                    badges=c["badges"],
                    favorite_trees=c.get("favorite_trees", ""),
                    last_activity_at=now if c["current_streak"] > 0 else None,
                    created_at=now - timedelta(days=30),
                )
                citizens.append(user)
            session.add_all(citizens)
            await session.flush()
            print(f"  Seeded {len(citizens)} demo citizens.")

            # ── Back-fill waterings ──
            waterings = _make_waterings(citizens, list(trees))
            session.add_all(waterings)
            await session.flush()
            print(f"  Seeded {len(waterings)} demo waterings.")

        await session.commit()

    print(f"\n  Database: {settings.db_path}")
    print("  Run:  vega  # or:  uvicorn vega.main:app --reload")


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed VEGA database")
    parser.add_argument("--reset", action="store_true", help="Drop all tables before seeding")
    args = parser.parse_args()
    asyncio.run(seed(reset=args.reset))


if __name__ == "__main__":
    main()
