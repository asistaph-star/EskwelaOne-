/**
 * DIGISKWELA — Global AI Response Normalizer & Sanitizer
 * 
 * Enforces clean, natural, grounded presentation globally:
 * 1. Decodes HTML entities (&#x..., &#..., &amp;, etc.)
 * 2. Replaces internal route identifiers (p-monitoring, p-leaves, etc.) with human-readable module names
 * 3. Humanizes raw enums and snake_case tokens (partial_terms, TIME_OUT_PENDING, etc.)
 * 4. Eliminates generic chatbot filler (Sure!, Certainly!, If you need anything else...)
 * 5. Eliminates awkward empty-collection narrations ("All other faculty (none)...")
 * 6. Softens over-prescriptive actions to neutral administrative language
 * 7. Deduplicates narrative when rich structured UI cards represent the report
 */

const ROUTE_LABELS: Record<string, string> = {
  'p-dashboard': 'Dashboard Overview',
  'p-monitoring': 'Gate Attendance Monitoring',
  'p-leaves': 'Leave Management',
  'p-behavior': 'Behavioral Reports',
  'p-analytics': 'Academic Analytics',
  'p-teachers': 'Teacher Management',
  'p-events': 'School Events',
  'p-inventory': 'Inventory',
  'p-doc-requests': 'Document Requests',
  'p-announcements': 'Announcements',
  'p-settings': 'Settings',
  'p-help': 'Help & Feedback',
};

const ENUM_REPLACEMENTS: Record<string, string> = {
  'partial_terms': 'partial terms',
  'TIME_OUT_PENDING': 'time-out pending',
  'ON_APPROVED_LEAVE': 'on approved leave',
  'NO_GATE_CHECK_IN_NO_APPROVED_LEAVE_FOUND': 'no gate check-in recorded and no approved leave found',
  'FACULTY_MEETING': 'Faculty Meeting',
  'UNDER_INVESTIGATION': 'under investigation',
  'PARENT_NOTIFIED': 'parent notified',
  'RESOLVED': 'resolved',
  'REPORTED': 'reported',
  'DISMISSED': 'dismissed',
  'ESCALATED': 'escalated',
};

/**
 * Decodes all numeric and common named HTML entities.
 */
export function decodeHTMLEntities(text: string): string {
  if (!text) return '';
  return text
    // Hex entities: &#x45; -> E
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
      try {
        return String.fromCharCode(parseInt(hex, 16));
      } catch {
        return '';
      }
    })
    // Decimal entities: &#65; -> A
    .replace(/&#([0-9]+);/g, (_, dec) => {
      try {
        return String.fromCharCode(parseInt(dec, 10));
      } catch {
        return '';
      }
    })
    // Common named entities
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–');
}

/**
 * Strips generic chatbot filler openings and closings.
 */
export function stripChatbotFiller(text: string): string {
  if (!text) return '';
  let cleaned = text.trim();

  // Strip openings like "Sure!", "Certainly!", "Absolutely!", "Of course!", "Yes—", "Great question!"
  cleaned = cleaned.replace(/^(?:Sure!?|Certainly!?|Absolutely!?|Of course!?|Yes[—\-–]|Great question!?)\s*/i, '');

  // Strip closing filler like "Let me know if...", "If you need anything else...", "Feel free to..."
  cleaned = cleaned.replace(/\s*(?:If you need anything else|If you need any|Let me know if|Feel free to|Just let me know)[\s\S]*$/i, '');

  return cleaned.trim();
}

/**
 * Normalizes internal routes to human-readable DigiSkwela module titles.
 */
export function replaceRouteIds(text: string): string {
  if (!text) return '';
  let result = text;

  // Replace unicode non-breaking hyphens with standard hyphens in route-like patterns
  result = result.replace(/p\u2011([a-z]+)/gi, 'p-$1');

  // Replace parenthetical or arrow route citations:
  // e.g. "(see Leave Management → p-leaves)" -> "(see Leave Management)"
  // e.g. "(see p-leaves)" -> "(see Leave Management)"
  // e.g. "(see p-monitoring)" -> "(see Gate Attendance Monitoring)"
  result = result.replace(/\(see\s+([^→\)]*?)\s*→\s*p-[a-z-]+\)/gi, '(see $1)');
  
  for (const [routeId, title] of Object.entries(ROUTE_LABELS)) {
    const escaped = routeId.replace(/-/g, '[-—\u2011]');
    // "(see p-leaves)" -> "(see Leave Management)"
    result = result.replace(new RegExp(`\\(see\\s+${escaped}\\)`, 'gi'), `(see ${title})`);
    // "navigate to p-monitoring" -> "open Gate Attendance Monitoring"
    result = result.replace(new RegExp(`(?:navigate to|go to(?: the)?)\\s+${escaped}(?:\\s+dashboard)?`, 'gi'), `open ${title}`);
    // standalone route id mention -> title
    result = result.replace(new RegExp(`\\b${escaped}\\b`, 'gi'), title);
  }

  // Also clean up any loose "student-attention"
  result = result.replace(/student[-—\u2011]attention/gi, 'Student Welfare');

  return result;
}

