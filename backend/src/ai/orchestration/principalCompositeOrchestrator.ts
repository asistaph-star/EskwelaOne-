/**
 * DIGISKWELA — Principal AI Composite Intent Orchestrator
 * 
 * Provides deterministic, backend-governed orchestration for high-value Principal composite intents:
 * 1. Needs Attention ("What needs my review today?")
 *    - Deterministically ensures all 5 authorized operational domains are considered:
 *      * Pending leave requests
 *      * Faculty attendance exceptions (gate records vs approved leaves)
 *      * Unresolved behavior cases
 *      * Academic grading completeness
 *      * Upcoming operational events
 * 2. Meeting Brief ("Prepare me for my next faculty meeting.")
 *    - Deterministically dispatches generatePrincipalMeetingBrief
 * 3. Weekly Brief ("Summarize this week's school operations.")
 *    - Deterministically dispatches generateWeeklyOperationsReport
 * 4. Cross-check Attendance ("Check faculty gate records against approved leaves.")
 *    - Deterministically dispatches getFacultyAttendanceAudit
 * 
 * Invariants:
 * - Simple factual queries (e.g., "How many pending leaves are there?") remain narrow.
 * - Navigation queries (e.g., "Where do I review faculty attendance?") remain navigation only.
 * - Every dispatched tool MUST be authorized in the user's role/permission allowlist.
 * - Provider choice (Groq vs Cloudflare) does NOT decide which operational domains are omitted.
 */

export interface ToolDispatchPlan {
  name: string;
  args: Record<string, any>;
}

export interface PrincipalCompositeIntentPlan {
  intent: 'NEEDS_ATTENTION' | 'MEETING_BRIEF' | 'WEEKLY_BRIEF' | 'ATTENDANCE_CROSSCHECK';
  toolsToExecute: ToolDispatchPlan[];
  primaryToolName: string;
}

/**
 * Classifies whether an incoming query from a Principal is a high-value composite intent.
 * Returns the deterministic execution plan, or null if the query should use dynamic single-tool dispatch.
 */
