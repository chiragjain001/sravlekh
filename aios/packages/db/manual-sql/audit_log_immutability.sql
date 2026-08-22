-- 07-SECURITY-SPECIFICATION.md §13 / 03-FEATURE-SPECIFICATIONS.md's Audit &
-- Governance module: "Application-level roles have INSERT-only privilege on
-- this table; no UPDATE/DELETE grant exists at the database role level."
--
-- UNEXECUTED — see docs/33-GAP-ANALYSIS-AND-BUILD-PLAN.md's Phase 6.5 section.
-- This sandbox has no live Postgres instance, so nothing here has been run or
-- verified against a real database. This is hand-written SQL, not a Prisma
-- migration — no prisma/migrations/ history exists yet in this repo (schema.prisma
-- is the source of truth, applied ad hoc), so this lives alongside it rather
-- than inside a migration folder that doesn't exist yet.
--
-- PREREQUISITE this SQL depends on and does NOT itself set up: the app must
-- connect as a dedicated, non-superuser role. Today DATABASE_URL in
-- .env.example connects as the `postgres` superuser in dev — a superuser
-- bypasses GRANT/REVOKE entirely by definition, so section 1 below is
-- inert until production's DATABASE_URL is switched to a created,
-- least-privilege role. Section 2 (the trigger) is defense-in-depth that
-- holds even then, and is the part worth keeping regardless of role setup.

-- ── 1. Least-privilege grant (inert until the app connects as a non-superuser) ──
-- Replace aios_app with whatever role the production DATABASE_URL actually uses.
-- REVOKE UPDATE, DELETE ON audit_logs FROM aios_app;
-- GRANT SELECT, INSERT ON audit_logs TO aios_app;

-- ── 2. Trigger-based immutability (works regardless of which role connects) ──
-- Real defense-in-depth: even a superuser session hitting this table by
-- mistake (a manual `UPDATE audit_logs ...` during an incident investigation,
-- say) gets rejected, not just a role lacking the grant. A superuser can still
-- disable triggers explicitly if they truly need to (e.g. GDPR erasure of a
-- specific PII value under legal obligation) — that's a deliberate, auditable
-- action, not an accidental one.
CREATE OR REPLACE FUNCTION reject_audit_log_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is insert-only — % is not permitted (07-SECURITY-SPECIFICATION.md §13)', TG_OP;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_logs_immutable ON audit_logs;
CREATE TRIGGER audit_logs_immutable
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION reject_audit_log_mutation();
