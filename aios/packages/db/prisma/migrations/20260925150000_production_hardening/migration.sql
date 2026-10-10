-- AlterTable
ALTER TABLE "student_profiles" ADD COLUMN "instituteId" TEXT;

-- Backfill data
UPDATE "student_profiles" sp
  SET "instituteId" = u."instituteId"
  FROM "users" u WHERE u."id" = sp."userId";

-- Make it NOT NULL
ALTER TABLE "student_profiles" ALTER COLUMN "instituteId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "interventions_studentProfileId_topicId_idx" ON "interventions"("studentProfileId", "topicId");
CREATE INDEX "notice_deliveries_userId_idx" ON "notice_deliveries"("userId");
CREATE INDEX "assessment_deliveries_assessmentId_idx" ON "assessment_deliveries"("assessmentId");
CREATE INDEX "student_profiles_instituteId_idx" ON "student_profiles"("instituteId");

-- Security Setup: Application Role
-- Prerequisite: The DBA must have created the `aios_app` role manually (e.g. via Supabase Dashboard)
-- with a strong password before this migration runs. We do not hardcode passwords in version control.
DO
$do$
BEGIN
   IF NOT EXISTS (
      SELECT FROM pg_catalog.pg_roles
      WHERE  rolname = 'aios_app') THEN

      RAISE EXCEPTION 'Role aios_app does not exist. Please create it manually with a secure password before running this migration.';
   END IF;
END
$do$;

GRANT USAGE ON SCHEMA public TO aios_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO aios_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO aios_app;

-- Security Setup: Immutability Revokes
REVOKE UPDATE, DELETE ON audit_logs FROM aios_app;
REVOKE UPDATE, DELETE ON evaluation_versions FROM aios_app;

-- Security Setup: Immutability Triggers (Defense-in-depth)
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
