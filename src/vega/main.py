"""VEGA FastAPI application entry point."""

from pathlib import Path

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse

from .config import settings
from .database import init_db
from .routes import citizens, dashboard, gamification, rewards, sensors, trees
from .routes.map import router as map_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown lifecycle."""
    await init_db()
    yield


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="Smart tree monitoring with citizen gamification — HackXplore 2026.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount route modules
app.include_router(map_router)
app.include_router(sensors.router)
app.include_router(trees.router)
app.include_router(citizens.router)
app.include_router(dashboard.router)
app.include_router(gamification.router)
app.include_router(rewards.router)


@app.get("/health")
async def health_check():
    """Liveness probe."""
    return {"status": "ok", "version": settings.app_version}


@app.get("/review", response_class=HTMLResponse)
async def review_page():
    """Human-facing sensor data review page."""
    html_path = Path(__file__).parent / "static" / "review.html"
    return HTMLResponse(content=html_path.read_text(encoding="utf-8"))


def main():
    """CLI entry point: uvicorn server."""
    import uvicorn

    uvicorn.run(
        "vega.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
    )
