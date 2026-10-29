import { maskEmail, maskPhone, isValidEmail, normalizeAndValidatePhone } from './mask-pii';

describe('maskEmail', () => {
  it('masks normal email addresses safely', () => {
    expect(maskEmail('student@example.com')).toBe('s***t@example.com');
    expect(maskEmail('priya.sharma@school.edu.in')).toBe('p***a@school.edu.in');
  });

  it('handles short usernames', () => {
    expect(maskEmail('ab@test.com')).toBe('a***@test.com');
    expect(maskEmail('a@test.com')).toBe('a***@test.com');
  });

  it('handles null, undefined, or malformed inputs safely', () => {
    expect(maskEmail(null)).toBe('[no_email]');
    expect(maskEmail(undefined)).toBe('[no_email]');
    expect(maskEmail('')).toBe('[no_email]');
    expect(maskEmail('not-an-email')).toBe('***');
  });
});

describe('maskPhone', () => {
  it('masks Indian numbers safely preserving only last 4 digits', () => {
    expect(maskPhone('+919876543210')).toBe('+91******3210');
    expect(maskPhone('9876543210')).toBe('******3210');
    expect(maskPhone('+1-555-123-4567')).toBe('+1******4567');
  });

  it('handles empty or malformed phones', () => {
    expect(maskPhone(null)).toBe('[no_phone]');
    expect(maskPhone(undefined)).toBe('[no_phone]');
    expect(maskPhone('')).toBe('[no_phone]');
    expect(maskPhone('12')).toBe('***');
  });
});

describe('isValidEmail', () => {
  it('accepts valid RFC emails', () => {
    expect(isValidEmail('teacher@school.org')).toBe(true);
    expect(isValidEmail('student.2026@sub.domain.co.in')).toBe(true);
  });

  it('rejects invalid or dangerous email strings', () => {
    expect(isValidEmail('invalid-email')).toBe(false);
    expect(isValidEmail('@nodomain.com')).toBe(false);
    expect(isValidEmail('spaces in@email.com')).toBe(false);
    expect(isValidEmail('')).toBe(false);
    expect(isValidEmail(null)).toBe(false);
  });
});

describe('normalizeAndValidatePhone', () => {
  it('normalizes valid 10-digit Indian mobile numbers starting with 6,7,8,9', () => {
    const res = normalizeAndValidatePhone('9876543210');
    expect(res.valid).toBe(true);
    expect(res.normalized).toBe('+919876543210');
  });

  it('normalizes formatted numbers with dashes, spaces, and brackets', () => {
    const res = normalizeAndValidatePhone('+91 (98765) 43210');
    expect(res.valid).toBe(true);
    expect(res.normalized).toBe('+919876543210');
  });

  it('normalizes Indian numbers with 0 prefix', () => {
    const res = normalizeAndValidatePhone('09876543210');
    expect(res.valid).toBe(true);
    expect(res.normalized).toBe('+919876543210');
  });

  it('rejects invalid Indian mobile numbers starting with 0-5 for 10 digits', () => {
    const res = normalizeAndValidatePhone('1234567890');
    expect(res.valid).toBe(false);
    expect(res.error).toBe('invalid_indian_mobile');
  });

  it('rejects numbers that are too short or contain alphabetical characters', () => {
    expect(normalizeAndValidatePhone('12345').valid).toBe(false);
    expect(normalizeAndValidatePhone('987654321A').valid).toBe(false);
  });
});