/**
 * Humanizes backend enums and raw snake_case tokens.
 */
export function humanizeEnums(text: string): string {
  if (!text) return '';
  let result = text;

  for (const [rawEnum, human] of Object.entries(ENUM_REPLACEMENTS)) {
    const regex = new RegExp(`\\b${rawEnum}\\b`, 'g');
    result = result.replace(regex, human);
  }

  return result;
}

/**
 * Eliminates awkward or redundant empty-collection narrations and prescriptiveness.
 */
export function cleanAwkwardLanguage(text: string): string {
  if (!text) return '';
  let result = text;

  // Remove awkward empty-collection phrasing when there are no additional records
  result = result.replace(/(?:No|There are no)\s+other\s+faculty(?:\s+members)?\s+(?:have\s+completed\s+check-ins\s+or\s+are\s+on\s+approved\s+leave|have\s+completed\s+check-ins|are\s+on\s+approved\s+leave|have\s+check-ins\s+recorded|have\s+recorded\s+attendance)\.?/gi, '');
  result = result.replace(/All other faculty\s*\([^\)]*\)\s*have completed check-ins\.?/gi, '');
  result = result.replace(/All other faculty\s+have completed check-ins\.?/gi, '');
  result = result.replace(/\s*\([Nn]one\)/g, '');

  // Over-prescriptive actions -> neutral recommendations
  result = result.replace(/\bApprove\s+(?:or provide guidance on\s+)?the pending leave/gi, 'Review the pending leave');
  result = result.replace(/\bApprove the leave\b/gi, 'Review the leave');
  result = result.replace(/\bTake disciplinary action\b/gi, 'Review the behavior case');
  result = result.replace(/\bRefer the student to Guidance\b/gi, 'Review Guidance counseling options');
  result = result.replace(/\bContact the parent immediately\b/gi, 'Review parent communication history');
  result = result.replace(/\bUnexcused absence\b/gi, 'No gate check-in recorded and no approved leave found');

  // Strip excessive em dashes: replace standalone " — " or " —" with comma or colon where suitable
  result = result.replace(/(\w)\s*—\s*(\w)/g, '$1: $2');

  // Clean up any double spaces left behind by sentence removal
  result = result.replace(/[ \t]{2,}/g, ' ');

  return result.trim();
}

/**
 * Master normalization pipeline for AI assistant message responses.
 */
export function normalizeAssistantText(
  text: string, 
  options?: { 
    hasStructuredData?: boolean;
    toolName?: string;
    skipFeatureMenuRule?: boolean;
  }
): string {
  if (!text) return '';

  // 1. Decode HTML entities
  let cleaned = decodeHTMLEntities(text);

  // 2. Normalize internal route IDs
  cleaned = replaceRouteIds(cleaned);

  // 3. Humanize backend enums
  cleaned = humanizeEnums(cleaned);

  // 4. Strip chatbot filler
  cleaned = stripChatbotFiller(cleaned);

  // 5. Clean awkward / empty collection narrations and over-prescriptive wording
  cleaned = cleanAwkwardLanguage(cleaned);

  // 6. Handle System Help feature menu dump rule
  const lower = cleaned.toLowerCase();
  if (
    !options?.skipFeatureMenuRule && (
      /^(?:which digiskwela feature|which feature would you like)/i.test(cleaned) ||
      lower.includes('help me find or understand a digiskwela feature') ||
      (lower.includes('which digiskwela feature') && (lower.includes('gate attendance') || lower.includes('leave management'))) ||
      (cleaned.includes('Gate Attendance Monitoring') && cleaned.includes('Leave Management') && cleaned.includes('Behavioral Reports') && cleaned.includes('Academic Analytics') && !cleaned.includes('weekly'))
    )
  ) {
    return 'Which DigiSkwela feature do you need help with?';
  }

  // 7. Deduplicate narrative if structured data already represents the detailed report
  if (options?.hasStructuredData) {
    if (options.toolName === 'generatePrincipalMeetingBrief') {
      // Condense verbose duplicate meeting report to a clean executive introduction
      return 'Here is your executive faculty meeting brief compiled from authoritative school records.';
    }
    if (options.toolName === 'generateWeeklyOperationsReport') {
      return 'Here is the weekly operations summary report for Calulut Integrated School.';
    }
  }

  return cleaned;
}
