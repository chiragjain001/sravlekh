// ─── Utility Functions ────────────────────────────────────────────────────────

/** Merge class names — lightweight cn utility */
export function cn(...classes: (string | undefined | null | false | 0)[]): string {
  return classes.filter(Boolean).join(' ');
}

/** Format a date string to a readable format */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

/** Get initials from a full name */
export function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('');
}

/** Capitalize first letter of each word */
export function titleCase(str: string): string {
  return str.replace(/\b\w/g, c => c.toUpperCase());
}

/** Generate a UUID v4 for idempotency keys */
export function generateId(): string {
  return crypto.randomUUID ? crypto.randomUUID() :
    `${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
}

/** Debounce a function */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout>;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), delay);
  };
}

/** Format a percentage */
export function formatPct(value: number, decimals = 0): string {
  return `${value.toFixed(decimals)}%`;
}

/** Clamp a value between min and max */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
