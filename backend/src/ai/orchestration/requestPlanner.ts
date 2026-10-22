import { AIMessage } from '../provider/aiProvider.interface.js';
import { DOMAIN_CATALOG, OperationalDomainName } from './domainCatalog.js';
import { NormalizedNavigationAction } from '../ai.service.js';

export type SupportedOperation =
  | 'retrieve'
  | 'count'
  | 'compare'
  | 'correlate'
  | 'explain'
  | 'summarize'
  | 'prioritize'
  | 'navigate'
  | 'draft'
  | 'generate_report';

export interface PlannedToolDispatch {
  name: string;
  args: Record<string, any>;
}

export interface DomainObligation {
  domain: OperationalDomainName;
  description: string;
}

export interface OperationObligation {
  operation: SupportedOperation;
  targetDomain?: OperationalDomainName;
  description: string;
}

export interface PlanObligation {
  domain: OperationalDomainName;
  operation: SupportedOperation;
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
  domainObligations: DomainObligation[];
  operationObligations: OperationObligation[];
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
 * Extracts prior operational context from previous conversation turns.
 */
export function extractPriorOperationalContext(messages: AIMessage[]): {
  domains: Set<OperationalDomainName>;
  recentDomains: OperationalDomainName[];
  tools: Set<string>;
  lastAssistantContent: string;
} {
  const domains = new Set<OperationalDomainName>();
  const recentDomains: OperationalDomainName[] = [];
  const tools = new Set<string>();
  let lastAssistantContent = '';

  const recordDomain = (dom: OperationalDomainName) => {
    domains.add(dom);
    const existingIdx = recentDomains.indexOf(dom);
    if (existingIdx !== -1) {
      recentDomains.splice(existingIdx, 1);
    }
    recentDomains.unshift(dom);
  };

  const prev = messages.slice(0, -1);
  for (const m of prev) {
    if (m.role === 'tool' && m.name) {
      tools.add(m.name);
      for (const [dom, meta] of Object.entries(DOMAIN_CATALOG)) {
        if (meta.toolName === m.name) {
          recordDomain(dom as OperationalDomainName);
        }
      }
    }
    if (m.role === 'assistant') {
      lastAssistantContent = m.content || '';
      if (m.toolCalls) {
        for (const tc of m.toolCalls) {
          const fnName = tc.name || (tc as any).function?.name;
          if (fnName) {
            tools.add(fnName);
            for (const [dom, meta] of Object.entries(DOMAIN_CATALOG)) {
              if (meta.toolName === fnName) {
                recordDomain(dom as OperationalDomainName);
              }
            }
          }
        }
      }
    }
    if (m.role === 'user') {
      const lowerText = (m.content || '').toLowerCase();
      for (const [dom, meta] of Object.entries(DOMAIN_CATALOG)) {
        if (meta.keywords.test(lowerText)) {
          recordDomain(dom as OperationalDomainName);
        }
      }
    }
  }

  return { domains, recentDomains, tools, lastAssistantContent };
}

/**
 * Detects distinct operational tasks requested in the user prompt.
 */
export function detectOperations(lower: string): Set<SupportedOperation> {
  const ops = new Set<SupportedOperation>();

  // navigate
  if (/\b(where\s+do\s+i|where\s+can\s+i|how\s+do\s+i\s+(find|navigate|access|open|go)|navigate\s+to|where\s+to\s+review)\b/i.test(lower)) {
    ops.add('navigate');
  }

  // draft
  if (/\b(draft|prepare\s+memo|write\s+memo|draft\s+communication|draft\s+reminder|compose)\b/i.test(lower)) {
    ops.add('draft');
  }

  // explain
  if (/\b(why|reason|explain|preventing|what\s+causes|cause\s+of|understand)\b/i.test(lower)) {
    ops.add('explain');
  }

  // correlate
  if (/\b(correlate|cross-?check|link|relationship|overlap|related|relate(\s+to\s+one\s+another)?|explained\s+by|separate\s+anything\s+unrelated|same\s+faculty|involve\s+the\s+same)\b/i.test(lower)) {
    ops.add('correlate');
  }

  // prioritize
  if (/\b(prioritize|priority|order\s+for\s+what\s+i\s+should\s+review|what\s+should\s+i\s+(look\s+at|review|check)\s+first|which.*first|review\s+order|order\s+of\s+review|short\s+order)\b/i.test(lower)) {
    ops.add('prioritize');
  }

  // count
  if (/\b(how many|count of|number of|total)\b/i.test(lower)) {
    ops.add('count');
  }

  // compare
  if (/\b(compare|versus|vs\.?|difference between)\b/i.test(lower)) {
    ops.add('compare');
  }

  // summarize
  if (/\b(summarize|summary|overview|round-?up)\b/i.test(lower)) {
    ops.add('summarize');
  }

  // generate_report
  if (/\b(executive\s+brief|meeting\s+brief|weekly\s+(operations?\s+)?report|prepare.*(brief|report)|generate\s+(report|brief))\b/i.test(lower)) {
    ops.add('generate_report');
  }

  // retrieve (default fallback if no specific modifier, or if explicitly requested)
  if (
    /\b(check|review|show|get|list|find|inspect|look at|tell me|what (are|is)|view|audit|examine|cases?|records?)\b/i.test(lower) ||
    ops.size === 0
  ) {
    ops.add('retrieve');
  }

  return ops;
}

/**
 * Builds a structured plan with synchronized domainObligations, operationObligations, and obligations.
 */
function createPlan(
  intent: PlannedIntentType,
  tools: PlannedToolDispatch[],
  domainObs: DomainObligation[],
  opObs: OperationObligation[],
  extras: Partial<PrincipalRequestPlan> = {}
): PrincipalRequestPlan {
  const obligations: PlanObligation[] = [];
  for (const d of domainObs) {
    obligations.push({
      domain: d.domain,
      operation: opObs.length > 0 ? opObs[0].operation : 'retrieve',
      description: d.description,
    });
  }
  for (const op of opObs) {
    const targetDomain = op.targetDomain || (domainObs.length > 0 ? domainObs[0].domain : 'overview');
    if (!obligations.some(o => o.domain === targetDomain && o.operation === op.operation)) {
      obligations.push({
        domain: targetDomain,
        operation: op.operation,
        description: op.description,
      });
    }
  }

  return {
    intent,
    toolsToExecute: tools,
    primaryToolName: tools[0]?.name || '',
    obligations,
    domainObligations: domainObs,
    operationObligations: opObs,
    ...extras,
  };
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
    return createPlan(
      'OUT_OF_SCOPE',
      [],
      [],
      [],
      {
        isOutOfScope: true,
        directResponseContent: 'I am the DigiSkwela school operations assistant. I can only assist with authorized school management, attendance, leave records, academic analytics, and calendar operations.',
      }
    );
  }

