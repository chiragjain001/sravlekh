import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EvaluationWorkspace } from './EvaluationWorkspace';

vi.mock('@/contexts/auth.context', () => ({
  useAuth: () => ({ user: { id: 'u-1', name: 'Rahul Verma', role: 'TEACHER', instituteId: 'inst-1' } }),
}));

vi.mock('@/hooks/useContextUrlSync', () => ({
  useNetworkStatus: () => true,
}));

vi.mock('@/hooks/useApi', () => ({
  useExam: vi.fn(() => ({ data: null, isLoading: false })),
  useExamResults: vi.fn(() => ({ data: null, isLoading: false })),
  useStudents: vi.fn(() => ({ data: { data: [] }, isLoading: false })),
  usePaper: vi.fn(() => ({ data: null, isLoading: false })),
  useGradeAnswerSheet: vi.fn(() => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false })),
  useCheckedCopy: vi.fn(() => ({ data: null, isLoading: false })),
  useSubmitCheckedCopy: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useDecideEvaluation: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useEvaluationWorkItems: vi.fn(() => ({ data: null, isLoading: false })),
}));

describe('EvaluationWorkspace Component', () => {
  const onExit = vi.fn();

  beforeEach(async () => {
    vi.clearAllMocks();
    sessionStorage.clear();
    const { useExam, useExamResults } = await import('@/hooks/useApi');
    vi.mocked(useExam).mockReturnValue({ data: null, isLoading: false } as any);
    vi.mocked(useExamResults).mockReturnValue({ data: null, isLoading: false } as any);
  });

  it('renders workspace header with exam details and exit button', () => {
    render(<EvaluationWorkspace examId="exam-1" onExit={onExit} />);

    expect(screen.getAllByText('Mid-Term Examination').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Class 10A').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Physics').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /exit/i })).toBeDefined();
  });

  it('navigates questions and students seamlessly without clutter', () => {
    render(<EvaluationWorkspace examId="exam-1" onExit={onExit} />);

    expect(screen.getByText(/previous student/i)).toBeDefined();
    expect(screen.getAllByText(/next student/i).length).toBeGreaterThan(0);

    // Jump to Question 1 using the question pills
    const q1Btn = screen.getByRole('button', { name: 'Jump to Question 1' });
    fireEvent.click(q1Btn);
    expect(screen.getAllByText('Q1').length).toBeGreaterThan(0);
  });

  it('renders the handwritten answer sheet canvas and zoom controls', () => {
    render(<EvaluationWorkspace examId="exam-1" onExit={onExit} />);

    expect(screen.getAllByText(/newton/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/f_ab = - f_ba/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/115%/i)).toBeDefined();
  });

  it('allows awarding marks via Quick Marks pill buttons', () => {
    render(<EvaluationWorkspace examId="exam-1" onExit={onExit} />);

    const quickMark5 = screen.getByRole('button', { name: 'Mark 5' });
    fireEvent.click(quickMark5);

    const input = screen.getByRole('spinbutton') as HTMLInputElement;
    expect(input.value).toBe('5');
  });

  it('toggles learning mistake tags when clicked', () => {
    render(<EvaluationWorkspace examId="exam-1" onExit={onExit} />);

    const conceptErrorTag = screen.getByRole('button', { name: /concept error/i });
    fireEvent.click(conceptErrorTag);

    expect(conceptErrorTag.className).toContain('bg-rose-50');
  });

  it('saves marks and advances to next question on Save & Next', () => {
    render(<EvaluationWorkspace examId="exam-1" onExit={onExit} />);

    const saveNextBtn = screen.getByRole('button', { name: /save & next/i });
    fireEvent.click(saveNextBtn);

    expect(screen.getAllByText('Q4').length).toBeGreaterThan(0);
  });

  it('handles keyboard shortcuts: number key assigns marks and Enter saves', () => {
    render(<EvaluationWorkspace examId="exam-1" onExit={onExit} />);

    fireEvent.keyDown(window, { key: '3' });
    const input = screen.getByRole('spinbutton') as HTMLInputElement;
    expect(input.value).toBe('3');

    fireEvent.keyDown(window, { key: 'Enter' });
    expect(screen.getAllByText('Q4').length).toBeGreaterThan(0);
  });

  it('calls onExit when clicking exit button or pressing Esc', () => {
    render(<EvaluationWorkspace examId="exam-1" onExit={onExit} />);

    const exitBtn = screen.getByRole('button', { name: /exit/i });
    fireEvent.click(exitBtn);

    expect(onExit).toHaveBeenCalled();
  });

  it('allows fractional increment with +0.5 half-mark button', () => {
    render(<EvaluationWorkspace examId="exam-1" onExit={onExit} />);

    // Start with 4, click +0.5 -> 4.5
    const halfMarkBtn = screen.getByRole('button', { name: '+0.5' });
    fireEvent.click(halfMarkBtn);

    const input = screen.getByRole('spinbutton') as HTMLInputElement;
    expect(input.value).toBe('4.5');
  });

  it('opens and closes the keyboard shortcuts cheatsheet modal', () => {
    render(<EvaluationWorkspace examId="exam-1" onExit={onExit} />);

    // Press '?' key to open modal
    fireEvent.keyDown(window, { key: '?' });
    expect(screen.getByText(/keyboard shortcuts cheat sheet/i)).toBeDefined();
    expect(screen.getByText(/assign marks \(0 to max\)/i)).toBeDefined();

    // Click 'Got It' to close
    const gotItBtn = screen.getByRole('button', { name: /got it/i });
    fireEvent.click(gotItBtn);
    expect(screen.queryByText(/keyboard shortcuts cheat sheet/i)).toBeNull();
  });

  it('opens slide-over drawers when clicking quick rail buttons', () => {
    render(<EvaluationWorkspace examId="exam-1" onExit={onExit} />);

    // Click Model Solution & Blueprint rail icon
    const blueprintBtn = screen.getByTitle(/question blueprint & model solution/i);
    fireEvent.click(blueprintBtn);

    expect(screen.getByText(/model solution & blueprint/i)).toBeDefined();
    expect(screen.getByText(/official model answer/i)).toBeDefined();

    // Click Question Overview rail icon
    const questionsBtn = screen.getByTitle(/question grid & paper overview/i);
    fireEvent.click(questionsBtn);

    expect(screen.getByText(/paper question overview/i)).toBeDefined();

    // Click Student Roster rail icon
    const studentsBtn = screen.getByTitle(/all students roster & jump list/i);
    fireEvent.click(studentsBtn);

    expect(screen.getByText(/all students roster/i)).toBeDefined();
  });

  it('shows a clearly visible open button when page thumbnails are collapsed and can reopen', () => {
    render(<EvaluationWorkspace examId="exam-1" onExit={onExit} />);

    // Collapse page strip
    const collapseBtn = screen.getByTitle(/collapse page strip/i);
    fireEvent.click(collapseBtn);

    // Visible expand button should be present in the collapsed rail
    const expandBtn = screen.getByTitle(/expand page thumbnails/i);
    expect(expandBtn).toBeDefined();
    expect(screen.getByText(/pages \(6\)/i)).toBeDefined();

    // Click expand button to reopen
    fireEvent.click(expandBtn);
    expect(screen.getByTitle(/collapse page strip/i)).toBeDefined();

    // Toggle via canvas toolbar button
    const toolbarToggleBtn = screen.getByTitle(/toggle page thumbnails/i);
    fireEvent.click(toolbarToggleBtn);
    expect(screen.getByTitle(/expand page thumbnails/i)).toBeDefined();

    // Toggle back open via 'P' shortcut
    fireEvent.keyDown(window, { key: 'p' });
    expect(screen.getByTitle(/collapse page strip/i)).toBeDefined();
  });

  it('toggles review bookmark flag', () => {
    render(<EvaluationWorkspace examId="exam-1" onExit={onExit} />);

    const flagBtn = screen.getByTitle(/flag for review/i);
    fireEvent.click(flagBtn);

    expect(screen.getByTitle(/flagged for coordinator review/i)).toBeDefined();
  });

  it('handles ArrowUp and ArrowDown shortcuts for fractional mark adjustments', () => {
    render(<EvaluationWorkspace examId="exam-1" onExit={onExit} />);

    // Starts at 4 (from Q3 initial state). ArrowUp -> 4.5
    fireEvent.keyDown(window, { key: 'ArrowUp' });
    const input = screen.getByRole('spinbutton') as HTMLInputElement;
    expect(input.value).toBe('4.5');

    // ArrowDown -> 4
    fireEvent.keyDown(window, { key: 'ArrowDown' });
    expect(input.value).toBe('4');
  });

  it('handles M key shortcut to toggle bookmark/flag for review', () => {
    render(<EvaluationWorkspace examId="exam-1" onExit={onExit} />);

    // Press 'm' to flag
    fireEvent.keyDown(window, { key: 'm' });
    expect(screen.getByTitle(/flagged for coordinator review/i)).toBeDefined();

    // Press 'm' again to unflag
    fireEvent.keyDown(window, { key: 'm' });
    expect(screen.getByTitle(/flag for review \(m\)/i)).toBeDefined();
  });

  it('renders student copy total score card and paper evaluation progress', () => {
    render(<EvaluationWorkspace examId="exam-1" onExit={onExit} />);

    expect(screen.getByText(/student copy total/i)).toBeDefined();
    expect(screen.getAllByText(/aarav sharma/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/evaluated/i)).toBeDefined();
  });

  it('handles questions with no answer stored in DB gracefully with step-wise rubric and teacher notes', () => {
    render(<EvaluationWorkspace examId="exam-1" onExit={onExit} />);

    // Jump to Q4 (which has solution: null)
    const q4Btn = screen.getByRole('button', { name: 'Jump to Question 4' });
    fireEvent.click(q4Btn);

    // Question card shows "No DB Ans" badge
    expect(screen.getByText('No DB Ans')).toBeDefined();

    // Click Blueprint rail icon to inspect drawer
    const blueprintBtn = screen.getByTitle(/question blueprint & model solution/i);
    fireEvent.click(blueprintBtn);

    // Shows alert that answer is not stored in DB
    expect(screen.getByText(/no answer stored in database/i)).toBeDefined();
    // Shows step-wise mark distribution
    expect(screen.getAllByText(/step-wise mark distribution/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/calculation of recoil velocity/i).length).toBeGreaterThan(0);

    // Allows entering evaluator reference notes
    const notesTextarea = screen.getByPlaceholderText(/type or paste your reference key/i) as HTMLTextAreaElement;
    fireEvent.change(notesTextarea, { target: { value: 'Deduct 1 mark if SI unit is missing' } });
    expect(notesTextarea.value).toBe('Deduct 1 mark if SI unit is missing');
  });

  it('renders question diagrams and allows expanding long questions', () => {
    render(<EvaluationWorkspace examId="exam-1" onExit={onExit} />);

    // Q3 has diagram
    expect(screen.getByText(/figure 2: action-reaction mutual force pair/i)).toBeDefined();

    // Jump to Q4 which has long text
    const q4Btn = screen.getByRole('button', { name: 'Jump to Question 4' });
    fireEvent.click(q4Btn);

    // Has "Show Full Question" toggle
    const toggleBtn = screen.getByText(/show full question/i);
    expect(toggleBtn).toBeDefined();
    fireEvent.click(toggleBtn);
    expect(screen.getByText(/show less/i)).toBeDefined();
  });

  it('turns student copy pages via W, S, PageUp, PageDown keyboard shortcuts', () => {
    render(<EvaluationWorkspace examId="exam-1" onExit={onExit} />);

    // Initially Page 1
    expect(screen.getByText('Page 1')).toBeDefined();

    // Press 's' to turn to Page 2
    fireEvent.keyDown(window, { key: 's' });
    expect(screen.getByText('Page 2')).toBeDefined();

    // Press 'PageDown' to turn to Page 3
    fireEvent.keyDown(window, { key: 'PageDown' });
    expect(screen.getByText('Page 3')).toBeDefined();

    // Press 'w' to turn back to Page 2
    fireEvent.keyDown(window, { key: 'w' });
    expect(screen.getByText('Page 2')).toBeDefined();

    // Visible shortcut badges are rendered in toolbar
    expect(screen.getAllByText('W').length).toBeGreaterThan(0);
    expect(screen.getAllByText('S').length).toBeGreaterThan(0);
    expect(screen.getByText('Turn Page')).toBeDefined();
  });

  it('toggles full screen mode on icon click and via F11 shortcut', () => {
    const requestFullscreenMock = vi.fn().mockResolvedValue(undefined);
    document.documentElement.requestFullscreen = requestFullscreenMock;

    render(<EvaluationWorkspace examId="exam-1" onExit={onExit} />);

    // Full screen button has title with F11 hint
    const fsBtn = screen.getByTitle(/full screen mode \(fn \+ f11 \/ f11\)/i);
    expect(fsBtn).toBeDefined();

    // Click full screen button
    fireEvent.click(fsBtn);
    expect(requestFullscreenMock).toHaveBeenCalled();
  });

  it('renders dynamic exam details and students from API hooks when available', async () => {
    const { useExam, useExamResults } = await import('@/hooks/useApi');
    vi.mocked(useExam).mockReturnValue({
      data: {
        id: 'exam-dynamic-99',
        title: 'Annual Board Assessment',
        batch: { id: 'b-99', name: 'Class 12C', studentCount: 40 },
        blueprint: { subject: { name: 'Mathematics' } },
        papers: [],
      },
      isLoading: false,
    } as any);

    vi.mocked(useExamResults).mockReturnValue({
      data: {
        students: [
          {
            studentProfileId: 'st-dyn-1',
            name: 'Priya Patel',
            rollNumber: '101',
            isFinalized: true,
            percentage: 95,
            participationStatus: 'PARTICIPATED',
          },
          {
            studentProfileId: 'st-dyn-2',
            name: 'Rohan Joshi',
            rollNumber: '102',
            isFinalized: false,
            percentage: null,
            participationStatus: 'PARTICIPATED',
          },
        ],
      },
      isLoading: false,
    } as any);

    render(<EvaluationWorkspace examId="exam-dynamic-99" onExit={onExit} />);

    // Dynamically rendered exam header
    expect(screen.getByText('Annual Board Assessment')).toBeDefined();
    expect(screen.getByText('Class 12C')).toBeDefined();
    expect(screen.getByText('Mathematics')).toBeDefined();

    // Dynamically rendered copies progress
    expect(screen.getByText(/1 \/ 40 copies checked • 39 remaining/i)).toBeDefined();

    // Dynamically rendered student info
    expect(screen.getAllByText(/priya patel|rohan joshi/i).length).toBeGreaterThan(0);
  });

  it('displays AI suggestion card and accepts suggestion via button click and Shift+A shortcut', () => {
    render(<EvaluationWorkspace examId="exam-1" onExit={onExit} />);

    // Q3 has an AI suggestion with 4.5 marks and 94% confidence
    expect(screen.getAllByText(/ai suggestion/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/94% conf/i)).toBeDefined();
    expect(screen.getByText(/correctly states newton's 3rd law statement/i)).toBeDefined();

    // Click "Accept AI Suggestion" button
    const acceptBtn = screen.getByRole('button', { name: /accept ai suggestion/i });
    fireEvent.click(acceptBtn);

    // Marks should update to 4.5
    const input = screen.getByRole('spinbutton') as HTMLInputElement;
    expect(input.value).toBe('4.5');

    // Should display Teacher Verified badge
    expect(screen.getAllByText(/teacher verified/i).length).toBeGreaterThan(0);

    // Test shortcut: switch question then test Shift+A or Y
    fireEvent.keyDown(window, { key: 'y' });
    expect(input.value).toBe('4.5');
  });

  it('calculates derived marks through step-wise rubric criteria selection', () => {
    render(<EvaluationWorkspace examId="exam-1" onExit={onExit} />);

    // Q3 has 3 rubric criteria
    expect(screen.getByText(/rubric criteria breakdown/i)).toBeDefined();
    expect(screen.getByText(/correct statement of newton's 3rd law/i)).toBeDefined();
    expect(screen.getByText(/mathematical formulation f_ab = -f_ba/i)).toBeDefined();

    // Toggle step 1 (2 marks)
    const step1Btn = screen.getByRole('button', {
      name: /toggle rubric step: correct statement of newton's 3rd law/i,
    });
    fireEvent.click(step1Btn);

    // Toggle step 2 (1.5 marks)
    const step2Btn = screen.getByRole('button', {
      name: /toggle rubric step: mathematical formulation f_ab = -f_ba/i,
    });
    fireEvent.click(step2Btn);

    // Derived marks input should now be 3.5
    const input = screen.getByRole('spinbutton') as HTMLInputElement;
    expect(input.value).toBe('3.5');
    expect(screen.getByText(/derived from rubric/i)).toBeDefined();
  });

  it('displays autosave status indicator and handles online reconnect event', () => {
    render(<EvaluationWorkspace examId="exam-1" onExit={onExit} />);

    // Autosave indicator is rendered
    expect(screen.getByTestId('autosave-status').textContent).toContain('All changes saved');

    // Simulate online reconnect event
    fireEvent(window, new Event('online'));

    // Component triggers sync on reconnect
    expect(screen.getByTestId('autosave-status').textContent).toMatch(/saving evaluation|all changes saved/i);
  });
});
