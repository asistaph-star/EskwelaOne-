import prisma from '../../config/database.js';
import { getPhilippineCalendarDate } from '../../common/utils/dateTime.js';
import { FacultyAttendanceService } from '../../modules/faculty-attendance/facultyAttendance.service.js';
import { getAcademicAnalytics } from '../academicAnalytics.service.js';
import { SchoolFactSheet } from './executiveSummary.types.js';

const facultyAttendanceService = new FacultyAttendanceService();

/**
 * Formats a Date in Asia/Manila as "MMM D, YYYY • H:MM AM/PM".
 */
export function formatPhilippineDateTime(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).formatToParts(date);

  const month = parts.find(p => p.type === 'month')?.value || '';
  const day = parts.find(p => p.type === 'day')?.value || '';
  const year = parts.find(p => p.type === 'year')?.value || '';
  const hour = parts.find(p => p.type === 'hour')?.value || '';
  const minute = parts.find(p => p.type === 'minute')?.value || '';
  const dayPeriod = parts.find(p => p.type === 'dayPeriod')?.value || '';

  return `${month} ${day}, ${year} • ${hour}:${minute} ${dayPeriod}`;
}

/**
 * Builds the authoritative, strictly grounded SchoolFactSheet.
 * 
 * Strict Privacy & Architectural Isolation:
 * - Does NOT query GuidanceRecord (counseling session confidentiality).
 * - Does NOT query ClinicReferral (medical diagnoses / treatments confidentiality).
 * - Reuses existing authorized services:
 *   - FacultyAttendanceService (PRIN-003)
 *   - AcademicAnalyticsService (PRIN-002)
 *   - Philippine Date Gate Attendance (PRIN-001)
 *   - Model B Inventory Semantics
 */
