"""
Root conftest for the api-python test suite.

Ensures `apps/api-python` (the src/ package's parent) is on sys.path for
pytest, matching how uvicorn runs this service (`uvicorn src.main:app`).

Also injects the required env vars that pydantic-settings demands at import
time (DATABASE_URL, JWT_SECRET) so tests that import `src.main` — such as
test_health.py — don't blow up with a ValidationError before any test runs.
Real integration tests that need a live DB must supply their own credentials
via a local .env file or CI secrets.
"""

import os

# Inject test-only sentinel values before any src.* module is imported.
# These are intentionally fake — no test in this suite talks to a real DB.
# The values satisfy pydantic-settings' "field required" validation; they are
# never used to open an actual connection during unit/smoke tests.
os.environ.setdefault("DATABASE_URL", "postgresql://test:test@localhost:5432/test_db")
os.environ.setdefault("JWT_SECRET", "test-jwt-secret-at-least-32-characters-long!!")
