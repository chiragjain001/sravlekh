from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient

from src.main import app

# The route's comment about skipping lifespan still applies: entering
# TestClient's context manager would run src.main.lifespan, which calls
# connect_db() and needs a real DATABASE_URL. The db client is patched per test
# instead, so the readiness logic is exercised without a live database.
#
# The whole `db` object is replaced rather than its method: prisma-client-py
# defines query_raw as a read-only attribute, so patch.object on it fails.


def fake_db(query_raw):
    return SimpleNamespace(query_raw=query_raw)


def test_health_reports_healthy_when_the_database_answers():
    with patch("src.main.db", fake_db(AsyncMock(return_value=[{"?column?": 1}]))):
        response = TestClient(app).get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "healthy", "database": "up"}


def test_health_reports_503_when_the_database_is_unreachable():
    """This is the case the old check got wrong: it returned a hard-coded
    "healthy" regardless, so a container that had lost Postgres kept receiving
    traffic and failing every request. A health check that cannot fail is worse
    than none once a platform routes on it."""
    with patch("src.main.db", fake_db(AsyncMock(side_effect=ConnectionError("no route to host")))):
        response = TestClient(app).get("/health")

    assert response.status_code == 503
    assert response.json() == {"status": "degraded", "database": "down"}


def test_health_does_not_hang_when_the_database_hangs():
    """A stuck connection must surface as "down" within the probe's own budget,
    rather than hanging until the platform's probe timeout fires with no
    diagnostic of its own."""
    import asyncio

    async def never_returns(*_args, **_kwargs):
        await asyncio.sleep(60)

    with patch("src.main.HEALTH_DB_TIMEOUT_SECONDS", 0.05), \
         patch("src.main.db", fake_db(never_returns)):
        response = TestClient(app).get("/health")

    assert response.status_code == 503
    assert response.json()["database"] == "down"
