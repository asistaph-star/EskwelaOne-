/**
 * DIGISKWELA — Global Human-Readable Value Formatter
 * 
 * Centralizes presentation formatting for internal enums, snake_case identifiers,
 * and database status values without altering underlying backend semantics.
 */

const KNOWN_PHRASE_MAP: Record<string, string> = {
  // Attendance gate statuses
  'NO_GATE_CHECK_IN_NO_APPROVED_LEAVE_FOUND': 'No gate check-in / no approved leave found',
  'TIME_OUT_PENDING': 'Time-out pending',
  'ON_APPROVED_LEAVE': 'On approved leave',
  'COMPLETED': 'Completed',

  // Academic completeness statuses
  'partial_terms': 'Partial terms',
  'complete_annual_evaluation': 'Complete annual evaluation',
  'partial_evaluation': 'Partial evaluation',
  'incomplete_annual_evaluation': 'Incomplete annual evaluation',
  'all_terms_completed': 'All terms completed',

  // Behavior case statuses
  'UNDER_INVESTIGATION': 'Under investigation',
  'PARENT_NOTIFIED': 'Parent notified',
  'RESOLVED': 'Resolved',
  'REPORTED': 'Reported',
  'DISMISSED': 'Dismissed',
  'ESCALATED': 'Escalated',

  // General workflow statuses
  'PENDING': 'Pending',
  'APPROVED': 'Approved',
  'REJECTED': 'Rejected',
  'CANCELLED': 'Cancelled',
  'ACTIVE': 'Active',
  'INACTIVE': 'Inactive',
  'DRAFT': 'Draft',
  'ARCHIVED': 'Archived',

  // Common screen codes
  'p-dashboard': 'Executive Dashboard',
  'p-monitoring': 'Gate Monitoring',
  'p-leaves': 'Leave Management',
  'p-events': 'Calendar & Events',
  'p-behavior': 'Behavior Records',
  'p-analytics': 'Academic Analytics',
};

/**
 * Humanizes a single internal token or enum value.
 * e.g.:
 * - "partial_terms" -> "Partial terms"
 * - "TIME_OUT_PENDING" -> "Time-out pending"
 * - "NO_GATE_CHECK_IN_NO_APPROVED_LEAVE_FOUND" -> "No gate check-in / no approved leave found"
 */
export function humanizeValue(val: string): string {
  if (!val || typeof val !== 'string') return val;
  const trimmed = val.trim();

  // 1. Direct dictionary match
  if (KNOWN_PHRASE_MAP[trimmed]) {
    return KNOWN_PHRASE_MAP[trimmed];
  }

  const upper = trimmed.toUpperCase();
  if (KNOWN_PHRASE_MAP[upper]) {
    return KNOWN_PHRASE_MAP[upper];
  }

  // 2. CONSTANT_CASE with underscores (e.g., ANNUAL_PASS_RATE, SICK_LEAVE, TIME_OUT_PENDING)
  if (/^[A-Z0-9]+(_[A-Z0-9]+)+$/.test(trimmed)) {
    const words = trimmed.toLowerCase().split('_');
    return words[0].charAt(0).toUpperCase() + words[0].slice(1) + ' ' + words.slice(1).join(' ');
  }

  // 3. snake_case with lowercase (e.g., partial_terms, days_count)
  if (/^[a-z0-9]+(_[a-z0-9]+)+$/.test(trimmed)) {
    const words = trimmed.split('_');
    return words[0].charAt(0).toUpperCase() + words[0].slice(1) + ' ' + words.slice(1).join(' ');
  }

  return trimmed;
}

/**
 * Scans narrative text for embedded raw enums or snake_case tokens and replaces them with humanized equivalents.
 * Prevents raw tokens like "TIME_OUT_PENDING" or "partial_terms" from appearing inside assistant narrative paragraphs.
 */
export function sanitizeNarrativeEnums(text: string): string {
  if (!text || typeof text !== 'string') return text;

  // 1. Replace known multi-word phrases first
  let result = text;
  for (const [rawToken, humanized] of Object.entries(KNOWN_PHRASE_MAP)) {
    const escaped = rawToken.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}\\b`, 'g');
    result = result.replace(regex, humanized);
  }

  // 2. Replace any remaining CONSTANT_CASE tokens (e.g., TIME_OUT_PENDING, SICK_LEAVE)
  result = result.replace(/\b[A-Z0-9]+(?:_[A-Z0-9]+)+\b/g, (match) => {
    return humanizeValue(match);
  });

  // 3. Replace known snake_case tokens (e.g. partial_terms, all_terms_completed)
  result = result.replace(/\b[a-z0-9]+(?:_[a-z0-9]+)+\b/g, (match) => {
    return humanizeValue(match);
  });

  return result;
}
