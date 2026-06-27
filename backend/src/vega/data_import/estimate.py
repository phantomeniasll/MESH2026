

def _h(tree_id: str, salt: int = 0) -> float:
    """Returns a stable float in [0,1) seeded by tree_id."""
    v = hash(tree_id + str(salt)) & 0x7FFFFFFF
    return v / 0x7FFFFFFF


def est_moisture(tree_id: str) -> float:
    return 5.0 + _h(tree_id, 1) * 60.0          # [5, 65]


def est_heat(tree_id: str, moisture: float) -> float:
    return max(0.0, min(100.0, (100 - moisture) * 0.6 + _h(tree_id, 2) * 40.0))


def est_liters_per_day(tree_id: str, age_years: int) -> float:
    return max(8.0, min(30.0, age_years * 4.0 + _h(tree_id, 3) * 6.0))


def est_planting_year(tree_id: str, species_latin: str | None) -> int:
    """Deterministic planting year estimate for trees without a real one."""
    # Most species planted 1980-2018 in Karlsruhe urban program
    base = 1980
    span = 38
    # Nudge by species typical maturity (fast-growers planted later)
    fast = {"Betula", "Alnus", "Populus", "Prunus"}
    parts = (species_latin or "").split()
    genus = parts[0] if parts else ""
    nudge = 8 if genus in fast else 0
    return base + nudge + int(_h(tree_id, 4) * (span - nudge))
