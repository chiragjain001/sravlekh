import os
from functools import lru_cache
from pathlib import Path

from pydantic import ConfigDict, model_validator
from pydantic_settings import BaseSettings

from src.staging_targets import check_postgres_target

# Absolute, anchored on this package rather than the process's working
# directory. pydantic-settings resolves a relative env_file against os.getcwd(),
# so ".env" meant apps/api-python/.env when uvicorn was launched from that
# directory and NOTHING when it was launched from the repo root — the same
# command loading a different configuration depending on where you stood. That
# is exactly the ambiguity the staging work is removing, so it is anchored here
# regardless of environment.
ENV_FILE = Path(__file__).resolve().parent.parent / ".env"


class Settings(BaseSettings):
    # App
    NODE_ENV: str = "development"
    PORT: int = 4000

    # Database
    DATABASE_URL: str

    # Prisma MIGRATIONS resolve directUrl, not url. This service never migrates
    # anything, but it is declared so the staging guard below can refuse a
    # process that was handed a shared-instance DIRECT_URL.
    DIRECT_URL: str = ""

    # JWT
    JWT_SECRET: str
    
    # AI (OpenAI)
    OPENAI_API_KEY: str = ""

    # AI (Gemini) — dev-only fallback for blueprint_agent.py when no OpenAI key
    # is configured. See GEMINI_FALLBACK_MODEL in that file for why this isn't
    # governed by the OpenAI-specific model registry.
    GEMINI_API_KEY: str = ""

    # Internal NestJS -> FastAPI service contract (02-SYSTEM-ARCHITECTURE.md: never a
    # user JWT, never browser-exposed). Empty means UNENFORCED — a dev-only
    # fallback, and REFUSED in production by the validator below. This service is
    # where verify_internal_token actually runs, so an empty value here means the
    # AI endpoints serve any caller that can reach the port. Staging verification
    # found it unset in both services, so the guard had never once executed.
    INTERNAL_SERVICE_TOKEN: str = ""

    # V2 Analytics/Mastery Integration — deployment-wide defaults for now.
    # src/analytics/intervention_config.py wraps these behind a per-institute-
    # ready accessor rather than reading Settings directly from call sites,
    # so a future per-institute override doesn't require touching callers.
    MASTERY_INTERVENTION_THRESHOLD: float = 0.50
    MASTERY_MAX_WEAK_TOPICS: int = 1

    # P1 D1: the batch heatmap's CRITICAL/WARNING/HEALTHY display bands. Deliberately
    # NOT derived from MASTERY_INTERVENTION_THRESHOLD above — 01-PRODUCT-REQUIREMENTS.md
    # §"MasteryScore < 0.50 is the hard threshold that triggers an Intervention" specifies
    # only the intervention cutoff; these 3-tier display bands have no spec anywhere and
    # answer a different question ("how should this topic's class average be color-coded"
    # vs. "is this one student's mastery on this topic weak"). Named config instead of the
    # bare 40/70 literals that used to live inside a pandas lambda, so a future change is
    # deliberate and visible in one place. _PCT suffix is explicit about the 0-100 scale —
    # MASTERY_INTERVENTION_THRESHOLD above is 0-1 — mixing the two scales silently is
    # exactly the trap that would make "40" mean "40%" in one place and "4000%" in another.
    MASTERY_HEATMAP_CRITICAL_PCT: float = 40.0
    MASTERY_HEATMAP_WARNING_PCT: float = 70.0

    # Minimum length in production, matching the Node side's rule for the same
    # credential: a short token is a guessable one.
    MIN_INTERNAL_TOKEN_LENGTH: int = 32

    # Browser origins allowed to call this service directly, comma-separated.
    # Was hardcoded as ["http://localhost:3000"] in main.py — environment-specific
    # config compiled into source, so a deployed engine trusted a developer laptop
    # and nothing else. The normal path is now same-origin through the web app's
    # /api/py rewrite (next.config.js), which needs no CORS at all; this exists for
    # deployments that expose the engine directly, and defaults to the dev origin
    # so local work is unchanged.
    CORS_ALLOWED_ORIGINS: str = "http://localhost:3000"

    @property
    def cors_allowed_origins(self) -> list[str]:
        return [o.strip() for o in self.CORS_ALLOWED_ORIGINS.split(",") if o.strip()]

    # ── Disposable local staging stack ────────────────────────────────────
    #
    # AIOS_ENV is NOT NODE_ENV. NODE_ENV=staging is a legitimate value for a
    # hosted staging deployment against a hosted database; AIOS_ENV=staging
    # means one specific thing in this repo — the loopback, RAM-backed
    # containers in infra/staging/docker-compose.yml — and is set only by that
    # stack's launcher. Mirrors apps/api/src/config/env.schema.ts.
    AIOS_ENV: str = ""
    STAGING_DB_ALLOWLIST: str = ""

    @model_validator(mode="after")
    def _require_internal_token_in_production(self) -> "Settings":
        """Fail closed rather than serve the AI endpoints unauthenticated.

        Mirrors apps/api's env.schema.ts superRefine so the two halves of the
        internal contract cannot disagree about whether the credential is
        required — a config that boots the caller but not the callee (or worse,
        the other way round) is how an unauthenticated service reaches
        production. Raising here means uvicorn never binds a port.

        Raises RuntimeError, NOT ValueError. Pydantic wraps a ValueError raised
        in a validator into a ValidationError that echoes the whole input dict —
        including the token — and a failed boot lands in deploy logs, which are
        far more widely readable than the secret store the value came from.
        Verified: with ValueError the token appeared in the message; with
        RuntimeError pydantic lets it through untouched and only this message is
        printed. Either way the process still refuses to start.
        """
        if self.NODE_ENV != "production":
            return self

        if not self.INTERNAL_SERVICE_TOKEN:
            raise RuntimeError(
                "INTERNAL_SERVICE_TOKEN is required when NODE_ENV=production — without it "
                "verify_internal_token is a no-op and /evaluation/ai-evaluate and /ocr/extract "
                "accept any caller that can reach this port. Refusing to start. Use a different "
                "value per environment."
            )
        if len(self.INTERNAL_SERVICE_TOKEN) < self.MIN_INTERNAL_TOKEN_LENGTH:
            raise RuntimeError(
                f"INTERNAL_SERVICE_TOKEN must be at least {self.MIN_INTERNAL_TOKEN_LENGTH} "
                "characters in production. Refusing to start."
            )
        return self

    @model_validator(mode="after")
    def _reject_wildcard_cors_in_production(self) -> "Settings":
        """A wildcard origin plus credentials is not a valid CORS configuration.

        Starlette will happily accept allow_origins=["*"] together with
        allow_credentials=True, but the combination is meaningless-to-dangerous:
        it either breaks credentialed requests outright or, where a framework
        "helpfully" echoes the caller's Origin back, turns every website into a
        trusted origin for an authenticated API. Refuse it at boot rather than
        discover it from a browser console. Development is untouched.
        """
        if self.NODE_ENV != "production":
            return self
        if "*" in self.cors_allowed_origins:
            raise RuntimeError(
                "CORS_ALLOWED_ORIGINS must not contain '*' when NODE_ENV=production — this "
                "service serves authenticated requests, so a wildcard origin would let any "
                "site call it with the caller's credentials. Set explicit origins. Refusing to start."
            )
        return self

    @model_validator(mode="after")
    def _require_staging_targets(self) -> "Settings":
        """Refuse to start a staging process pointed at shared infrastructure.

        WHY THIS EXISTS: staging isolation used to be a launch procedure you had
        to remember. apps/api-python/.env points DATABASE_URL at the shared
        Supabase instance, and process env is what overrides it — so a staging
        process launched without that override came up silently attached to the
        shared database and looked completely normal. The failure had no symptom.

        Inert unless AIOS_ENV is exactly "staging", so development, the test
        suite and production are untouched.

        RuntimeError, not ValueError, for the same reason as the token guard
        above: pydantic wraps a ValueError into a ValidationError that echoes the
        whole input dict — including DATABASE_URL, password and all — and a
        failed boot lands in deploy logs.
        """
        if self.AIOS_ENV != "staging":
            return self

        for name, url in (("DATABASE_URL", self.DATABASE_URL), ("DIRECT_URL", self.DIRECT_URL)):
            result = check_postgres_target(name, url, self.STAGING_DB_ALLOWLIST)
            if not result.ok:
                # result.reason carries host:port only, never a connection URL.
                raise RuntimeError(
                    f"AIOS_ENV=staging: {result.reason} Refusing to start — a staging "
                    "process must not run against shared infrastructure."
                )

        # The guard above checked the value Settings resolved. src/database.py
        # constructs a bare Prisma(), which reads DATABASE_URL from the process
        # environment on its own — so if the two ever disagreed, this guard would
        # be vouching for a connection string the client is not using. Prove they
        # are the same rather than assuming it.
        env_url = os.environ.get("DATABASE_URL", "")
        if env_url != self.DATABASE_URL:
            from src.staging_targets import DEFAULT_POSTGRES_PORT, host_port

            raise RuntimeError(
                "AIOS_ENV=staging: DATABASE_URL in the process environment "
                f"({host_port(env_url, DEFAULT_POSTGRES_PORT) or 'unset/unparseable'}) is not the "
                f"value this service resolved ({host_port(self.DATABASE_URL, DEFAULT_POSTGRES_PORT)}). "
                "The Prisma client reads the environment directly, so it would connect somewhere "
                "this guard never checked. Refusing to start."
            )

        return self

    model_config = ConfigDict(env_file=ENV_FILE)

@lru_cache
def get_settings():
    return Settings()
