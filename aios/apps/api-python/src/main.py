import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Response, status
from fastapi.middleware.cors import CORSMiddleware

from src.config import get_settings
from src.database import connect_db, db, disconnect_db
from src.routers import ai, analytics, documents, evaluation, institutes, ocr, users

logger = logging.getLogger(__name__)

# Construct Settings NOW, at process start, not on first request.
#
# WHY THIS EXISTS: every other call site in this codebase reads get_settings()
# lazily inside a route handler or dependency (auth.py, ai_evaluator.py,
# handwriting_ocr.py, intervention_config.py) — deliberately, per the comment in
# blueprint_agent.py, so that importing a module never has the side effect of
# validating configuration. That is the right call for those modules, but it
# means NOTHING constructed Settings() before uvicorn bound a port. Found while
# proving the staging boot guard live: `uvicorn src.main:app` reported "running"
# and served /health successfully even with AIOS_ENV=staging pointed at the
# shared database, because the request that would have triggered
# _require_staging_targets never arrived. The SAME gap means the earlier
# INTERNAL_SERVICE_TOKEN production guard never ran at boot either — only on the
# first request to a route that depends on it. Neither guard was actually
# fail-closed in the running service; both only looked fail-closed in a unit
# test that constructs Settings() directly.
#
# This is the one place allowed to differ: main.py is the process entrypoint,
# never imported during test collection, so this line runs exactly once, for
# real, before anything can be served — which is the only place "fail closed at
# boot" can actually mean what it claims.
get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_db()
    yield
    await disconnect_db()

app = FastAPI(
    title="AIOS Data Engine & API",
    description="Python FastAPI backend powering the AIOS academic platform.",
    version="1.0.0",
    lifespan=lifespan
)

# CORS configuration. Origins come from CORS_ALLOWED_ORIGINS (config.py), which
# refuses a wildcard in production — they used to be a hardcoded localhost literal,
# which meant a deployed engine trusted a developer's laptop origin and nothing
# else. Note the browser normally never reaches this service directly at all: the
# web app calls it same-origin via its /api/py rewrite, so CORS is only load-bearing
# for deployments that expose the engine directly.
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(ai.router)
app.include_router(institutes.router)
app.include_router(users.router)
app.include_router(analytics.router)
app.include_router(ocr.router)
app.include_router(evaluation.router)
app.include_router(documents.router)

@app.get("/")
async def root():
    return {"message": "Welcome to the AIOS Python Engine", "status": "online"}

HEALTH_DB_TIMEOUT_SECONDS = 2.0


@app.get("/health")
async def health_check(response: Response):
    """Readiness, not just liveness.

    This used to return {"status": "healthy"} unconditionally, which is worse
    than having no check at all once a platform is routing on it: a container
    that has lost its database keeps reporting healthy, so traffic keeps
    arriving and every request fails. Mirrors the Node health controller, which
    already probes its dependencies.

    The query is bounded — a hung connection must surface as "down", not as a
    health check that never answers and trips the platform's own probe timeout
    with no diagnostic.
    """
    database_up = False
    try:
        await asyncio.wait_for(db.query_raw("SELECT 1"), timeout=HEALTH_DB_TIMEOUT_SECONDS)
        database_up = True
    except Exception:
        # Deliberately broad: any failure to reach Postgres — timeout, auth,
        # disconnected client — means this instance cannot serve, and the reason
        # belongs in logs rather than in an unauthenticated health response.
        logger.warning("Health check: database unreachable", exc_info=True)

    if not database_up:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE

    return {"status": "healthy" if database_up else "degraded", "database": "up" if database_up else "down"}
