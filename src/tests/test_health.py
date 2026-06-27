"""Basic smoke tests — health check and app initialization."""

import pytest
from httpx import ASGITransport, AsyncClient

from vega.main import app


@pytest.mark.asyncio
async def test_health_check():
    """The /health endpoint returns OK."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert "version" in data


@pytest.mark.asyncio
async def test_app_title():
    """App has the correct title."""
    assert app.title == "VEGA"
