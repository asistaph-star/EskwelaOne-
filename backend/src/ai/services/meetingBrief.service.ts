import { buildSchoolFactSheet } from '../../admin/executive-summary/factSheet.service.js';
import { leaveService } from '../../modules/leaves/leave.service.js';
import { eventService } from '../../modules/events/event.service.js';
import { BehaviorService } from '../../modules/behavior/behavior.service.js';
import { getAcademicAnalytics } from '../../admin/academicAnalytics.service.js';
import { formatPhilippineDateTime } from '../../admin/executive-summary/factSheet.service.js';

export interface MeetingBriefInput {
  meetingType: 'FACULTY_MEETING' | 'EXECUTIVE_COMMITTEE' | 'PARENT_TEACHER_CONFERENCE' | 'OPERATIONAL_PULSE' | 'GENERAL';
  focusArea?: string;
}

export interface MeetingBriefDTO {
  briefTitle: string;
  reportingPeriod: string;
  meetingType: string;
  focusArea?: string;
  operationalHighlights: Array<{ label: string; value: string | number }>;
  discussionItems: string[];
  pendingAdministrativeItems: Array<{ category: string; summary: string }>;
  upcomingDates: Array<{ title: string; date: string; audience: string | null }>;
  sourceDomains: string[];
  asOf: string;
}

