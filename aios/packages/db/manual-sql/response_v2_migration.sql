-- 04-DATABASE-SCHEMA.md (V2 section) §3.1 — the v1 Response → Evaluation/
-- EvaluationVersion field migration.
--
-- UNEXECUTED — see docs/33-GAP-ANALYSIS-AND-BUILD-PLAN.md's Phase 7 section.
-- This sandbox has no live Postgres instance, so nothing here has been run or
-- verified against a real database. Written by hand, same reasoning as
-- audit_log_immutability.sql: no prisma/migrations/ history exists yet, so
-- this lives alongside the schema rather than inside a migration folder that
-- doesn't exist.
--
-- WHY THIS IS DEFERRED, NOT JUST UNRUN: doc 04 V2 §3.1 describes DROPPING
-- Response.marksAwarded / mistakeTagType / teacherComment / gradedByUserId /
-- gradedAt once every existing graded row has been backfilled into
-- evaluation_versions. That DROP is destructive and one-directional. Phase 7
-- deliberately built Evaluation/EvaluationVersion/AIRecommendation to FK
-- straight into the EXISTING v1 responses.id column instead (see the
-- "V2 bridge" comment on the Response model in schema.prisma) so that
-- Rubric/Evaluation work in later phases has something real to attach to
-- without this destructive step being a prerequisite. Running this script
-- (through the final DROP COLUMN) is only safe once:
--   1. A real database exists to verify row-count parity against (step 4
--      below is the parity check the doc requires before DROP is safe).
--   2. ExamsService / grading code paths that currently read
--      Response.marksAwarded etc. directly have been migrated to read
--      through Evaluation/EvaluationVersion instead — dropping the columns
--      out from under working v1 grading code would break it immediately.
--
-- Until both are true, Response keeps its v1 columns AND gets the v2
-- Evaluation bridge alongside them — deliberately redundant, not yet merged.

-- ── 1. Seed an Evaluation for every previously-graded Response ──
INSERT INTO evaluations (id, "responseId", status)
  SELECT gen_random_uuid()::text, id, 'TEACHER_REVIEWED'
  FROM responses
  WHERE "updatedAt" IS NOT NULL; -- v1 Response has no gradedAt column yet; see note below

-- NOTE: v1's Response model (schema.prisma, current) does not have the
-- gradedByUserId/gradedAt columns the doc's conceptual migration assumes —
-- those were part of the ORIGINAL v1 grading design this codebase actually
-- shipped with a different shape (marksAwarded/teacherComment/mistakeTags
-- directly on Response, graded implicitly via ExamsService, no separate
-- "graded at" timestamp). The doc's SQL sketch is written against its own
-- idealized prior state, not literally against this repo's current
-- responses table. Before this script can be executed for real, it needs
-- one more pass reconciling it against the ACTUAL current Response columns
-- (id, answerSheetId, questionId, marksAwarded, marksAvailable, isCorrect,
-- studentAnswer, mistakeTags, teacherComment, createdAt, updatedAt) — e.g.
-- deciding what "graded" means as a WHERE predicate (marksAwarded IS NOT
-- NULL is the closest real proxy) and dropping the gradedByUserId reference
-- entirely (no such column exists; author_user_id would need to come from
-- somewhere else, e.g. AnswerSheet's evaluatedByUserId if that exists, or be
-- left null for the historical backfill).

-- ── 2. Seed the first EvaluationVersion (source=TEACHER) from each Response's current values ──
INSERT INTO evaluation_versions (id, "evaluationId", source, "marksAwarded", "mistakeTagType", "teacherComment", "createdAt")
  SELECT gen_random_uuid()::text, e.id, 'TEACHER', r."marksAwarded", r."mistakeTags"[1], r."teacherComment", r."updatedAt"
  FROM responses r
  JOIN evaluations e ON e."responseId" = r.id;
-- mistakeTagType on EvaluationVersion is singular; v1 mistakeTags on Response
-- is an array. Taking [1] (first tag) here is a lossy simplification that
-- needs an explicit product decision before this runs for real — not made
-- here.

-- ── 3. Point each Evaluation at its seeded version as "current" ──
UPDATE evaluations SET "currentEvaluationVersionId" = ev.id
  FROM evaluation_versions ev
  WHERE ev."evaluationId" = evaluations.id;

-- ── 4. Row-count parity check — MUST pass before step 5 is even considered ──
-- SELECT
--   (SELECT count(*) FROM responses WHERE "marksAwarded" IS NOT NULL) AS graded_responses,
--   (SELECT count(*) FROM evaluation_versions) AS seeded_versions;
-- These two counts must be equal. If they are not, do not proceed — find and
-- fix the discrepancy first.

-- ── 5. Only after step 4 passes AND all reading code has been migrated off
--        these columns (see "WHY THIS IS DEFERRED" above): ──
-- ALTER TABLE responses
--   DROP COLUMN "marksAwarded",
--   DROP COLUMN "mistakeTags",
--   DROP COLUMN "teacherComment";
-- "marksAvailable" and "isCorrect" are NOT part of this migration — they stay
-- on Response; only the fields the doc identifies as now belonging to
-- EvaluationVersion are candidates for removal.
