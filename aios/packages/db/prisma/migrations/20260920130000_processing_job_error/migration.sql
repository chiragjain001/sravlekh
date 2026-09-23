-- A failed processing stage can now say why, so the teacher sees "this PDF is
-- password-protected" instead of a bare FAILED status. Additive and nullable.

-- AlterTable
ALTER TABLE "processing_jobs" ADD COLUMN     "errorMessage" TEXT;
