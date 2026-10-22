import { AIMessage } from '../provider/aiProvider.interface.js';
import { DOMAIN_CATALOG, OperationalDomainName } from './domainCatalog.js';
import { NormalizedNavigationAction } from '../ai.service.js';

export interface PlannedToolDispatch {
  name: string;
  args: Record<string, any>;
}

export interface PlanObligation {
  domain: OperationalDomainName;
  operation: 'retrieve' | 'count' | 'compare' | 'correlate' | 'explain' | 'summarize' | 'prioritize' | 'draft';
  description: string;
}

export type PlannedIntentType = 
  | 'SWEEP' 
  | 'MEETING_BRIEF' 
  | 'WEEKLY_BRIEF' 
  | 'ATTENDANCE_CROSSCHECK' 
  | 'MULTI_DOMAIN' 
  | 'SINGLE_DOMAIN' 
  | 'NAVIGATION' 
  | 'CLARIFICATION' 
  | 'SOCIAL' 
  | 'DRAFT' 
  | 'OUT_OF_SCOPE' 
  | 'DYNAMIC';

export interface PrincipalRequestPlan {
  intent: PlannedIntentType;
  toolsToExecute: PlannedToolDispatch[];
  primaryToolName: string;
  obligations: PlanObligation[];
  navigationOnly?: boolean;
  navigationAction?: NormalizedNavigationAction;
  directResponseContent?: string;
  clarificationMessage?: string;
  isDraft?: boolean;
  isCorrelate?: boolean;
  isPrioritize?: boolean;
  isOutOfScope?: boolean;
  skipFeatureMenuRule?: boolean;
}

/**
 * Intelligent, provider-independent Request Planner for Principal queries.
 * Analyzes clauses, intent, domains, and conversational context to produce a deterministic execution plan.
 */
