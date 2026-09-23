'use client';

import { useState } from 'react';
import { X, UploadCloud, FileImage, Trash2 } from 'lucide-react';
import { useUploadDocument } from '@/hooks/useApi';

interface UploadBookletModalProps {
  bundleId: string;
  onClose: () => void;
  onUploaded: () => void;
}

export function UploadBookletModal({ bundleId, onClose, onUploaded }: UploadBookletModalProps) {
  const uploadDocument = useUploadDocument();
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleFiles = (list: FileList | null) => {
    if (!list) return;
    setFiles((prev) => [...prev, ...Array.from(list)]);
  };

  // A PDF is the whole booklet; its pages are rendered server-side.
  const isPdfUpload = files.some((f) => f.type === 'application/pdf');

  const handleSubmit = async () => {
    if (files.length === 0) return;
    setError(null);
    try {
      await uploadDocument.mutateAsync({ bundleId, files });
      onUploaded();
      setFiles([]);
    } catch {
      setError(
        'Upload failed. Upload either page images (jpg/png/webp, 10 MB each) or a single PDF booklet (25 MB, 60 pages), then try again.',
      );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/65 backdrop-blur-md animate-fadein">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-[16px] font-bold text-slate-800">Upload a Booklet</h2>
              <p className="text-[12px] text-slate-500">One student's answer booklet: its page images, or a single PDF</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-500">
            <X className="w-4 h-4" />
          </button>
        </div>

        <label className="flex flex-col items-center justify-center gap-2 p-8 border-2 border-dashed border-slate-300 rounded-2xl cursor-pointer hover:border-indigo-300 hover:bg-indigo-50/30 transition-colors">
          <UploadCloud className="w-8 h-8 text-slate-400" />
          <span className="text-[13px] font-semibold text-slate-600">Click to select page images (jpg, png, webp) or one PDF</span>
          <span className="text-[11px] text-slate-400">Select all pages for this booklet in order</span>
          <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
        </label>

        {files.length > 0 && (
          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {files.map((f, idx) => (
              <div key={idx} className="flex items-center justify-between px-3 py-2 bg-slate-50 border border-slate-100 rounded-lg">
                <span className="flex items-center gap-2 text-[12px] text-slate-700 truncate">
                  <FileImage className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                  {f.type === 'application/pdf' ? `PDF booklet: ${f.name}` : `Page ${idx + 1}: ${f.name}`}
                </span>
                <button type="button" onClick={() => setFiles((prev) => prev.filter((_, i) => i !== idx))} className="text-slate-400 hover:text-rose-600">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {isPdfUpload && files.length > 1 && (
          <p className="text-[12.5px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
            Upload the PDF on its own — one PDF is one booklet.
          </p>
        )}
        {isPdfUpload && files.length === 1 && (
          <p className="text-[12.5px] text-slate-600 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
            Its pages are rendered after upload; the booklet shows “Page processing” until they are ready.
          </p>
        )}

        {error && <p className="text-[12.5px] font-semibold text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">{error}</p>}

        <div className="flex gap-3">
          <button onClick={handleSubmit} disabled={files.length === 0 || uploadDocument.isPending}
            className="flex-1 py-2.5 bg-indigo-600 text-white text-[13px] font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-50">
            {uploadDocument.isPending
              ? 'Uploading…'
              : isPdfUpload
                ? 'Upload PDF booklet'
                : `Upload ${files.length || ''} Page${files.length !== 1 ? 's' : ''}`}
          </button>
          <button onClick={onClose} className="px-5 py-2.5 border border-slate-200 text-slate-600 text-[13px] font-bold rounded-xl hover:bg-slate-50">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
