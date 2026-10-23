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

export type ConstraintType =
  | 'EXCLUDE_DOMAIN'
  | 'EXCLUDE_STATUS'
  | 'INCLUDE_ONLY'
  | 'SCOPE'
  | 'FILTER'
  | 'SEPARATE_UNRELATED';

export interface RequestConstraint {
  type: ConstraintType;
  targetDomain?: OperationalDomainName;
  value?: string;
  clauseText?: string;
}

export interface RequestClause {
  text: string;
  domains: OperationalDomainName[];
  excludedDomains: OperationalDomainName[];
  operations: SupportedOperation[];
  constraints: RequestConstraint[];
}

export interface RequestUnderstanding {
  raw: string;
  lower: string;
  clauses: RequestClause[];
  positiveDomains: OperationalDomainName[];
  excludedDomains: OperationalDomainName[];
  operations: Set<SupportedOperation>;
  constraints: RequestConstraint[];
  hasNavigation: boolean;
  navigationModule?: OperationalDomainName;
  hasDraft: boolean;
  hasCorrelate: boolean;
  hasSeparateUnrelated: boolean;
  hasPrioritize: boolean;
  isAttentionSweep: boolean;
  isSocial: boolean;
  socialType?: 'GREETING' | 'COURTESY';
  isOutOfScope: boolean;
  hasCurrentPromptAntecedent: boolean;
  hasHistoricalAntecedent: boolean;
  isDirectAnaphora: boolean;
  isFollowUpCandidate: boolean;
  isNarrowing: boolean;
  isExplicitExpansion: boolean;
  isMeetingBrief: boolean;
  isWeeklyBrief: boolean;
  isAttendanceCrossCheck: boolean;
}

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
  constraints?: RequestConstraint[];
  navigationOnly?: boolean;
  navigationAction?: NormalizedNavigationAction;
  directResponseContent?: string;
  clarificationMessage?: string;
  isDraft?: boolean;
  isCorrelate?: boolean;
  hasSeparateUnrelated?: boolean;
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
 * Splits prompt into constituent semantic clauses.
 */
