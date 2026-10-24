import { NormalizedNavigationAction } from '../ai.service.js';
import { SCHOOL_NAME } from '../../config/ai.config.js';

export type OperationalDomainName = 
  | 'leaves' 
  | 'faculty_attendance' 
  | 'behavior' 
  | 'academics' 
  | 'events' 
  | 'overview' 
  | 'meeting_brief' 
  | 'weekly_report';

export interface DomainMetadata {
  id: OperationalDomainName;
  displayName: string;
  toolName: string;
  screen: string;
  navAction: NormalizedNavigationAction;
  keywords: RegExp;
  coverageRegex: RegExp;
  defaultArgs?: Record<string, any>;
  summarizeResult: (result: any) => string;
}

export const DOMAIN_CATALOG: Record<OperationalDomainName, DomainMetadata> = {
  leaves: {
    id: 'leaves',
    displayName: 'Leave Management',
    toolName: 'getPendingLeaves',
    screen: 'p-leaves',
    navAction: {
      label: 'Open Leave Management',
      screen: 'p-leaves',
      description: 'Open Leave Management tab',
    },
    keywords: /\b(leaves|vacation|sick leave|leave (?:application|request|approval|status|record|credit|management|balance)s?|pending leave|approved leave|on leave|take(?: a)? leave|faculty leave|staff leave|time off|absence request)\b|(?<!\b(?:i|you|we|they|he|she|before|when|as|after|time to|ready to|going to|plan to)\s+)leave(?!\s+(?:the|campus|school|office|today|early|room|building|now|at|for))\b/i,
    coverageRegex: /\b(leaves|vacation|sick leave|leave (?:application|request)s?|pending leave|approved leave)\b|(?<!\b(?:i|before|when|as|after)\s+)leave(?!\s+(?:the|campus|school|office|today))\b/i,
    defaultArgs: { limit: 10 },
    summarizeResult: (result: any) => {
      const count = result?.totalPending ?? (Array.isArray(result?.requests) ? result.requests.length : 0);
      if (count === 0) {
        return 'No pending leave applications are currently awaiting administrative review in Leave Management.';
      }
      return `${count} faculty leave application(s) are currently pending review in Leave Management.`;
    }
  },

  faculty_attendance: {
    id: 'faculty_attendance',
    displayName: 'Gate Attendance Monitoring',
    toolName: 'getFacultyAttendanceAudit',
    screen: 'p-monitoring',
    navAction: {
      label: 'Open Gate Attendance Monitoring',
      screen: 'p-monitoring',
      description: 'Open Gate Attendance Monitoring tab',
    },
    keywords: /\b(faculty([- ]related)?\s*(attendance|presence|records?|concerns?|issues?|matters?|check(?:ed)?-?\s*ins?|time-?outs?|members?|ones?)|gate\s+(attendance|records?|check(?:ed)?-?\s*ins?|time-?outs?|scan)|check(?:ed)?-?\s*ins?|time-?outs?|attendance(\s+audit|\s+records?|\s+exceptions?)?|approved\s+leaves?|on\s+approved\s+leave)\b/i,
    coverageRegex: /\b(attendance|check(?:ed)?-?\s*in|time-?out|gate records?|faculty|approved\s+leave)\b/i,
    defaultArgs: {},
    summarizeResult: (result: any) => {
      const summary = result?.summary;
      if (summary) {
        return `Faculty attendance audit reflects ${summary.completedCount ?? 0} completed check-ins, ${summary.timeOutPendingCount ?? 0} time-out pending, ${summary.onApprovedLeaveCount ?? 0} on approved leave, and ${summary.noGateCheckInNoApprovedLeaveFoundCount ?? 0} with no gate check-in and no approved leave recorded.`;
      }
      return "Faculty attendance records have been cross-checked against authoritative gate records and leave logs.";
    }
  },

  behavior: {
    id: 'behavior',
    displayName: 'Behavioral Reports',
    toolName: 'getAdministrativeBehaviorSummary',
    screen: 'p-behavior',
    navAction: {
      label: 'View Behavioral Reports',
      screen: 'p-behavior',
      description: 'Open Behavioral Reports tab',
    },
    keywords: /\b(behavior(al)?|disciplin(e|ary)|incidents?|misconduct|student\s+(cases?|matters?|concerns?)|infractions?)\b/i,
    coverageRegex: /\b(behavior|incident|cases?|infraction)\b/i,
    defaultArgs: { limit: 10 },
    summarizeResult: (result: any) => {
      const summary = result?.summary;
      if (summary) {
        const open = (summary.underInvestigation || 0) + (summary.reported || 0);
        return `Administrative behavior logs show ${summary.totalCases ?? 0} total incident(s) with ${open} active case(s) requiring attention.`;
      }
      return "Administrative student behavior logs have been reviewed from authoritative records.";
    }
  },

  academics: {
    id: 'academics',
    displayName: 'Academic Analytics',
    toolName: 'getAcademicAnalytics',
    screen: 'p-analytics',
    navAction: {
      label: 'Open Academic Analytics',
      screen: 'p-analytics',
      description: 'Open Academic Analytics tab',
    },
    keywords: /\b(academics?|grades?|grading|pass rates?|quarterly|t1|t2|t3|t4|completeness|performance|promotion rate)\b/i,
    coverageRegex: /\b(academic|grades?|pass rate|partial terms)\b/i,
    defaultArgs: {},
    summarizeResult: (result: any) => {
      if (result?.academicCompleteness === 'partial_terms') {
        return "Annual academic analytics remain partial terms pending complete quarterly grade submissions across all terms.";
      }
      if (result?.statusNote) {
        return result.statusNote;
      }
      return "Academic analytics have been verified from authoritative grading records.";
    }
  },

  events: {
    id: 'events',
    displayName: 'School Events',
    toolName: 'getUpcomingEvents',
    screen: 'p-events',
    navAction: {
      label: 'Open School Events',
      screen: 'p-events',
      description: 'Open School Events tab',
    },
    keywords: /\b(events?|calendar|schedules?|upcoming|holidays?|activities|important\s+dates?)\b/i,
    coverageRegex: /\b(events?|calendar|schedules?)\b/i,
    defaultArgs: { limit: 10 },
    summarizeResult: (result: any) => {
      const count = result?.totalEvents ?? (Array.isArray(result?.events) ? result.events.length : 0);
      if (count === 0) {
        return "No upcoming events are scheduled on the active school calendar window.";
      }
      return `${count} upcoming event(s) are scheduled on the authoritative school calendar.`;
    }
  },

  overview: {
    id: 'overview',
    displayName: 'Dashboard Overview',
    toolName: 'getSchoolOperationalFactSheet',
    screen: 'p-dashboard',
    navAction: {
      label: 'Open Dashboard Overview',
      screen: 'p-dashboard',
      description: 'Open Dashboard Overview',
    },
    keywords: /\b(fact sheet|pulse|overview|enrolled|on campus|campus population|school operations|inventory)\b/i,
    coverageRegex: /\b(operational|pulse|fact sheet|enrollment|campus)\b/i,
    defaultArgs: {},
    summarizeResult: (_result: any) => {
      return "The daily operational fact sheet reflects authoritative student enrollment, campus presence, and operational counters.";
    }
  },

  meeting_brief: {
    id: 'meeting_brief',
    displayName: 'Dashboard Overview',
    toolName: 'generatePrincipalMeetingBrief',
    screen: 'p-dashboard',
    navAction: {
      label: 'Open Dashboard Overview',
      screen: 'p-dashboard',
      description: 'Open Dashboard Overview',
    },
    keywords: /\b(meeting brief|faculty meeting|executive committee|prepare for.*meeting|prepare me for.*meeting)\b/i,
    coverageRegex: /\b(meeting brief|faculty meeting)\b/i,
    defaultArgs: { meetingType: 'GENERAL' },
    summarizeResult: (_result: any) => {
      return "Here is your executive faculty meeting brief compiled from authoritative school records.";
    }
  },

  weekly_report: {
    id: 'weekly_report',
    displayName: 'Dashboard Overview',
    toolName: 'generateWeeklyOperationsReport',
    screen: 'p-dashboard',
    navAction: {
      label: 'Open Dashboard Overview',
      screen: 'p-dashboard',
      description: 'Open Dashboard Overview',
    },
    keywords: /\b(weekly report|weekly operations|weekly summary|operations report|summarize this week.*operations)\b/i,
    coverageRegex: /\b(weekly operations|weekly report)\b/i,
    defaultArgs: {},
    summarizeResult: (_result: any) => {
      return `Here is the weekly operations summary report for ${SCHOOL_NAME}.`;
    }
  }
};
