'use client';

import { useState } from 'react';
import { X, UploadCloud, FileImage, Trash2, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useUploadDocument } from '@/hooks/useApi';

interface UploadBookletModalProps {
  bundleId: string;
  onClose: () => void;
  onUploaded: () => void;
}

const MAX_PDF_BYTES = 25 * 1024 * 1024; // 25 MB per 23-DOCUMENT-PROCESSING-ARCHITECTURE
const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB per image
const MAX_PAGES = 60; // Max 60 pages per booklet

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function UploadBookletModal({ bundleId, onClose, onUploaded }: UploadBookletModalProps) {
  const uploadDocument = useUploadDocument();
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const validateAndAddFiles = (newFiles: File[]) => {
    setError(null);
    const combined = [...files, ...newFiles];

    const hasPdf = combined.some((f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
    const hasImage = combined.some((f) => f.type.startsWith('image/') || /\.(jpe?g|png|webp)$/i.test(f.name));

    if (hasPdf && hasImage) {
      const msg = 'Cannot mix PDF and image files. Please upload either a single PDF booklet or sequential page images.';
      setError(msg);
      toast.error(msg);
      return;
    }

    if (hasPdf && combined.filter((f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')).length > 1) {
      const msg = 'Upload one PDF per booklet. Multi-booklet batches should be uploaded as separate booklets.';
      setError(msg);
      toast.error(msg);
      return;
    }

    for (const f of combined) {
      const isPdf = f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf');
      if (isPdf && f.size > MAX_PDF_BYTES) {
        const msg = `"${f.name}" (${formatFileSize(f.size)}) exceeds the 25 MB PDF limit. Please compress or optimize the booklet PDF.`;
        setError(msg);
        toast.error(msg);
        return;
      }
      if (!isPdf && f.size > MAX_IMAGE_BYTES) {
        const msg = `Page "${f.name}" (${formatFileSize(f.size)}) exceeds the 10 MB limit per page.`;
        setError(msg);
        toast.error(msg);
        return;
      }
    }

    if (combined.length > MAX_PAGES) {
      const msg = `Cannot exceed ${MAX_PAGES} pages per booklet (currently ${combined.length} files selected).`;
      setError(msg);
      toast.error(msg);
      return;
    }

    setFiles(combined);
  };

  const handleFiles = (list: FileList | null) => {
    if (!list) return;
    validateAndAddFiles(Array.from(list));
  };

  // A PDF is the whole booklet; its pages are rendered server-side.
  const isPdfUpload = files.some((f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));

  const handleSubmit = async () => {
    if (files.length === 0) return;
    setError(null);
    try {
      await uploadDocument.mutateAsync({ bundleId, files });
      toast.success(
        isPdfUpload
          ? 'PDF booklet uploaded successfully. Page rendering started in background.'
          : `${files.length} page image(s) uploaded successfully.`
      );
      onUploaded();
      setFiles([]);
    } catch {
      setError(
        'Upload failed. Upload either page images (jpg/png/webp, max 10 MB each) or a single PDF booklet (max 25 MB, 60 pages), then try again.'
      );
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/65 backdrop-blur-md animate-fadein"
      role="dialog"
      aria-modal="true"
      aria-labelledby="upload-booklet-title"
    >
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg p-5 sm:p-6 space-y-5 max-h-[92vh] overflow-y-auto custom-scrollbar">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <h2 id="upload-booklet-title" className="text-[16px] font-bold text-slate-800">Upload a Booklet</h2>
              <p className="text-[12px] text-slate-500">One student&apos;s answer booklet: its page images, or a single PDF</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close upload dialog"
            className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-500 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <label
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            if (e.dataTransfer.files) {
              handleFiles(e.dataTransfer.files);
            }
          }}
          className={`flex flex-col items-center justify-center gap-2 p-7 sm:p-8 border-2 border-dashed rounded-2xl cursor-pointer transition-colors ${
            isDragging
              ? 'border-indigo-500 bg-indigo-50/60 ring-4 ring-indigo-500/20'
              : 'border-slate-300 hover:border-indigo-300 hover:bg-indigo-50/30'
          }`}
        >
          <UploadCloud className={`w-8 h-8 ${isDragging ? 'text-indigo-600' : 'text-slate-400'}`} />
          <span className="text-[13px] font-semibold text-slate-700 text-center">
            Click to browse or drop page images (JPG, PNG, WebP) or one PDF
          </span>
          <span className="text-[11px] text-slate-400 text-center">
            PDF max 25 MB (up to 60 pages) • Images max 10 MB per page
          </span>
          <input
            data-testid="booklet-file-input"
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </label>

        {files.length > 0 && (
          <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1">
              <span>Selected Files ({files.length})</span>
              <button
                type="button"
                onClick={() => setFiles([])}
                className="text-rose-600 hover:underline cursor-pointer"
              >
                Clear all
              </button>
            </div>
            {files.map((f, idx) => (
              <div
                key={`${f.name}-${idx}`}
                className="flex items-center justify-between px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl"
              >
                <div className="flex items-center gap-2 text-[12px] text-slate-700 truncate min-w-0">
                  <FileImage className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                  <span className="truncate">
                    {f.type === 'application/pdf' ? `PDF booklet: ${f.name}` : `Page ${idx + 1}: ${f.name}`}
                  </span>
                  <span className="text-[10.5px] text-slate-400 font-mono shrink-0">
                    ({formatFileSize(f.size)})
                  </span>
                </div>
                <button
                  type="button"
                  aria-label={`Remove ${f.name}`}
                  onClick={() => setFiles((prev) => prev.filter((_, i) => i !== idx))}
                  className="text-slate-400 hover:text-rose-600 p-1 rounded-md transition-colors cursor-pointer shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {isPdfUpload && files.length > 1 && (
          <p className="text-[12.5px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
            <span>Upload the PDF on its own — one PDF is one booklet.</span>
          </p>
        )}
        {isPdfUpload && files.length === 1 && (
          <div className="text-[12px] text-slate-600 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-indigo-600 mt-0.5" />
            <span>Pages are extracted and rendered server-side at 150 DPI. The booklet shows &ldquo;Page processing&rdquo; until ready.</span>
          </div>
        )}

        {error && (
          <div className="text-[12px] font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3.5 py-2.5 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex gap-3 pt-1">
          <button
            onClick={handleSubmit}
            disabled={files.length === 0 || uploadDocument.isPending || (isPdfUpload && files.length > 1)}
            className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white text-[13px] font-bold rounded-xl transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2 shadow-xs"
          >
            {uploadDocument.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Uploading booklet...</span>
              </>
            ) : isPdfUpload ? (
              'Upload PDF Booklet'
            ) : (
              `Upload ${files.length || ''} Page${files.length !== 1 ? 's' : ''}`
            )}
          </button>
          <button
            onClick={onClose}
            className="px-5 py-2.5 border border-slate-200 text-slate-600 hover:bg-slate-50 text-[13px] font-bold rounded-xl transition-colors cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
