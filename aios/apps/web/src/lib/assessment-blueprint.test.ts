import { describe, it, expect } from 'vitest';
import { buildDistributionRules, totalQuestionsFromRules, mapQuestionType, mapExamType, MARKS_PER_QUESTION } from './assessment-blueprint';
import type { AssessmentState } from '../components/dashboard/teacher/assessment-builder/AssessmentSummaryPanel';
import type { SyllabusChapter } from '../components/dashboard/teacher/assessment-builder/steps/Step3Syllabus';

/**
 * buildDistributionRules translates the wizard's per-chapter easy/medium/hard
 * plan into the flat per-topic-per-type rule list the backend blueprint
 * actually consumes. The property under test throughout is that nothing a
 * teacher selected in the wizard gets silently dropped on the way there.
 */
describe('buildDistributionRules', () => {
  const chapters: SyllabusChapter[] = [
    { id: 'ch-1', name: 'Kinematics', topics: [{ id: 't-1', name: 'Motion in a Straight Line' }, { id: 't-2', name: 'Projectile Motion' }] },
  ];

  function baseState(overrides: Partial<AssessmentState> = {}): AssessmentState {
    return {
      title: 'Test', type: 'Weekly Test', exam: 'X', subject: 'Physics', batches: [],
      duration: 60, totalMarks: 0, negativeMarking: 'None', instructions: '',
      scheduleType: 'later', dueDate: '', startTime: '', endTime: '',
      shuffleQuestions: false, shuffleOptions: false, showSolutions: false,
      selectedSources: [], selectedChapters: ['ch-1'], selectedTopics: ['t-1', 't-2'],
      chapterQuestionPlan: {},
      questionTypes: ['MCQ'],
      allowRepeat: false, avoidRecentDays: 0, minRating: 0, paperSetsCount: 1, strategy: 'general',
      ...overrides,
    };
  }

  it('a single selected type gets the full count — the pre-fix baseline behaviour', () => {
    const state = baseState({ chapterQuestionPlan: { 'ch-1': { easy: 4, medium: 0, hard: 0 } } });
    const rules = buildDistributionRules(state, chapters);

    expect(totalQuestionsFromRules(rules)).toBe(4);
    expect(rules.every((r) => r.type === 'MCQ')).toBe(true);
  });

  it('THE BUG: selecting multiple types spreads the count across ALL of them, not just the first', () => {
    // Before this fix, buildDistributionRules read only state.questionTypes[0] —
    // a teacher who ticked both MCQ and Short Answer in Step5Rules got an
    // MCQ-only paper with no warning that Short Answer was silently ignored.
    const state = baseState({
      questionTypes: ['MCQ', 'Short Answer'],
      chapterQuestionPlan: { 'ch-1': { easy: 4, medium: 0, hard: 0 } },
    });
    const rules = buildDistributionRules(state, chapters);

    const types = new Set(rules.map((r) => r.type));
    expect(types.has('MCQ')).toBe(true);
    expect(types.has('SHORT_ANSWER')).toBe(true);
    // Total question count is conserved — the split changes WHICH type each
    // question is, never how many questions the teacher planned for.
    expect(totalQuestionsFromRules(rules)).toBe(4);
  });

  it('conserves the total across a three-way type split with a remainder', () => {
    const state = baseState({
      questionTypes: ['MCQ', 'Numerical', 'Long Answer'],
      chapterQuestionPlan: { 'ch-1': { easy: 0, medium: 10, hard: 0 } },
    });
    const rules = buildDistributionRules(state, chapters);

    expect(totalQuestionsFromRules(rules)).toBe(10);
    // Every rule from the medium tier's split is nonzero and MEDIUM.
    expect(rules.every((r) => r.difficulty === 'MEDIUM')).toBe(true);
  });

  it('two UI labels mapping to the same backend type are deduped, not double-counted', () => {
    // 'Assertion Reason' and 'Mixed' both map to plain MCQ (QUESTION_TYPE_MAP).
    // Selecting both must not create two independent MCQ rules that double the
    // effective share MCQ receives relative to a genuinely different type.
    const withDupe = baseState({
      questionTypes: ['Assertion Reason', 'Mixed', 'Short Answer'],
      chapterQuestionPlan: { 'ch-1': { easy: 6, medium: 0, hard: 0 } },
    });
    const withoutDupe = baseState({
      questionTypes: ['MCQ', 'Short Answer'],
      chapterQuestionPlan: { 'ch-1': { easy: 6, medium: 0, hard: 0 } },
    });

    const dupeCounts = buildDistributionRules(withDupe, chapters).reduce((m, r) => ({ ...m, [r.type]: (m[r.type] ?? 0) + r.count }), {} as Record<string, number>);
    const noDupeCounts = buildDistributionRules(withoutDupe, chapters).reduce((m, r) => ({ ...m, [r.type]: (m[r.type] ?? 0) + r.count }), {} as Record<string, number>);

    expect(dupeCounts).toEqual(noDupeCounts);
  });

  it('still spreads across topics correctly when combined with a type split', () => {
    const state = baseState({
      questionTypes: ['MCQ', 'Numerical'],
      selectedTopics: ['t-1', 't-2'],
      chapterQuestionPlan: { 'ch-1': { easy: 8, medium: 0, hard: 0 } },
    });
    const rules = buildDistributionRules(state, chapters);

    expect(totalQuestionsFromRules(rules)).toBe(8);
    const topicsUsed = new Set(rules.map((r) => r.topicId));
    expect(topicsUsed).toEqual(new Set(['t-1', 't-2']));
  });

  it('falls back to MCQ if somehow no question type is selected', () => {
    const state = baseState({ questionTypes: [], chapterQuestionPlan: { 'ch-1': { easy: 2, medium: 0, hard: 0 } } });
    const rules = buildDistributionRules(state, chapters);
    expect(rules.every((r) => r.type === 'MCQ')).toBe(true);
    expect(totalQuestionsFromRules(rules)).toBe(2);
  });

  it('every rule carries MARKS_PER_QUESTION, so totalMarks stays derivable', () => {
    const state = baseState({ chapterQuestionPlan: { 'ch-1': { easy: 3, medium: 2, hard: 1 } } });
    const rules = buildDistributionRules(state, chapters);
    expect(rules.every((r) => r.marksPerQuestion === MARKS_PER_QUESTION)).toBe(true);
  });

  it('skips chapters with no plan or unselected topics, rather than throwing', () => {
    const state = baseState({
      selectedChapters: ['ch-1', 'ch-missing'],
      selectedTopics: [],
      chapterQuestionPlan: { 'ch-1': { easy: 5, medium: 0, hard: 0 } },
    });
    expect(buildDistributionRules(state, chapters)).toEqual([]);
  });
});

describe('mapQuestionType', () => {
  it('maps the new Theory/Subjective labels to the real backend enums', () => {
    expect(mapQuestionType('Short Answer')).toBe('SHORT_ANSWER');
    expect(mapQuestionType('Long Answer')).toBe('LONG_ANSWER');
  });

  it('unknown labels fall back to MCQ rather than sending garbage to the API', () => {
    expect(mapQuestionType('Something Unknown')).toBe('MCQ');
    expect(mapQuestionType(undefined)).toBe('MCQ');
  });
});

describe('mapExamType', () => {
  it('falls back to WEEKLY_TEST for an unrecognised label', () => {
    expect(mapExamType('Not A Real Type')).toBe('WEEKLY_TEST');
  });
});
