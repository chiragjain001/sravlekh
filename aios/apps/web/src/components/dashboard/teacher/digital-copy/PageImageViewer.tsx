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

export type Box = { x: number; y: number; width: number; height: number };

interface PageImageViewerProps {
  imageUrl: string;
  regions: ViewerRegion[];
  selectedRegionId?: string | null;
  onSelectRegion?: (id: string) => void;
  onDrawRegion?: (box: Box) => void;
  drawEnabled?: boolean;
  /** Enables dragging the selected region and its corner handles. */
  onMoveRegion?: (id: string, box: Box) => void;
}

/** The corner a handle drags, as (x, y) multipliers of the box's own edges. */
const HANDLES = [
  { id: 'nw', cx: 0, cy: 0, cursor: 'nwse-resize' },
  { id: 'ne', cx: 1, cy: 0, cursor: 'nesw-resize' },
  { id: 'sw', cx: 0, cy: 1, cursor: 'nesw-resize' },
  { id: 'se', cx: 1, cy: 1, cursor: 'nwse-resize' },
] as const;

const MIN_SIDE = 0.02;

function clampBox(box: Box): Box {
  const width = Math.max(MIN_SIDE, Math.min(box.width, 1));
  const height = Math.max(MIN_SIDE, Math.min(box.height, 1));
  return {
    x: Math.min(Math.max(0, box.x), 1 - width),
    y: Math.min(Math.max(0, box.y), 1 - height),
    width,
    height,
  };
}

const REGION_COLOR: Record<string, string> = {
  QUESTION_ANSWER: 'border-indigo-500 bg-indigo-500/10',
  ROLL_NUMBER_FIELD: 'border-amber-500 bg-amber-500/10',
  HEADER: 'border-slate-400 bg-slate-400/10',
  MARGIN: 'border-slate-300 bg-slate-300/10',
  SIGNATURE: 'border-emerald-500 bg-emerald-500/10',
  UNCLASSIFIED: 'border-rose-400 bg-rose-400/10',
};

export function PageImageViewer({ imageUrl, regions, selectedRegionId, onSelectRegion, onDrawRegion, drawEnabled, onMoveRegion }: PageImageViewerProps) {
  const [zoom, setZoom] = useState(100);
  const imgRef = useRef<HTMLImageElement>(null);
  const [drag, setDrag] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  // Live box while the teacher drags a region or one of its corners; committed
  // on mouse-up so the API sees one update, not one per mouse-move.
  const [edit, setEdit] = useState<{ id: string; box: Box; origin: { x: number; y: number }; start: Box; handle: string | null } | null>(null);

  const beginEdit = (e: React.MouseEvent, region: ViewerRegion, handle: string | null) => {
    if (!onMoveRegion) return;
    e.stopPropagation();
    e.preventDefault();
    const p = toNormalized(e.clientX, e.clientY);
    setEdit({ id: region.id, box: region.boundingBox, origin: p, start: region.boundingBox, handle });
  };

  const moveEdit = (e: React.MouseEvent) => {
    if (!edit) return;
    const p = toNormalized(e.clientX, e.clientY);
    const dx = p.x - edit.origin.x;
    const dy = p.y - edit.origin.y;
    const { start, handle } = edit;
    let next: Box;
    if (!handle) {
      next = { ...start, x: start.x + dx, y: start.y + dy };
    } else {
      const left = handle.includes('w') ? start.x + dx : start.x;
      const top = handle.includes('n') ? start.y + dy : start.y;
      const right = handle.includes('e') ? start.x + start.width + dx : start.x + start.width;
      const bottom = handle.includes('s') ? start.y + start.height + dy : start.y + start.height;
      next = { x: Math.min(left, right), y: Math.min(top, bottom), width: Math.abs(right - left), height: Math.abs(bottom - top) };
    }
    setEdit({ ...edit, box: clampBox(next) });
  };

  const endEdit = () => {
    if (!edit) return;
    const { id, box, start } = edit;
    setEdit(null);
    const unchanged = (['x', 'y', 'width', 'height'] as const).every((k) => Math.abs(box[k] - start[k]) < 1e-4);
    if (!unchanged) onMoveRegion?.(id, { x: +box.x.toFixed(4), y: +box.y.toFixed(4), width: +box.width.toFixed(4), height: +box.height.toFixed(4) });
  };

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
    if (edit) {
      moveEdit(e);
      return;
    }
    if (!drag) return;
    const p = toNormalized(e.clientX, e.clientY);
    setDrag((d) => (d ? { ...d, x1: p.x, y1: p.y } : d));
  };
  const handleMouseUp = () => {
    if (edit) {
      endEdit();
      return;
    }
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
            onMouseLeave={() => (drag || edit) && handleMouseUp()}
          />

          {regions.map((r) => {
            const selected = selectedRegionId === r.id;
            const box = edit?.id === r.id ? edit.box : r.boundingBox;
            const editable = !!onMoveRegion && selected && !drawEnabled;
            return (
              <div
                key={r.id}
                onClick={() => onSelectRegion?.(r.id)}
                onMouseDown={(e) => (editable ? beginEdit(e, { ...r, boundingBox: box }, null) : undefined)}
                className={`absolute border-2 transition-colors ${REGION_COLOR[r.regionType] ?? REGION_COLOR.UNCLASSIFIED} ${
                  selected ? 'ring-2 ring-offset-1 ring-indigo-400' : ''
                }`}
                style={{
                  left: `${box.x * 100}%`,
                  top: `${box.y * 100}%`,
                  width: `${box.width * 100}%`,
                  height: `${box.height * 100}%`,
                  cursor: editable ? 'move' : 'pointer',
                }}
                title={editable ? 'Drag to move, corners to resize' : (r.label ?? r.regionType)}
              >
                {r.label && (
                  <span className="absolute -top-5 left-0 text-[9px] font-bold px-1 py-0.5 bg-slate-900 text-white rounded whitespace-nowrap">
                    {r.label}
                  </span>
                )}
                {editable &&
                  HANDLES.map((h) => (
                    <span
                      key={h.id}
                      onMouseDown={(e) => beginEdit(e, { ...r, boundingBox: box }, h.id)}
                      className="absolute w-2.5 h-2.5 -ml-1.5 -mt-1.5 bg-white border-2 border-indigo-500 rounded-sm"
                      style={{ left: `${h.cx * 100}%`, top: `${h.cy * 100}%`, cursor: h.cursor }}
                    />
                  ))}
              </div>
            );
          })}

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