  // ─── 2. Social / Courtesy Invariants ──────────────────────────────────
  if (/\b(thank\s*you|thanks|many\s*thanks|thank\s*u|salamat)\b/i.test(lower)) {
    return createPlan('SOCIAL', [], [], [], { directResponseContent: 'You’re welcome.' });
  }

  if (/^(hello|hi|hey|good\s*(morning|afternoon|evening))\b/i.test(lower) && lower.split(/\s+/).length <= 4) {
    return createPlan('SOCIAL', [], [], [], { directResponseContent: 'Good day. How may I assist you with school operations?' });
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
      /\b(and|also|\?.*\w)\b.*\b(are there|how many|is there|any|show me|check|what are|cases?|unresolved|pending|exceptions?|exist)\b/i.test(lower) ||
      (/\b(where do i|where can i|how do i)\b/i.test(lower) && /\b(and\s+(are|is|do|how|what|tell me)|unresolved|pending|active|exist)\b/i.test(lower))
    );

    // Composite Navigation + Data Question (e.g. "Where do I review behavioral reports, and are there any unresolved cases?")
    if (hasDataQuestion) {
      if ((lower.includes('behavior') || lower.includes('incident')) && allowedToolNames.has('getAdministrativeBehaviorSummary')) {
        return createPlan(
          'MULTI_DOMAIN',
          [{ name: 'getAdministrativeBehaviorSummary', args: { limit: 10 } }],
          [{ domain: 'behavior', description: 'Behavioral Reports records' }],
          [
            { operation: 'navigate', targetDomain: 'behavior', description: 'Navigate to Behavioral Reports module' },
            { operation: 'retrieve', targetDomain: 'behavior', description: 'Retrieve active unresolved behavioral cases' }
          ],
          {
            navigationAction: DOMAIN_CATALOG.behavior.navAction,
            skipFeatureMenuRule: true,
          }
        );
      }
      if ((lower.includes('attendance') || lower.includes('gate')) && allowedToolNames.has('getFacultyAttendanceAudit')) {
        return createPlan(
          'MULTI_DOMAIN',
          [{ name: 'getFacultyAttendanceAudit', args: {} }],
          [{ domain: 'faculty_attendance', description: 'Gate Attendance Monitoring records' }],
          [
            { operation: 'navigate', targetDomain: 'faculty_attendance', description: 'Navigate to Gate Attendance Monitoring' },
            { operation: 'retrieve', targetDomain: 'faculty_attendance', description: 'Audit faculty check-in exceptions' }
          ],
          {
            navigationAction: DOMAIN_CATALOG.faculty_attendance.navAction,
            skipFeatureMenuRule: true,
          }
        );
      }
      if ((lower.includes('leave') || lower.includes('vacation')) && allowedToolNames.has('getPendingLeaves')) {
        return createPlan(
          'MULTI_DOMAIN',
          [{ name: 'getPendingLeaves', args: { limit: 10 } }],
          [{ domain: 'leaves', description: 'Leave Management records' }],
          [
            { operation: 'navigate', targetDomain: 'leaves', description: 'Navigate to Leave Management' },
            { operation: 'retrieve', targetDomain: 'leaves', description: 'Check pending leave requests' }
          ],
          {
            navigationAction: DOMAIN_CATALOG.leaves.navAction,
            skipFeatureMenuRule: true,
          }
        );
      }
    }

