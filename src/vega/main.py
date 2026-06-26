"""VEGA FastAPI application entry point."""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .database import init_db
from .routes import sensors, trees, citizens, dashboard, gamification, rewards


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


def main():
    """CLI entry point: uvicorn server."""
    import uvicorn

    uvicorn.run(
        "vega.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
    )
