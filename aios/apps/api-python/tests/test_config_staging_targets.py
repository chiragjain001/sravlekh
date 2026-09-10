import pytest

from src.config import Settings
from src.staging_targets import (
    check_postgres_target,
    check_redis_target,
    host_port,
    parse_allowlist,
)

# Staging isolation used to be a launch procedure you had to remember.
# apps/api-python/.env points DATABASE_URL at the shared Supabase instance and
# process env is what overrides it, so a staging process launched without that
# override came up attached to the shared database and looked completely normal.
# The failure had no symptom.
#
# These tests pin the behaviour that replaced it: a staging process that did not
# get its target simply does not start. apps/api/src/config/env.schema.spec.ts
# asserts the mirrored rule on the Node side, and
# apps/api/src/config/staging-targets.spec.ts holds the two Node copies of the
# rule together; this file holds the Python copy to the same table of cases.

STAGING_DB = "postgresql://aios_staging:staging_local_only@localhost:5433/aios_staging"
SHARED_DB = "postgresql://postgres:hunter2@aws-0-ap-south-1.pooler.supabase.com:6543/postgres"
SHARED_DIRECT = "postgresql://postgres:hunter2@aws-0-ap-south-1.pooler.supabase.com:5432/postgres"

BASE = {"JWT_SECRET": "x" * 32}


def staging_settings(monkeypatch, **overrides) -> Settings:
    """Build staging Settings with the process environment kept in step.

    src/database.py constructs a bare Prisma(), which reads DATABASE_URL from the
    environment itself — so the guard also asserts that the environment and the
    resolved Settings agree. Keeping them in sync here means the other tests
    exercise the target rules rather than tripping over that check.
    """
    values = {
        **BASE,
        "AIOS_ENV": "staging",
        "DATABASE_URL": STAGING_DB,
        "DIRECT_URL": STAGING_DB,
        "STAGING_DB_ALLOWLIST": "localhost:5433",
        **overrides,
    }
    monkeypatch.setenv("DATABASE_URL", values["DATABASE_URL"])
    return Settings(**values)


# ── host_port / parse_allowlist ───────────────────────────────────────────────


def test_host_port_discards_credentials():
    assert host_port(STAGING_DB, 5432) == "localhost:5433"
    assert host_port(SHARED_DB, 5432) == "aws-0-ap-south-1.pooler.supabase.com:6543"


def test_host_port_applies_the_scheme_default_when_the_port_is_omitted():
    assert host_port("postgresql://u:p@db.internal/aios", 5432) == "db.internal:5432"
    assert host_port("redis://cache.internal", 6379) == "cache.internal:6379"


def test_host_port_lowercases_so_casing_cannot_dodge_an_allowlist():
    assert host_port("postgresql://u:p@LOCALHOST:5433/db", 5432) == "localhost:5433"


def test_host_port_returns_none_rather_than_raising():
    assert host_port("not a url", 5432) is None
    assert host_port("", 5432) is None
    assert host_port("postgresql://u:p@host:not-a-number/db", 5432) is None


def test_an_unset_allowlist_permits_nothing():
    """The fail-closed property: nothing nominated means nothing permitted."""
    assert parse_allowlist(None) == set()
    assert parse_allowlist("") == set()
    assert parse_allowlist("  ,  , ") == set()


def test_allowlist_entries_are_trimmed_and_lowercased():
    assert parse_allowlist(" LocalHost:5433 , 127.0.0.1:5433 ") == {"localhost:5433", "127.0.0.1:5433"}


# ── the rule itself ───────────────────────────────────────────────────────────


def test_a_nominated_staging_host_is_accepted():
    result = check_postgres_target("DATABASE_URL", STAGING_DB, "localhost:5433")
    assert result.ok
    assert result.target == "localhost:5433"


def test_the_shared_instance_is_refused_even_when_nominated():
    # The blocklist is deliberately redundant with the allowlist: it catches
    # pointing staging at production on purpose, which an allowlist cannot.
    result = check_postgres_target("DATABASE_URL", SHARED_DB, "aws-0-ap-south-1.pooler.supabase.com:6543")
    assert not result.ok
    assert "supabase" in result.reason


def test_an_unnominated_host_is_refused():
    result = check_postgres_target("DATABASE_URL", "postgresql://u:p@localhost:5432/aios", "localhost:5433")
    assert not result.ok
    assert "localhost:5432" in result.reason


def test_an_unset_url_is_refused_rather_than_defaulted():
    assert not check_postgres_target("DIRECT_URL", None, "localhost:5433").ok
    assert not check_redis_target("REDIS_URL", "", "localhost:6380").ok