    // Pure Navigation guidance
    if (lower.includes('attendance') || lower.includes('gate') || lower.includes('check-in')) {
      return createPlan(
        'NAVIGATION',
        [],
        [{ domain: 'faculty_attendance', description: 'Gate Attendance Monitoring' }],
        [{ operation: 'navigate', targetDomain: 'faculty_attendance', description: 'Open Gate Attendance Monitoring tab' }],
        {
          navigationOnly: true,
          navigationAction: DOMAIN_CATALOG.faculty_attendance.navAction,
          directResponseContent: 'You can review faculty attendance in Gate Attendance Monitoring. You can also view registered profiles and schedules in Teacher Management.',
        }
      );
    }
    if (lower.includes('leave') || lower.includes('vacation')) {
      return createPlan(
        'NAVIGATION',
        [],
        [{ domain: 'leaves', description: 'Leave Management' }],
        [{ operation: 'navigate', targetDomain: 'leaves', description: 'Open Leave Management tab' }],
        {
          navigationOnly: true,
          navigationAction: DOMAIN_CATALOG.leaves.navAction,
          directResponseContent: 'You can review, approve, or deny pending faculty leave applications in the Leave Management module under Administration.',
        }
      );
    }
    if (lower.includes('behavior') || lower.includes('discipline') || lower.includes('incident')) {
      return createPlan(
        'NAVIGATION',
        [],
        [{ domain: 'behavior', description: 'Behavioral Reports' }],
        [{ operation: 'navigate', targetDomain: 'behavior', description: 'Open Behavioral Reports tab' }],
        {
          navigationOnly: true,
          navigationAction: DOMAIN_CATALOG.behavior.navAction,
          directResponseContent: 'You can view logged student disciplinary incidents and behavioral cases in the Behavioral Reports module under Operations.',
        }
      );
    }
    if (lower.includes('academic') || lower.includes('grade') || lower.includes('completeness')) {
      return createPlan(
        'NAVIGATION',
        [],
        [{ domain: 'academics', description: 'Academic Analytics' }],
        [{ operation: 'navigate', targetDomain: 'academics', description: 'Open Academic Analytics tab' }],
        {
          navigationOnly: true,
          navigationAction: DOMAIN_CATALOG.academics.navAction,
          directResponseContent: 'You can inspect grading progress and quarterly performance summaries in the Academic Analytics module under Administration.',
        }
      );
    }
    if (lower.includes('teacher') || lower.includes('faculty profile')) {
      return createPlan(
        'NAVIGATION',
        [],
        [],
        [{ operation: 'navigate', description: 'Open Teacher Management tab' }],
        {
          navigationOnly: true,
          navigationAction: {
            label: 'Open Teacher Management',
            screen: 'p-teachers',
            description: 'Open Teacher Management tab',
          },
          directResponseContent: 'You can manage teacher assignments and profile records in Teacher Management under Administration.',
        }
      );
    }
    if (lower.includes('event') || lower.includes('calendar')) {
      return createPlan(
        'NAVIGATION',
        [],
        [{ domain: 'events', description: 'School Events' }],
        [{ operation: 'navigate', targetDomain: 'events', description: 'Open School Events tab' }],
        {
          navigationOnly: true,
          navigationAction: DOMAIN_CATALOG.events.navAction,
          directResponseContent: 'You can view and schedule school events on the School Events calendar under Operations.',
        }
      );
    }

