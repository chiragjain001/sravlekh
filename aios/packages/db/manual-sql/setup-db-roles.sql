-- packages/db/manual-sql/setup-db-roles.sql
CREATE ROLE aios_app WITH LOGIN PASSWORD 'Chirag@9588_aios';
GRANT USAGE ON SCHEMA public TO aios_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO aios_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO aios_app;
REVOKE UPDATE, DELETE ON audit_logs FROM aios_app;
REVOKE UPDATE, DELETE ON evaluation_versions FROM aios_app;

-- Backfill student_profiles
UPDATE student_profiles sp
  SET "instituteId" = u."instituteId"
  FROM users u WHERE u.id = sp."userId";

-- Now make it NOT NULL
ALTER TABLE student_profiles ALTER COLUMN "instituteId" SET NOT NULL;
