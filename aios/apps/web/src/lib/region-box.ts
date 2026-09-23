/**
 * Whether an OCR reading still belongs to the region it was read from.
 *
 * Mirrors apps/api/src/shared/region-box.ts and apps/api-python's
 * ocr/region_box.py: a block records the page-normalised box that was read, and
 * a teacher who moves or resizes the region invalidates that reading. The UI
 * shows such an answer as needing another read rather than showing text taken
 * from a different part of the page.
 */

export interface RegionBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

const BOX_TOLERANCE = 1e-4;

export function sameBox(a: unknown, b: unknown): boolean {
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  const boxA = a as Record<string, number>;
  const boxB = b as Record<string, number>;
  return (['x', 'y', 'width', 'height'] as const).every((k) => {
    const left = Number(boxA[k]);
    const right = Number(boxB[k]);
    return Number.isFinite(left) && Number.isFinite(right) && Math.abs(left - right) <= BOX_TOLERANCE;
  });
}
