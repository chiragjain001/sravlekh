import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PrintBookletsModal } from './PrintBookletsModal';
import toast from 'react-hot-toast';

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/contexts/auth.context', () => ({
  useAuth: () => ({ user: { id: 'u-1', name: 'Admin User', role: 'ADMIN' } }),
}));

const mockPrintRuns = [
  {
    id: 'pr-1',
    startSerial: '0001',
    endSerial: '0040',
    count: 40,
    status: 'READY',
    createdAt: '2026-10-25T10:00:00Z',
  },
];

const mockMutateAsync = vi.fn().mockResolvedValue({
  startSerial: '0041',
  endSerial: '0080',
  count: 40,
});

vi.mock('@/hooks/useApi', () => ({
  useBookletPrintRuns: vi.fn(() => ({
    data: mockPrintRuns,
    isLoading: false,
  })),
  useCreateBookletPrintRun: vi.fn(() => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  })),
  downloadBookletPrintRunPdf: vi.fn().mockResolvedValue(new Blob(['pdf content'], { type: 'application/pdf' })),
}));

describe('PrintBookletsModal Component', () => {
  const onClose = vi.fn();
  const exam = {
    id: 'exam-1',
    title: 'Mid-Term Examination',
    batch: { name: 'Class 10A' },
    assessmentDeliveryId: 'del-1',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders modal with exam metadata, printing guidelines, and existing runs', () => {
    render(<PrintBookletsModal exam={exam} onClose={onClose} />);

    expect(screen.getByText('Print Answer Sheet Booklets')).toBeDefined();
    expect(screen.getByText(/Mid-Term Examination/i)).toBeDefined();
    expect(screen.getByText(/standard a4/i)).toBeDefined();
    expect(screen.getByText(/corner fiducial/i)).toBeDefined();
    expect(screen.getByText(/#0001 – #0040/i)).toBeDefined();
  });

  it('creates a new booklet print run and triggers toast notification', async () => {
    render(<PrintBookletsModal exam={exam} onClose={onClose} />);

    const countInput = screen.getByRole('spinbutton') as HTMLInputElement;
    fireEvent.change(countInput, { target: { value: '40' } });

    const generateBtn = screen.getByRole('button', { name: /generate booklets/i });
    fireEvent.click(generateBtn);

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({ count: 40 });
      expect(toast.success).toHaveBeenCalledWith(
        expect.stringMatching(/successfully generated 40 booklets \(#0041 – #0080\)/i)
      );
    });
  });

  it('calls onClose when close button is clicked', () => {
    render(<PrintBookletsModal exam={exam} onClose={onClose} />);

    const closeBtn = screen.getByRole('button', { name: /close booklet printing modal/i });
    fireEvent.click(closeBtn);

    expect(onClose).toHaveBeenCalled();
  });
});
