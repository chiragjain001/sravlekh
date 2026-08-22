import { PrismaService } from '../prisma/prisma.service';

/**
 * Upserts Response(evidenceType=PAGE_REGION) rows for every confirmed
 * QuestionRegion on a document, once that document's identity is resolved
 * (Document.attemptId set). Idempotent — safe to call after every region
 * edit (DocumentsService) and after identity confirmation
 * (IdentityResolutionService), regardless of which happened first.
 */
export async function syncPageRegionResponses(prisma: PrismaService, documentId: string): Promise<void> {
  const document = await prisma.document.findUnique({ where: { id: documentId } });
  if (!document?.attemptId) return; // nothing to attach evidence to yet — 23 fix #7's one-directional Document->Attempt link

  const regions = await prisma.pageRegion.findMany({
    where: { questionId: { not: null }, regionType: 'QUESTION_ANSWER', pageImage: { page: { documentId } } },
  });

  for (const region of regions) {
    if (!region.questionId) continue;
    const question = await prisma.question.findUnique({ where: { id: region.questionId } });
    if (!question) continue;

    await prisma.response.upsert({
      where: { attemptId_questionId: { attemptId: document.attemptId, questionId: region.questionId } },
      create: {
        attemptId: document.attemptId,
        questionId: region.questionId,
        marksAwarded: 0,
        marksAvailable: question.marks,
        evidenceType: 'PAGE_REGION',
        questionRegionId: region.id,
      },
      update: { questionRegionId: region.id },
    });
  }
}