    return createPlan(
      'NAVIGATION',
      [],
      [],
      [{ operation: 'navigate', description: 'Open feature menu' }],
      {
        navigationOnly: true,
        directResponseContent: 'Which DigiSkwela feature do you need help with?',
      }
    );
  }

  // ─── 4. Conversational Pronouns, Narrowing, Expansion & Follow-ups ────
  const isDirectAnaphora = /\b(which of (them|those)|who among them|who of them|any of them|what about them)\b/i.test(lower);
  const hasReferent = isDirectAnaphora || /\b(them|those|these|they|that|this one|the second one|the first one|most important (one|problem|issue))\b/i.test(lower);
  const isNarrowing = /\b(only|just|specifically|filter by|narrow to|show me only)\b/i.test(lower);
  const isExplicitExpansion = /\b(also|in addition|as well as|and check|what about|include|check also|additionally)\b/i.test(lower);
  const isPrioritizeFollowUp = /\b(which of (those|them).*(first|priority)|what.*(those|them).*(check|review) first|which.*(those|them).*(check|review) first)\b/i.test(lower) ||
    (/\b(what|which).*(check|review|look at)\s+first\b/i.test(lower) && /\b(those|them|these)\b/i.test(lower));

  const isFollowUpCandidate = hasReferent || isNarrowing || isExplicitExpansion || isPrioritizeFollowUp;

  if (isFollowUpCandidate) {
    const priorContext = extractPriorOperationalContext(messages);

    const currentDomains = (Object.keys(DOMAIN_CATALOG) as OperationalDomainName[]).filter(d => 
      DOMAIN_CATALOG[d].keywords.test(lower)
    );

    // If an explicit anaphoric pronoun (e.g. "which of them", "who among them") has no prior context, ask for clarification
    if (priorContext.domains.size === 0 && (isDirectAnaphora || (currentDomains.length === 0 && (hasReferent || isPrioritizeFollowUp || isNarrowing)))) {
      return createPlan(
        'CLARIFICATION',
        [],
        [],
        [],
        {
          clarificationMessage: 'Could you please clarify who or what you are referring to? For example, are you asking about faculty attendance or staff leave applications?',
        }
      );
    }

    // Only resolve contextual follow-up if prior conversation domains actually exist
    if (priorContext.domains.size > 0) {
      // 4.1 NARROWING (Section 9.D): "Only show me the faculty-related ones"
      if (isNarrowing) {
        const targetDomain = (Object.keys(DOMAIN_CATALOG) as OperationalDomainName[]).find(d => 
          DOMAIN_CATALOG[d].keywords.test(lower)
        );
        if (targetDomain && priorContext.domains.has(targetDomain)) {
          const entry = DOMAIN_CATALOG[targetDomain];
          if (allowedToolNames.has(entry.toolName)) {
            return createPlan(
              'SINGLE_DOMAIN',
              [{ name: entry.toolName, args: entry.defaultArgs || {} }],
              [{ domain: targetDomain, description: `${entry.displayName} records` }],
              [{ operation: 'retrieve', targetDomain, description: `Filtered to ${entry.displayName}` }],
              { skipFeatureMenuRule: true }
            );
          }
        }
      }

      // 4.2 EXPLICIT EXPANSION (Section 10): "Also check behavior cases and academics"
      if (isExplicitExpansion) {
        const newDomains: OperationalDomainName[] = [];
        for (const [dom, meta] of Object.entries(DOMAIN_CATALOG)) {
          if (meta.keywords.test(lower) && !priorContext.domains.has(dom as OperationalDomainName)) {
            newDomains.push(dom as OperationalDomainName);
          }
        }
        if (newDomains.length > 0) {
          const combined = Array.from(new Set([...priorContext.domains, ...newDomains]));
          const tools: PlannedToolDispatch[] = [];
          const domainObs: DomainObligation[] = [];
          const opObs: OperationObligation[] = [];

          for (const d of combined) {
            const entry = DOMAIN_CATALOG[d];
            if (allowedToolNames.has(entry.toolName) && !tools.some(t => t.name === entry.toolName)) {
              tools.push({ name: entry.toolName, args: entry.defaultArgs || {} });
              domainObs.push({ domain: d, description: `${entry.displayName} records` });
              opObs.push({ operation: 'retrieve', targetDomain: d, description: `Retrieve ${entry.displayName}` });
            }
          }

          if (tools.length > 0) {
            return createPlan(
              'MULTI_DOMAIN',
              tools,
              domainObs,
              opObs,
              { skipFeatureMenuRule: true }
            );
          }
        }
      }

      // 4.3 CONTEXTUAL PRIORITIZATION (Section 9.A): "Which of those should I check first?"
      if (isPrioritizeFollowUp) {
        const tools: PlannedToolDispatch[] = [];
        const domainObs: DomainObligation[] = [];
        const opObs: OperationObligation[] = [];

        // Faithful scope: Execute tools ONLY for domains that actually existed in the prior result set!
        for (const dom of priorContext.domains) {
          const entry = DOMAIN_CATALOG[dom];
          if (entry && allowedToolNames.has(entry.toolName) && !tools.some(t => t.name === entry.toolName)) {
            tools.push({ name: entry.toolName, args: entry.defaultArgs || {} });
            domainObs.push({ domain: dom, description: `${entry.displayName} records` });
            opObs.push({ operation: 'prioritize', targetDomain: dom, description: `Review order for ${entry.displayName}` });
          }
        }

        if (tools.length > 0) {
          return createPlan(
            tools.length > 1 ? 'MULTI_DOMAIN' : 'SINGLE_DOMAIN',
            tools,
            domainObs,
            opObs,
            {
              isPrioritize: true,
              skipFeatureMenuRule: true,
            }
          );
        }
      }

      // 4.4 CONTEXTUAL CORRELATION (Section 9.B): "Which of them involve the same faculty member?"
      if (/\b(same faculty|involve the same|correlate|overlap|related)\b/i.test(lower)) {
        if (priorContext.domains.has('faculty_attendance') || priorContext.domains.has('leaves')) {
          const tools: PlannedToolDispatch[] = [];
          const domainObs: DomainObligation[] = [];
          if (allowedToolNames.has('getFacultyAttendanceAudit')) {
            tools.push({ name: 'getFacultyAttendanceAudit', args: {} });
            domainObs.push({ domain: 'faculty_attendance', description: 'Faculty attendance records' });
          }
          if (allowedToolNames.has('getPendingLeaves')) {
            tools.push({ name: 'getPendingLeaves', args: { limit: 10 } });
            domainObs.push({ domain: 'leaves', description: 'Leave Management records' });
          }
          return createPlan(
            'ATTENDANCE_CROSSCHECK',
            tools,
            domainObs,
            [{ operation: 'correlate', description: 'Cross-check faculty attendance exceptions with pending leave requests' }],
            {
              isCorrelate: true,
              skipFeatureMenuRule: true,
            }
          );
        }
      }

      // 4.5 CONTEXTUAL EXPLANATION (Section 9.C): "Explain the most important one"
      if (/\b(explain|why|reason|cause)\b/i.test(lower)) {
        // If the user explicitly specified an operational domain in the current prompt, do NOT hijack it with prior context!
        if (currentDomains.length === 0) {
          const targetDomain = priorContext.recentDomains[0] || Array.from(priorContext.domains)[0];
          if (targetDomain === 'faculty_attendance' && allowedToolNames.has('getFacultyAttendanceAudit')) {
            return createPlan(
              'SINGLE_DOMAIN',
              [{ name: 'getFacultyAttendanceAudit', args: {} }],
              [{ domain: 'faculty_attendance', description: 'Faculty attendance records' }],
              [{ operation: 'explain', targetDomain: 'faculty_attendance', description: 'Explain faculty attendance exceptions' }],
              { skipFeatureMenuRule: true }
            );
          }
          if (targetDomain === 'academics' && allowedToolNames.has('getAcademicAnalytics')) {
            return createPlan(
              'SINGLE_DOMAIN',
              [{ name: 'getAcademicAnalytics', args: {} }],
              [{ domain: 'academics', description: 'Academic Analytics records' }],
              [{ operation: 'explain', targetDomain: 'academics', description: 'Explain academic reporting issues' }],
              { skipFeatureMenuRule: true }
            );
          }
          if (targetDomain === 'leaves' && allowedToolNames.has('getPendingLeaves')) {
            return createPlan(
              'SINGLE_DOMAIN',
              [{ name: 'getPendingLeaves', args: { limit: 10 } }],
              [{ domain: 'leaves', description: 'Leave Management records' }],
              [{ operation: 'explain', targetDomain: 'leaves', description: 'Explain pending leave requests' }],
              { skipFeatureMenuRule: true }
            );
          }
          if (targetDomain === 'behavior' && allowedToolNames.has('getAdministrativeBehaviorSummary')) {
            return createPlan(
              'SINGLE_DOMAIN',
              [{ name: 'getAdministrativeBehaviorSummary', args: {} }],
              [{ domain: 'behavior', description: 'Behavior Incident records' }],
              [{ operation: 'explain', targetDomain: 'behavior', description: 'Explain behavior incidents' }],
              { skipFeatureMenuRule: true }
            );
          }
        }
      }

      // 4.6 Follow-up attendance status filtering ("Which of them are on approved leave?")
      const isAttendanceScope = currentDomains.includes('faculty_attendance') || (currentDomains.length === 0 && priorContext.domains.has('faculty_attendance'));
      if (isAttendanceScope && allowedToolNames.has('getFacultyAttendanceAudit')) {
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

        if (statusFilter !== 'ALL') {
          return createPlan(
            'SINGLE_DOMAIN',
            [{ name: 'getFacultyAttendanceAudit', args: { statusFilter } }],
            [{ domain: 'faculty_attendance', description: `Faculty attendance with statusFilter=${statusFilter}` }],
            [{ operation: 'retrieve', targetDomain: 'faculty_attendance', description: `Faculty attendance with statusFilter=${statusFilter}` }]
          );
        }
      }

      // 4.7 Ambiguous follow-up without antecedent: honest clarification
      // Only return clarification if current prompt does NOT explicitly specify an operational domain!
      if (currentDomains.length === 0) {
        return createPlan(
          'CLARIFICATION',
          [],
          [],
          [],
          {
            clarificationMessage: 'Could you please clarify who or what you are referring to? For example, are you asking about faculty attendance or staff leave applications?',
          }
        );
      }
    }
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

    return createPlan(
      'MEETING_BRIEF',
      [{ name: 'generatePrincipalMeetingBrief', args: { meetingType } }],
      [{ domain: 'meeting_brief', description: `Meeting brief for ${meetingType}` }],
      [
        { operation: 'generate_report', targetDomain: 'meeting_brief', description: `Generate meeting brief for ${meetingType}` },
        { operation: 'summarize', targetDomain: 'meeting_brief', description: `Executive summary for ${meetingType}` }
      ]
    );
  }

  // ─── 6. Weekly Operations Report Intent ────────────────────────────────
  const isWeeklyBrief = (
    /\b(weekly\s+(operations?\s+)?(report|summary|brief)|summarize\s+(this\s+week('s)?|weekly)\b.*operations?)\b/i.test(lower) ||
    (lower.includes('week') && lower.includes('operation'))
  );

  if (isWeeklyBrief && allowedToolNames.has('generateWeeklyOperationsReport')) {
    return createPlan(
      'WEEKLY_BRIEF',
      [{ name: 'generateWeeklyOperationsReport', args: {} }],
      [{ domain: 'weekly_report', description: 'Weekly school operations report' }],
      [
        { operation: 'generate_report', targetDomain: 'weekly_report', description: 'Generate weekly operations report' },
        { operation: 'summarize', targetDomain: 'weekly_report', description: 'Summarize weekly operational metrics' }
      ]
    );
  }

  // ─── 7. Attendance Cross-Check Intent ──────────────────────────────────
  const isAttendanceCrossCheck = !lower.includes('pending') && !lower.includes('behavior') && !lower.includes('incident') && !lower.includes('cases') && (
    /\b(cross-?check|audit)\b.*\b(attendance|gate(\s+records?|\s+check-?ins?)?)\b.*\b(approved\s+)?leaves?\b/i.test(lower) ||
    /\b(check|audit|cross-?check)\b.*\bfaculty\s+(gate\s+records?|attendance)\b.*\b(approved\s+)?leaves?\b/i.test(lower) ||
    /\b(gate\s+records?|gate\s+check-?ins?|faculty\s+attendance)\b.*\b(against|with)\b.*\b(approved\s+)?leaves?\b/i.test(lower) ||
    /\b(faculty\s+.*unresolved|attendance\s+.*exception|unresolved.*faculty)\b.*\b(explained|covered)\s+by\s+(approved\s+)?leaves?\b/i.test(lower)
  );

  if (isAttendanceCrossCheck && allowedToolNames.has('getFacultyAttendanceAudit')) {
    const tools: PlannedToolDispatch[] = [{ name: 'getFacultyAttendanceAudit', args: {} }];
    const domainObs: DomainObligation[] = [{ domain: 'faculty_attendance', description: 'Faculty attendance records' }];
    if (allowedToolNames.has('getPendingLeaves')) {
      tools.push({ name: 'getPendingLeaves', args: { limit: 10 } });
      domainObs.push({ domain: 'leaves', description: 'Leave Management records' });
    }

    return createPlan(
      'ATTENDANCE_CROSSCHECK',
      tools,
      domainObs,
      [
        { operation: 'retrieve', targetDomain: 'faculty_attendance', description: 'Retrieve faculty attendance audit' },
        { operation: 'correlate', description: 'Audit faculty gate check-ins correlated with approved leaves' }
      ],
      {
        isCorrelate: true,
        skipFeatureMenuRule: true,
      }
    );
  }

  // ─── 8. Attention Sweep Intent ("What needs my review/attention today?") ─
  const isAttentionSweep = (
    /\b(what\s+needs\s+(my\s+)?(review|attention)|what\s+should\s+i\s+(review|attend\s+to)|items?\s+needing\s+(review|attention)|operational\s+exceptions?)\b/i.test(lower) ||
    (/\b(review|attention)\s+today\b/i.test(lower) && /\b(what|need|item|exception|pulse)\b/i.test(lower))
  );

  if (isAttentionSweep) {
    const tools: PlannedToolDispatch[] = [];
    const domainObs: DomainObligation[] = [];
    const opObs: OperationObligation[] = [];

    if (allowedToolNames.has('getFacultyAttendanceAudit')) {
      tools.push({ name: 'getFacultyAttendanceAudit', args: {} });
      domainObs.push({ domain: 'faculty_attendance', description: 'Faculty attendance exceptions' });
      opObs.push({ operation: 'retrieve', targetDomain: 'faculty_attendance', description: 'Audit faculty attendance exceptions' });
    }
    if (allowedToolNames.has('getPendingLeaves')) {
      tools.push({ name: 'getPendingLeaves', args: { limit: 10 } });
      domainObs.push({ domain: 'leaves', description: 'Pending leave requests' });
      opObs.push({ operation: 'retrieve', targetDomain: 'leaves', description: 'Audit pending leave requests' });
    }
    if (allowedToolNames.has('getAdministrativeBehaviorSummary')) {
      tools.push({ name: 'getAdministrativeBehaviorSummary', args: { limit: 10 } });
      domainObs.push({ domain: 'behavior', description: 'Administrative behavior summary' });
      opObs.push({ operation: 'retrieve', targetDomain: 'behavior', description: 'Audit active behavioral cases' });
    }
    if (allowedToolNames.has('getSchoolOperationalFactSheet')) {
      tools.push({ name: 'getSchoolOperationalFactSheet', args: {} });
      domainObs.push({ domain: 'overview', description: 'Operational fact sheet pulse' });
      opObs.push({ operation: 'summarize', targetDomain: 'overview', description: 'Operational fact sheet pulse' });
    }

    opObs.push({ operation: 'prioritize', description: 'Suggested review order based on operational urgency' });

    if (tools.length > 0) {
      return createPlan(
        'SWEEP',
        tools,
        domainObs,
        opObs,
        {
          primaryToolName: 'getSchoolOperationalFactSheet',
          isPrioritize: true,
          skipFeatureMenuRule: true,
        }
      );
    }
  }

  // ─── 9. Multi-Operation & General Inquiries ────────────────────────────
  const ops = detectOperations(lower);

  const mentionedDomains: OperationalDomainName[] = [];
  if (DOMAIN_CATALOG.leaves.keywords.test(lower)) mentionedDomains.push('leaves');
  if (DOMAIN_CATALOG.faculty_attendance.keywords.test(lower)) mentionedDomains.push('faculty_attendance');
  if (DOMAIN_CATALOG.behavior.keywords.test(lower)) mentionedDomains.push('behavior');
  if (DOMAIN_CATALOG.academics.keywords.test(lower)) mentionedDomains.push('academics');
  if (DOMAIN_CATALOG.events.keywords.test(lower)) mentionedDomains.push('events');
  if (DOMAIN_CATALOG.overview.keywords.test(lower)) mentionedDomains.push('overview');

  // Simple Narrow Query: exactly 1 domain and 1 operation (count or retrieve)
  if (mentionedDomains.length === 1 && ops.size === 1 && (ops.has('count') || ops.has('retrieve')) && !ops.has('draft') && !ops.has('explain') && !ops.has('prioritize') && !ops.has('correlate')) {
    const domainName = mentionedDomains[0];
    const catalogEntry = DOMAIN_CATALOG[domainName];
    if (allowedToolNames.has(catalogEntry.toolName)) {
      const op = ops.has('count') ? 'count' : 'retrieve';
      return createPlan(
        'SINGLE_DOMAIN',
        [{ name: catalogEntry.toolName, args: catalogEntry.defaultArgs || {} }],
        [{ domain: domainName, description: `${catalogEntry.displayName} records` }],
        [{ operation: op, targetDomain: domainName, description: `${op} for ${catalogEntry.displayName}` }]
      );
    }
  }

  // If prioritization is requested without explicit domains, check urgent domains:
  if (ops.has('prioritize') && mentionedDomains.length === 0) {
    mentionedDomains.push('faculty_attendance', 'leaves', 'behavior');
  }

  // If correlation is requested between attendance and leaves, make sure both are included:
  if (ops.has('correlate') && (mentionedDomains.includes('faculty_attendance') || mentionedDomains.includes('leaves'))) {
    if (!mentionedDomains.includes('faculty_attendance')) mentionedDomains.push('faculty_attendance');
    if (!mentionedDomains.includes('leaves')) mentionedDomains.push('leaves');
  }

  // Build tools and obligations for mentioned domains
  if (mentionedDomains.length > 0) {
    const tools: PlannedToolDispatch[] = [];
    const domainObs: DomainObligation[] = [];
    const opObs: OperationObligation[] = [];

    for (const domainName of mentionedDomains) {
      const catalogEntry = DOMAIN_CATALOG[domainName];
      if (allowedToolNames.has(catalogEntry.toolName)) {
        if (!tools.some(t => t.name === catalogEntry.toolName)) {
          tools.push({ name: catalogEntry.toolName, args: catalogEntry.defaultArgs || {} });
        }
        domainObs.push({ domain: domainName, description: `${catalogEntry.displayName} records` });
      }
    }

    // Build independent operation obligations
    for (const op of ops) {
      const targetDomain = mentionedDomains.length === 1 ? mentionedDomains[0] : undefined;
      const desc = targetDomain 
        ? `${op} on ${DOMAIN_CATALOG[targetDomain].displayName}`
        : `${op} across ${mentionedDomains.map(d => DOMAIN_CATALOG[d].displayName).join(', ')}`;
      opObs.push({ operation: op, targetDomain, description: desc });
    }

    if (tools.length > 0) {
      return createPlan(
        tools.length > 1 ? 'MULTI_DOMAIN' : 'SINGLE_DOMAIN',
        tools,
        domainObs,
        opObs,
        {
          isDraft: ops.has('draft'),
          isCorrelate: ops.has('correlate'),
          isPrioritize: ops.has('prioritize'),
          skipFeatureMenuRule: tools.length > 1,
        }
      );
    }
  }

  // Ambiguous or unmapped: Let dynamic model-assisted planning execute
  return createPlan('DYNAMIC', [], [], []);
}
