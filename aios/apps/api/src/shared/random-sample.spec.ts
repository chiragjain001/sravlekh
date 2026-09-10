import { sampleWithoutReplacement } from './random-sample';

describe('sampleWithoutReplacement', () => {
  it('draws the requested number of distinct items', () => {
    const bank = Array.from({ length: 50 }, (_, i) => `q${i}`);
    const drawn = sampleWithoutReplacement(bank, 10);

    expect(drawn).toHaveLength(10);
    expect(new Set(drawn).size).toBe(10);
    drawn.forEach((q) => expect(bank).toContain(q));
  });

  it('never returns more than the pool holds', () => {
    expect(sampleWithoutReplacement(['a', 'b'], 10)).toHaveLength(2);
    expect(sampleWithoutReplacement([], 5)).toEqual([]);
    expect(sampleWithoutReplacement(['a'], 0)).toEqual([]);
    expect(sampleWithoutReplacement(['a'], -1)).toEqual([]);
  });

  it('does not mutate or reorder the caller’s array', () => {
    const bank = Array.from({ length: 30 }, (_, i) => i);
    const before = [...bank];
    sampleWithoutReplacement(bank, 15);
    expect(bank).toEqual(before);
  });

  /**
   * The regression this file exists for. The previous implementation was
   * `candidates.sort(() => 0.5 - Math.random())`, whose inconsistent comparator
   * leaves V8's TimSort strongly biased toward the input order: measured at
   * 187% selection frequency for the first candidate against 90% for the tail.
   *
   * The bound below is deliberately loose (±25%) so this is a bias detector, not
   * a flaky statistics test — the old implementation misses it by a wide margin
   * (1.87 vs the 1.25 ceiling) while a correct uniform draw sits comfortably
   * inside it. 4000 trials x 10 of 40 gives each item an expected 1000 draws.
   */
  it('selects every item at close to a uniform rate (the old sort-comparator did not)', () => {
    const N = 40;
    const PICK = 10;
    const TRIALS = 4000;
    const bank = Array.from({ length: N }, (_, i) => i);

    const counts = new Array<number>(N).fill(0);
    for (let t = 0; t < TRIALS; t++) {
      for (const item of sampleWithoutReplacement(bank, PICK)) counts[item] = (counts[item] ?? 0) + 1;
    }

    const expected = (TRIALS * PICK) / N;
    const ratios = counts.map((c) => c / expected);
    const min = Math.min(...ratios);
    const max = Math.max(...ratios);

    expect(max).toBeLessThan(1.25);
    expect(min).toBeGreaterThan(0.75);
    // Every question in the bank must be reachable — a sampler that never returns
    // some of them is the failure a teacher actually notices.
    expect(counts.every((c) => c > 0)).toBe(true);
  });

  it('is not anchored to the input order — first and last are drawn alike', () => {
    const N = 40;
    const TRIALS = 4000;
    const bank = Array.from({ length: N }, (_, i) => i);

    let firstDrawn = 0;
    let lastDrawn = 0;
    for (let t = 0; t < TRIALS; t++) {
      const drawn = sampleWithoutReplacement(bank, 10);
      if (drawn.includes(0)) firstDrawn++;
      if (drawn.includes(N - 1)) lastDrawn++;
    }

    // Under the old comparator this ratio was ~2x. Uniform sampling keeps it near 1.
    expect(firstDrawn / lastDrawn).toBeGreaterThan(0.8);
    expect(firstDrawn / lastDrawn).toBeLessThan(1.25);
  });
});
