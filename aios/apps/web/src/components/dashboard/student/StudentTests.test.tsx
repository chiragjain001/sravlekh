import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StudentTests } from './StudentTests';

const mockExams = [
  {
    id: 'exam-up-1',
    title: 'Physics Wave Optics Test',
    type: 'UNIT_TEST',
    status: 'PUBLISHED',
    scheduledDate: '2026-11-10T10:00:00Z',
    durationMinutes: 90,
    venue: 'Hall 3',
    batch: { name: 'Class 12A' },
    blueprint: { totalMarks: 50, subject: { name: 'Physics' } },
  },
];

const mockProfile = {
  scoreRecords: [
    {
      id: 'score-1',
      percentage: 86,
      obtainedMarks: 43,
      totalMarks: 50,
      rank: 4,
      evaluatedAt: '2026-10-20T14:00:00Z',
      createdAt: '2026-10-20T14:00:00Z',
      exam: {
        id: 'exam-eval-1',
        title: 'Mechanics & Laws of Motion Mid-Term',
        scheduledDate: '2026-10-18T09:00:00Z',
        type: 'SUBJECT_TEST',
        blueprint: {
          totalMarks: 50,
          subject: { name: 'Physics' },
        },
      },
    },
  ],
};

vi.mock('@/hooks/useApi', () => ({
  useExams: vi.fn(() => ({ data: { data: mockExams }, isPending: false })),
  useMyStudentProfile: vi.fn(() => ({ data: mockProfile, isPending: false })),
}));

describe('StudentTests Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders upcoming exams and past test results side-by-side', () => {
    render(<StudentTests />);

    expect(screen.getByText('My Tests')).toBeDefined();
    expect(screen.getByText('Physics Wave Optics Test')).toBeDefined();
    expect(screen.getByText(/Hall 3/i)).toBeDefined();
    expect(screen.getByText('Mechanics & Laws of Motion Mid-Term')).toBeDefined();
    expect(screen.getByText('86%')).toBeDefined();
  });

  it('opens score details modal and displays teacher evaluation verification guarantee', () => {
    render(<StudentTests />);

    // Click on past test card
    const examCard = screen.getByText('Mechanics & Laws of Motion Mid-Term');
    fireEvent.click(examCard);

    // Should display Teacher Evaluation Verification Guarantee banner
    expect(screen.getByText('Official Teacher-Verified Evaluation')).toBeDefined();
    expect(
      screen.getByText(/all marks shown are finalized by subject teachers/i)
    ).toBeDefined();

    // Displays verified score breakdown
    expect(screen.getByText('(43 / 50 marks)')).toBeDefined();
    expect(screen.getByText('Excellent')).toBeDefined();
  });

  it('displays evaluated questions breakdown with per-question marks and teacher notes', () => {
    render(<StudentTests />);

    // Click on exam card
    const examCard = screen.getByText('Mechanics & Laws of Motion Mid-Term');
    fireEvent.click(examCard);

    // Question breakdown is displayed
    expect(screen.getByText('Evaluated Questions Breakdown')).toBeDefined();
    expect(screen.getByText('Q1 • Short Answer')).toBeDefined();
    expect(screen.getByText('2 / 2 marks')).toBeDefined();
    expect(screen.getByText(/teacher note: correct concept & recoil formula/i)).toBeDefined();

    // Close modal
    const closeBtn = screen.getByRole('button', { name: /close test details/i });
    fireEvent.click(closeBtn);

    expect(screen.queryByText('Official Teacher-Verified Evaluation')).toBeNull();
  });
});

