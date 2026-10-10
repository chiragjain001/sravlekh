import {
  computeContentHashAndFingerprint,
  calculateFingerprintSimilarity,
} from './question-dedup.helper';

describe('Question Deduplication and Fingerprinting Helper', () => {
  it('generates identical contentHash for identical questions with whitespace differences', () => {
    const q1 = 'What is the speed of light in vacuum?';
    const q2 = '   What   is the speed of   light in vacuum?   ';

    const res1 = computeContentHashAndFingerprint(q1);
    const res2 = computeContentHashAndFingerprint(q2);

    expect(res1.contentHash).toBe(res2.contentHash);
  });

  it('generates different contentHash for different questions', () => {
    const q1 = 'What is the speed of light in vacuum?';
    const q2 = 'What is the speed of sound in air?';

    const res1 = computeContentHashAndFingerprint(q1);
    const res2 = computeContentHashAndFingerprint(q2);

    expect(res1.contentHash).not.toBe(res2.contentHash);
  });

  it('calculates high fingerprint similarity for rephrased questions with identical concept keywords', () => {
    const q1 = 'Determine the roots of quadratic equation x^2 - 5x + 6 = 0 using discriminant formula';
    const q2 = 'Find the roots of quadratic equation x^2 - 5x + 6 = 0 by discriminant method';

    const res1 = computeContentHashAndFingerprint(q1);
    const res2 = computeContentHashAndFingerprint(q2);

    const similarity = calculateFingerprintSimilarity(res1.fingerprint, res2.fingerprint);
    // Similarity between these rephrased statements should be >= 0.5
    expect(similarity).toBeGreaterThanOrEqual(0.5);
  });

  it('calculates low fingerprint similarity for completely different questions', () => {
    const q1 = 'Calculate the kinetic energy of a 2kg mass moving at 10 m/s';
    const q2 = 'Explain the difference between mitosis and meiosis in eukaryotic cells';

    const res1 = computeContentHashAndFingerprint(q1);
    const res2 = computeContentHashAndFingerprint(q2);

    const similarity = calculateFingerprintSimilarity(res1.fingerprint, res2.fingerprint);
    expect(similarity).toBeLessThan(0.15);
  });
});
