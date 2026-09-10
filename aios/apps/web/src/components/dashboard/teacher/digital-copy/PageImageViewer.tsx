'use client';

import { useRef, useState } from 'react';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';

export interface ViewerRegion {
  id: string;
  boundingBox: { x: number; y: number; width: number; height: number };
  regionType: string;
  questionId?: string | null;
  label?: string;
}

interface PageImageViewerProps {
  imageUrl: string;
  regions: ViewerRegion[];
  selectedRegionId?: string | null;
  onSelectRegion?: (id: string) => void;
  onDrawRegion?: (box: { x: number; y: number; width: number; height: number }) => void;
  drawEnabled?: boolean;
}

const REGION_COLOR: Record<string, string> = {
  QUESTION_ANSWER: 'border-indigo-500 bg-indigo-500/10',
  ROLL_NUMBER_FIELD: 'border-amber-500 bg-amber-500/10',
  HEADER: 'border-slate-400 bg-slate-400/10',
  MARGIN: 'border-slate-300 bg-slate-300/10',
  SIGNATURE: 'border-emerald-500 bg-emerald-500/10',
  UNCLASSIFIED: 'border-rose-400 bg-rose-400/10',
};

export function PageImageViewer({ imageUrl, regions, selectedRegionId, onSelectRegion, onDrawRegion, drawEnabled }: PageImageViewerProps) {
  const [zoom, setZoom] = useState(100);
  const imgRef = useRef<HTMLImageElement>(null);
  const [drag, setDrag] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);

  const toNormalized = (clientX: number, clientY: number) => {
    const rect = imgRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (clientY - rect.top) / rect.height)),
    };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!drawEnabled) return;
    const p = toNormalized(e.clientX, e.clientY);
    setDrag({ x0: p.x, y0: p.y, x1: p.x, y1: p.y });
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!drag) return;
    const p = toNormalized(e.clientX, e.clientY);
    setDrag((d) => (d ? { ...d, x1: p.x, y1: p.y } : d));
  };
  const handleMouseUp = () => {
    if (!drag) return;
    const box = {
      x: Math.min(drag.x0, drag.x1),
      y: Math.min(drag.y0, drag.y1),
      width: Math.abs(drag.x1 - drag.x0),
      height: Math.abs(drag.y1 - drag.y0),
    };
    setDrag(null);
    if (box.width > 0.02 && box.height > 0.02 && onDrawRegion) onDrawRegion(box);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setZoom((z) => Math.max(50, z - 25))} className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600">
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
        <span className="text-[11px] font-bold text-slate-500 w-10 text-center">{zoom}%</span>
        <button type="button" onClick={() => setZoom((z) => Math.min(300, z + 25))} className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600">
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
        <button type="button" onClick={() => setZoom(100)} className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600" title="Reset zoom">
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
        {drawEnabled && <span className="text-[11px] text-indigo-600 font-semibold ml-2">Click and drag on the page to mark a region</span>}
      </div>

      <div className="overflow-auto border border-slate-200 rounded-xl bg-slate-900" style={{ height: 560 }}>
        <div className="relative inline-block" style={{ cursor: drawEnabled ? 'crosshair' : 'default' }}>
          <img
            ref={imgRef}
            src={imageUrl}
            alt="Scanned page"
            draggable={false}
            style={{ width: `${zoom}%`, maxWidth: 'none', display: 'block', userSelect: 'none' }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={() => drag && handleMouseUp()}
          />

          {regions.map((r) => (
            <div
              key={r.id}
              onClick={() => onSelectRegion?.(r.id)}
              className={`absolute border-2 cursor-pointer transition-all ${REGION_COLOR[r.regionType] ?? REGION_COLOR.UNCLASSIFIED} ${
                selectedRegionId === r.id ? 'ring-2 ring-offset-1 ring-indigo-400' : ''
              }`}
              style={{
                left: `${r.boundingBox.x * 100}%`,
                top: `${r.boundingBox.y * 100}%`,
                width: `${r.boundingBox.width * 100}%`,
                height: `${r.boundingBox.height * 100}%`,
              }}
              title={r.label ?? r.regionType}
            >
              {r.label && (
                <span className="absolute -top-5 left-0 text-[9px] font-bold px-1 py-0.5 bg-slate-900 text-white rounded whitespace-nowrap">
                  {r.label}
                </span>
              )}
            </div>
          ))}

          {drag && (
            <div
              className="absolute border-2 border-dashed border-indigo-400 bg-indigo-400/10 pointer-events-none"
              style={{
                left: `${Math.min(drag.x0, drag.x1) * 100}%`,
                top: `${Math.min(drag.y0, drag.y1) * 100}%`,
                width: `${Math.abs(drag.x1 - drag.x0) * 100}%`,
                height: `${Math.abs(drag.y1 - drag.y0) * 100}%`,
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
