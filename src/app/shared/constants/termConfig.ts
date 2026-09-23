/**
 * termConfig.ts
 * ─────────────────────────────────────────────────────────────
 * Single source-of-truth for Term configuration in DigiSkwela.
 *
 * IMPORTANT: The internal storage keys are now strictly T1, T2, T3, T4.
 *
 * To change the number of default Terms, update DEFAULT_TERM_COUNT.
 * To change the school year, update SCHOOL_YEAR.
 * ─────────────────────────────────────────────────────────────
 */

/** The internal key format used in API and state (strict). */
export type TermKey = "T1" | "T2" | "T3" | "T4";

/** Human-facing Term descriptor. */
export interface TermConfig {
  /** Internal key, e.g. "T1" — used for storage and data keying. */
  key: TermKey;
  /** Display label shown in the UI, e.g. "Term 1". */
  label: string;
  /** Optional short label for compact views, e.g. "T1". */
  shortLabel: string;
}

/** Active school year label displayed in headers. */
export const SCHOOL_YEAR = "2026–2027";

/** Default number of Terms per school year. */
export const DEFAULT_TERM_COUNT = 3;

/**
 * Generates the Term configuration array for a given number of terms.
 */
export function buildTerms(count: number): TermConfig[] {
  return Array.from({ length: count }, (_, i) => ({
    key: `T${i + 1}` as TermKey,
    label: `Term ${i + 1}`,
    shortLabel: `T${i + 1}`,
  }));
}

/** Pre-built default Terms (Term 1 – Term 3). */
export const DEFAULT_TERMS: TermConfig[] = buildTerms(DEFAULT_TERM_COUNT);

/**
 * Converts an internal key (e.g. "T1") to a display label (e.g. "Term 1").
 * Falls back gracefully if the key is out of range.
 */
export function termLabel(key: TermKey | string): string {
  const match = key.match(/^T(\d+)$/);
  if (!match) return key;
  return `Term ${match[1]}`;
}

/**
 * Converts a display label (e.g. "Term 1") back to the internal key ("T1").
 */
export function labelToTermKey(label: string): TermKey {
  const match = label.match(/^Term\s+(\d+)$/i);
  if (!match) return "T1";
  return `T${match[1]}` as TermKey;
}

/**
 * Grade status key format helper.
 * Old format: "Gr10-Rizal-T1"
 * The key structure stays the same — only display changes.
 */
export function gradeStatusKey(grade: number, section: string, termKey: TermKey | string): string {
  return `Gr${grade}-${section}-${termKey}`;
}
