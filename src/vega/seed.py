"""Seed the database with demo trees and rewards for hackathon demos.

Usage:
    python -m vega.seed          # creates tables + seeds data
    python -m vega.seed --reset  # drops all tables first, then seeds
"""

import argparse
import asyncio
import sys
from pathlib import Path

# Ensure the src/ directory is on the path for direct script invocation
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from vega.config import settings
from vega.database import async_session, Base, engine, init_db
from vega.models.reward import Reward
from vega.models.tree import Tree

# ── Karlsruhe trees ────────────────────────────────────────────
DEMO_TREES: list[dict] = [
    {
        "name": "Marktplatz-Linde",
        "species": "Tilia cordata",
        "latitude": 49.0090,
        "longitude": 8.4037,
        "neighborhood": "Innenstadt",
        "address": "Marktplatz, 76133 Karlsruhe",
        "nfc_tag_id": "NFC-KA-001",
        "device_eui": "tree-01",
    },
    {
        "name": "Schlossgarten-Eiche",
        "species": "Quercus robur",
        "latitude": 49.0132,
        "longitude": 8.4043,
        "neighborhood": "Innenstadt",
        "address": "Schlossplatz, 76131 Karlsruhe",
        "nfc_tag_id": "NFC-KA-002",
        "device_eui": "tree-02",
    },
    {
        "name": "Suedstadt-Ahorn",
        "species": "Acer platanoides",
        "latitude": 49.0015,
        "longitude": 8.4010,
        "neighborhood": "Südstadt",
        "address": "Werderplatz, 76137 Karlsruhe",
        "nfc_tag_id": "NFC-KA-003",
        "device_eui": "tree-03",
    },
    {
        "name": "Oststadt-Platane",
        "species": "Platanus × hispanica",
        "latitude": 49.0100,
        "longitude": 8.4150,
        "neighborhood": "Oststadt",
        "address": "Durlacher Allee, 76131 Karlsruhe",
        "nfc_tag_id": "NFC-KA-004",
        "device_eui": "tree-04",
    },
    {
        "name": "Weststadt-Buche",
        "species": "Fagus sylvatica",
        "latitude": 49.0055,
        "longitude": 8.3890,
        "neighborhood": "Weststadt",
        "address": "Kaiserallee, 76133 Karlsruhe",
        "nfc_tag_id": "NFC-KA-005",
        "device_eui": "tree-05",
    },
]

# ── Rewards catalogue ──────────────────────────────────────────
DEMO_REWARDS: list[dict] = [
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
        "stock": None,  # unlimited
    },
    {
        "name": "Tree Planting Ceremony Invite",
        "description": "Invitation to the annual tree planting ceremony with the mayor.",
        "points_cost": 750,
        "category": "ceremony",
        "stock": 15,
    },
    {
        "name": "Wurzelwerk T-Shirt",
        "description": "Limited edition Be Tree / Wurzelwerk merch.",
        "points_cost": 150,
        "category": "merch",
        "stock": 30,
    },
]


async def seed(reset: bool = False) -> None:
    """Create tables and populate demo data."""
    # Create tables
    await init_db()

    if reset:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
        await init_db()
        print("  Dropped all tables, recreated.")

    async with async_session() as session:
        # ── Insert trees ──
        existing = (await session.execute(
            __import__("sqlalchemy").select(__import__("sqlalchemy").func.count(Tree.id))
        )).scalar()

        if existing > 0:
            print(f"  Skipping trees: {existing} already exist.")
        else:
            trees = [Tree(**t) for t in DEMO_TREES]
            session.add_all(trees)
            await session.flush()
            print(f"  Seeded {len(trees)} demo trees.")

        # ── Insert rewards ──
        existing = (await session.execute(
            __import__("sqlalchemy").select(
                __import__("sqlalchemy").func.count(Reward.id)
            )
        )).scalar()

        if existing > 0:
            print(f"  Skipping rewards: {existing} already exist.")
        else:
            rewards = [Reward(**r) for r in DEMO_REWARDS]
            session.add_all(rewards)
            await session.flush()
            print(f"  Seeded {len(rewards)} demo rewards.")

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
