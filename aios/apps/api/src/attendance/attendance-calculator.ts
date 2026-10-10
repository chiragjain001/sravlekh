import { AttendanceStatus } from '@prisma/client';

export interface AttendanceCounts {
  present: number;
  absent: number;
  late: number;
  excused: number;
}

export interface AttendanceMetricsResult {
  totalSessions: number;
  totalEvaluated: number;    // evaluatedSessions (total - excused)
  attendedCount: number;     // present + late * lateWeight
  unexcusedAbsentCount: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  overallAttendancePct: number | null; // null if evaluatedSessions === 0, rounded to 1 decimal place
  percentage: number | null; // alias for overallAttendancePct
  statusBreakdown: {
    PRESENT: number;
    ABSENT: number;
    LATE: number;
    EXCUSED: number;
  };
}

/**
 * Single authoritative attendance calculation engine for AIOS.
 * Used identically across Student Profile, Teacher Summary, Admin Reports,
 * Analytics, Shortage Warnings, and Official Transcripts.
 *
 * Formula:
 * (PRESENT + LATE * lateWeight) / (TOTAL_EVALUATED - EXCUSED) * 100
 *
 * - EXCUSED absences are strictly excluded from both numerator and denominator.
 * - Cancelled or suppressed sessions are strictly excluded from all counts.
 * - If evaluatedSessions is 0, returns null (displayed in UI as "—" or "N/A").
 */
export function calculateAttendanceMetrics(
  input: AttendanceCounts | Array<{ status: AttendanceStatus }>,
  options: { lateWeight?: number } = { lateWeight: 1.0 },
): AttendanceMetricsResult {
  let counts: AttendanceCounts;

  if (Array.isArray(input)) {
    counts = {
      present: input.filter((r) => r.status === AttendanceStatus.PRESENT).length,
      absent: input.filter((r) => r.status === AttendanceStatus.ABSENT).length,
      late: input.filter((r) => r.status === AttendanceStatus.LATE).length,
      excused: input.filter((r) => r.status === AttendanceStatus.EXCUSED).length,
    };
  } else {
    counts = input;
  }

  const { present, absent, late, excused } = counts;
  const totalSessions = present + absent + late + excused;
  const evaluatedSessions = totalSessions - excused;
  const lateWeight = options.lateWeight ?? 1.0;
  const attendedSessions = present + late * lateWeight;

  let percentage: number | null = null;
  if (evaluatedSessions > 0) {
    const raw = (attendedSessions / evaluatedSessions) * 100;
    percentage = Math.round(raw * 10) / 10;
  }

  return {
    totalSessions,
    totalEvaluated: evaluatedSessions,
    attendedCount: attendedSessions,
    unexcusedAbsentCount: absent,
    present,
    absent,
    late,
    excused,
    overallAttendancePct: percentage,
    percentage,
    statusBreakdown: {
      PRESENT: present,
      ABSENT: absent,
      LATE: late,
      EXCUSED: excused,
    },
  };
}

export function countsTowardDenominator(status: AttendanceStatus): boolean {
  return status !== AttendanceStatus.EXCUSED;
}

export function isAttended(status: AttendanceStatus): boolean {
  return status === AttendanceStatus.PRESENT || status === AttendanceStatus.LATE;
}