@pytest.mark.parametrize(
    "url",
    [SHARED_DB, STAGING_DB, "postgresql://u:p@localhost:5432/aios", "postgres://bad url"],
)
def test_the_reason_never_contains_the_connection_string_or_password(url):
    """These messages land in terminal scrollback and deploy logs, both far more
    widely readable than the place the password came from."""
    result = check_postgres_target("DATABASE_URL", url, "localhost:5433")
    if result.ok:
        return
    assert "hunter2" not in result.reason
    assert "staging_local_only" not in result.reason
    assert "postgresql://" not in result.reason
    assert "postgres://" not in result.reason


# ── the boot guard ────────────────────────────────────────────────────────────


def test_staging_starts_when_every_target_is_nominated(monkeypatch):
    assert staging_settings(monkeypatch).DATABASE_URL == STAGING_DB


def test_staging_refuses_to_start_against_the_shared_database(monkeypatch):
    with pytest.raises(RuntimeError, match="supabase"):
        staging_settings(monkeypatch, DATABASE_URL=SHARED_DB, DIRECT_URL=SHARED_DIRECT)


def test_staging_refuses_when_only_database_url_was_redirected(monkeypatch):
    """The exact footgun this pass exists for: Prisma migrations resolve
    directUrl, so a process carrying a shared DIRECT_URL is one invocation away
    from migrating the shared database."""
    with pytest.raises(RuntimeError, match="DIRECT_URL"):
        staging_settings(monkeypatch, DIRECT_URL=SHARED_DIRECT)


def test_staging_refuses_when_direct_url_is_absent(monkeypatch):
    with pytest.raises(RuntimeError, match="DIRECT_URL is not set"):
        staging_settings(monkeypatch, DIRECT_URL="")


def test_staging_refuses_when_nothing_is_nominated(monkeypatch):
    with pytest.raises(RuntimeError, match="no host has been nominated"):
        staging_settings(monkeypatch, STAGING_DB_ALLOWLIST="")


def test_staging_refuses_when_the_environment_and_the_resolved_settings_disagree(monkeypatch):
    """src/database.py builds a bare Prisma(), which reads DATABASE_URL from the
    process environment on its own. If that ever differed from what Settings
    resolved, this guard would be vouching for a connection string the client is
    not using — so prove they match rather than assuming it."""
    monkeypatch.setenv("DATABASE_URL", SHARED_DB)
    with pytest.raises(RuntimeError, match="is not the value this service resolved"):
        Settings(
            **BASE,
            AIOS_ENV="staging",
            DATABASE_URL=STAGING_DB,
            DIRECT_URL=STAGING_DB,
            STAGING_DB_ALLOWLIST="localhost:5433",
        )


@pytest.mark.parametrize("secret", ["hunter2", "staging_local_only"])
def test_a_refused_boot_never_prints_a_password(monkeypatch, secret):
    with pytest.raises(RuntimeError) as exc:
        staging_settings(monkeypatch, DATABASE_URL=SHARED_DB, DIRECT_URL=SHARED_DIRECT)
    assert secret not in str(exc.value)
    assert "postgresql://" not in str(exc.value)
    # It must still say enough to diagnose: the host it refused.
    assert "aws-0-ap-south-1.pooler.supabase.com:6543" in str(exc.value)


# ── inert everywhere else ─────────────────────────────────────────────────────


def test_ordinary_development_is_untouched():
    """The whole point of keying on AIOS_ENV: normal development must not acquire
    a new configuration requirement."""
    assert Settings(**BASE, DATABASE_URL=SHARED_DB).AIOS_ENV == ""


def test_production_is_untouched():
    """A hosted database is exactly what production should be using."""
    settings = Settings(
        **BASE,
        NODE_ENV="production",
        INTERNAL_SERVICE_TOKEN="i" * 32,
        DATABASE_URL=SHARED_DB,
    )
    assert settings.DATABASE_URL == SHARED_DB


def test_node_env_staging_alone_does_not_arm_the_guard():
    """A hosted staging deployment is not this disposable stack."""
    assert Settings(**BASE, NODE_ENV="staging", DATABASE_URL=SHARED_DB).AIOS_ENV == ""


@pytest.mark.parametrize("value", ["Staging", "STAGING", "stage", "dev", ""])
def test_only_exactly_staging_arms_the_guard(value):
    """An unrecognised value must leave the guard asleep rather than refuse to
    boot, so a typo cannot take down a deployment."""
    assert Settings(**BASE, AIOS_ENV=value, DATABASE_URL=SHARED_DB).DATABASE_URL == SHARED_DB


def test_the_env_file_is_anchored_to_the_package_not_the_working_directory():
    """pydantic-settings resolves a relative env_file against os.getcwd(), so
    ".env" meant apps/api-python/.env when uvicorn was launched from there and
    NOTHING when it was launched from the repo root — the same command loading a
    different configuration depending on where you stood."""
    from pathlib import Path

    from src.config import ENV_FILE

    assert Path(ENV_FILE).is_absolute()
    assert Path(ENV_FILE).name == ".env"
    assert Path(ENV_FILE).parent.name == "api-python"
