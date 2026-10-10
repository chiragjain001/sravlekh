-- Execute this script manually via psql or PgAdmin before running the corresponding Prisma migration.
-- Prisma migrations run inside a transaction, which prevents CREATE INDEX CONCURRENTLY.
-- Creating these indexes concurrently ensures that read/write operations on live tables are not blocked.

CREATE INDEX CONCURRENTLY IF NOT EXISTS "assignments_studentProfileId_idx" ON "assignments"("studentProfileId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "interventions_instituteId_idx" ON "interventions"("instituteId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "answer_sheets_studentProfileId_idx" ON "answer_sheets"("studentProfileId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "responses_questionId_idx" ON "responses"("questionId");
-- Fix M-1 / Fix 7: GIN index on mistakeTags array for fast filtering and unnesting in getBatchMistakeSummary
CREATE INDEX CONCURRENTLY IF NOT EXISTS "responses_mistakeTags_gin_idx" ON "responses" USING GIN ("mistakeTags");
