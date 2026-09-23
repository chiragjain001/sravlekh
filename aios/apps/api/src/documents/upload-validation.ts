/**
 * What an uploaded booklet file is allowed to be.
 *
 * The declared Content-Type of a multipart part is attacker-controlled, so every
 * file is also sniffed: the bytes decide, not the header. And the name the
 * teacher's device supplied never becomes part of a storage key — keys are
 * generated (page-1.jpg, source.pdf), so a crafted filename cannot steer where
 * the object lands or what it is served as.
 */

export type UploadKind = 'image' | 'pdf';

export const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const PDF_MIME_TYPE = 'application/pdf';

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 07-SECURITY-SPECIFICATION.md §9
export const MAX_PDF_BYTES = 25 * 1024 * 1024; // a 40-page colour scan fits comfortably

const EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  [PDF_MIME_TYPE]: 'pdf',
};

/** The real type of `buffer`, from its signature — or null if it is none of the accepted ones. */
export function sniffMimeType(buffer: Buffer): string | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString('latin1') === 'RIFF' && buffer.subarray(8, 12).toString('latin1') === 'WEBP') return 'image/webp';
  if (buffer.length >= 5 && buffer.subarray(0, 5).toString('latin1') === '%PDF-') return PDF_MIME_TYPE;
  return null;
}

export function kindOf(mimeType: string): UploadKind | null {
  if ((IMAGE_MIME_TYPES as readonly string[]).includes(mimeType)) return 'image';
  if (mimeType === PDF_MIME_TYPE) return 'pdf';
  return null;
}

export function extensionFor(mimeType: string): string {
  return EXTENSION_BY_MIME[mimeType] ?? 'bin';
}

/** A generated, safe object name — never the client's filename. */
export function pageObjectName(pageNumber: number, mimeType: string): string {
  return `page-${pageNumber}.${extensionFor(mimeType)}`;
}

/** Only for error messages: the client's filename, stripped of anything that could mislead in a log or a UI. */
export function displayName(originalName: string | undefined, fallback: string): string {
  const base = (originalName ?? '').split(/[\\/]/).pop() ?? '';
  const cleaned = base.replace(/[^\w.\- ]/g, '').trim().slice(0, 80);
  return cleaned || fallback;
}
