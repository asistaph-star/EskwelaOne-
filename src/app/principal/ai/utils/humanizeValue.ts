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

  // Common screen codes (aligned with TITLES in PrincipalApp)
  'p-dashboard': 'Dashboard Overview',
  'p-monitoring': 'Gate Attendance Monitoring',
  'p-leaves': 'Leave Management',
  'p-events': 'School Events',
  'p-behavior': 'Behavioral Reports',
  'p-analytics': 'Academic Analytics',
  'p-teachers': 'Teacher Management',
  'p-inventory': 'Inventory',
  'p-doc-requests': 'Document Requests',
  'p-announcements': 'Announcements',
  'p-settings': 'Settings',
  'p-help': 'Help & Feedback',
};

/**
 * Decodes all numeric and common named HTML entities.
 */
export function decodeHTMLEntities(text: string): string {
  if (!text) return '';
  return text
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
      try {
        return String.fromCharCode(parseInt(hex, 16));
      } catch {
        return '';
      }
    })
    .replace(/&#([0-9]+);/g, (_, dec) => {
      try {
        return String.fromCharCode(parseInt(dec, 10));
      } catch {
        return '';
      }
    })
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
 * Scans narrative text for embedded raw enums, route codes, or HTML entities and cleans them.
 */
export function sanitizeNarrativeEnums(text: string): string {
  if (!text || typeof text !== 'string') return text;

  // 1. Decode HTML entities
  let result = decodeHTMLEntities(text);

  // 2. Replace unicode non-breaking hyphens with standard hyphens in route tokens
  result = result.replace(/p[\u2011\-]([a-z]+)/gi, 'p-$1');

  // 3. Clean up parenthetical routes: (see Module → p-module) -> (see Module)
  result = result.replace(/\(see\s+([^→\)]*?)\s*→\s*p-[a-z-]+\)/gi, '(see $1)');

  // 4. Replace known route IDs with human-readable titles (longest first to avoid clobbering compound phrases)
  const sortedEntries = Object.entries(KNOWN_PHRASE_MAP).sort((a, b) => b[0].length - a[0].length);
  for (const [rawToken, humanized] of sortedEntries) {
    const escaped = rawToken.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
    result = result.replace(new RegExp(`\\(see\\s+${escaped}\\)`, 'gi'), `(see ${humanized})`);
    result = result.replace(new RegExp(`(?:navigate to|go to(?: the)?)\\s+${escaped}(?:\\s+dashboard)?`, 'gi'), `open ${humanized}`);
    if (/^[A-Z0-9]+$/.test(rawToken)) {
      result = result.replace(new RegExp(`\\b${escaped}\\b`, 'g'), humanized);
    } else {
      result = result.replace(new RegExp(`\\b${escaped}\\b`, 'gi'), humanized);
    }
  }

  // 5. Replace any remaining CONSTANT_CASE tokens
  result = result.replace(/\b[A-Z0-9]+(?:_[A-Z0-9]+)+\b/g, (match) => {
    return humanizeValue(match);
  });

  // 6. Replace known snake_case tokens
  result = result.replace(/\b[a-z0-9]+(?:_[a-z0-9]+)+\b/g, (match) => {
    return humanizeValue(match);
  });

  // 7. Remove awkward empty-collection phrases and (none)
  result = result.replace(/All other faculty\s*\([^\)]*\)\s*have completed check-ins\.?/gi, '');
  result = result.replace(/All other faculty\s+have completed check-ins\.?/gi, '');
  result = result.replace(/\s*\([Nn]one\)/g, '');

  // 8. Over-prescriptive actions -> neutral
  result = result.replace(/\bApprove\s+(?:or provide guidance on\s+)?the pending leave/gi, 'Review the pending leave');
  result = result.replace(/\bApprove the leave\b/gi, 'Review the leave');
  result = result.replace(/\bTake disciplinary action\b/gi, 'Review the behavior case');
  result = result.replace(/\bRefer the student to Guidance\b/gi, 'Review Guidance counseling options');
  result = result.replace(/\bContact the parent(?:\s+immediately)?\b/gi, 'Review parent communication history');
  result = result.replace(/\bUnexcused absence\b/gi, 'No gate check-in recorded and no approved leave found');

  return result;
}
