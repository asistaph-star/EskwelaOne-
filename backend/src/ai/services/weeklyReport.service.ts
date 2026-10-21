import { buildSchoolFactSheet } from '../../admin/executive-summary/factSheet.service.js';
import { facultyAttendanceService } from '../../modules/faculty-attendance/facultyAttendance.service.js';
import { leaveService } from '../../modules/leaves/leave.service.js';
import { eventService } from '../../modules/events/event.service.js';
import { BehaviorService } from '../../modules/behavior/behavior.service.js';
import { getAcademicAnalytics } from '../../admin/academicAnalytics.service.js';
import { getPhilippineCalendarDate, parseCalendarDate } from '../../common/utils/dateTime.js';

export interface WeeklyReportInput {
  weekStartDate?: string;
}

export interface WeeklyReportDTO {
  reportPeriod: {
    startDate: string;
    endDate: string;
    label: string;
  };
  executiveSummaryFacts: {
    enrolledStudents: number | null;
    studentsOnCampusToday: number;
    totalActiveFaculty: number | null;
    facultyCheckedInToday: number | null;
  };
  facultyAttendanceFacts: {
    totalActiveFaculty: number;
    checkedInToday: number;
    timeOutPendingToday: number;
    completedToday: number;
    attendanceSemanticsNote: string;
  };
  leaveFacts: {
    pendingApprovalsCount: number;
    approvedLeavesCoveringPeriod: number;
  };
  administrativeBehaviorFacts: {
    openCasesCount: number;
    studentsRequiringAttention: number;
    resolvedCasesCount: number;
  };
  eventFacts: {
    scheduledEventsCount: number;
    events: Array<{ title: string; date: string; audience: string | null }>;
  };
  academicCompletenessFacts: {
    completenessStatus: 'complete_annual' | 'partial_terms' | 'insufficient_data';
    annualPassRate: number | null;
    note: string;
  };
  sourceDomains: string[];
  generatedAt: string;
}

