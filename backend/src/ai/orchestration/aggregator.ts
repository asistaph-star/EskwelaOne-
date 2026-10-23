import { ExecutedToolResult } from './planExecutor.js';
import { PrincipalRequestPlan } from './requestPlanner.js';

export interface CorrelationFinding {
  domainA: string;
  domainB: string;
  description: string;
}

export interface ReviewPriorityItem {
  priority: number;
  domain: string;
  item: string;
  urgency: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface AggregationResult {
  correlations: CorrelationFinding[];
  priorities: ReviewPriorityItem[];
  priorityDisclaimer?: string;
  mergedSourceDomains: string[];
  unrelatedDomains?: string[];
}

/**
 * Normalizes facts, discovers safe factual correlations, and computes review priority with disclaimers.
 */
export function aggregateFacts(
  plan: PrincipalRequestPlan,
  executedResults: ExecutedToolResult[]
): AggregationResult {
  const correlations: CorrelationFinding[] = [];
  const priorities: ReviewPriorityItem[] = [];
  const allSourceDomains = new Set<string>();

  // Collect source domains
  for (const item of executedResults) {
    if (!item.success || !item.result) continue;
    const doms = item.result?.provenance?.sourceDomains || item.result?.sourceDomains;
    if (Array.isArray(doms)) {
      doms.forEach((d: string) => allSourceDomains.add(d));
    }
  }

  const attendanceRes = executedResults.find(r => r.name === 'getFacultyAttendanceAudit' && r.success)?.result;
  const leavesRes = executedResults.find(r => r.name === 'getPendingLeaves' && r.success)?.result;
  const behaviorRes = executedResults.find(r => r.name === 'getAdministrativeBehaviorSummary' && r.success)?.result;
  const factSheetRes = executedResults.find(r => r.name === 'getSchoolOperationalFactSheet' && r.success)?.result;

  // ─── 1. Correlation Analysis (Authoritative Match + Date Overlap Only) ─
  if (attendanceRes && leavesRes) {
    const attRecords: any[] = attendanceRes.records || [];
    const leaveRequests: any[] = leavesRes.requests || [];
    const attDate: string = attendanceRes.asOfDate || new Date().toISOString().split('T')[0];

    for (const att of attRecords) {
      if (att.attendanceStatus === 'NO_GATE_CHECK_IN_NO_APPROVED_LEAVE_FOUND') {
        const matchingLeave = leaveRequests.find(l => {
          const matchId = (att.userId && l.userId && att.userId === l.userId);
          const matchName = att.teacherDisplayName && l.applicantDisplayName &&
            att.teacherDisplayName.trim().toLowerCase() === l.applicantDisplayName.trim().toLowerCase();
          
          if (!matchId && !matchName) return false;

          // Check date overlap
          if (l.startDate && l.endDate) {
            return attDate >= l.startDate && attDate <= l.endDate;
          }
          return false;
        });

        if (matchingLeave) {
          correlations.push({
            domainA: 'Faculty Attendance',
            domainB: 'Leave Management',
            description: `${att.teacherDisplayName} has no gate check-in recorded on ${attDate} and a pending leave application (${matchingLeave.leaveType}) covering ${matchingLeave.startDate} to ${matchingLeave.endDate}.`,
          });
        }
      }
    }
  }

  // ─── 2. Review Prioritization (Suggested Order + Policy Disclaimer) ───
  let priorityCounter = 1;

  if (attendanceRes?.summary?.noGateCheckInNoApprovedLeaveFoundCount > 0) {
    priorities.push({
      priority: priorityCounter++,
      domain: 'Gate Attendance Monitoring',
      item: `${attendanceRes.summary.noGateCheckInNoApprovedLeaveFoundCount} faculty member(s) with no gate check-in and no approved leave record found.`,
      urgency: 'HIGH',
    });
  }

  if (leavesRes?.totalPending > 0) {
    priorities.push({
      priority: priorityCounter++,
      domain: 'Leave Management',
      item: `${leavesRes.totalPending} faculty leave application(s) awaiting administrative review.`,
      urgency: 'MEDIUM',
    });
  }

  if (behaviorRes?.summary) {
    const openCases = (behaviorRes.summary.underInvestigation || 0) + (behaviorRes.summary.reported || 0);
    if (openCases > 0) {
      priorities.push({
        priority: priorityCounter++,
        domain: 'Behavioral Reports',
        item: `${openCases} open student behavior incident(s) currently under investigation or reported.`,
        urgency: 'MEDIUM',
      });
    }
  }

  const academicsRes = executedResults.find(r => r.name === 'getAcademicAnalytics' && r.success)?.result;
  const eventsRes = executedResults.find(r => r.name === 'getUpcomingEvents' && r.success)?.result;

  if (academicsRes?.academicCompleteness === 'partial_terms' || factSheetRes?.academics?.academicCompleteness === 'partial_terms') {
    priorities.push({
      priority: priorityCounter++,
      domain: 'Academic Analytics',
      item: 'Annual promotion metrics remain pending until complete T1–T4 term grade submissions are finalized.',
      urgency: 'MEDIUM',
    });
  }

  const upcomingEventsCount = eventsRes?.totalEvents ?? factSheetRes?.operations?.upcomingEventsCount ?? 0;
  if (upcomingEventsCount > 0) {
    priorities.push({
      priority: priorityCounter++,
      domain: 'School Events',
      item: `${upcomingEventsCount} scheduled upcoming operational event(s) on the school calendar.`,
      urgency: 'LOW',
    });
  }

  // ─── 3. Unrelated Domains Identification (Requirement 23) ───────────
  const correlatedDomains = new Set<string>();
  for (const c of correlations) {
    correlatedDomains.add(c.domainA.toLowerCase());
    correlatedDomains.add(c.domainB.toLowerCase());
  }

  const executedDomainNames = executedResults
    .filter(r => r.success)
    .map(r => {
      if (r.name === 'getFacultyAttendanceAudit') return 'Faculty Attendance';
      if (r.name === 'getPendingLeaves') return 'Leave Management';
      if (r.name === 'getAdministrativeBehaviorSummary') return 'Behavioral Reports';
      if (r.name === 'getAcademicAnalytics') return 'Academic Analytics';
      if (r.name === 'getUpcomingEvents') return 'School Events';
      if (r.name === 'getSchoolOperationalFactSheet') return 'Dashboard Overview';
      return r.name;
    });

  const unrelatedDomains = executedDomainNames.filter(d => !correlatedDomains.has(d.toLowerCase()));

  return {
    correlations,
    priorities,
    priorityDisclaimer: priorities.length > 0
      ? '(Suggested review order based on operational urgency; not DepEd policy)'
      : undefined,
    mergedSourceDomains: Array.from(allSourceDomains),
    unrelatedDomains,
  };
}
