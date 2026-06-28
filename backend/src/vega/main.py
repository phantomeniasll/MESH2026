"""VEGA FastAPI application entry point."""

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse

from .config import settings
from .database import init_db
from .routes import citizens, city, dashboard, gamification, rewards, sensors, trees
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
app.include_router(city.router)
app.include_router(gamification.router)
app.include_router(rewards.router)


@app.get("/health")
async def health_check():
    """Liveness probe."""
    return {"status": "ok", "version": settings.app_version}


def _serve(name: str) -> HTMLResponse:
    html_path = Path(__file__).parent / "static" / f"{name}.html"
    return HTMLResponse(content=html_path.read_text(encoding="utf-8"))


@app.get("/review", response_class=HTMLResponse)
async def review_page():
    """Sensor data review page."""
    return _serve("review")


@app.get("/login", response_class=HTMLResponse)
async def login_page():
    return _serve("login")


@app.get("/register", response_class=HTMLResponse)
async def register_page():
    return _serve("register")


@app.get("/profile", response_class=HTMLResponse)
async def profile_page():
    return _serve("profile")


@app.get("/impact", response_class=HTMLResponse)
async def impact_page():
    return _serve("impact")


@app.get("/citizen-map", response_class=HTMLResponse)
async def citizen_map_page():
    return _serve("citizen_map")


def main():
    """CLI entry point: uvicorn server."""
    import uvicorn

    uvicorn.run(
        "vega.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
    )