export function buildRequestPlan(
  messages: AIMessage[],
  userRole: string,
  portal: string,
  allowedToolNames: Set<string>
): PrincipalRequestPlan | null {
  const isPrincipal = portal.toLowerCase() === 'principal' || userRole.toLowerCase() === 'principal';
  if (!isPrincipal) {
    return null;
  }

  const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
  const raw = (lastUserMsg?.content || '').trim();
  const lower = raw.toLowerCase();

  if (!raw) {
    return null;
  }

  // ─── 1. Out-of-Scope Boundary Check ────────────────────────────────────
  const outOfScopePatterns = [
    /\b(write|create|generate)\s+(a\s+)?(python|javascript|typescript|c\+\+|code|script|sql\s+query)\b/i,
    /\b(capital of|weather in|recipe for|stock price of|movie recommendations?)\b/i,
    /\b(write an essay about|tell me a joke|who won the world cup)\b/i,
  ];
  const matchesNonSchoolPattern = outOfScopePatterns.some(p => p.test(lower));
  const matchesAnySchoolDomain = Object.values(DOMAIN_CATALOG).some(d => d.keywords.test(lower));

  if (matchesNonSchoolPattern && !matchesAnySchoolDomain) {
    return {
      intent: 'OUT_OF_SCOPE',
      toolsToExecute: [],
      primaryToolName: '',
      obligations: [],
      isOutOfScope: true,
      directResponseContent: 'I am the DigiSkwela school operations assistant. I can only assist with authorized school management, attendance, leave records, academic analytics, and calendar operations.',
    };
  }

  // ─── 2. Social / Courtesy Invariants ──────────────────────────────────
  if (/\b(thank\s*you|thanks|many\s*thanks|thank\s*u|salamat)\b/i.test(lower)) {
    return {
      intent: 'SOCIAL',
      toolsToExecute: [],
      primaryToolName: '',
      obligations: [],
      directResponseContent: 'You’re welcome.',
    };
  }

  if (/^(hello|hi|hey|good\s*(morning|afternoon|evening))\b/i.test(lower) && lower.split(/\s+/).length <= 4) {
    return {
      intent: 'SOCIAL',
      toolsToExecute: [],
      primaryToolName: '',
      obligations: [],
      directResponseContent: 'Good day. How may I assist you with school operations?',
    };
  }

  // ─── 3. Navigation & Contextual Guidance ──────────────────────────────
  const isNavQuery = (
    lower.startsWith('where do i') ||
    lower.startsWith('where can i') ||
    lower.startsWith('how do i') ||
    lower.startsWith('how can i') ||
    lower.startsWith('where to') ||
    lower.includes('help me find or understand') ||
    lower.includes('which digiskwela feature')
  );

  if (isNavQuery) {
    const hasDataQuestion = (
      /\b(and|also|\?.*\w)\b.*\b(are there|how many|is there|any|show me|check|what are|cases?|unresolved|pending|exceptions?)\b/i.test(lower) ||
      (/\b(where do i|where can i|how do i)\b/i.test(lower) && /\b(and\s+(are|is|do|how|what)|unresolved|pending|active)\b/i.test(lower))
    );

    // Composite Navigation + Data Question (e.g. "Where do I review behavioral reports, and are there any unresolved cases?")
    if (hasDataQuestion) {
      if ((lower.includes('behavior') || lower.includes('incident')) && allowedToolNames.has('getAdministrativeBehaviorSummary')) {
        return {
          intent: 'MULTI_DOMAIN',
          toolsToExecute: [{ name: 'getAdministrativeBehaviorSummary', args: { limit: 10 } }],
          primaryToolName: 'getAdministrativeBehaviorSummary',
          navigationAction: DOMAIN_CATALOG.behavior.navAction,
          obligations: [
            { domain: 'behavior', operation: 'retrieve', description: 'Navigate to Behavioral Reports and retrieve active cases' }
          ],
          skipFeatureMenuRule: true,
        };
      }
      if ((lower.includes('attendance') || lower.includes('gate')) && allowedToolNames.has('getFacultyAttendanceAudit')) {
        return {
          intent: 'MULTI_DOMAIN',
          toolsToExecute: [{ name: 'getFacultyAttendanceAudit', args: {} }],
          primaryToolName: 'getFacultyAttendanceAudit',
          navigationAction: DOMAIN_CATALOG.faculty_attendance.navAction,
          obligations: [
            { domain: 'faculty_attendance', operation: 'retrieve', description: 'Navigate to Gate Attendance Monitoring and audit presence' }
          ],
          skipFeatureMenuRule: true,
        };
      }
      if ((lower.includes('leave') || lower.includes('vacation')) && allowedToolNames.has('getPendingLeaves')) {
        return {
          intent: 'MULTI_DOMAIN',
          toolsToExecute: [{ name: 'getPendingLeaves', args: { limit: 10 } }],
          primaryToolName: 'getPendingLeaves',
          navigationAction: DOMAIN_CATALOG.leaves.navAction,
          obligations: [
            { domain: 'leaves', operation: 'retrieve', description: 'Navigate to Leave Management and check pending requests' }
          ],
          skipFeatureMenuRule: true,
        };
      }
    }

    // Pure Navigation guidance
    if (lower.includes('attendance') || lower.includes('gate') || lower.includes('check-in')) {
      return {
        intent: 'NAVIGATION',
        toolsToExecute: [],
        primaryToolName: '',
        obligations: [],
        navigationOnly: true,
        navigationAction: DOMAIN_CATALOG.faculty_attendance.navAction,
        directResponseContent: 'You can review faculty attendance in Gate Attendance Monitoring. You can also view registered profiles and schedules in Teacher Management.',
      };
    }
    if (lower.includes('leave') || lower.includes('vacation')) {
      return {
        intent: 'NAVIGATION',
        toolsToExecute: [],
        primaryToolName: '',
        obligations: [],
        navigationOnly: true,
        navigationAction: DOMAIN_CATALOG.leaves.navAction,
        directResponseContent: 'You can review, approve, or deny pending faculty leave applications in the Leave Management module under Administration.',
      };
    }
    if (lower.includes('behavior') || lower.includes('discipline') || lower.includes('incident')) {
      return {
        intent: 'NAVIGATION',
        toolsToExecute: [],
        primaryToolName: '',
        obligations: [],
        navigationOnly: true,
        navigationAction: DOMAIN_CATALOG.behavior.navAction,
        directResponseContent: 'You can view logged student disciplinary incidents and behavioral cases in the Behavioral Reports module under Operations.',
      };
    }
    if (lower.includes('academic') || lower.includes('grade') || lower.includes('completeness')) {
      return {
        intent: 'NAVIGATION',
        toolsToExecute: [],
        primaryToolName: '',
        obligations: [],
        navigationOnly: true,
        navigationAction: DOMAIN_CATALOG.academics.navAction,
        directResponseContent: 'You can inspect grading progress and quarterly performance summaries in the Academic Analytics module under Administration.',
      };
    }
    if (lower.includes('teacher') || lower.includes('faculty profile')) {
      return {
        intent: 'NAVIGATION',
        toolsToExecute: [],
        primaryToolName: '',
        obligations: [],
        navigationOnly: true,
        navigationAction: {
          label: 'Open Teacher Management',
          screen: 'p-teachers',
          description: 'Open Teacher Management tab',
        },
        directResponseContent: 'You can manage teacher assignments and profile records in Teacher Management under Administration.',
      };
    }
    if (lower.includes('event') || lower.includes('calendar')) {
      return {
        intent: 'NAVIGATION',
        toolsToExecute: [],
        primaryToolName: '',
        obligations: [],
        navigationOnly: true,
        navigationAction: DOMAIN_CATALOG.events.navAction,
        directResponseContent: 'You can view and schedule school events on the School Events calendar under Operations.',
      };
    }

    return {
      intent: 'NAVIGATION',
      toolsToExecute: [],
      primaryToolName: '',
      obligations: [],
      navigationOnly: true,
      directResponseContent: 'Which DigiSkwela feature do you need help with?',
    };
  }

  // ─── 4. Conversational Pronouns & Follow-up Anaphora ───────────────────
  const isFollowUpQuery = (
    /\b(them|which of (them|those)|who among them|who of them|any of them|what about them)\b/i.test(lower) ||
    (/\b(which of (those|them)|what.*(check|review) first|which.*first)\b/i.test(lower) && /\b(those|them|these)\b/i.test(lower))
  );
  if (isFollowUpQuery) {
    const previousMessages = messages.slice(0, -1);

    // Follow-up prioritization ("Which of those should I check first?")
    if (/\b(which of (those|them).*(first|priority)|what.*(check|review) first|which.*(check|review) first|which.*first)\b/i.test(lower)) {
      const hadOperationalContext = previousMessages.some(m => {
        const c = (m.content || '').toLowerCase();
        return c.includes('faculty') || c.includes('attendance') || c.includes('leave') || c.includes('behavior') || c.includes('academic') || m.role === 'tool';
      });

      if (hadOperationalContext) {
        const tools: PlannedToolDispatch[] = [];
        if (allowedToolNames.has('getFacultyAttendanceAudit')) tools.push({ name: 'getFacultyAttendanceAudit', args: {} });
        if (allowedToolNames.has('getPendingLeaves')) tools.push({ name: 'getPendingLeaves', args: { limit: 10 } });
        if (allowedToolNames.has('getAdministrativeBehaviorSummary')) tools.push({ name: 'getAdministrativeBehaviorSummary', args: { limit: 10 } });

        if (tools.length > 0) {
          const obligations: PlanObligation[] = [];
          if (allowedToolNames.has('getFacultyAttendanceAudit')) {
            obligations.push({ domain: 'faculty_attendance', operation: 'prioritize', description: 'Faculty attendance exceptions review order' });
          }
          if (allowedToolNames.has('getPendingLeaves')) {
            obligations.push({ domain: 'leaves', operation: 'prioritize', description: 'Pending leaves review order' });
          }
          if (allowedToolNames.has('getAdministrativeBehaviorSummary')) {
            obligations.push({ domain: 'behavior', operation: 'prioritize', description: 'Behavior incidents review order' });
          }
          return {
            intent: 'MULTI_DOMAIN',
            toolsToExecute: tools,
            primaryToolName: tools[0].name,
            obligations,
            isPrioritize: true,
            skipFeatureMenuRule: true,
          };
        }
      }
    }

    // Follow-up attendance status filtering ("Which of them are on approved leave?")
    const hadFacultyAttendanceContext = previousMessages.some(m => {
      const c = (m.content || '').toLowerCase();
      return c.includes('faculty') || c.includes('attendance') || c.includes('check-in') || m.name === 'getFacultyAttendanceAudit';
    });

    if (hadFacultyAttendanceContext && allowedToolNames.has('getFacultyAttendanceAudit')) {
      let statusFilter: 'ALL' | 'COMPLETED' | 'TIME_OUT_PENDING' | 'ON_APPROVED_LEAVE' | 'NO_GATE_CHECK_IN_NO_APPROVED_LEAVE_FOUND' = 'ALL';

      if (lower.includes('leave') || lower.includes('approved')) {
        statusFilter = 'ON_APPROVED_LEAVE';
      } else if (lower.includes('no check-in') || lower.includes('no gate') || lower.includes('missing')) {
        statusFilter = 'NO_GATE_CHECK_IN_NO_APPROVED_LEAVE_FOUND';
      } else if (lower.includes('time-out') || lower.includes('time out') || lower.includes('pending')) {
        statusFilter = 'TIME_OUT_PENDING';
      } else if (lower.includes('completed')) {
        statusFilter = 'COMPLETED';
      }

      return {
        intent: 'SINGLE_DOMAIN',
        toolsToExecute: [
          { name: 'getFacultyAttendanceAudit', args: { statusFilter } }
        ],
        primaryToolName: 'getFacultyAttendanceAudit',
        obligations: [
          { domain: 'faculty_attendance', operation: 'retrieve', description: `Faculty attendance with statusFilter=${statusFilter}` }
        ]
      };
    }

    // Ambiguous follow-up without antecedent: honest clarification
    return {
      intent: 'CLARIFICATION',
      toolsToExecute: [],
      primaryToolName: '',
      obligations: [],
      clarificationMessage: 'Could you please clarify who you are referring to? For example, are you asking about faculty attendance or staff leave applications?',
    };
  }

  // ─── 5. Meeting Brief Intent ──────────────────────────────────────────
  const isMeetingBrief = (
    /\b(meeting\s+(brief|prep(aration)?)|prepare(\s+me)?\s+for.*meeting|faculty\s+meeting|executive\s+meeting)\b/i.test(lower)
  ) && !lower.includes('weekly');

  if (isMeetingBrief && allowedToolNames.has('generatePrincipalMeetingBrief')) {
    let meetingType: 'FACULTY_MEETING' | 'EXECUTIVE_COMMITTEE' | 'PARENT_TEACHER_CONFERENCE' | 'OPERATIONAL_PULSE' | 'GENERAL' = 'FACULTY_MEETING';
    if (lower.includes('executive')) meetingType = 'EXECUTIVE_COMMITTEE';
    else if (lower.includes('parent') || lower.includes('ptc')) meetingType = 'PARENT_TEACHER_CONFERENCE';
    else if (lower.includes('pulse')) meetingType = 'OPERATIONAL_PULSE';

    return {
      intent: 'MEETING_BRIEF',
      toolsToExecute: [
        { name: 'generatePrincipalMeetingBrief', args: { meetingType } }
      ],
      primaryToolName: 'generatePrincipalMeetingBrief',
      obligations: [
        { domain: 'meeting_brief', operation: 'summarize', description: `Meeting brief for ${meetingType}` }
      ]
    };
  }

  // ─── 6. Weekly Operations Report Intent ────────────────────────────────
  const isWeeklyBrief = (
    /\b(weekly\s+(operations?\s+)?(report|summary|brief)|summarize\s+(this\s+week('s)?|weekly)\b.*operations?)\b/i.test(lower) ||
    (lower.includes('week') && lower.includes('operation'))
  );

  if (isWeeklyBrief && allowedToolNames.has('generateWeeklyOperationsReport')) {
    return {
      intent: 'WEEKLY_BRIEF',
      toolsToExecute: [
        { name: 'generateWeeklyOperationsReport', args: {} }
      ],
      primaryToolName: 'generateWeeklyOperationsReport',
      obligations: [
        { domain: 'weekly_report', operation: 'summarize', description: 'Weekly school operations report' }
      ]
    };
  }

  // ─── 7. Attendance Cross-Check Intent ──────────────────────────────────
  const isAttendanceCrossCheck = !lower.includes('pending') && !lower.includes('behavior') && !lower.includes('incident') && !lower.includes('cases') && (
    /\b(cross-?check|audit)\b.*\b(attendance|gate(\s+records?|\s+check-?ins?)?)\b.*\b(approved\s+)?leaves?\b/i.test(lower) ||
    /\b(check|audit|cross-?check)\b.*\bfaculty\s+(gate\s+records?|attendance)\b.*\b(approved\s+)?leaves?\b/i.test(lower) ||
    /\b(gate\s+records?|gate\s+check-?ins?|faculty\s+attendance)\b.*\b(against|with)\b.*\b(approved\s+)?leaves?\b/i.test(lower) ||
    /\b(faculty\s+.*unresolved|attendance\s+.*exception|unresolved.*faculty)\b.*\b(explained|covered)\s+by\s+(approved\s+)?leaves?\b/i.test(lower)
  );

  if (isAttendanceCrossCheck && allowedToolNames.has('getFacultyAttendanceAudit')) {
    const tools: PlannedToolDispatch[] = [
      { name: 'getFacultyAttendanceAudit', args: {} }
    ];
    const obligations: PlanObligation[] = [
      { domain: 'faculty_attendance', operation: 'correlate', description: 'Audit faculty gate check-ins correlated with approved leaves' }
    ];
    if (allowedToolNames.has('getPendingLeaves')) {
      tools.push({ name: 'getPendingLeaves', args: { limit: 10 } });
      obligations.push({ domain: 'leaves', operation: 'correlate', description: 'Pending leave applications cross-check' });
    }

    return {
      intent: 'ATTENDANCE_CROSSCHECK',
      toolsToExecute: tools,
      primaryToolName: 'getFacultyAttendanceAudit',
      obligations,
      isCorrelate: true,
      skipFeatureMenuRule: true,
    };
  }

  // ─── 8. Attention Sweep Intent ("What needs my review/attention today?") ─
  const isAttentionSweep = (
    /\b(what\s+needs\s+(my\s+)?(review|attention)|what\s+should\s+i\s+(review|attend\s+to)|items?\s+needing\s+(review|attention)|operational\s+exceptions?)\b/i.test(lower) ||
    (/\b(review|attention)\s+today\b/i.test(lower) && /\b(what|need|item|exception|pulse)\b/i.test(lower))
  );

  if (isAttentionSweep) {
    const tools: PlannedToolDispatch[] = [];
    const obligations: PlanObligation[] = [];

    // Exact required order for parity:
    // 1. Attendance audit
    if (allowedToolNames.has('getFacultyAttendanceAudit')) {
      tools.push({ name: 'getFacultyAttendanceAudit', args: {} });
      obligations.push({ domain: 'faculty_attendance', operation: 'retrieve', description: 'Faculty attendance exceptions' });
    }
    // 2. Pending leaves
    if (allowedToolNames.has('getPendingLeaves')) {
      tools.push({ name: 'getPendingLeaves', args: { limit: 10 } });
      obligations.push({ domain: 'leaves', operation: 'retrieve', description: 'Pending leave requests' });
    }
    // 3. Behavior summary
    if (allowedToolNames.has('getAdministrativeBehaviorSummary')) {
      tools.push({ name: 'getAdministrativeBehaviorSummary', args: { limit: 10 } });
      obligations.push({ domain: 'behavior', operation: 'retrieve', description: 'Administrative behavior summary' });
    }
    // 4. Fact sheet (last so MockAIProvider outputs fact sheet review narrative)
    if (allowedToolNames.has('getSchoolOperationalFactSheet')) {
      tools.push({ name: 'getSchoolOperationalFactSheet', args: {} });
      obligations.push({ domain: 'overview', operation: 'summarize', description: 'Operational fact sheet pulse' });
    }

    if (tools.length > 0) {
      return {
        intent: 'SWEEP',
        toolsToExecute: tools,
        primaryToolName: 'getSchoolOperationalFactSheet',
        obligations,
        skipFeatureMenuRule: true,
      };
    }
  }

  // ─── 9. Administrative Drafting Intent (Read-Only) ─────────────────────
  const isDraftRequest = /\b(draft|prepare memo|write memo|draft communication|draft reminder)\b/i.test(lower);
  if (isDraftRequest) {
    if ((lower.includes('grade') || lower.includes('academic') || lower.includes('term')) && allowedToolNames.has('getAcademicAnalytics')) {
      return {
        intent: 'DRAFT',
        toolsToExecute: [{ name: 'getAcademicAnalytics', args: {} }],
        primaryToolName: 'getAcademicAnalytics',
        obligations: [{ domain: 'academics', operation: 'draft', description: 'Draft academic grading reminder memo' }],
        isDraft: true,
      };
    }
    if ((lower.includes('leave') || lower.includes('coverage')) && allowedToolNames.has('getPendingLeaves')) {
      return {
        intent: 'DRAFT',
        toolsToExecute: [{ name: 'getPendingLeaves', args: { limit: 10 } }],
        primaryToolName: 'getPendingLeaves',
        obligations: [{ domain: 'leaves', operation: 'draft', description: 'Draft faculty leave coordination memo' }],
        isDraft: true,
      };
    }
    if (allowedToolNames.has('getFacultyAttendanceAudit')) {
      return {
        intent: 'DRAFT',
        toolsToExecute: [{ name: 'getFacultyAttendanceAudit', args: {} }],
        primaryToolName: 'getFacultyAttendanceAudit',
        obligations: [{ domain: 'faculty_attendance', operation: 'draft', description: 'Draft attendance memo' }],
        isDraft: true,
      };
    }
  }

  // ─── 10. Multi-Domain & General Inquiries ──────────────────────────────
  // Detect operations requested
  const isCount = /\b(how many|count of|number of|total)\b/i.test(lower);
  const isExplain = /\b(why|reason|explain why|preventing)\b/i.test(lower);
  const isCompare = /\b(compare|versus|vs\.?|difference between)\b/i.test(lower);
  const isCorrelate = /\b(correlate|cross-?check|link|relationship|overlap|relate\s+to\s+one\s+another|explained\s+by|separate\s+anything\s+unrelated)\b/i.test(lower);
  const isPrioritize = /\b(prioritize|priority|order\s+for\s+what\s+i\s+should\s+review|what\s+should\s+i\s+(look\s+at|review|check)\s+first|review\s+order|order\s+of\s+review|short\s+order)\b/i.test(lower);

  // Identify mentioned domains
  const mentionedDomains: OperationalDomainName[] = [];
  if (DOMAIN_CATALOG.leaves.keywords.test(lower)) mentionedDomains.push('leaves');
  if (DOMAIN_CATALOG.faculty_attendance.keywords.test(lower)) mentionedDomains.push('faculty_attendance');
  if (DOMAIN_CATALOG.behavior.keywords.test(lower)) mentionedDomains.push('behavior');
  if (DOMAIN_CATALOG.academics.keywords.test(lower)) mentionedDomains.push('academics');
  if (DOMAIN_CATALOG.events.keywords.test(lower)) mentionedDomains.push('events');
  if (DOMAIN_CATALOG.overview.keywords.test(lower)) mentionedDomains.push('overview');

  // Simple Narrow Query Invariant:
  // If only 1 domain is mentioned with a simple count or explain:
  if (mentionedDomains.length === 1 && (isCount || isExplain) && !isCompare && !isCorrelate && !isPrioritize) {
    const domainName = mentionedDomains[0];
    const catalogEntry = DOMAIN_CATALOG[domainName];
    if (allowedToolNames.has(catalogEntry.toolName)) {
      const op = isCount ? 'count' : 'explain';
      return {
        intent: 'SINGLE_DOMAIN',
        toolsToExecute: [{ name: catalogEntry.toolName, args: catalogEntry.defaultArgs || {} }],
        primaryToolName: catalogEntry.toolName,
        obligations: [{ domain: domainName, operation: op, description: `${op} for ${catalogEntry.displayName}` }],
      };
    }
  }

  // If prioritization is requested without explicit domains, check urgent domains:
  if (isPrioritize && mentionedDomains.length === 0) {
    mentionedDomains.push('faculty_attendance', 'leaves', 'behavior');
  }

  // If correlation is requested between attendance and leaves, make sure both are included:
  if (isCorrelate && (mentionedDomains.includes('faculty_attendance') || mentionedDomains.includes('leaves'))) {
    if (!mentionedDomains.includes('faculty_attendance')) mentionedDomains.push('faculty_attendance');
    if (!mentionedDomains.includes('leaves')) mentionedDomains.push('leaves');
  }

  // Build tools for mentioned domains
  if (mentionedDomains.length > 0) {
    const tools: PlannedToolDispatch[] = [];
    const obligations: PlanObligation[] = [];

    for (const domainName of mentionedDomains) {
      const catalogEntry = DOMAIN_CATALOG[domainName];
      if (allowedToolNames.has(catalogEntry.toolName)) {
        // avoid duplicate tool dispatches
        if (!tools.some(t => t.name === catalogEntry.toolName)) {
          tools.push({ name: catalogEntry.toolName, args: catalogEntry.defaultArgs || {} });
        }
        let op: PlanObligation['operation'] = 'retrieve';
        if (isCount) op = 'count';
        else if (isExplain) op = 'explain';
        else if (isCompare) op = 'compare';
        else if (isCorrelate) op = 'correlate';
        else if (isPrioritize) op = 'prioritize';

        obligations.push({
          domain: domainName,
          operation: op,
          description: `${op} on ${catalogEntry.displayName}`
        });
      }
    }

    if (tools.length > 0) {
      const primaryToolName = tools[0].name;
      return {
        intent: tools.length > 1 ? 'MULTI_DOMAIN' : 'SINGLE_DOMAIN',
        toolsToExecute: tools,
        primaryToolName,
        obligations,
        isCorrelate,
        isPrioritize,
        skipFeatureMenuRule: tools.length > 1,
      };
    }
  }

  // Ambiguous or unmapped: Let dynamic model-assisted planning execute
  return {
    intent: 'DYNAMIC',
    toolsToExecute: [],
    primaryToolName: '',
    obligations: [],
  };
}
