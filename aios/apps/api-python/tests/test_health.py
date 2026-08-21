from fastapi.testclient import TestClient

from src.main import app


def test_health_endpoint_reports_healthy():
    # Deliberately not using `with TestClient(app) as client:` — entering the context
    # manager runs the app's lifespan (src.main.lifespan), which calls connect_db()
    # and requires a real DATABASE_URL. This smoke test only exercises the route
    # itself, which has no DB dependency, so lifespan is skipped on purpose.
    client = TestClient(app)

    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "healthy"}
