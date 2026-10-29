import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { StudentWeakTopics } from './StudentWeakTopics';

vi.mock('@/store/dashboard-store', () => ({
  useDashboardStore: () => ({
    setStudentActiveNav: vi.fn(),
  }),
}));

vi.mock('@/hooks/useApi', () => ({
  useMyStudentProfile: () => ({
    data: {
      masteryScores: [
        {
          id: 'score-1',
          masteryValue: 35,
          trend: -5,
          topic: { name: 'Thermodynamics Laws' },
          subject: { name: 'Physics' },
        },
        {
          id: 'score-2',
          masteryValue: 65,
          trend: 8,
          topic: { name: 'Integration by Parts' },
          subject: { name: 'Mathematics' },
        },
      ],
    },
    isPending: false,
  }),
}));

describe('StudentWeakTopics Screen', () => {
  it('renders teacher-verified diagnostic mastery banner and assurance', () => {
    render(<StudentWeakTopics />);

    expect(screen.getByText('Teacher-Verified Diagnostic Mastery')).toBeDefined();
    expect(
      screen.getByText(/calculated exclusively from teacher-evaluated assessments/i)
    ).toBeDefined();
    expect(
      screen.getByText(/unreviewed ai suggestions never affect your academic standing/i)
    ).toBeDefined();
  });

  it('expands mastery guide with priority benchmarks on click', () => {
    render(<StudentWeakTopics />);

    const guideBtn = screen.getByRole('button', { name: /mastery guide/i });
    expect(screen.queryByText(/Critical conceptual gaps requiring immediate revision/i)).toBeNull();

    fireEvent.click(guideBtn);

    expect(screen.getByText(/High Priority \(<40%\)/i)).toBeDefined();
    expect(screen.getByText(/Critical conceptual gaps requiring immediate revision/i)).toBeDefined();
    expect(screen.getByText(/Moderate \(40% – 69%\)/i)).toBeDefined();
    expect(screen.getByText(/Good Standing \(≥70%\)/i)).toBeDefined();

    // Toggle back
    fireEvent.click(screen.getByRole('button', { name: /hide guide/i }));
    expect(screen.queryByText(/Critical conceptual gaps requiring immediate revision/i)).toBeNull();
  });

  it('renders student weak topics with correct priority chips', () => {
    render(<StudentWeakTopics />);

    expect(screen.getByText('Thermodynamics Laws')).toBeDefined();
    expect(screen.getByText('Integration by Parts')).toBeDefined();
    expect(screen.getByText('High Priority')).toBeDefined();
    expect(screen.getByText('Moderate')).toBeDefined();
  });
});
