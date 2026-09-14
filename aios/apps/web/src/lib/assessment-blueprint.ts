// Translates the Assessment Builder wizard's UI-level state (AssessmentState)
// into the real backend payloads for Blueprint/Paper/Exam creation
// (apps/api/src/papers/dto/paper.dto.ts, apps/api/src/exams/dto/exam.dto.ts).
//
// The wizard's fixture labels (e.g. 'Weekly Test', 'Numerical') don't line up
// 1:1 with the Prisma enums — this file is the single place that maps
// between the two, so Step8Generate never has to guess.

import { AssessmentState } from '../components/dashboard/teacher/assessment-builder/AssessmentSummaryPanel';
import { SyllabusChapter } from '../components/dashboard/teacher/assessment-builder/steps/Step3Syllabus';

// Fixed by convention with Step4Planning's own running-total math
// (`totalMarks = totalQuestions * 4`) — keeping the same constant here
// guarantees the Blueprint's distribution sums to exactly its totalMarks,
// which apps/api/src/papers/papers.service.ts createBlueprint() enforces.
export const MARKS_PER_QUESTION = 4;

const QUESTION_TYPE_MAP: Record<string, string> = {
  MCQ: 'MCQ',
  Integer: 'NUMERICAL',
  Numerical: 'NUMERICAL',
  'Assertion Reason': 'MCQ',
  Mixed: 'MCQ',
  // Subjective/theory types — a real gap until now. The backend's QuestionType
  // enum (packages/db/prisma/schema.prisma) has always had SHORT_ANSWER and
  // LONG_ANSWER; Step5Rules just never offered them, which meant Paper
  // Builder could only ever produce MCQ/NUMERICAL papers — fine for a
  // competitive-exam mock test, wrong for a school-style theory paper, which
  // is mostly these two.
  'Short Answer': 'SHORT_ANSWER',
  'Long Answer': 'LONG_ANSWER',
};

export function mapQuestionType(label: string | undefined): string {
  return (label && QUESTION_TYPE_MAP[label]) || 'MCQ';
}

const EXAM_TYPE_MAP: Record<string, string> = {
  'Weekly Test': 'WEEKLY_TEST',
  'Chapter Test': 'CHAPTER_TEST',
  'Topic Test': 'UNIT_TEST',
  'Unit Test': 'UNIT_TEST',
  'Mock Test': 'MOCK_TEST',
  'Grand Test': 'MOCK_TEST',
  'Revision Test': 'REVISION_TEST',
  'Practice Test': 'PRACTICE_TEST',
  DPP: 'PRACTICE_TEST',
  Assignment: 'PRACTICE_TEST',
};

export function mapExamType(label: string | undefined): string {
  return (label && EXAM_TYPE_MAP[label]) || 'WEEKLY_TEST';
}

export interface BlueprintDistributionRule {
  topicId: string;
  type: string;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  count: number;
  marksPerQuestion: number;
}

/** Spreads a chapter's easy/medium/hard counts evenly across that chapter's
 * selected topics — the wizard plans by chapter (Step4Planning), but a
 * Blueprint's distribution rules are per-topic. */
/** Splits `total` into `slots` near-equal whole-number shares — the same
 * "per + remainder to the first N" spread used for topics below, factored out
 * so the type split can reuse it without duplicating the remainder math. */
function spread(total: number, slots: number): number[] {
  if (slots <= 0) return [];
  const per = Math.floor(total / slots);
  const remainder = total - per * slots;
  return Array.from({ length: slots }, (_, i) => per + (i < remainder ? 1 : 0));
}

export function buildDistributionRules(
  state: AssessmentState,
  chaptersTree: SyllabusChapter[],
): BlueprintDistributionRule[] {
  // Every selected type was previously discarded but the first — Step5Rules
  // lets a teacher tick MCQ *and* Short Answer *and* Numerical, and only
  // whichever happened to be ticked first ever reached the generated paper.
  // Deduped because two UI labels can map to the same backend enum (e.g.
  // "Assertion Reason" and "Mixed" both mean MCQ) — no reason to split one
  // type's share into two identical rules.
  const types = Array.from(new Set(state.questionTypes.map(mapQuestionType)));
  const effectiveTypes = types.length > 0 ? types : ['MCQ'];

  const rules: BlueprintDistributionRule[] = [];

  for (const chapterId of state.selectedChapters) {
    const plan = state.chapterQuestionPlan[chapterId];
    const chapter = chaptersTree.find((c) => c.id === chapterId);
    if (!plan || !chapter) continue;

    const topicIds = chapter.topics.map((t) => t.id).filter((id) => state.selectedTopics.includes(id));
    if (topicIds.length === 0) continue;

    (['easy', 'medium', 'hard'] as const).forEach((tier) => {
      const total = plan[tier];
      if (total <= 0) return;

      const perTopic = spread(total, topicIds.length);

      topicIds.forEach((topicId, topicIdx) => {
        const topicCount = perTopic[topicIdx] ?? 0;
        if (topicCount <= 0) return;

        // Second split: this topic's share of the tier, spread across every
        // selected question type rather than dumped entirely into one.
        const perType = spread(topicCount, effectiveTypes.length);

        effectiveTypes.forEach((type, typeIdx) => {
          const count = perType[typeIdx] ?? 0;
          if (count > 0) {
            rules.push({
              topicId,
              type,
              difficulty: tier.toUpperCase() as 'EASY' | 'MEDIUM' | 'HARD',
              count,
              marksPerQuestion: MARKS_PER_QUESTION,
            });
          }
        });
      });
    });
  }

  return rules;
}

export function totalQuestionsFromRules(rules: BlueprintDistributionRule[]): number {
  return rules.reduce((sum, r) => sum + r.count, 0);
}