export async function buildSchoolFactSheet(): Promise<SchoolFactSheet> {
  const now = new Date();
  const asOf = now.toISOString();
  const asOfFormatted = formatPhilippineDateTime(now);

  // 1. Students & Active Academic Year
  const currentAY = await prisma.academicYear.findFirst({
    where: { is_current: true },
    select: { id: true }
  });

  let enrolled: number | null = null;
  if (currentAY) {
    enrolled = await prisma.enrollment.count({
      where: {
        academic_year_id: currentAY.id,
        status: 'Enrolled'
      }
    });
  }

  // 2. Students with Gate Time-In and No Time-Out Recorded (Authoritative Asia/Manila Date)
  const { dateObj: phToday } = getPhilippineCalendarDate();
  const onCampusNow = await prisma.gateAttendance.count({
    where: {
      date: phToday,
      time_in: { not: null },
      time_out: null
    }
  });

  // 3. Faculty Attendance (PRIN-003 authoritative service)
  let checkedInToday: number | null = null;
  let checkedInNow: number | null = null;
  let timedOutToday: number | null = null;
  let totalActiveFaculty: number | null = null;

  try {
    const fSummary = await facultyAttendanceService.getSummary();
    checkedInToday = fSummary.checkedInCount;
    checkedInNow = fSummary.timeOutPendingCount;
    timedOutToday = fSummary.completedCount;
    totalActiveFaculty = fSummary.totalActiveFaculty;
  } catch (err) {
    console.error('Error fetching faculty summary for fact sheet:', err);
  }

  // 4. Academic Performance (PRIN-002 service)
  let annualPassRate: number | null = null;
  let termGradeAverages: { gradeLevel: number; average: number }[] | null = null;
  let lowestTermAverageGradeLevel: number | null = null;
  let assessedGradeLevelsCount = 0;
  let academicCompleteness: 'complete_annual' | 'partial_terms' | 'insufficient_data' = 'insufficient_data';

  try {
    const analytics = await getAcademicAnalytics();

    // A. Annual Complete Promotion Pass Rate (DepEd SF10 Annual Average across all quarters/subjects)
    if (analytics && Array.isArray(analytics.passingVsFailingByGradeLevel) && analytics.passingVsFailingByGradeLevel.length > 0) {
      let totalPassing = 0;
      let totalAssessed = 0;
      for (const item of analytics.passingVsFailingByGradeLevel) {
        totalPassing += item.passing || 0;
        totalAssessed += ((item.passing || 0) + (item.failing || 0));
      }
      if (totalAssessed > 0) {
        annualPassRate = Math.round((totalPassing / totalAssessed) * 100);
      }
    }

    // B. Submitted Term Grades Pulse
    if (analytics && Array.isArray(analytics.schoolAverageByGradeLevel) && analytics.schoolAverageByGradeLevel.length > 0) {
      const validAverages = analytics.schoolAverageByGradeLevel.filter(
        g => typeof g.average === 'number' && !isNaN(g.average) && g.average > 0
      );
      if (validAverages.length > 0) {
        termGradeAverages = validAverages;
        assessedGradeLevelsCount = validAverages.length;

        // Semantic Rule: Only designate a comparative "lowest" if at least 2 grade levels are assessed!
        // A single grade level cannot be considered "the lowest" when there are no other grade levels to compare.
        if (validAverages.length >= 2) {
          const sorted = [...validAverages].sort((a, b) => a.average - b.average);
          lowestTermAverageGradeLevel = sorted[0].gradeLevel;
        } else {
          lowestTermAverageGradeLevel = null;
        }
      }
    }

    // Determine Provenance & Completeness
    if (annualPassRate !== null) {
      academicCompleteness = 'complete_annual';
    } else if (termGradeAverages !== null && termGradeAverages.length > 0) {
      academicCompleteness = 'partial_terms';
    } else {
      academicCompleteness = 'insufficient_data';
    }
  } catch {
    // If no grades or analytics available, retain strict null (no fabrication)
    annualPassRate = null;
    termGradeAverages = null;
    lowestTermAverageGradeLevel = null;
    assessedGradeLevelsCount = 0;
    academicCompleteness = 'insufficient_data';
  }

  // 5. Welfare & Behavior (Zero Clinic/Guidance cross-contamination)
  const openBehaviorCases = await prisma.behaviorLog.count({
    where: {
      status: { in: ['Reported', 'Under investigation', 'Parent notified'] }
    }
  });

  const flaggedStudents = await prisma.behaviorLog.findMany({
    where: {
      status: { in: ['Reported', 'Under investigation', 'Parent notified'] }
    },
    distinct: ['student_id'],
    select: { student_id: true }
  });
  const studentsRequiringAttention = flaggedStudents.length;

  // 6. Operations & Leaves
  const pendingLeaves = await prisma.leaveRequest.count({
    where: { status: 'Pending' }
  });

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const upcomingEvents = await prisma.event.findMany({
    where: { date: { gte: todayStart } },
    orderBy: { date: 'asc' },
    take: 3,
    select: { title: true }
  });
  const upcomingEventsCount = await prisma.event.count({
    where: { date: { gte: todayStart } }
  });
  const nextUpcomingEvents = upcomingEvents.map(e => e.title);

  // 7. Inventory (Model B Semantics)
  const inventoryGroups = await prisma.inventoryItem.groupBy({
    by: ['status'],
    _sum: { quantity: true }
  });

  const counts: Record<string, number> = {
    Good: 0,
    Repair: 0,
    Borrowed: 0,
    Lost: 0,
    Damaged: 0,
    Retired: 0,
    Disposed: 0
  };

  for (const group of inventoryGroups) {
    if (group.status && group.status in counts) {
      counts[group.status] = group._sum.quantity || 0;
    }
  }

  const currentAccountableUnits = counts.Good + counts.Repair + counts.Borrowed + counts.Lost + counts.Damaged;
  const repairUnits = counts.Repair;
  const borrowedUnits = counts.Borrowed;
  const lostDamagedUnits = counts.Lost + counts.Damaged;
  const retiredDisposedUnits = counts.Retired + counts.Disposed;

  return {
    asOf,
    asOfFormatted,
    students: {
      enrolled,
      timeInNoTimeoutCount: onCampusNow,
      onCampusNow
    },
    faculty: {
      checkedInNow,
      checkedInToday,
      timedOutToday,
      totalActive: totalActiveFaculty
    },
    academics: {
      academicCompleteness,
      annualPassRate,
      termGradeAverages,
      lowestTermAverageGradeLevel,
      assessedGradeLevelsCount
    },
    welfare: {
      studentsRequiringAttention,
      openBehaviorCases
    },
    operations: {
      pendingLeaves,
      upcomingEventsCount,
      nextUpcomingEvents
    },
    inventory: {
      currentAccountableUnits,
      repairUnits,
      borrowedUnits,
      lostDamagedUnits,
      retiredDisposedUnits
    }
  };
}
