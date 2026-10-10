// Translates the Assessment Builder wizard's UI-level state (AssessmentState)
// into the real backend payloads for Blueprint/Paper/Exam creation
// (apps/api/src/papers/dto/paper.dto.ts, apps/api/src/exams/dto/exam.dto.ts).
//
// KEY DESIGN CHANGE vs V1:
// The old file hardcoded MARKS_PER_QUESTION = 4 uniformly across all topics.
// That was fine for MCQ/OMR papers but breaks for Theory papers where sections
// carry different marks (Section A = 1 mark VSA, Section C = 5 mark LA).
//
// V2 strategy:
//   Theory/Hybrid → use AssessmentState.sections[] (section-based path)
//   OMR           → fall back to AssessmentState.chapterQuestionPlan (V1 path)
//
// Both paths produce the same BlueprintDistributionRule[] the backend already
// accepts via CreateBlueprintDto, so no API changes are needed.

import { AssessmentState, PaperSection } from '../components/dashboard/teacher/assessment-builder/AssessmentSummaryPanel';
import { SyllabusChapter } from '../components/dashboard/teacher/assessment-builder/steps/Step3Syllabus';

// Keep for backward compat — Step1 no longer hard-pins this for Theory papers.
export const MARKS_PER_QUESTION = 4;

const QUESTION_TYPE_MAP: Record<string, string> = {
  // OMR / Objective types
  MCQ: 'MCQ',
  Integer: 'NUMERICAL',
  Numerical: 'NUMERICAL',
  'Assertion Reason': 'MCQ',
  Mixed: 'MCQ',
  'Single Correct MCQ': 'MCQ',
  'Multiple Correct': 'MULTI_CORRECT',
  'True/False': 'MCQ',
  'Match the Following': 'MATCH_THE_FOLLOWING',
  'Fill in the Blank': 'MCQ',
  'Numerical MCQ': 'NUMERICAL',
  // Theory / Descriptive types
  'Very Short Answer': 'SHORT_ANSWER',
  'Short Answer': 'SHORT_ANSWER',
  'Long Answer': 'LONG_ANSWER',
  Essay: 'LONG_ANSWER',
  'Case Based': 'PASSAGE_BASED',
  'Source Based': 'PASSAGE_BASED',
  'Passage Based': 'PASSAGE_BASED',
  'Diagram Based': 'SHORT_ANSWER',
  Application: 'SHORT_ANSWER',
  HOTS: 'SHORT_ANSWER',
  Competency: 'SHORT_ANSWER',
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
  'Homework / Assignment': 'PRACTICE_TEST',
  'Half Yearly': 'MOCK_TEST',
  'Annual Examination': 'MOCK_TEST',
  'School Examination': 'MOCK_TEST',
  'Custom Assessment': 'WEEKLY_TEST',
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
  sectionId?: string;  // V2 — which section this slot belongs to
}

// ── Section Totals ─────────────────────────────────────────────────────────────

/** Sum of all section marks, respecting attemptRequired where internalChoice is set. */
export function computeSectionsTotal(sections: PaperSection[]): number {
  return sections.reduce((sum, sec) => {
    const attemptCount = sec.internalChoice ? sec.attemptRequired : sec.questionCount;
    return sum + attemptCount * sec.marksPerQuestion;
  }, 0);
}

/** Total questions a teacher writes (including internal choice extras). */
export function computeSectionsTotalQuestions(sections: PaperSection[]): number {
  return sections.reduce((sum, sec) => sum + sec.questionCount, 0);
}

/** Splits `total` into `slots` near-equal whole-number shares. */
function spread(total: number, slots: number): number[] {
  if (slots <= 0) return [];
  const per = Math.floor(total / slots);
  const remainder = total - per * slots;
  return Array.from({ length: slots }, (_, i) => per + (i < remainder ? 1 : 0));
}

// ── Path A: Section-Based (Theory / Hybrid) ────────────────────────────────────
//
// Each section in state.sections[] drives its own block of rules. Questions
// are spread across selected topics, then split by difficulty from
// state.difficultyDistribution.
function buildSectionBasedRules(
  state: AssessmentState,
  chaptersTree: SyllabusChapter[],
): BlueprintDistributionRule[] {
  if (state.sections.length === 0) return [];

  const topicIds: string[] = [];
  for (const chapterId of state.selectedChapters) {
    const chapter = chaptersTree.find((c) => c.id === chapterId);
    if (!chapter) continue;
    for (const topic of chapter.topics) {
      if (state.selectedTopics.includes(topic.id)) topicIds.push(topic.id);
    }
  }
  if (topicIds.length === 0) return [];

  const { easy, medium, hard } = state.difficultyDistribution;
  const totalPct = easy + medium + hard || 1;
  const easyFrac = easy / totalPct;
  const medFrac = medium / totalPct;

  const rules: BlueprintDistributionRule[] = [];

  for (const section of state.sections) {
    const mappedType = mapQuestionType(section.questionType);
    if (section.questionCount <= 0) continue;

    const perTopic = spread(section.questionCount, topicIds.length);

    topicIds.forEach((topicId, ti) => {
      const topicCount = perTopic[ti] ?? 0;
      if (topicCount <= 0) return;

      const easyCount = Math.floor(topicCount * easyFrac);
      const medCount  = Math.floor(topicCount * medFrac);
      const hardCount = topicCount - easyCount - medCount;

      const tiers: [number, 'EASY' | 'MEDIUM' | 'HARD'][] = [
        [easyCount, 'EASY'],
        [medCount,  'MEDIUM'],
        [hardCount, 'HARD'],
      ];

      for (const [count, difficulty] of tiers) {
        if (count <= 0) continue;
        rules.push({ topicId, type: mappedType, difficulty, count, marksPerQuestion: section.marksPerQuestion, sectionId: section.id });
      }
    });
  }

  return rules;
}