export function splitClauses(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  // Split on strong punctuation: . ? ! ;
  // Also split on coordinating conjunctions:
  // ", and then ", ", and ", " and then ", ", then ", " then ", ", but ", " but ", ", however ", ", whereas ", ", while "
  const rawSegments = trimmed.split(/(?:[?!;]|\.(?!\d)|,(?:\s+and\s+then|\s+and|\s+then|\s+but|\s+however|\s+whereas|\s+while)\b|\b(?:and\s+then|then|but|however|whereas|while)\b)/i);

  return rawSegments
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

/**
 * Determines whether a domain keyword match in a clause/prompt is in a negated context.
 */
export function isDomainNegated(domain: OperationalDomainName, clauseText: string, fullText: string): boolean {
  const meta = DOMAIN_CATALOG[domain];
  if (!meta) return false;

  const clauseLower = clauseText.toLowerCase();
  const fullLower = fullText.toLowerCase();

  // If the clause does not match the domain's keywords, it's not negated in this clause
  if (!meta.keywords.test(clauseLower)) {
    return false;
  }

  // Status filters like "no gate check-in" or "no check-in" represent attendance exception queries, not domain exclusion
  if (domain === 'faculty_attendance' && /\bno\s+(?:gate\s+)?check-?ins?\b/i.test(clauseLower)) {
    return false;
  }

  // 1. Direct leading negation in the clause:
  // e.g. "not attendance", "don't include attendance", "excluding attendance", "ignore attendance", "without attendance", "aside from attendance", "except attendance"
  const directPrefixNegation = new RegExp(
    `\\b(?:not|no|don't|do\\s+not|never|exclude|excluding|ignore|ignoring|without|isn't|is\\s+not|aren't|are\\s+not|aside\\s+from|except)\\s+(?:about\\s+|on\\s+|for\\s+|in\\s+)?(?:the\\s+)?(?:my\\s+)?[^.?!;,]*?\\b(?:${meta.keywords.source})\\b`,
    'i'
  );
  if (directPrefixNegation.test(clauseLower)) {
    return true;
  }

  // 2. Trailing negation:
  // e.g. "attendance isn't my main concern", "attendance is not needed", "attendance isn't a priority"
  const trailingNegation = new RegExp(
    `\\b(?:${meta.keywords.source})\\b\\s+(?:is\\s+not|isn't|are\\s+not|aren't)\\s+(?:my\\s+)?(?:concern|focus|needed|necessary|priority|required|what\\s+i\\s+want|my\\s+main\\s+concern)`,
    'i'
  );
  if (trailingNegation.test(clauseLower) || trailingNegation.test(fullLower)) {
    return true;
  }

  // 3. Contrastive focus:
  // e.g. "focus on unresolved behavior and upcoming events, not attendance" or "focus on behavior, not attendance"
  const contrastiveNegation = new RegExp(
    `\\bfocus\\s+on\\b[^.?!;,]*?(?:not|instead\\s+of|rather\\s+than)\\s+[^.?!;,]*?\\b(?:${meta.keywords.source})\\b`,
    'i'
  );
  if (contrastiveNegation.test(fullLower)) {
    return true;
  }

  return false;
}

/**
 * Detects distinct operational tasks requested in the user prompt.
 */
export function detectOperations(lower: string): Set<SupportedOperation> {
  const ops = new Set<SupportedOperation>();

  // navigate
  if (/\b(where\s+do\s+i|where\s+can\s+i|how\s+do\s+i\s+(find|navigate|access|open|go)|navigate\s+to|where\s+to\s+review|tell\s+me\s+where\s+to\s+review)\b/i.test(lower)) {
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

  // correlate (direct + indirect cross-check phrasings)
  if (
    /\b(correlate|cross-?check|link|relationship|overlap|related|relate(\s+to\s+one\s+another)?|connected|connection|explained\s+by|(?:this|the|leave|record)\s+explains?|explains?\s+(?:the\s+|this\s+)?(?:missing|check-in|absence|discrepancy)|covered\s+by|cover(s|ed|ing)?\s+(their\s+)?(absence|missing|today)?|supporting\s+leave|leave\s+covering|do\s+any\s+have|are\s+any\s+(covered|explained|supported)|(applications?|requests?|records?)\s+on\s+file|is\s+there\s+anything\s+on\s+file\s+that\s+explains|separate\s+anything\s+unrelated|separate\s+the\s+unrelated|separate\s+unrelated|same\s+faculty|involve\s+the\s+same)\b/i.test(lower)
  ) {
    ops.add('correlate');
  }

  // prioritize (direct + natural operational attention phrasings)
  if (
    /\b(prioritize|priority|order\s+for\s+what\s+i\s+should\s+review|what\s+should\s+i\s+(look\s+at|review|check|handle|deal\s+with|attend\s+to)\s+first|suggest\s+what\s+i\s+should\s+review\s+first|which.*first|review\s+order|order\s+of\s+review|short\s+order|what\s+should\s+i\s+actually\s+deal\s+with\s+first\s+today|what\s+matters\s+most\s+today|anything\s+urgent)\b/i.test(lower)
  ) {
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
    /\b(check|review|show|get|list|find|inspect|look\s+(at|into)|tell me|what (are|is)|view|audit|examine|status|rates?|submissions?|cases?|records?|exceptions?|concerns?|issues?)\b/i.test(lower) ||
    ops.size === 0
  ) {
    ops.add('retrieve');
  }

  return ops;
}

/**
 * Complete, normalized request-understanding analyzer.
 * Decomposes clauses, domains, operations, negations, constraints, and antecedents BEFORE routing shortcuts.
 */
export function analyzeRequest(raw: string, messages: AIMessage[]): RequestUnderstanding {
  const lower = raw.toLowerCase().trim();
  const priorContext = extractPriorOperationalContext(messages);

  // 1. Check Out of Scope (Security guard)
  const outOfScopePatterns = [
    /\b(write|create|generate)\s+(a\s+)?(python|javascript|typescript|c\+\+|code|script|sql\s+query)\b/i,
    /\b(capital of|weather in|recipe for|stock price of|movie recommendations?)\b/i,
    /\b(write an essay about|tell me a joke|who won the world cup)\b/i,
  ];
  const matchesNonSchoolPattern = outOfScopePatterns.some(p => p.test(lower));
  const matchesAnySchoolDomain = Object.values(DOMAIN_CATALOG).some(d => d.keywords.test(lower));
  const isOutOfScope = matchesNonSchoolPattern && !matchesAnySchoolDomain;

  // 2. Social Courtesy Check
  let isSocial = false;
  let socialType: 'GREETING' | 'COURTESY' | undefined = undefined;
  if (/\b(thank\s*you|thanks|many\s*thanks|thank\s*u|salamat)\b/i.test(lower)) {
    isSocial = true;
    socialType = 'COURTESY';
  } else if (/^(hello|hi|hey|good\s*(morning|afternoon|evening))\b/i.test(lower) && lower.split(/\s+/).length <= 4) {
    isSocial = true;
    socialType = 'GREETING';
  }

  // 3. Clause Decomposition & Analysis
  const rawClauses = splitClauses(raw);
  const clauses: RequestClause[] = [];
  const positiveDomainsSet = new Set<OperationalDomainName>();
  const excludedDomainsSet = new Set<OperationalDomainName>();
  const overallConstraints: RequestConstraint[] = [];

  for (const clauseText of rawClauses) {
    const clauseLower = clauseText.toLowerCase();
    const clauseDomains: OperationalDomainName[] = [];
    const clauseExcluded: OperationalDomainName[] = [];
    const clauseConstraints: RequestConstraint[] = [];

    // Check each catalog domain for positive vs negated presence
    for (const [domKey, meta] of Object.entries(DOMAIN_CATALOG)) {
      const dom = domKey as OperationalDomainName;
      if (meta.keywords.test(clauseLower)) {
        if (isDomainNegated(dom, clauseText, raw)) {
          clauseExcluded.push(dom);
          excludedDomainsSet.add(dom);
          const c: RequestConstraint = {
            type: 'EXCLUDE_DOMAIN',
            targetDomain: dom,
            clauseText,
          };
          clauseConstraints.push(c);
          overallConstraints.push(c);
        } else {
          clauseDomains.push(dom);
          positiveDomainsSet.add(dom);
        }
      }
    }

    // Check status exclusions in this clause
    if (/(?:don't|do\s+not|exclude|excluding|ignore|ignoring|without|no|except)\s+(?:include\s+)?resolved\b/i.test(clauseLower)) {
      const c: RequestConstraint = {
        type: 'EXCLUDE_STATUS',
        targetDomain: 'behavior',
        value: 'Resolved',
        clauseText,
      };
      clauseConstraints.push(c);
      overallConstraints.push(c);
    }
    if (/(?:only|just)\s+unresolved\b/i.test(clauseLower)) {
      const c: RequestConstraint = {
        type: 'INCLUDE_ONLY',
        targetDomain: 'behavior',
        value: 'Unresolved',
        clauseText,
      };
      clauseConstraints.push(c);
      overallConstraints.push(c);
    }

    // Check clause-specific scope qualifier (e.g. "only for my assigned classes")
    if (/(?:only|just)\s+(?:for\s+)?(?:my\s+)?assigned\s+classes\b/i.test(clauseLower)) {
      const targetDom = clauseDomains[0] || 'faculty_attendance';
      const c: RequestConstraint = {
        type: 'SCOPE',
        targetDomain: targetDom,
        value: 'assigned_classes',
        clauseText,
      };
      clauseConstraints.push(c);
      overallConstraints.push(c);
    }

    const clauseOps = Array.from(detectOperations(clauseLower));
    clauses.push({
      text: clauseText,
      domains: clauseDomains,
      excludedDomains: clauseExcluded,
      operations: clauseOps,
      constraints: clauseConstraints,
    });
  }

  // Remove any excluded domain that might have been matched elsewhere
  for (const excl of excludedDomainsSet) {
    positiveDomainsSet.delete(excl);
  }

  const positiveDomains = Array.from(positiveDomainsSet);
  const excludedDomains = Array.from(excludedDomainsSet);
  const operations = detectOperations(lower);

  // 4. Antecedent and Pronoun Resolution
  // Standalone direct anaphora: starts with pronoun phrase without preceding noun clause
  const isDirectAnaphora = /\b(which of (them|those)|who among them|who of them|any of them|what about them)\b/i.test(lower);
  const isNarrowing = /\b(only|just|specifically|filter by|narrow to|show me only)\b/i.test(lower) && !/(?:only|just)\s+unresolved\b/i.test(lower);
  const isExplicitExpansion = /\b(also|in addition|as well as|and check|what about|include|check also|additionally)\b/i.test(lower);
  const isPrioritizeFollowUp = (
    /\b(which of (those|them).*(first|priority)|what.*(those|them).*(check|review) first|which.*(those|them).*(check|review) first)\b/i.test(lower) ||
    (/\b(what|which).*(check|review|look at)\s+first\b/i.test(lower) && /\b(those|them|these)\b/i.test(lower))
  );

  const nounAntecedentPattern = /\b(cases?|concerns?|issues?|events?|records?|classes?|exceptions?|reports?|findings?|items?|members?|teachers?|students?|gradings?|grades?|infractions?|incidents?|applications?)\b/i;
  const isDirectStandAlone = isDirectAnaphora || (
    /^(them|those|these|they|that|tell me where to review them|where to review them)\b/i.test(lower) && !nounAntecedentPattern.test(lower)
  );

  // Has current prompt antecedent when positive domains or plural nouns are present in prompt
  const hasCurrentPromptAntecedent = !isDirectStandAlone && (positiveDomains.length > 0 || nounAntecedentPattern.test(lower));
  const hasHistoricalAntecedent = priorContext.domains.size > 0;

  // A follow-up candidate seeks prior turn context:
  // - Direct standalone anaphora
  // - Explicit narrowing from prior context
  // - Explicit expansion from prior context
  // - Contextual prioritization from prior context
  const isFollowUpCandidate = (isDirectStandAlone || isNarrowing || isExplicitExpansion || isPrioritizeFollowUp) && !hasCurrentPromptAntecedent;

  // 5. Special Query Types
  const isAttentionSweep = (
    /\b(what\s+needs\s+(my\s+)?(review|attention)|what\s+should\s+i\s+(review|attend\s+to|pay\s+attention\s+to|be\s+paying\s+attention\s+to|deal\s+with|handle|look\s+at|check|tackle|address)|items?\s+needing\s+(review|attention)|operational\s+(exceptions?|concerns?)|what\s+matters\s+most\s+today|what\s+should\s+i\s+prioritize|anything\s+urgent)\b/i.test(lower) ||
    (/\b(review|attention|priority|prioritize|deal\s+with)\s+today\b/i.test(lower) && /\b(what|need|item|exception|pulse|paying|first)\b/i.test(lower))
  );

  const hasSeparateUnrelated = /\b(separate\s+(anything\s+|the\s+)?unrelated|which\s+are\s+unrelated|unrelated\s+(issues?|items?|ones?|findings?))\b/i.test(lower);
  if (hasSeparateUnrelated) {
    overallConstraints.push({
      type: 'SEPARATE_UNRELATED',
    });
  }

  const hasNavigation = operations.has('navigate');
  const hasDraft = operations.has('draft');
  const hasCorrelate = operations.has('correlate') || hasSeparateUnrelated;
  const hasPrioritize = operations.has('prioritize') || isPrioritizeFollowUp;

  const isMeetingBrief = (
    /\b(meeting\s+(brief|prep(aration)?)|prepare(\s+me)?\s+for.*meeting|faculty\s+meeting|executive\s+meeting)\b/i.test(lower)
  ) && !lower.includes('weekly');

  const isWeeklyBrief = (
    /\b(weekly\s+(operations?\s+)?(report|summary|brief)|summarize\s+(this\s+week('s)?|weekly)\b.*operations?)\b/i.test(lower) ||
    (lower.includes('week') && lower.includes('operation'))
  );

  const isAttendanceCrossCheck = !lower.includes('pending') && !lower.includes('behavior') && !lower.includes('incident') && !lower.includes('cases') && (
    /\b(cross-?check|audit)\b.*\b(attendance|gate(\s+records?|\s+check-?ins?)?)\b.*\b(approved\s+)?leaves?\b/i.test(lower) ||
    /\b(check|audit|cross-?check)\b.*\bfaculty\s+(gate\s+records?|attendance)\b.*\b(approved\s+)?leaves?\b/i.test(lower) ||
    /\b(gate\s+records?|gate\s+check-?ins?|faculty\s+attendance)\b.*\b(against|with)\b.*\b(approved\s+)?leaves?\b/i.test(lower) ||
    /\b(faculty\s+.*unresolved|attendance\s+.*exception|unresolved.*faculty)\b.*\b(explained|covered)\s+by\s+(approved\s+)?leaves?\b/i.test(lower)
  );

  return {
    raw,
    lower,
    clauses,
    positiveDomains,
    excludedDomains,
    operations,
    constraints: overallConstraints,
    hasNavigation,
    hasDraft,
    hasCorrelate,
    hasSeparateUnrelated,
    hasPrioritize,
    isAttentionSweep,
    isSocial,
    socialType,
    isOutOfScope,
    hasCurrentPromptAntecedent,
    hasHistoricalAntecedent,
    isDirectAnaphora,
    isFollowUpCandidate,
    isNarrowing,
    isExplicitExpansion,
    isMeetingBrief,
    isWeeklyBrief,
    isAttendanceCrossCheck,
  };
}

/**
 * Resolves tool arguments for a domain while propagating active constraints (e.g. status exclusions).
 */
function buildDomainToolArgs(domainName: OperationalDomainName, constraints: RequestConstraint[]): Record<string, any> {
  const catalogEntry = DOMAIN_CATALOG[domainName];
  let args = catalogEntry.defaultArgs ? { ...catalogEntry.defaultArgs } : {};
  if (domainName === 'behavior') {
    const excludeResolved = constraints.some(c => c.type === 'EXCLUDE_STATUS' && c.value === 'Resolved');
    if (excludeResolved) {
      args = { ...args, status: 'Under investigation' };
    }
  }
  return args;
}

/**
 * Builds a structured plan with synchronized domainObligations, operationObligations, obligations, and constraints.
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
      operation: 'retrieve',
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
 * Analyzes clauses, intent, domains, negations, constraints, and conversational context to produce a deterministic execution plan.
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
  if (!raw) {
    return null;
  }

  // ─── FULL-REQUEST ANALYSIS FIRST (Invariants 1 & 2) ───────────────────
  const analysis = analyzeRequest(raw, messages);
  const lower = analysis.lower;
  const priorContext = extractPriorOperationalContext(messages);

  // ─── 1. Security Guard: Out-of-Scope Boundary Check ──────────────────
  if (analysis.isOutOfScope) {
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
  if (analysis.isSocial) {
    if (analysis.socialType === 'COURTESY') {
      return createPlan('SOCIAL', [], [], [], { directResponseContent: 'You’re welcome.' });
    }
    return createPlan('SOCIAL', [], [], [], { directResponseContent: 'Good day. How may I assist you with school operations?' });
  }

  // ─── 3. Navigation Check: Pure Navigation vs Composite Navigation ─────
  const hasExplicitDataQuestion = (
    analysis.operations.has('explain') ||
    analysis.operations.has('draft') ||
    analysis.operations.has('count') ||
    analysis.operations.has('correlate') ||
    analysis.operations.has('compare') ||
    analysis.operations.has('prioritize') ||
    analysis.isAttentionSweep ||
    /\b(are\s+there\s+any|is\s+there\s+any|how\s+many|show\s+me|list\s+the|what\s+are\s+the|tell\s+me\s+if)\b/i.test(lower) ||
    analysis.clauses.length > 1
  );

  const isPureNavQuery = (
    (lower.startsWith('where do i') ||
    lower.startsWith('where can i') ||
    lower.startsWith('how do i') ||
    lower.startsWith('how can i') ||
    lower.startsWith('where to') ||
    lower.includes('help me find or understand') ||
    lower.includes('which digiskwela feature')) &&
    !hasExplicitDataQuestion
  );

  if (isPureNavQuery) {
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
  const hasReferent = isDirectAnaphora || /\b(them|those|these|they|that\s+one|about\s+that|this\s+one|the\s+second\s+one|the\s+first\s+one|most\s+important\s+(one|problem|issue))\b/i.test(lower);
  const isNarrowing = /\b(only|just|specifically|filter by|narrow to|show me only)\b/i.test(lower) && !/(?:only|just)\s+unresolved\b/i.test(lower);
  const isExplicitExpansion = /\b(also|in addition|as well as|and check|what about|include|check also|additionally)\b/i.test(lower);
  const isPrioritizeFollowUp = (
    /\b(which of (those|them).*(first|priority)|what.*(those|them).*(check|review) first|which.*(those|them).*(check|review) first)\b/i.test(lower) ||
    (/\b(what|which).*(check|review|look at)\s+first\b/i.test(lower) && /\b(those|them|these)\b/i.test(lower))
  );

  const isFollowUpCandidate = (hasReferent || isNarrowing || isExplicitExpansion || isPrioritizeFollowUp) && !analysis.isAttentionSweep;

  if (isFollowUpCandidate) {
    const currentDomains = analysis.positiveDomains;

    // A. If NO prior conversation context:
    if (priorContext.domains.size === 0) {
      // Check if current message has a self-contained noun antecedent:
      // (e.g. "Look at today's operational concerns... review them" or "Check behavior cases and review them")
      const selfContainedNoun = (currentDomains.length > 0 || /\b(concerns?|issues?|cases?|exceptions?|events?|records?|classes?|items?|findings?|infractions?|incidents?|grades?|reports?|members?|teachers?|students?)\b/i.test(lower)) && !isDirectAnaphora && !/^(them|those|these|they|that|explain the most important|which of them)\b/i.test(lower);

      if (!selfContainedNoun && (isDirectAnaphora || (currentDomains.length === 0 && (hasReferent || isPrioritizeFollowUp || isNarrowing)))) {
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

    // B. If prior conversation context EXISTS:
    if (priorContext.domains.size > 0) {
      // 4.1 NARROWING: "Only show me the faculty-related ones"
      if (isNarrowing) {
        const targetDomain = (Object.keys(DOMAIN_CATALOG) as OperationalDomainName[]).find(d => 
          DOMAIN_CATALOG[d].keywords.test(lower) && !analysis.excludedDomains.includes(d)
        );
        if (targetDomain && priorContext.domains.has(targetDomain)) {
          const entry = DOMAIN_CATALOG[targetDomain];
          if (allowedToolNames.has(entry.toolName)) {
            return createPlan(
              'SINGLE_DOMAIN',
              [{ name: entry.toolName, args: entry.defaultArgs || {} }],
              [{ domain: targetDomain, description: `${entry.displayName} records` }],
              [{ operation: 'retrieve', targetDomain, description: `Filtered to ${entry.displayName}` }],
              { skipFeatureMenuRule: true, constraints: analysis.constraints }
            );
          }
        }
      }

      // 4.2 EXPLICIT EXPANSION: "Also check behavior cases and academics"
      if (isExplicitExpansion) {
        const newDomains: OperationalDomainName[] = [];
        for (const [dom, meta] of Object.entries(DOMAIN_CATALOG)) {
          if (meta.keywords.test(lower) && !priorContext.domains.has(dom as OperationalDomainName) && !analysis.excludedDomains.includes(dom as OperationalDomainName)) {
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
              { skipFeatureMenuRule: true, constraints: analysis.constraints }
            );
          }
        }
      }

      // 4.3 CONTEXTUAL PRIORITIZATION: "Which of those should I check first?"
      if (isPrioritizeFollowUp) {
        const tools: PlannedToolDispatch[] = [];
        const domainObs: DomainObligation[] = [];
        const opObs: OperationObligation[] = [];

        for (const dom of priorContext.domains) {
          if (analysis.excludedDomains.includes(dom)) continue;
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
              constraints: analysis.constraints,
            }
          );
        }
      }

      // 4.4 CONTEXTUAL CORRELATION: "Which of them involve the same faculty member?"
      if (/\b(same faculty|involve the same|correlate|overlap|related)\b/i.test(lower)) {
        if (priorContext.domains.has('faculty_attendance') || priorContext.domains.has('leaves')) {
          const tools: PlannedToolDispatch[] = [];
          const domainObs: DomainObligation[] = [];
          if (allowedToolNames.has('getFacultyAttendanceAudit') && !analysis.excludedDomains.includes('faculty_attendance')) {
            tools.push({ name: 'getFacultyAttendanceAudit', args: {} });
            domainObs.push({ domain: 'faculty_attendance', description: 'Faculty attendance records' });
          }
          if (allowedToolNames.has('getPendingLeaves') && !analysis.excludedDomains.includes('leaves')) {
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
              constraints: analysis.constraints,
            }
          );
        }
      }

      // 4.5 CONTEXTUAL EXPLANATION: "Explain the most important one"
      if (/\b(explain|why|reason|cause)\b/i.test(lower) && currentDomains.length === 0) {
        const targetDomain = priorContext.recentDomains[0] || Array.from(priorContext.domains)[0];
        if (targetDomain && !analysis.excludedDomains.includes(targetDomain)) {
          const entry = DOMAIN_CATALOG[targetDomain];
          if (entry && allowedToolNames.has(entry.toolName)) {
            return createPlan(
              'SINGLE_DOMAIN',
              [{ name: entry.toolName, args: entry.defaultArgs || {} }],
              [{ domain: targetDomain, description: `${entry.displayName} records` }],
              [{ operation: 'explain', targetDomain, description: `Explain ${entry.displayName}` }],
              { skipFeatureMenuRule: true, constraints: analysis.constraints }
            );
          }
        }
      }

      // 4.6 Follow-up attendance status filtering & authoritative leave cross-check
      // Case I FIX: If the user asks if attendance issues have supporting leave records,
      // dispatch BOTH getFacultyAttendanceAudit AND getPendingLeaves!
      const isAttendanceScope = currentDomains.includes('faculty_attendance') || (priorContext.domains.has('faculty_attendance') && (hasReferent || isDirectAnaphora || currentDomains.length === 0 || lower.includes('approved leave') || lower.includes('on leave')));
      if (isAttendanceScope && allowedToolNames.has('getFacultyAttendanceAudit') && !analysis.excludedDomains.includes('faculty_attendance')) {
        const asksAboutLeaveRecords = /\b(supporting\s+leave|leave\s+records?|leave\s+requests?|leave\s+coverage|have\s+supporting\s+leave)\b/i.test(lower) && !lower.includes('on approved leave') && !lower.includes('on leave');
        if (asksAboutLeaveRecords && allowedToolNames.has('getPendingLeaves')) {
          return createPlan(
            'ATTENDANCE_CROSSCHECK',
            [
              { name: 'getFacultyAttendanceAudit', args: {} },
              { name: 'getPendingLeaves', args: { limit: 10 } }
            ],
            [
              { domain: 'faculty_attendance', description: 'Faculty attendance records' },
              { domain: 'leaves', description: 'Authoritative Leave Management records' }
            ],
            [
              { operation: 'retrieve', targetDomain: 'faculty_attendance', description: 'Re-ground attendance exceptions' },
              { operation: 'correlate', targetDomain: 'leaves', description: 'Correlate attendance exceptions with authoritative leave applications' }
            ],
            {
              isCorrelate: true,
              skipFeatureMenuRule: true,
              constraints: analysis.constraints,
            }
          );
        }

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
            [{ operation: 'retrieve', targetDomain: 'faculty_attendance', description: `Faculty attendance with statusFilter=${statusFilter}` }],
            { constraints: analysis.constraints }
          );
        }
      }

      // 4.7 Ambiguous follow-up without antecedent: honest clarification
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


  // ─── 5. Meeting Brief Intent (Pure) ──────────────────────────────────
  const specificDataDomains = analysis.positiveDomains.filter(d => d !== 'overview' && d !== 'meeting_brief' && d !== 'weekly_report');

  if (analysis.isMeetingBrief && allowedToolNames.has('generatePrincipalMeetingBrief') && specificDataDomains.length === 0) {
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
      ],
      { constraints: analysis.constraints }
    );
  }

  // ─── 6. Weekly Operations Report Intent (Pure) ────────────────────────
  if (analysis.isWeeklyBrief && allowedToolNames.has('generateWeeklyOperationsReport') && specificDataDomains.length === 0) {
    return createPlan(
      'WEEKLY_BRIEF',
      [{ name: 'generateWeeklyOperationsReport', args: {} }],
      [{ domain: 'weekly_report', description: 'Weekly school operations report' }],
      [
        { operation: 'generate_report', targetDomain: 'weekly_report', description: 'Generate weekly operations report' },
        { operation: 'summarize', targetDomain: 'weekly_report', description: 'Summarize weekly operational metrics' }
      ],
      { constraints: analysis.constraints }
    );
  }

  // ─── 7. Attendance Cross-Check Intent (Pure) ──────────────────────────
  if (
    analysis.isAttendanceCrossCheck && 
    allowedToolNames.has('getFacultyAttendanceAudit') && 
    !analysis.excludedDomains.includes('faculty_attendance') &&
    !analysis.positiveDomains.some(d => d !== 'faculty_attendance' && d !== 'leaves')
  ) {
    const tools: PlannedToolDispatch[] = [{ name: 'getFacultyAttendanceAudit', args: {} }];
    const domainObs: DomainObligation[] = [{ domain: 'faculty_attendance', description: 'Faculty attendance records' }];
    if (allowedToolNames.has('getPendingLeaves') && !analysis.excludedDomains.includes('leaves')) {
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
        constraints: analysis.constraints,
      }
    );
  }

  // ─── 8. Multi-Domain, Attention Sweep & Operational Inquiries ─────────
  const mentionedDomains: OperationalDomainName[] = [...analysis.positiveDomains];

  // If this is an attention sweep or prioritization without explicit domains:
  if ((analysis.isAttentionSweep || analysis.hasPrioritize) && mentionedDomains.length === 0) {
    if (!analysis.excludedDomains.includes('faculty_attendance')) mentionedDomains.push('faculty_attendance');
    if (!analysis.excludedDomains.includes('leaves')) mentionedDomains.push('leaves');
    if (!analysis.excludedDomains.includes('behavior')) mentionedDomains.push('behavior');
  }

  // If correlation is requested without explicit domains, populate core operational exception domains:
  if (analysis.hasCorrelate && mentionedDomains.length === 0) {
    if (!analysis.excludedDomains.includes('faculty_attendance')) mentionedDomains.push('faculty_attendance');
    if (!analysis.excludedDomains.includes('leaves')) mentionedDomains.push('leaves');
    if (!analysis.excludedDomains.includes('behavior')) mentionedDomains.push('behavior');
  }

  // If correlation is requested between attendance and leaves, make sure both are included:
  if (analysis.hasCorrelate && (mentionedDomains.includes('faculty_attendance') || mentionedDomains.includes('leaves'))) {
    if (!mentionedDomains.includes('faculty_attendance') && !analysis.excludedDomains.includes('faculty_attendance')) {
      mentionedDomains.push('faculty_attendance');
    }
    if (!mentionedDomains.includes('leaves') && !analysis.excludedDomains.includes('leaves')) {
      mentionedDomains.push('leaves');
    }
  }

  // Simple Narrow Query: exactly 1 positive domain and 1 simple operation, no draft/explain/prioritize/correlate/navigate
  if (
    mentionedDomains.length === 1 && 
    analysis.operations.size === 1 && 
    (analysis.operations.has('count') || analysis.operations.has('retrieve')) && 
    !analysis.hasDraft && 
    !analysis.operations.has('explain') && 
    !analysis.hasPrioritize && 
    !analysis.hasCorrelate && 
    !analysis.hasNavigation
  ) {
    const domainName = mentionedDomains[0];
    const catalogEntry = DOMAIN_CATALOG[domainName];
    if (allowedToolNames.has(catalogEntry.toolName)) {
      const op = analysis.operations.has('count') ? 'count' : 'retrieve';
      const toolArgs = buildDomainToolArgs(domainName, analysis.constraints);
      return createPlan(
        'SINGLE_DOMAIN',
        [{ name: catalogEntry.toolName, args: toolArgs }],
        [{ domain: domainName, description: `${catalogEntry.displayName} records` }],
        [{ operation: op, targetDomain: domainName, description: `${op} for ${catalogEntry.displayName}` }],
        { constraints: analysis.constraints }
      );
    }
  }

  // Pure generic sweep (e.g. "What needs my review today?") without explicit domains or correlation
  if (analysis.isAttentionSweep && analysis.positiveDomains.length === 0 && !analysis.hasCorrelate) {
    const tools: PlannedToolDispatch[] = [];
    const domainObs: DomainObligation[] = [];
    const opObs: OperationObligation[] = [];

    if (allowedToolNames.has('getFacultyAttendanceAudit') && !analysis.excludedDomains.includes('faculty_attendance')) {
      tools.push({ name: 'getFacultyAttendanceAudit', args: {} });
      domainObs.push({ domain: 'faculty_attendance', description: 'Faculty attendance exceptions' });
      opObs.push({ operation: 'retrieve', targetDomain: 'faculty_attendance', description: 'Audit faculty attendance exceptions' });
    }
    if (allowedToolNames.has('getPendingLeaves') && !analysis.excludedDomains.includes('leaves')) {
      tools.push({ name: 'getPendingLeaves', args: { limit: 10 } });
      domainObs.push({ domain: 'leaves', description: 'Pending leave requests' });
      opObs.push({ operation: 'retrieve', targetDomain: 'leaves', description: 'Audit pending leave requests' });
    }
    if (allowedToolNames.has('getAdministrativeBehaviorSummary') && !analysis.excludedDomains.includes('behavior')) {
      tools.push({ name: 'getAdministrativeBehaviorSummary', args: { limit: 10 } });
      domainObs.push({ domain: 'behavior', description: 'Administrative behavior summary' });
      opObs.push({ operation: 'retrieve', targetDomain: 'behavior', description: 'Audit active behavioral cases' });
    }
    if (allowedToolNames.has('getSchoolOperationalFactSheet') && !analysis.excludedDomains.includes('overview')) {
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
          constraints: analysis.constraints,
        }
      );
    }
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
          let toolArgs = catalogEntry.defaultArgs ? { ...catalogEntry.defaultArgs } : {};
          // Propagate exclusion filters if tool supports it (Requirement 6)
          if (domainName === 'behavior') {
            const excludeResolved = analysis.constraints.some(c => c.type === 'EXCLUDE_STATUS' && c.value === 'Resolved');
            if (excludeResolved) {
              toolArgs = { ...toolArgs, status: 'Under investigation' };
            }
          }
          tools.push({ name: catalogEntry.toolName, args: toolArgs });
        }
        domainObs.push({ domain: domainName, description: `${catalogEntry.displayName} records` });
      }
    }

    // Attach meeting brief or weekly operations report tools if composite request
    if (analysis.isMeetingBrief && allowedToolNames.has('generatePrincipalMeetingBrief')) {
      if (!tools.some(t => t.name === 'generatePrincipalMeetingBrief')) {
        tools.push({ name: 'generatePrincipalMeetingBrief', args: { meetingType: 'FACULTY_MEETING' } });
        domainObs.push({ domain: 'meeting_brief', description: 'Meeting brief records' });
      }
    }
    if (analysis.isWeeklyBrief && allowedToolNames.has('generateWeeklyOperationsReport')) {
      if (!tools.some(t => t.name === 'generateWeeklyOperationsReport')) {
        tools.push({ name: 'generateWeeklyOperationsReport', args: {} });
        domainObs.push({ domain: 'weekly_report', description: 'Weekly school operations report' });
      }
    }

    // Build independent operation obligations across detected operations
    for (const op of analysis.operations) {
      const targetDomain = mentionedDomains.length === 1 ? mentionedDomains[0] : undefined;
      const desc = targetDomain 
        ? `${op} on ${DOMAIN_CATALOG[targetDomain].displayName}`
        : `${op} across ${mentionedDomains.map(d => DOMAIN_CATALOG[d].displayName).join(', ')}`;
      opObs.push({ operation: op, targetDomain, description: desc });
    }

    // Attach navigation action if navigation requested (Requirement 14)
    let navigationAction: NormalizedNavigationAction | undefined = undefined;
    if (analysis.hasNavigation) {
      const primaryNavDomain = mentionedDomains[0] || 'overview';
      navigationAction = DOMAIN_CATALOG[primaryNavDomain]?.navAction || DOMAIN_CATALOG.overview.navAction;
    }

    if (tools.length > 0) {
      return createPlan(
        tools.length > 1 ? 'MULTI_DOMAIN' : 'SINGLE_DOMAIN',
        tools,
        domainObs,
        opObs,
        {
          isDraft: analysis.hasDraft,
          isCorrelate: analysis.hasCorrelate,
          hasSeparateUnrelated: analysis.hasSeparateUnrelated,
          isPrioritize: analysis.hasPrioritize,
          skipFeatureMenuRule: tools.length > 1,
          navigationAction,
          constraints: analysis.constraints,
        }
      );
    }
  }

  // Ambiguous or unmapped: Let dynamic model-assisted planning execute
  return createPlan('DYNAMIC', [], [], [], { constraints: analysis.constraints });
}