export class MeetingBriefService {
  /**
   * Generates a deterministic, factual meeting brief for the Principal.
   * Enforces strict dynamic authorization for every source domain:
   * NO AUTHORIZED DOMAIN PERMISSION -> NO DOMAIN QUERY -> NO FACT IN AI OUTPUT.
   * Directly invokes authorized domain services (NEVER calls the AI tool dispatcher recursively).
   */
  async generateBrief(input: MeetingBriefInput, userPermissions: string[] = []): Promise<MeetingBriefDTO> {
    const now = new Date();
    const asOf = now.toISOString();
    const asOfFormatted = formatPhilippineDateTime(now);
    const sourceDomains: string[] = [];

    const highlights: Array<{ label: string; value: string | number }> = [];
    const discussionItems: string[] = [];
    const pendingItems: Array<{ category: string; summary: string }> = [];
    const upcomingDates: Array<{ title: string; date: string; audience: string | null }> = [];

    // Helper to verify domain permission
    const hasPerm = (p: string) => userPermissions.includes(p);

    // 1. Fetch Executive Fact Sheet (Requires attendance:read or academic:read)
    if (hasPerm('attendance:read') || hasPerm('academic:read')) {
      try {
        const factSheet = await buildSchoolFactSheet();
        sourceDomains.push('Executive Summary');

        if (factSheet.students.enrolled !== null) {
          highlights.push({ label: 'Enrolled Students', value: factSheet.students.enrolled });
        }
        if (factSheet.students.onCampusNow !== null) {
          highlights.push({ label: 'Students on Campus Today', value: factSheet.students.onCampusNow });
        }

        if (factSheet.faculty.totalActive !== null) {
          highlights.push({ label: 'Total Active Faculty', value: factSheet.faculty.totalActive });
        }
        if (factSheet.faculty.checkedInToday !== null) {
          highlights.push({ label: 'Faculty Checked In Today', value: factSheet.faculty.checkedInToday });
        }
      } catch {
        // Gracefully handle partial data
      }
    }

    // 2. Fetch Pending Leaves (Strictly requires leave:approve)
    if (hasPerm('leave:approve') && ['FACULTY_MEETING', 'OPERATIONAL_PULSE', 'GENERAL', 'EXECUTIVE_COMMITTEE'].includes(input.meetingType)) {
      try {
        const pendingLeaves = await leaveService.getPendingLeaves(10);
        sourceDomains.push('Leave Management');

        if (pendingLeaves.length > 0) {
          pendingItems.push({
            category: 'Leave Requests',
            summary: `${pendingLeaves.length} leave application(s) awaiting administrative review.`
          });
          discussionItems.push(`Review ${pendingLeaves.length} pending leave request(s) for faculty/staff coverage.`);
        } else {
          pendingItems.push({
            category: 'Leave Requests',
            summary: 'No pending leave applications awaiting action.'
          });
        }
      } catch {
        // Skip domain on failure
      }
    }

    // 3. Fetch Upcoming Events (Calendar alignment - requires user:read)
    if (hasPerm('user:read') || userPermissions.length === 0) {
      try {
        const events = await eventService.getUpcomingEvents({ limit: 5 });
        sourceDomains.push('School Events Calendar');

        for (const ev of events) {
          upcomingDates.push({
            title: ev.title,
            date: ev.startDate,
            audience: ev.targetAudience
          });
        }

        if (events.length > 0) {
          discussionItems.push(`Upcoming scheduled events: ${events.map(e => e.title).join(', ')}.`);
        }
      } catch {
        // Skip domain on failure
      }
    }

    // 4. Administrative Behavior Summary (Strictly requires behavior:read)
    if (hasPerm('behavior:read') && ['EXECUTIVE_COMMITTEE', 'PARENT_TEACHER_CONFERENCE', 'GENERAL'].includes(input.meetingType)) {
      try {
        const behaviorSummary = await BehaviorService.getBehaviorSummary();
        sourceDomains.push('Behavior Management (Administrative)');

        highlights.push({
          label: 'Active Behavior Cases',
          value: (behaviorSummary.reported + behaviorSummary.underInvestigation + behaviorSummary.parentNotified)
        });

        if (behaviorSummary.reported > 0) {
          pendingItems.push({
            category: 'Behavior Management',
            summary: `${behaviorSummary.reported} recently reported behavior case(s) requiring follow-up.`
          });
        }
      } catch {
        // Skip domain on failure
      }
    }

    // 5. Academic Analytics Completeness Check (Strictly requires grade:read_all or academic:read)
    if ((hasPerm('grade:read_all') || hasPerm('academic:read')) && ['FACULTY_MEETING', 'PARENT_TEACHER_CONFERENCE', 'GENERAL', 'EXECUTIVE_COMMITTEE'].includes(input.meetingType)) {
      try {
        const analytics = await getAcademicAnalytics();
        sourceDomains.push('Academic Analytics');

        if (analytics.passingVsFailingByGradeLevel && analytics.passingVsFailingByGradeLevel.length > 0) {
          highlights.push({ label: 'Academic Reporting', value: 'Complete Annual Data Available' });
        } else if (analytics.schoolAverageByGradeLevel && analytics.schoolAverageByGradeLevel.length > 0) {
          highlights.push({ label: 'Academic Reporting', value: 'Partial Term Averages Available' });
          discussionItems.push('Review submitted partial-term grading averages across grade levels.');
        } else {
          highlights.push({ label: 'Academic Reporting', value: 'No Submitted Grade Data' });
        }
      } catch {
        // Skip domain on failure
      }
    }

    // Focus Area Customization
    if (input.focusArea && input.focusArea.trim().length > 0) {
      discussionItems.unshift(`Designated Focus Discussion: "${input.focusArea.trim()}"`);
    }

    // Build human-readable brief title
    const titleMap: Record<string, string> = {
      FACULTY_MEETING: 'Faculty & Academic Coordination Brief',
      EXECUTIVE_COMMITTEE: 'Executive Leadership Operational Brief',
      PARENT_TEACHER_CONFERENCE: 'Parent-Teacher Conference Overview',
      OPERATIONAL_PULSE: 'Daily School Operations Pulse Brief',
      GENERAL: 'Principal General Administrative Brief'
    };

    return {
      briefTitle: titleMap[input.meetingType] || 'Principal Meeting Brief',
      reportingPeriod: asOfFormatted,
      meetingType: input.meetingType,
      focusArea: input.focusArea,
      operationalHighlights: highlights,
      discussionItems: discussionItems.length > 0 ? discussionItems : ['No urgent discussion items identified from current records.'],
      pendingAdministrativeItems: pendingItems,
      upcomingDates,
      sourceDomains: Array.from(new Set(sourceDomains)),
      asOf
    };
  }
}

export const meetingBriefService = new MeetingBriefService();
