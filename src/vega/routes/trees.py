"""Tree CRUD and discovery routes."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models.reading import Reading
from ..models.tree import Tree
from ..schemas.tree import TreeCreate, TreeResponse, TreeSummary, TreeUpdate

router = APIRouter(prefix="/api/trees", tags=["trees"])


@router.get("", response_model=list[TreeSummary])
async def list_trees(
    neighborhood: str | None = Query(None),
    status: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """List all trees, optionally filtered."""
    stmt = select(Tree)
    if neighborhood:
        stmt = stmt.where(Tree.neighborhood == neighborhood)
    if status:
        stmt = stmt.where(Tree.status == status)

    result = await db.execute(stmt)
    trees = result.scalars().all()

    summaries = []
    for tree in trees:
        latest = await db.execute(
            select(Reading.moisture)
            .where(Reading.tree_id == tree.id)
            .order_by(Reading.recorded_at.desc())
            .limit(1)
        )
        moisture = latest.scalar_one_or_none()
        summaries.append(TreeSummary(
            id=tree.id,
            name=tree.name,
            species=tree.species,
            latitude=tree.latitude,
            longitude=tree.longitude,
            status=tree.status,
            latest_moisture=moisture,
        ))

    return summaries


@router.get("/{tree_id}", response_model=TreeResponse)
async def get_tree(tree_id: str, db: AsyncSession = Depends(get_db)):
    """Get a single tree by ID."""
    result = await db.execute(select(Tree).where(Tree.id == tree_id))
    tree = result.scalar_one_or_none()
    if not tree:
        raise HTTPException(status_code=404, detail="Tree not found")
    return TreeResponse.model_validate(tree)


@router.post("", response_model=TreeResponse, status_code=201)
async def create_tree(payload: TreeCreate, db: AsyncSession = Depends(get_db)):
    """Register a new tree in the system."""
    tree = Tree(**payload.model_dump())
    db.add(tree)
    await db.flush()
    return TreeResponse.model_validate(tree)


@router.get("/by-nfc/{nfc_tag_id}", response_model=TreeResponse)
async def get_tree_by_nfc(nfc_tag_id: str, db: AsyncSession = Depends(get_db)):
    """Look up a tree by its NFC tag ID — used when a citizen taps."""
    result = await db.execute(select(Tree).where(Tree.nfc_tag_id == nfc_tag_id))
    tree = result.scalar_one_or_none()
    if not tree:
        raise HTTPException(status_code=404, detail=f"No tree found for NFC tag: {nfc_tag_id}")
    return TreeResponse.model_validate(tree)


@router.patch("/{tree_id}", response_model=TreeResponse)
async def update_tree(tree_id: str, payload: TreeUpdate, db: AsyncSession = Depends(get_db)):
    """Update tree details."""
    result = await db.execute(select(Tree).where(Tree.id == tree_id))
    tree = result.scalar_one_or_none()
    if not tree:
        raise HTTPException(status_code=404, detail="Tree not found")

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(tree, key, value)

    await db.flush()
    return TreeResponse.model_validate(tree)
