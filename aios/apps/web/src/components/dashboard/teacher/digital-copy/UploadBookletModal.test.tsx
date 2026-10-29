import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { UploadBookletModal } from './UploadBookletModal';
import toast from 'react-hot-toast';

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/hooks/useApi', () => ({
  useUploadDocument: () => ({
    mutateAsync: vi.fn().mockResolvedValue({ id: 'doc-1' }),
    isPending: false,
  }),
}));

describe('UploadBookletModal Component', () => {
  const onClose = vi.fn();
  const onUploadSuccess = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders modal dialog with instructions, limits and file dropzone', () => {
    render(
      <UploadBookletModal
        bundleId="bundle-1"
        onClose={onClose}
        onUploaded={onUploadSuccess}
      />
    );

    expect(screen.getByText('Upload a Booklet')).toBeDefined();
    expect(screen.getByText(/one student's answer booklet/i)).toBeDefined();
    expect(screen.getByText(/click to browse or drop page images/i)).toBeDefined();
    expect(screen.getByText(/pdf max 25 mb/i)).toBeDefined();
  });

  it('rejects PDF files exceeding the 25 MB limit', () => {
    render(
      <UploadBookletModal
        bundleId="bundle-1"
        onClose={onClose}
        onUploaded={onUploadSuccess}
      />
    );

    // 26 MB file
    const oversizedPdf = new File(['x'.repeat(100)], 'huge-exam.pdf', {
      type: 'application/pdf',
    });
    Object.defineProperty(oversizedPdf, 'size', { value: 26 * 1024 * 1024 });

    const input = screen.getByTestId('booklet-file-input') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [oversizedPdf] } });

    expect(toast.error).toHaveBeenCalledWith(
      expect.stringMatching(/exceeds the 25 MB PDF limit/i)
    );
  });

  it('rejects image files exceeding the 10 MB limit', () => {
    render(
      <UploadBookletModal
        bundleId="bundle-1"
        onClose={onClose}
        onUploaded={onUploadSuccess}
      />
    );

    // 12 MB image
    const oversizedImage = new File(['x'.repeat(100)], 'page1.png', {
      type: 'image/png',
    });
    Object.defineProperty(oversizedImage, 'size', { value: 12 * 1024 * 1024 });

    const input = screen.getByTestId('booklet-file-input') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [oversizedImage] } });

    expect(toast.error).toHaveBeenCalledWith(
      expect.stringMatching(/exceeds the 10 MB limit per page/i)
    );
  });

  it('rejects mixing PDF files with individual page images', () => {
    render(
      <UploadBookletModal
        bundleId="bundle-1"
        onClose={onClose}
        onUploaded={onUploadSuccess}
      />
    );

    const pdfFile = new File(['test'], 'booklet.pdf', { type: 'application/pdf' });
    Object.defineProperty(pdfFile, 'size', { value: 2 * 1024 * 1024 });

    const imgFile = new File(['test'], 'page1.jpg', { type: 'image/jpeg' });
    Object.defineProperty(imgFile, 'size', { value: 1 * 1024 * 1024 });

    const input = screen.getByTestId('booklet-file-input') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [pdfFile, imgFile] } });

    expect(toast.error).toHaveBeenCalledWith(
      expect.stringMatching(/cannot mix pdf and image files/i)
    );
  });

  it('accepts valid PDF booklet and displays file summary', () => {
    render(
      <UploadBookletModal
        bundleId="bundle-1"
        onClose={onClose}
        onUploaded={onUploadSuccess}
      />
    );

    const validPdf = new File(['valid pdf content'], 'class10-physics.pdf', {
      type: 'application/pdf',
    });
    Object.defineProperty(validPdf, 'size', { value: 5 * 1024 * 1024 });

    const input = screen.getByTestId('booklet-file-input') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [validPdf] } });

    expect(screen.getByText(/PDF booklet: class10-physics\.pdf/i)).toBeDefined();
    expect(screen.getByText(/\(5\.0 MB\)/i)).toBeDefined();
    expect(screen.getByRole('button', { name: /upload pdf booklet/i })).toBeDefined();
  });
});
