import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EvaluationDesk } from './EvaluationDesk';

vi.mock('@/contexts/auth.context', () => ({
  useAuth: () => ({ user: { id: 'u-1', name: 'Rahul Verma', role: 'TEACHER', instituteId: 'inst-1' } }),
}));

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    invalidateQueries: vi.fn(),
  }),
}));

const mockExams = [
  {
    id: 'exam-1',
    title: 'Mid-Term Examination',
    blueprint: { name: 'Unit 1, 2, 3', subject: { name: 'Physics' } },
    batch: { name: 'Class 10A', studentCount: 60 },
    scheduledDate: '2024-11-15T10:00:00Z',
    status: 'IN_PROGRESS',
    answerSheets: new Array(58).fill({ id: 'as' }),
    scoreRecords: new Array(45).fill({ isFinalized: true }),
  },
  {
    id: 'exam-2',
    title: 'Quarterly Examination',
    blueprint: { name: 'Full Syllabus', subject: { name: 'Mathematics' } },
    batch: { name: 'Class 12', studentCount: 80 },
    scheduledDate: '2024-11-10T09:00:00Z',
    status: 'COMPLETED',
    answerSheets: new Array(80).fill({ id: 'as' }),
    scoreRecords: new Array(80).fill({ isFinalized: true }),
  },
];

vi.mock('@/hooks/useApi', () => ({
  useExams: () => ({ data: { data: mockExams }, isLoading: false, isFetching: false }),
  useAssessments: () => ({ data: [], isLoading: false }),
  useBatches: () => ({ data: [{ id: 'b-1', name: 'Class 10A' }, { id: 'b-2', name: 'Class 12' }] }),
  useSubjects: () => ({ data: [{ id: 's-1', name: 'Physics' }, { id: 's-2', name: 'Mathematics' }] }),
  useStudents: () => ({
    data: {
      data: [
        { id: 'st-1', rollNumber: '101', user: { name: 'Aarav Sharma' } },
        { id: 'st-2', rollNumber: '102', user: { name: 'Rohan Verma' } },
      ],
    },
    isLoading: false,
  }),
  useIdentityResolutions: () => ({
    data: [
      {
        id: 'res-1',
        serialNumber: 'BK-90214',
        examTitle: 'Organic Chemistry Test • Class 11B',
        issueType: 'QR_DAMAGED',
        issueLabel: 'QR Damaged / Unreadable',
        detectedName: 'Rohan Sharma',
        detectedRoll: '14',
        confidence: 0.62,
        status: 'PENDING',
      },
    ],
    refetch: vi.fn(),
  }),
  useConfirmIdentity: () => ({ mutate: vi.fn(), isPending: false }),
  useCreateDocumentBundle: () => ({ mutate: vi.fn(), isPending: false }),
  useUploadDocument: () => ({ mutate: vi.fn(), isPending: false }),
}));

describe('EvaluationDesk Component', () => {
  const onOpenWorkspace = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders page header and metric cards with computed counts', () => {
    render(<EvaluationDesk onOpenWorkspace={onOpenWorkspace} />);

    expect(screen.getByText('Evaluation Desk')).toBeDefined();
    expect(screen.getByText('Active Examinations')).toBeDefined();
    expect(screen.getByText('Total Copies')).toBeDefined();
    expect(screen.getByText('Checked')).toBeDefined();
    expect(screen.getByText('Pending')).toBeDefined();
    expect(screen.getAllByText('Needs Attention').length).toBeGreaterThan(0);
  });

  it('renders examination list with title, class, and progress', () => {
    render(<EvaluationDesk onOpenWorkspace={onOpenWorkspace} />);

    expect(screen.getAllByText('Mid-Term Examination').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Quarterly Examination').length).toBeGreaterThan(0);
  });

  it('navigates to workspace when clicking Continue Checking', () => {
    render(<EvaluationDesk onOpenWorkspace={onOpenWorkspace} />);

    const continueBtn = screen.getByRole('button', { name: /continue checking/i });
    fireEvent.click(continueBtn);

    expect(onOpenWorkspace).toHaveBeenCalledWith('exam-1', 'student-wise');
  });

  it('filters examinations when typing in the search box', () => {
    render(<EvaluationDesk onOpenWorkspace={onOpenWorkspace} />);

    const searchInput = screen.getByPlaceholderText(/search examinations/i);
    fireEvent.change(searchInput, { target: { value: 'Quarterly' } });

    expect(screen.getAllByText('Quarterly Examination').length).toBeGreaterThan(0);
    expect(screen.queryByText('Unit 1, 2, 3')).toBeNull();
  });

  it('renders Quick Upload and Recent Uploads sections', () => {
    render(<EvaluationDesk onOpenWorkspace={onOpenWorkspace} />);

    expect(screen.getByText(/quick upload scanned copies/i)).toBeDefined();
    expect(screen.getByText(/recent uploads & processing/i)).toBeDefined();
    expect(screen.getByText(/drag & drop pdf files here/i)).toBeDefined();
  });

  it('opens identity resolution modal when clicking Needs Attention card', () => {
    render(<EvaluationDesk onOpenWorkspace={onOpenWorkspace} />);

    const needsAttentionElements = screen.getAllByText('Needs Attention');
    const cardTitle = needsAttentionElements.find((el) => el.tagName === 'P');
    expect(cardTitle).toBeDefined();
    fireEvent.click(cardTitle!.closest('div.cursor-pointer')!);

    expect(screen.getByText(/resolve identity mapping issues/i)).toBeDefined();
  });

  it('allows resolving identity conflicts by selecting candidate student and confirming match', () => {
    render(<EvaluationDesk onOpenWorkspace={onOpenWorkspace} />);

    // Open identity resolution modal
    const needsAttentionElements = screen.getAllByText('Needs Attention');
    const cardTitle = needsAttentionElements.find((el) => el.tagName === 'P');
    fireEvent.click(cardTitle!.closest('div.cursor-pointer')!);

    // Should see conflict items
    expect(screen.getByText(/resolve identity mapping issues/i)).toBeDefined();
    expect(screen.getByText(/qr damaged \/ unreadable/i)).toBeDefined();

    // Select candidate student from dropdown
    const select = screen.getByDisplayValue('-- Select matching student --');
    fireEvent.change(select, { target: { value: 'st-1' } });

    // Click Confirm button
    const confirmBtns = screen.getAllByRole('button', { name: /confirm/i });
    expect(confirmBtns.length).toBeGreaterThan(0);
    fireEvent.click(confirmBtns[0]!);
  });
});
