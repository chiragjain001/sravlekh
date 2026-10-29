/**
 * PII masking and contact normalization utilities for communication dispatch.
 * 
 * Rules per AGENTS.md and 07-SECURITY-SPECIFICATION.md:
 * - Sensitive student and guardian contact details must never appear in plaintext logs or Sentry payloads.
 * - Emails and phones must be validated before attempting provider dispatches to avoid
 *   wasting quotas or triggering provider-level fraud/spam throttles.
 */

/**
 * Safely masks an email address for structured logs:
 * "john.doe@example.com" -> "j***e@example.com"
 * "a@b.com"              -> "a***@b.com"
 */
export function maskEmail(email: string | null | undefined): string {
  if (!email || typeof email !== 'string') return '[no_email]';
  const trimmed = email.trim();
  const atIndex = trimmed.indexOf('@');
  if (atIndex <= 0 || atIndex === trimmed.length - 1) return '***';

  const local = trimmed.substring(0, atIndex);
  const domain = trimmed.substring(atIndex + 1);

  if (local.length <= 2) {
    return `${local[0]}***@${domain}`;
  }
  return `${local[0]}***${local[local.length - 1]}@${domain}`;
}

/**
 * Safely masks a phone number for structured logs:
 * "+919876543210" -> "+91******3210"
 * "9876543210"    -> "******3210"
 */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone || typeof phone !== 'string') return '[no_phone]';
  const cleaned = phone.replace(/[\s\-()]/g, '');
  if (cleaned.length < 4) return '***';
  const lastFour = cleaned.slice(-4);
  let prefix = '';
  if (cleaned.startsWith('+91')) {
    prefix = '+91';
  } else if (cleaned.startsWith('+1')) {
    prefix = '+1';
  } else if (cleaned.startsWith('+')) {
    prefix = '+';
  }
  return `${prefix}******${lastFour}`;
}

/**
 * Standard RFC 5322-compatible email validation.
 */
export function isValidEmail(email: string | null | undefined): boolean {
  if (!email || typeof email !== 'string') return false;
  const trimmed = email.trim();
  if (trimmed.length > 254) return false;
  // Standard RFC 5322 compliant regex for practical production verification
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  return emailRegex.test(trimmed);
}

export interface PhoneValidationResult {
  valid: boolean;
  normalized: string;
  error?: 'empty' | 'too_short' | 'too_long' | 'invalid_characters' | 'invalid_indian_mobile';
}

/**
 * Normalizes and validates a phone number.
 * Supports:
 * - Indian 10-digit mobile numbers (6xxx, 7xxx, 8xxx, 9xxx) -> normalizes with +91
 * - Indian 12-digit numbers with 91 prefix
 * - Standard E.164 international phone format (+ followed by 10 to 15 digits)
 */
export function normalizeAndValidatePhone(phone: string | null | undefined): PhoneValidationResult {
  if (!phone || typeof phone !== 'string') {
    return { valid: false, normalized: '', error: 'empty' };
  }

  // Strip whitespaces, dashes, parentheses, dots
  let sanitized = phone.trim().replace(/[\s\-().]/g, '');

  const hasLeadingPlus = sanitized.startsWith('+');
  if (hasLeadingPlus) {
    sanitized = sanitized.substring(1);
  }

  // Check if remaining characters are all digits
  if (!/^\d+$/.test(sanitized)) {
    return { valid: false, normalized: '', error: 'invalid_characters' };
  }

  // Indian standard: 10 digits starting with 6, 7, 8, or 9
  if (sanitized.length === 10) {
    if (/^[6-9]\d{9}$/.test(sanitized)) {
      return { valid: true, normalized: `+91${sanitized}` };
    }
    return { valid: false, normalized: '', error: 'invalid_indian_mobile' };
  }

  // Indian format with leading 91: 12 digits
  if (sanitized.length === 12 && sanitized.startsWith('91')) {
    const localPart = sanitized.substring(2);
    if (/^[6-9]\d{9}$/.test(localPart)) {
      return { valid: true, normalized: `+${sanitized}` };
    }
    return { valid: false, normalized: '', error: 'invalid_indian_mobile' };
  }

  // Indian format with leading 0: 11 digits (e.g., 09876543210)
  if (sanitized.length === 11 && sanitized.startsWith('0')) {
    const localPart = sanitized.substring(1);
    if (/^[6-9]\d{9}$/.test(localPart)) {
      return { valid: true, normalized: `+91${localPart}` };
    }
    return { valid: false, normalized: '', error: 'invalid_indian_mobile' };
  }

  // General E.164: 10 to 15 digits
  if (sanitized.length >= 10 && sanitized.length <= 15) {
    return { valid: true, normalized: `+${sanitized}` };
  }

  if (sanitized.length < 10) {
    return { valid: false, normalized: '', error: 'too_short' };
  }

  return { valid: false, normalized: '', error: 'too_long' };
}
