-- Tag-wise marking: the AI's split of a question's marks (and, for questions
-- without a reference answer, its own model solution), and the teacher's edited
-- split on the version they approve. Additive and nullable - no backfill.

-- AlterTable
ALTER TABLE "evaluation_versions" ADD COLUMN     "gradingBreakdown" JSONB;

-- AlterTable
ALTER TABLE "ai_recommendations" ADD COLUMN     "gradingBreakdown" JSONB;
