/**
 * An answer region's box, and what it means for the OCR read from it.
 *
 * OCRBlock.boundingBox stores the page-normalised box that was actually cropped
 * and read (api-python's ocr/region_box.py writes it). A transcript read from a
 * box the teacher has since moved or resized is evidence for a different part of
 * the page, so every consumer compares boxes before trusting a reading: OcrService
 * re-queues the region, CheckedCopyService shows it as "not read yet", and the
 * Python evaluator refuses to grade on it.
 *
 * Mirrors apps/api-python/src/ocr/region_box.py — change one, change the other.
 */

export interface RegionBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

const BOX_TOLERANCE = 1e-4;

export function asBox(value: unknown): RegionBox | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Record<string, unknown>;
  const numbers = (['x', 'y', 'width', 'height'] as const).map((k) => Number(candidate[k]));
  if (numbers.some((n) => !Number.isFinite(n))) return null;
  const [x, y, width, height] = numbers as [number, number, number, number];
  return { x, y, width, height };
}

export function sameBox(a: unknown, b: unknown): boolean {
  const boxA = asBox(a);
  const boxB = asBox(b);
  if (!boxA || !boxB) return false;
  return (['x', 'y', 'width', 'height'] as const).every((k) => Math.abs(boxA[k] - boxB[k]) <= BOX_TOLERANCE);
}

/** True when this region has a usable reading of its CURRENT box. */
export function hasCurrentOcr(region: {
  boundingBox: unknown;
  ocrBlocks: { boundingBox: unknown; results: unknown[] }[];
}): boolean {
  return region.ocrBlocks.some((block) => block.results.length > 0 && sameBox(block.boundingBox, region.boundingBox));
}
