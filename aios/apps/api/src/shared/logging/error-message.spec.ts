import { describeError, ensureDiagnosableMessage } from './error-message';

/** The exact shape axios produces when `localhost` refuses on both stacks. */
function dualStackRefusal() {
  const inner = new AggregateError(
    [new Error('connect ECONNREFUSED ::1:8000'), new Error('connect ECONNREFUSED 127.0.0.1:8000')],
  );
  const axiosErr = new AggregateError([]) as unknown as Error & Record<string, unknown>;
  axiosErr.name = 'AggregateError';
  axiosErr.message = '';               // the defect: empty by design
  axiosErr.code = 'ECONNREFUSED';
  axiosErr.cause = inner;              // axios re-wraps; detail is one hop down
  axiosErr.config = { url: 'http://localhost:8000/analytics/recalculate-mastery', method: 'post' };
  return axiosErr;
}

describe('describeError', () => {
  it('rebuilds a real message for the dual-stack refusal that started this', () => {
    // Verified against a live axios call: name AggregateError, message "",
    // code ECONNREFUSED, real text in cause.errors[].
    const msg = describeError(dualStackRefusal());

    expect(msg).toContain('ECONNREFUSED');
    expect(msg).toContain('::1:8000');
    expect(msg).toContain('127.0.0.1:8000');
    // Which dependency was unreachable is the first thing anyone asks.
    expect(msg).toContain('http://localhost:8000/analytics/recalculate-mastery');
  });

  it('never invents text — everything comes from the error itself', () => {
    const bare = new AggregateError([]) as unknown as Error & Record<string, unknown>;
    bare.message = '';
    bare.code = 'ETIMEDOUT';
    expect(describeError(bare)).toContain('ETIMEDOUT');
  });

  it('returns a normal error message untouched', () => {
    expect(describeError(new Error('Attempt not found'))).toBe('Attempt not found');
  });

  it('degrades honestly when there is nothing to report', () => {
    expect(describeError({})).toMatch(/no message on the thrown value/);
  });
});

describe('ensureDiagnosableMessage', () => {
  it('fills a blank message so BullMQ stores a useful failedReason', () => {
    // BullMQ does `failedReason = err.message` inside moveToFailed, which runs
    // BEFORE any @OnWorkerEvent('failed') handler — so the repair has to happen
    // at the throw site, not in the dead-letter reporter.
    const err = dualStackRefusal();
    ensureDiagnosableMessage(err);
    expect(err.message).toContain('ECONNREFUSED');
    expect((err.message as string).length).toBeGreaterThan(0);
  });

  it('returns the SAME error object — type, code and stack preserved', () => {
    const err = dualStackRefusal();
    const returned = ensureDiagnosableMessage(err);

    expect(returned).toBe(err);                 // not a wrapper
    expect(returned.name).toBe('AggregateError');
    expect(returned['code']).toBe('ECONNREFUSED');
    expect(returned).toBeInstanceOf(AggregateError);
  });

  it('never overwrites a message that already says something', () => {
    const err = new Error('Attempt not found');
    ensureDiagnosableMessage(err);
    expect(err.message).toBe('Attempt not found');
  });

  it('treats whitespace as blank', () => {
    const err = new Error('   ');
    (err as Error & { code?: string }).code = 'ECONNRESET';
    ensureDiagnosableMessage(err);
    expect(err.message).toContain('ECONNRESET');
  });

  it('does not throw when the message cannot be written', () => {
    const frozen = Object.freeze(Object.assign(new Error(''), { code: 'EPIPE' }));
    expect(() => ensureDiagnosableMessage(frozen)).not.toThrow();
  });

  it('passes non-objects through unchanged', () => {
    expect(ensureDiagnosableMessage('a string')).toBe('a string');
    expect(ensureDiagnosableMessage(null)).toBeNull();
  });
});