export class WeeklyReportService {
  /**
   * Generates a deterministic cross-module Weekly Operations Report for the Principal.
   * Adheres strictly to locked attendance and academic completeness semantics.
   */
  async generateReport(input: WeeklyReportInput = {}): Promise<WeeklyReportDTO> {
    const sourceDomains: string[] = [];

    // 1. Resolve Deterministic Date Window (Monday to Friday of the target week)
    let startDateObj: Date;
    if (input.weekStartDate) {
      startDateObj = parseCalendarDate(input.weekStartDate);
    } else {
      const { dateObj } = getPhilippineCalendarDate();
      const dayOfWeek = dateObj.getUTCDay(); // 0 is Sunday, 1 is Monday...
      const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      startDateObj = new Date(dateObj.getTime() + diffToMonday * 24 * 60 * 60 * 1000);
    }

    const startOfDay = new Date(Date.UTC(startDateObj.getUTCFullYear(), startDateObj.getUTCMonth(), startDateObj.getUTCDate(), 0, 0, 0, 0));
    // 5-day school week (Monday through Friday)
    const endOfDay = new Date(Date.UTC(startDateObj.getUTCFullYear(), startDateObj.getUTCMonth(), startDateObj.getUTCDate() + 4, 23, 59, 59, 999));

    const startDateStr = startOfDay.toISOString().split('T')[0];
    const endDateStr = endOfDay.toISOString().split('T')[0];
    const periodLabel = `School Week: ${startDateStr} to ${endDateStr}`;

    // 2. Executive Fact Sheet Aggregate Facts
    let factSheet;
    try {
      factSheet = await buildSchoolFactSheet();
      sourceDomains.push('Executive Summary');
    } catch {
      // Fallback
    }

    // 3. Faculty Attendance Summary
    let facultyFacts = {
      totalActiveFaculty: 0,
      checkedInToday: 0,
      timeOutPendingToday: 0,
      completedToday: 0,
      attendanceSemanticsNote: 'Gate check-in status represents recorded scan presence. Lateness, undertime, absence, and unexcused status are not inferred without an authoritative DepEd faculty schedule policy.'
    };

    try {
      const fSummary = await facultyAttendanceService.getSummary();
      facultyFacts.totalActiveFaculty = fSummary.totalActiveFaculty;
      facultyFacts.checkedInToday = fSummary.checkedInCount;
      facultyFacts.timeOutPendingToday = fSummary.timeOutPendingCount;
      facultyFacts.completedToday = fSummary.completedCount;
      sourceDomains.push('Faculty Attendance');
    } catch {
      // Skip on error
    }

    // 4. Leave Management Facts
    let pendingLeavesCount = 0;
    let approvedPeriodLeavesCount = 0;
    try {
      pendingLeavesCount = await leaveService.getPendingCount();
      const approvedPeriodLeaves = await leaveService.getApprovedLeavesForPeriod(startOfDay, endOfDay);
      approvedPeriodLeavesCount = approvedPeriodLeaves.length;
      sourceDomains.push('Leave Management');
    } catch {
      // Skip on error
    }

    // 5. Administrative Behavior Facts
    let behaviorFacts = {
      openCasesCount: 0,
      studentsRequiringAttention: 0,
      resolvedCasesCount: 0
    };
    try {
      const bSummary = await BehaviorService.getBehaviorSummary();
      behaviorFacts.openCasesCount = bSummary.reported + bSummary.underInvestigation + bSummary.parentNotified;
      behaviorFacts.studentsRequiringAttention = bSummary.studentsCount;
      behaviorFacts.resolvedCasesCount = bSummary.resolved;
      sourceDomains.push('Behavior Management (Administrative)');
    } catch {
      // Skip on error
    }

    // 6. Events Facts
    const weekEvents: Array<{ title: string; date: string; audience: string | null }> = [];
    try {
      const events = await eventService.getEventsForPeriod(startOfDay, endOfDay);
      for (const ev of events) {
        weekEvents.push({
          title: ev.title,
          date: ev.startDate,
          audience: ev.targetAudience
        });
      }
      sourceDomains.push('School Events Calendar');
    } catch {
      // Skip on error
    }

    // 7. Academic Completeness Facts (Strict Semantics)
    let academicCompleteness: 'complete_annual' | 'partial_terms' | 'insufficient_data' = 'insufficient_data';
    let annualPassRate: number | null = null;
    let academicNote = 'No verified academic grading data has been submitted.';

    try {
      const analytics = await getAcademicAnalytics();
      sourceDomains.push('Academic Analytics');

      if (analytics.passingVsFailingByGradeLevel && analytics.passingVsFailingByGradeLevel.length > 0) {
        let totalPassing = 0;
        let totalAssessed = 0;
        for (const item of analytics.passingVsFailingByGradeLevel) {
          totalPassing += item.passing || 0;
          totalAssessed += ((item.passing || 0) + (item.failing || 0));
        }
        if (totalAssessed > 0) {
          annualPassRate = Math.round((totalPassing / totalAssessed) * 100);
          academicCompleteness = 'complete_annual';
          academicNote = `Verified annual pass rate of ${annualPassRate}% across all complete terms (T1–T4).`;
        }
      } else if (analytics.schoolAverageByGradeLevel && analytics.schoolAverageByGradeLevel.length > 0) {
        academicCompleteness = 'partial_terms';
        annualPassRate = null; // Strictly NULL under locked partial-term rule!
        academicNote = 'Annual promotion pass rate is not available because complete T1–T4 data has not yet been submitted. Records reflect partial-term averages only.';
      }
    } catch {
      academicCompleteness = 'insufficient_data';
      annualPassRate = null;
    }

    return {
      reportPeriod: {
        startDate: startDateStr,
        endDate: endDateStr,
        label: periodLabel
      },
      executiveSummaryFacts: {
        enrolledStudents: factSheet?.students.enrolled ?? null,
        studentsOnCampusToday: factSheet?.students.onCampusNow ?? 0,
        totalActiveFaculty: factSheet?.faculty.totalActive ?? null,
        facultyCheckedInToday: factSheet?.faculty.checkedInToday ?? null
      },
      facultyAttendanceFacts: facultyFacts,
      leaveFacts: {
        pendingApprovalsCount: pendingLeavesCount,
        approvedLeavesCoveringPeriod: approvedPeriodLeavesCount
      },
      administrativeBehaviorFacts: behaviorFacts,
      eventFacts: {
        scheduledEventsCount: weekEvents.length,
        events: weekEvents
      },
      academicCompletenessFacts: {
        completenessStatus: academicCompleteness,
        annualPassRate,
        note: academicNote
      },
      sourceDomains: Array.from(new Set(sourceDomains)),
      generatedAt: new Date().toISOString()
    };
  }
}

export const weeklyReportService = new WeeklyReportService();
