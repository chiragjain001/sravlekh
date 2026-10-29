-- CreateIndex
-- Optimizes versioned reference solution lookup across batches (Phase 6 DB Optimization)
CREATE INDEX IF NOT EXISTS "ai_recommendations_questionVersionId_rubricVersionId_idx" ON "ai_recommendations"("questionVersionId", "rubricVersionId");