// ── Path B: Chapter-Plan-Based (OMR / V1 Compatibility) ──────────────────────
function buildChapterPlanRules(
  state: AssessmentState,
  chaptersTree: SyllabusChapter[],
): BlueprintDistributionRule[] {
  const defaultMpq = state.sections.length === 1 ? (state.sections[0]?.marksPerQuestion ?? MARKS_PER_QUESTION) : MARKS_PER_QUESTION;
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

        const perType = spread(topicCount, effectiveTypes.length);

        effectiveTypes.forEach((type, typeIdx) => {
          const count = perType[typeIdx] ?? 0;
          if (count > 0) {
            rules.push({ topicId, type, difficulty: tier.toUpperCase() as 'EASY' | 'MEDIUM' | 'HARD', count, marksPerQuestion: defaultMpq });
          }
        });
      });
    });
  }

  return rules;
}

/**
 * Returns the distribution rules array for CreateBlueprintDto.distribution.
 * Theory / Hybrid with sections use the section-based path.
 * Everything else falls through to the V1 chapter-plan path.
 */
export function buildDistributionRules(
  state: AssessmentState,
  chaptersTree: SyllabusChapter[],
): BlueprintDistributionRule[] {
  const useSection =
    (state.paperFormat === 'THEORY' || state.paperFormat === 'HYBRID') &&
    state.sections && state.sections.length > 0;

  return useSection
    ? buildSectionBasedRules(state, chaptersTree)
    : buildChapterPlanRules(state, chaptersTree);
}

export function totalQuestionsFromRules(rules: BlueprintDistributionRule[]): number {
  return rules.reduce((sum, r) => sum + r.count, 0);
}

export function totalMarksFromRules(rules: BlueprintDistributionRule[]): number {
  return rules.reduce((sum, r) => sum + r.count * r.marksPerQuestion, 0);
}

// ── Section Quick-Fill Templates ──────────────────────────────────────────────
// Pre-built section layouts for common Theory paper patterns.
// Step4SectionBuilder exposes these as "Suggest Structure" quick fills.
export const THEORY_SECTION_TEMPLATES: Record<
  string,
  Array<{ name: string; questionType: string; questionCount: number; marksPerQuestion: number; instructions: string }>
> = {
  cbse_class10_80m: [
    { name: 'Section A', questionType: 'Very Short Answer', questionCount: 20, marksPerQuestion: 1, instructions: 'Answer all questions.' },
    { name: 'Section B', questionType: 'Short Answer',       questionCount: 6,  marksPerQuestion: 2, instructions: 'Answer all questions.' },
    { name: 'Section C', questionType: 'Short Answer',       questionCount: 7,  marksPerQuestion: 3, instructions: 'Answer all questions.' },
    { name: 'Section D', questionType: 'Long Answer',         questionCount: 3,  marksPerQuestion: 5, instructions: 'Answer all questions. Internal choice in 2 questions.' },
    { name: 'Section E', questionType: 'Case Based',          questionCount: 3,  marksPerQuestion: 4, instructions: 'Answer all case-based questions.' },
  ],
  cbse_class12_70m: [
    { name: 'Section A', questionType: 'Very Short Answer', questionCount: 16, marksPerQuestion: 1, instructions: 'Answer all questions.' },
    { name: 'Section B', questionType: 'Short Answer',       questionCount: 5,  marksPerQuestion: 2, instructions: 'Answer all questions.' },
    { name: 'Section C', questionType: 'Short Answer',       questionCount: 7,  marksPerQuestion: 3, instructions: 'Answer all questions.' },
    { name: 'Section D', questionType: 'Case Based',          questionCount: 2,  marksPerQuestion: 4, instructions: 'Answer all case-based questions.' },
    { name: 'Section E', questionType: 'Long Answer',         questionCount: 3,  marksPerQuestion: 5, instructions: 'Answer all questions. Internal choice in all 3 questions.' },
  ],
  unit_test_25m: [
    { name: 'Section A', questionType: 'Very Short Answer', questionCount: 5,  marksPerQuestion: 1, instructions: 'Answer all questions.' },
    { name: 'Section B', questionType: 'Short Answer',       questionCount: 4,  marksPerQuestion: 2, instructions: 'Answer all questions.' },
    { name: 'Section C', questionType: 'Long Answer',         questionCount: 2,  marksPerQuestion: 4, instructions: 'Answer all questions.' },
  ],
};
