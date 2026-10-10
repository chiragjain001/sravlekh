-- CreateIndex
CREATE INDEX IF NOT EXISTS "questions_instituteId_createdAt_idx" ON "questions"("instituteId", "createdAt" DESC);
