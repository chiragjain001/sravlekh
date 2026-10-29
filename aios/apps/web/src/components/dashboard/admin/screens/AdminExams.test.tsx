import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { AdminExams } from './AdminExams';
import toast from 'react-hot-toast';

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/contexts/auth.context', () => ({
  useAuth: () => ({
    user: { id: 'admin-1', name: 'Super Admin', role: 'ADMIN', instituteId: 'inst-1' },
  }),
}));

const mockExams = [
  {
    id: 'exam-eval-1',
    title: 'Physics Mid-Term Evaluation',
    type: 'SUBJECT_TEST',
    status: 'EVALUATING',
    version: 3,
    scheduledDate: '2026-10-20T10:00:00Z',
    batch: { id: 'b-1', name: 'Class 10A' },
    blueprint: { id: 'bp-1', name: 'Physics Blueprint', totalMarks: 100, subject: { id: 's-1', name: 'Physics' } },
    papers: [],
  },
  {
    id: 'exam-published-2',
    title: 'Mathematics Unit Test',
    type: 'UNIT_TEST',
    status: 'PUBLISHED',
    version: 1,
    batch: { id: 'b-2', name: 'Class 12B' },
    blueprint: { id: 'bp-2', name: 'Math Blueprint', totalMarks: 50, subject: { id: 's-2', name: 'Mathematics' } },
    papers: [],
  },
];

const mockMutateStatus = vi.fn();

vi.mock('@/hooks/useApi', () => ({
  useExams: vi.fn(() => ({ data: { data: mockExams }, isPending: false, isError: false, refetch: vi.fn() })),
  useBatches: vi.fn(() => ({ data: [{ id: 'b-1', name: 'Class 10A' }] })),
  useSubjects: vi.fn(() => ({ data: [{ id: 's-1', name: 'Physics' }] })),
  useCreateExam: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useUpdateExamStatus: vi.fn(() => ({ mutate: mockMutateStatus, isPending: false })),
  useUnlockExam: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useDeleteExam: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useCandidatePapers: vi.fn(() => ({ data: [], isLoading: false })),
  useSelectOfficialPaper: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useRejectCandidatePaper: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useRequestPaperChanges: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  usePaper: vi.fn(() => ({ data: null, isLoading: false })),
  useExamResults: vi.fn((examId: string | null) => {
    if (examId === 'exam-eval-1') {
      return {
        data: {
          students: [
            { studentProfileId: 'st-1', name: 'Aarav Sharma', isFinalized: true },
            { studentProfileId: 'st-2', name: 'Rohan Verma', isFinalized: false },
          ],
        },
        isLoading: false,
      };
    }
    return { data: null, isLoading: false };
  }),
}));

describe('AdminExams Component & Exam Locking Gates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders examination operations console and lifecycle metrics', () => {
    render(<AdminExams />);

    expect(screen.getByRole('heading', { name: /^exams$/i })).toBeDefined();
    expect(screen.getAllByText('Physics Mid-Term Evaluation').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Evaluating').length).toBeGreaterThan(0);
  });

  it('blocks exam locking when unevaluated copies exist (SCHOOL_EXAM_LOCK_BLOCKED_UNEVALUATED)', () => {
    render(<AdminExams />);

    // Click Finalize & Lock action for the exam in EVALUATING status
    const lockActionBtns = screen.getAllByTitle('Finalize & Lock Results');
    expect(lockActionBtns.length).toBeGreaterThan(0);
    fireEvent.click(lockActionBtns[0]!);

    // LockExamModal opens and shows blocker banner
    const modal = screen.getByRole('dialog');
    expect(within(modal).getByText(/result locking blocked/i)).toBeDefined();
    expect(within(modal).getByText('SCHOOL_EXAM_LOCK_BLOCKED_UNEVALUATED')).toBeDefined();
    expect(within(modal).getByText(/incomplete evaluation detected/i)).toBeDefined();
    expect(within(modal).getByText(/per ai governance policy/i)).toBeDefined();
    expect(within(modal).getByText('Rohan Verma')).toBeDefined();
    expect(within(modal).getByText(/pending teacher review/i)).toBeDefined();

    // Finalize button should NOT be present in blocker modal
    expect(within(modal).queryByRole('button', { name: /finalize & lock results/i })).toBeNull();

    // Dismiss button returns safely
    const dismissBtn = within(modal).getByRole('button', { name: /dismiss & return to grading/i });
    fireEvent.click(dismissBtn);

    expect(screen.queryByText('SCHOOL_EXAM_LOCK_BLOCKED_UNEVALUATED')).toBeNull();
  });

  it('allows locking exam only when all copies are verified and confirmation is checked', async () => {
    const { useExamResults } = await import('@/hooks/useApi');
    vi.mocked(useExamResults).mockReturnValue({
      data: {
        students: [
          { studentProfileId: 'st-1', name: 'Aarav Sharma', isFinalized: true },
          { studentProfileId: 'st-2', name: 'Rohan Verma', isFinalized: true },
        ],
      },
      isLoading: false,
    } as any);

    render(<AdminExams />);

    const lockActionBtns = screen.getAllByTitle('Finalize & Lock Results');
    fireEvent.click(lockActionBtns[0]!);

    const modal = screen.getByRole('dialog');

    // Should show 100% complete
    expect(within(modal).getByText(/evaluation 100% complete/i)).toBeDefined();
    expect(within(modal).getByText(/all 2 student answer sheets have been evaluated/i)).toBeDefined();

    // Submit button should be disabled before checking confirmation
    const submitLockBtn = within(modal).getByRole('button', { name: /finalize & lock results/i });
    expect(submitLockBtn).toHaveProperty('disabled', true);

    // Check verification checkbox
    const checkbox = within(modal).getByRole('checkbox');
    fireEvent.click(checkbox);
    expect(submitLockBtn).toHaveProperty('disabled', false);

    // Click lock
    fireEvent.click(submitLockBtn);
    expect(mockMutateStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        examId: 'exam-eval-1',
        status: 'LOCKED',
      }),
      expect.any(Object)
    );
  });
});
