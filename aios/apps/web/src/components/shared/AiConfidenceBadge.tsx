'use client';
// ─── Honest AI-confidence disclosure — every "confidence" number surfaced
// anywhere in this app (OCR transcription, AI-suggested evaluation marks) is
// the underlying model's own self-report, not a calibrated accuracy metric.
// The backend code has always said so in comments; this is the one place
// that says so where a teacher can actually see it, instead of a bare green
// badge that reads as more certain than it is (audit-flagged).

import { Info } from 'lucide-react';

export function AiConfidenceBadge({ confidence, label = 'AI' }: { confidence: number; label?: string }) {
  const pct = Math.round(confidence * 100);
  const tone =
    confidence >= 0.85 ? 'bg-emerald-100 text-emerald-700'
    : confidence >= 0.5 ? 'bg-amber-100 text-amber-700'
    : 'bg-rose-100 text-rose-700';

  return (
    <span
      className={`inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded ${tone}`}
      title="Self-reported by the model, not a calibrated confidence score — treat as a rough signal, not a guarantee."
    >
      {label} {pct}%
      <Info className="w-2.5 h-2.5 opacity-60" />
    </span>
  );
}