export function detectPrincipalCompositeIntent(
  prompt: string,
  userRole: string,
  portal: string,
  allowedToolNames: Set<string>
): PrincipalCompositeIntentPlan | null {
  // Only apply to Principal portal or Principal authenticated role
  const isPrincipal = portal.toLowerCase() === 'principal' || userRole.toLowerCase() === 'principal';
  if (!isPrincipal) {
    return null;
  }

  const raw = prompt.trim();
  const lower = raw.toLowerCase();

  // ─── 1. Exclude Navigation & Help Queries ────────────────────────────
  if (
    lower.startsWith('where do i') ||
    lower.startsWith('where can i') ||
    lower.startsWith('how do i') ||
    lower.startsWith('where to') ||
    lower.includes('help me find or understand') ||
    lower.includes('which digiskwela feature')
  ) {
    return null;
  }

  // ─── 2. Exclude Simple Narrow Factual Queries ─────────────────────────
  if (
    lower.startsWith('how many pending leaves') ||
    lower.startsWith('how many leaves') ||
    lower.startsWith('count of pending leaves') ||
    lower.includes('how many students are enrolled') ||
    lower.includes('how many students are on campus') ||
    lower.startsWith('why is annual academic') ||
    lower.startsWith('why are annual academic') ||
    lower.startsWith('why is academic analytics') ||
    lower.startsWith('draft ') ||
    lower.includes('draft a reminder') ||
    lower.includes('draft a communication') ||
    lower.includes('draft memo')
  ) {
    return null;
  }

  // ─── 3. Match Composite Intent: Meeting Brief ─────────────────────────
  const isMeetingBrief = (
    lower.includes('faculty meeting') ||
    lower.includes('meeting brief') ||
    lower.includes('prepare me for my next faculty meeting') ||
    lower.includes('prepare me for my next meeting') ||
    lower.includes('prepare for next meeting') ||
    lower.includes('prepare me for my meeting') ||
    lower.includes('generate faculty meeting brief')
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
    };
  }

  // ─── 4. Match Composite Intent: Weekly Operations Brief ──────────────
  const isWeeklyBrief = (
    lower.includes("summarize this week's school operations") ||
    lower.includes('summarize this week school operations') ||
    lower.includes('summarize school operations this week') ||
    lower.includes("summarize this week's operations") ||
    lower.includes('summarize weekly operations') ||
    lower.includes('weekly operations report') ||
    lower.includes('weekly operations summary') ||
    (lower.includes('weekly') && lower.includes('operations'))
  );

  if (isWeeklyBrief && allowedToolNames.has('generateWeeklyOperationsReport')) {
    return {
      intent: 'WEEKLY_BRIEF',
      toolsToExecute: [
        { name: 'generateWeeklyOperationsReport', args: {} }
      ],
      primaryToolName: 'generateWeeklyOperationsReport',
    };
  }

  // ─── 5. Match Composite Intent: Gate Attendance vs Approved Leaves ───
  const isAttendanceCrossCheck = (
    lower.includes('check faculty gate records against approved leaves') ||
    lower.includes('check gate records against approved leaves') ||
    lower.includes('cross-check faculty gate records') ||
    lower.includes('cross-check gate attendance against approved leaves') ||
    lower.includes('check faculty attendance against approved leaves') ||
    lower.includes('cross-check faculty attendance against approved leaves') ||
    lower.includes('audit faculty gate records against approved leaves') ||
    (lower.includes('cross-check') && lower.includes('attendance') && lower.includes('leave')) ||
    (lower.includes('gate records') && lower.includes('approved leave'))
  );

  if (isAttendanceCrossCheck && allowedToolNames.has('getFacultyAttendanceAudit')) {
    return {
      intent: 'ATTENDANCE_CROSSCHECK',
      toolsToExecute: [
        { name: 'getFacultyAttendanceAudit', args: {} }
      ],
      primaryToolName: 'getFacultyAttendanceAudit',
    };
  }

  // ─── 6. Match Composite Intent: Needs Attention / Review Today ───────
  const isNeedsAttention = (
    lower.includes('what needs my review today') ||
    lower.includes('what needs review today') ||
    lower.includes('what should i review today') ||
    lower.includes('items needing my review today') ||
    lower.includes('items needing review today') ||
    lower.includes('items for review today') ||
    lower.includes('what requires my review today') ||
    lower.includes('what items need my review today') ||
    lower.includes('operational items needing review') ||
    lower.includes('operational exceptions today') ||
    (
      lower.includes('review today') &&
      (lower.includes('what') || lower.includes('need') || lower.includes('item') || lower.includes('exception'))
    )
  );

  if (isNeedsAttention) {
    const tools: ToolDispatchPlan[] = [];

    // Domain 2: Faculty attendance exceptions (gate check-ins correlated with approved leaves)
    if (allowedToolNames.has('getFacultyAttendanceAudit')) {
      tools.push({ name: 'getFacultyAttendanceAudit', args: {} });
    }

    // Domain 1 details: Pending leave requests (safe applicant requests list)
    if (allowedToolNames.has('getPendingLeaves')) {
      tools.push({ name: 'getPendingLeaves', args: { limit: 10 } });
    }

    // Domain 3 details: Administrative behavior cases (summary & open cases list)
    if (allowedToolNames.has('getAdministrativeBehaviorSummary')) {
      tools.push({ name: 'getAdministrativeBehaviorSummary', args: { limit: 10 } });
    }

    // Domain 1, 3, 4, 5: Overall fact sheet (pulse, academics completeness, behavior cases summary, upcoming events, leaves count)
    if (allowedToolNames.has('getSchoolOperationalFactSheet')) {
      tools.push({ name: 'getSchoolOperationalFactSheet', args: {} });
    }

    if (tools.length > 0) {
      return {
        intent: 'NEEDS_ATTENTION',
        toolsToExecute: tools,
        primaryToolName: 'getSchoolOperationalFactSheet',
      };
    }
  }

  return null;
}
