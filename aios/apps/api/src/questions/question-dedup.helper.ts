import * as crypto from 'crypto';

export interface QuestionHashResult {
  contentHash: string;
  fingerprint: string;
}

/**
 * Generates an exact SHA-256 hash of normalized content and a tokenized
 * fingerprint for near-duplicate/similarity detection.
 */
export function computeContentHashAndFingerprint(content: string): QuestionHashResult {
  if (!content) {
    return { contentHash: '', fingerprint: '' };
  }

  // 1. Exact normalized hash: lowercase, normalize internal whitespace
  const normalized = content.trim().toLowerCase().replace(/\s+/g, ' ');
  const contentHash = crypto.createHash('sha256').update(normalized).digest('hex');

  // 2. Tokenized bag-of-words fingerprint: strip non-alphanumeric, sort unique significant tokens
  const tokens = normalized
    .replace(/[^a-z0-9\s]/gi, '')
    .split(/\s+/)
    .filter((w) => w.length > 2);

  const uniqueSortedTokens = Array.from(new Set(tokens)).sort();
  const fingerprint = uniqueSortedTokens.slice(0, 30).join(' ');

  return { contentHash, fingerprint };
}

/**
 * Calculates Jaccard similarity between two fingerprints (0.0 to 1.0).
 */
export function calculateFingerprintSimilarity(fp1: string, fp2: string): number {
  if (!fp1 || !fp2) return 0;
  const set1 = new Set(fp1.split(' '));
  const set2 = new Set(fp2.split(' '));

  let intersectionSize = 0;
  for (const token of set1) {
    if (set2.has(token)) {
      intersectionSize++;
    }
  }

  const unionSize = new Set([...set1, ...set2]).size;
  return unionSize === 0 ? 0 : intersectionSize / unionSize;
}
