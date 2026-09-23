import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { CheckedCopyReview } from './CheckedCopyReview';

const submitMutate = vi.fn();
const aiMutate = vi.fn();
let sheet: any;

vi.mock('@/hooks/useApi', () => ({
  useCheckedCopy: () => ({ data: sheet, isLoading: false, isError: false, refetch: vi.fn() }),
  useRunAiCheck: () => ({ mutate: aiMutate, isPending: false }),
  useSubmitCheckedCopy: () => ({ mutate: submitMutate, isPending: false }),
  useCheckedCopyPdf: () => ({ mutate: vi.fn(), isPending: false }),
  usePageImageUrl: () => ({ data: { url: 'https://img/page1.jpg' } }),
}));

const region = { documentId: 'doc-1', pageId: 'page-1', pageNumber: 1, boundingBox: { x: 0.1, y: 0.1, width: 0.8, height: 0.3 } };

function makeSheet(overrides: Record<string, unknown> = {}) {
  return {
    attemptId: 'att-1',
    status: 'DRAFT',
    reviewedBy: null,
    assessment: { title: 'Unit Test — Motion' },
    delivery: { id: 'del-1', status: 'EVALUATING' },
    student: { id: 'sp-1', name: 'Asha', rollNumber: '12' },
    totals: { obtained: 3, total: 9 },
    counts: { subjective: 2, reviewed: 0, aiSuggested: 1, readyForAi: 0, needsOcr: 0, illegible: 1 },
    scoreRecord: null,
    questions: [
      {
        responseId: 'r1', number: 1, content: 'A car accelerates from rest to 20 m/s in 5 s. Find a and s.',
        marksAvailable: 4, subjective: true, state: 'AI_SUGGESTED',
        studentAnswer: 'a = 4 m/s^2, s = 100 m', ocrConfidence: 0.92, region, rubricCriteria: null,
        current: {
          source: 'AI', marksAwarded: 3, mistakeTagType: 'CALCULATION_ERROR', teacherComment: null, criterionScores: [],
          breakdown: { tags: [{ tag: 'FORMULA', maxMarks: 2, marksAwarded: 2 }, { tag: 'CALCULATION', maxMarks: 2, marksAwarded: 1 }] },
        },
        ai: {
          suggestedMarks: 3, confidence: 0.9, flags: ['no_reference_answer'],
          breakdown: { verdict: 'PARTIALLY_CORRECT', modelSolution: 's = 50 m', note: 'Arithmetic slip in s.', referenceUsed: false },
        },
      },
      {
        responseId: 'r2', number: 2, content: 'Define inertia.', marksAvailable: 5, subjective: true, state: 'ILLEGIBLE',
        studentAnswer: null, ocrConfidence: 0.3, region: null, rubricCriteria: null, current: null, ai: null,
      },
    ],
    ...overrides,
  };
}

const card = (n: number) => screen.getByText(`Q${n}.`).closest('div.rounded-2xl') as HTMLElement;
const submitButton = () => screen.getByRole('button', { name: /submit final marks/i });

describe('CheckedCopyReview', () => {
  beforeEach(() => {
    submitMutate.mockReset();
    aiMutate.mockReset();
    sheet = makeSheet();
  });

  it("shows the AI's tag-wise marks, its flags and its own solution", () => {
    render(<CheckedCopyReview attemptId="att-1" onBack={vi.fn()} />);
    const q1 = card(1);
    expect(within(q1).getByText('Formula', { selector: 'span' })).toBeTruthy();
    expect(within(q1).getByText('Calculation', { selector: 'span' })).toBeTruthy();
    expect(within(q1).getByText('No reference answer — AI solved it itself')).toBeTruthy();
    expect(within(q1).getByText(/AI note:/)).toBeTruthy();
    expect(within(card(2)).getByText('Unreadable — mark it yourself')).toBeTruthy();
  });

  it('will not submit until every answer has marks and the teacher has confirmed', () => {
    render(<CheckedCopyReview attemptId="att-1" onBack={vi.fn()} />);
    fireEvent.click(screen.getByRole('checkbox'));
    expect((submitButton() as HTMLButtonElement).disabled).toBe(true); // Q2 has no marks yet
    expect(screen.getByText(/Q2: Enter marks/)).toBeTruthy();

    fireEvent.change(within(card(2)).getByRole('spinbutton'), { target: { value: '4' } });
    // Editing after confirming un-ticks the confirmation — it must cover the final state.
    expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(false);
    fireEvent.click(screen.getByRole('checkbox'));
    expect((submitButton() as HTMLButtonElement).disabled).toBe(false);
  });

  it('submits the edited tag marks and the manual mark for every answer', () => {
    render(<CheckedCopyReview attemptId="att-1" onBack={vi.fn()} />);
    const [formula, calculation] = within(card(1)).getAllByRole('spinbutton');
    fireEvent.change(calculation!, { target: { value: '1.5' } });
    expect(within(card(1)).getByText('3.5')).toBeTruthy(); // 2 + 1.5
    fireEvent.change(within(card(2)).getByRole('spinbutton'), { target: { value: '4' } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(submitButton());

    expect(formula).toBeTruthy();
    expect(submitMutate).toHaveBeenCalledTimes(1);
    expect(submitMutate.mock.calls[0]![0]).toEqual({
      attemptId: 'att-1',
      confirmed: true,
      items: [
        {
          responseId: 'r1',
          tags: [{ tag: 'FORMULA', maxMarks: 2, marksAwarded: 2 }, { tag: 'CALCULATION', maxMarks: 2, marksAwarded: 1.5 }],
          mistakeTagType: 'CALCULATION_ERROR',
        },
        { responseId: 'r2', marksAwarded: 4 },
      ],
    });
  });

  it('flags a tag given more than it is worth and blocks the submit', () => {
    render(<CheckedCopyReview attemptId="att-1" onBack={vi.fn()} />);
    fireEvent.change(within(card(1)).getAllByRole('spinbutton')[0]!, { target: { value: '3' } });
    fireEvent.change(within(card(2)).getByRole('spinbutton'), { target: { value: '4' } });
    fireEvent.click(screen.getByRole('checkbox'));
    expect(within(card(1)).getByText('Formula allows 0–2')).toBeTruthy();
    expect((submitButton() as HTMLButtonElement).disabled).toBe(true);
  });

  it('a locked assessment cannot be edited or submitted', () => {
    sheet = makeSheet({ delivery: { id: 'del-1', status: 'LOCKED' } });
    render(<CheckedCopyReview attemptId="att-1" onBack={vi.fn()} />);
    expect(screen.getByText(/This assessment is locked/)).toBeTruthy();
    expect((submitButton() as HTMLButtonElement).disabled).toBe(true);
    expect((within(card(1)).getAllByRole('spinbutton')[0] as HTMLInputElement).disabled).toBe(true);
  });
});
