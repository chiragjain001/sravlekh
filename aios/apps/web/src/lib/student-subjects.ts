/**
 * Student curriculum & enrolled subjects resolution.
 * In a school/coaching environment, a student belongs to a specific class and stream
 * (e.g. Class 11 - JEE Science Stream: Physics, Chemistry, Mathematics).
 *
 * Across the entire student dashboard (Overview, Weak Topics, Doubt Center, Tests, etc.),
 * only the subjects relevant to the student's enrolled program/batch should appear
 * in subject filters, dropdowns, and doubt submission selectors.
 */

export const DEFAULT_STUDENT_ENROLLED_SUBJECTS = ['Physics', 'Chemistry', 'Mathematics'] as const;

export type StudentEnrolledSubject = (typeof DEFAULT_STUDENT_ENROLLED_SUBJECTS)[number];

/**
 * Checks whether a subject name belongs to the student's enrolled class subjects.
 */
export function isStudentClassSubject(
  subjectName?: string | null,
  allowedSubjects: readonly string[] = DEFAULT_STUDENT_ENROLLED_SUBJECTS,
): boolean {
  if (!subjectName) return false;
  const normalized = subjectName.trim().toLowerCase();
  return allowedSubjects.some((s) => s.toLowerCase() === normalized);
}

/**
 * Filters any list of subjects to keep only the student's enrolled class subjects.
 */
export function filterStudentClassSubjects<T extends { name?: string }>(
  subjects: T[],
  allowedSubjects: readonly string[] = DEFAULT_STUDENT_ENROLLED_SUBJECTS,
): T[] {
  return subjects.filter((s) => isStudentClassSubject(s.name, allowedSubjects));
}
