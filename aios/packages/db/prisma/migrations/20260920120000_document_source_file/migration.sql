-- A booklet can now be uploaded as a PDF. The original file is kept in private
-- storage and its key recorded here; the page images are rendered from it.
-- Additive and nullable - existing image-uploaded documents are unaffected.

-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "sourceFileKey" TEXT;
