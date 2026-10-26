/**
 * DIGISKWELA — DepEd 2026 Grading Calculation Engine
 * Module: transmutation.ts
 *
 * Implementation of the official DepEd transmutation rules.
 *
 * THIS FILE MUST NOT import Prisma, database config, Express, or any
 * persistence layer. All logic is deterministic and pure.
 *
 * Policy Sources:
 *   DO No. 015, s. 2026, Annex D, Table 4 (Pages 36–37)
 *     — Adjusted Transmutation Table for SY 2026–2027.
 *   DO No. 015, s. 2026, Para. 50 & Annex D Paras. 13–15 (Pages 38–39)
 *     — Zero-Based Grading effective SY 2027–2028.
 *
 * ROUNDING CONTRACT (Engineering Convention — not explicitly mandated by DepEd):
 *   Intermediate scores (PS, WS) are computed at full floating-point precision.
 *   The Initial Grade (IG) is rounded to 2 decimal places using Half-Up rounding
 *   before transmutation lookup. This is the deterministic convention adopted to
 *   prevent floating-point approximation errors near table thresholds.
 *   Reference: Calculation Contract, Precision Contract Section (Phase 1 spec).
 *
 * VERIFIED REPORTABLE GRADE FLOORS:
 *   SY 2026–2027: Minimum reportable grade is 60 (IG 0.00–4.67 → TG 60).
 *                 Source: Annex D Table 4 (lowest documented interval).
 *   SY 2027–2028+: DepEd Para. 50 states TG = IG (zero-based), with 75 as
 *                  minimum passing. Para. 50 does NOT explicitly state the
 *                  minimum reportable grade. As a FAIL-CLOSED engineering
 *                  decision, the same floor of 60 is applied to avoid
 *                  producing reportable grades below the KS2–KS4 absolute
 *                  minimum established in SY 2026–2027. This decision is
 *                  DOCUMENTED as an implementation convention, not as a
 *                  verified DepEd requirement.
 */

import type { GradingPolicyVersion } from './types.js';

// ─── Half-Up Rounding Helper ──────────────────────────────────────────────────

/**
 * Rounds a number to `decimalPlaces` using deterministic symmetric Half-Up
 * (round half away from zero).
 *
 * To avoid IEEE 754 binary floating-point representation defects
 * (e.g., 1.005 * 100 === 100.49999999999999, which causes Math.floor/Math.round
 * to round down to 1.00 instead of 1.01; or 2.675 * 100 === 267.49999999999994),
 * this implementation uses decimal exponential notation shifting.
 * E.g., Number("1.005e2") -> 100.5 -> Math.round(100.5) = 101 -> Number("101e-2") = 1.01.
 *
 * Distinguishes engineering precision convention (Half-Up to 2 decimal places
 * for intermediate weighted scores and initial grades) from explicitly mandated
 * DepEd rules (integer term grades and Table 4 transmutation intervals).
 *
 * Example: roundHalfUp(1.005, 2)  → 1.01
 *          roundHalfUp(2.675, 2)  → 2.68
 *          roundHalfUp(69.994, 2) → 69.99
 *          roundHalfUp(69.995, 2) → 70.00
 *          roundHalfUp(71.174, 2) → 71.17
 *          roundHalfUp(71.175, 2) → 71.18
 *          roundHalfUp(87.805, 2) → 87.81
 *          roundHalfUp(99.495, 2) → 99.50
 */
export function roundHalfUp(value: number, decimalPlaces: number): number {
  if (!Number.isFinite(value)) {
    return value;
  }
  const sign = value < 0 ? -1 : 1;
  const absVal = Math.abs(value);
  const [mantissa, exponent] = absVal.toString().split('e');
  const exp = exponent ? Number(exponent) + decimalPlaces : decimalPlaces;
  const shifted = Number(`${mantissa}e${exp}`);
  const rounded = Math.round(shifted);
  const [roundedMantissa, roundedExp] = rounded.toString().split('e');
  const finalExp = roundedExp ? Number(roundedExp) - decimalPlaces : -decimalPlaces;
  return sign * Number(`${roundedMantissa}e${finalExp}`);
}

// ─── Adjusted Transmutation Table (SY 2026–2027) ─────────────────────────────

/**
 * All 41 intervals of the Adjusted Transmutation Table.
 * Source: DO No. 015, s. 2026, Annex D, Table 4 (Pages 36–37).
 *
 * Each entry: [lowerBound (inclusive), upperBound (inclusive), termGrade]
 *
 * INVARIANTS verified during module initialisation (see TRANSMUTATION_TABLE_INVARIANTS):
 *   - No overlaps between adjacent intervals.
 *   - Full coverage from 0.00 to 100.00.
 *   - Exactly 41 entries.
 *   - All TG values are integers in [60, 100].
 *
 * Intervals are sorted descending (highest IG first) for binary search clarity.
 * The lookup iterates in order and returns the first matching interval.
 */
export const ADJUSTED_TABLE_2026: ReadonlyArray<readonly [number, number, number]> = [
  [99.50, 100.00, 100],
  [98.32,  99.49,  99],
  [97.14,  98.31,  98],
  [95.96,  97.13,  97],
  [94.78,  95.95,  96],
  [93.60,  94.77,  95],
  [92.42,  93.59,  94],
  [91.24,  92.41,  93],
  [90.06,  91.23,  92],
  [88.88,  90.05,  91],
  [87.70,  88.87,  90],
  [86.52,  87.69,  89],
  [85.34,  86.51,  88],
  [84.16,  85.33,  87],
  [82.98,  84.15,  86],
  [81.80,  82.97,  85],
  [80.62,  81.79,  84],
  [79.44,  80.61,  83],
  [78.26,  79.43,  82],
  [77.08,  78.25,  81],
  [75.90,  77.07,  80],
  [74.72,  75.89,  79],
  [73.54,  74.71,  78],
  [72.36,  73.53,  77],
  [71.18,  72.35,  76],
  [70.00,  71.17,  75],  // ← Minimum Passing Threshold (DO 015 Para. 48)
  [65.34,  69.99,  74],
  [60.67,  65.33,  73],
  [56.01,  60.66,  72],
  [51.34,  56.00,  71],
  [46.67,  51.33,  70],
  [42.01,  46.66,  69],
  [37.34,  42.00,  68],
  [32.68,  37.33,  67],
  [28.01,  32.67,  66],
  [23.35,  28.00,  65],
  [18.68,  23.34,  64],
  [14.01,  18.67,  63],
  [ 9.35,  14.00,  62],
  [ 4.68,   9.34,  61],
  [ 0.00,   4.67,  60],  // ← Minimum Reportable Grade Floor (DO 015 Table 4)
] as const;

/** The minimum reportable grade under the adjusted table. */
const ADJUSTED_MIN_TG = 60;
/** The maximum reportable grade. */
const ADJUSTED_MAX_TG = 100;
/** The minimum Initial Grade that maps to a passing term grade (TG ≥ 75). */
export const ADJUSTED_PASSING_IG_THRESHOLD = 70.00;
/** The minimum reportable Initial Grade (maps to floor TG 60). */
const ADJUSTED_MIN_IG = 0.00;
/** The maximum possible Initial Grade. */
const ADJUSTED_MAX_IG = 100.00;

// ─── Transmutation Error ──────────────────────────────────────────────────────

export class TransmutationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TransmutationError';
  }
}

// ─── SY 2026–2027 Transmutation ───────────────────────────────────────────────

/**
 * Looks up the Term Grade for a given Initial Grade using the official
 * SY 2026–2027 Adjusted Transmutation Table (DO 015 Annex D Table 4).
 *
 * The IG must already be rounded to 2 decimal places (by the caller).
 *
 * @param ig — Initial Grade, expected in [0.00, 100.00] at 2 d.p.
 * @returns  — Integer Term Grade in [60, 100].
 * @throws   — TransmutationError if IG is out of valid range.
 */
export function transmute2026(ig: number): number {
  if (!Number.isFinite(ig)) {
    throw new TransmutationError(`Initial Grade must be a finite number; received: ${ig}`);
  }
  if (ig < ADJUSTED_MIN_IG || ig > ADJUSTED_MAX_IG) {
    throw new TransmutationError(
      `Initial Grade ${ig} is outside the valid range [${ADJUSTED_MIN_IG}, ${ADJUSTED_MAX_IG}].`
    );
  }

  for (const [lo, hi, tg] of ADJUSTED_TABLE_2026) {
    // Both bounds are inclusive.
    // We use roundHalfUp-compared values at 2 d.p. to avoid floating-point drift.
    if (ig >= lo && ig <= hi) {
      return tg;
    }
  }

  // This path should never be reached if the table is complete.
  throw new TransmutationError(
    `Initial Grade ${ig} did not match any interval in the 2026 Adjusted Table. ` +
    `This is an implementation defect — report immediately.`
  );
}

// ─── SY 2027–2028+ Zero-Based Grading ────────────────────────────────────────

/**
 * Produces the Term Grade under the Zero-Based Grading policy
 * effective SY 2027–2028 (DO 015, s. 2026 Para. 50).
 *
 * TG = round(IG) — no transmutation table.
 *
 * Minimum passing TG is 75 (DO 015 Para. 50).
 *
 * IMPLEMENTATION NOTE on the minimum reportable grade:
 *   DO 015 Para. 50 does not explicitly state a minimum reportable grade below 75.
 *   This implementation applies a floor of 60 as a fail-closed engineering
 *   convention to mirror the SY 2026–2027 table floor. This convention is
 *   documented explicitly and NOT claimed as a verified DepEd requirement.
 *   If DepEd issues a clarification, this floor must be updated.
 *
 * @param ig — Initial Grade in [0, 100].
 * @returns  — Integer Term Grade.
 * @throws   — TransmutationError if IG is invalid.
 */
export function zeroBasedGrade(ig: number): number {
  if (!Number.isFinite(ig)) {
    throw new TransmutationError(`Initial Grade must be a finite number; received: ${ig}`);
  }
  if (ig < 0 || ig > 100) {
    throw new TransmutationError(
      `Initial Grade ${ig} is outside the valid range [0, 100].`
    );
  }

  // Round to nearest whole number (Half-Up)
  const tg = roundHalfUp(ig, 0);

  // Apply minimum reportable floor (engineering convention — see file header)
  return Math.max(tg, ADJUSTED_MIN_TG);
}

// ─── Unified Policy Dispatch ──────────────────────────────────────────────────

/**
 * Selects and applies the correct transmutation function for the given
 * policy version. This is the single authoritative entry point for
 * converting an Initial Grade to a Term Grade.
 *
 * @param ig            — Initial Grade, already rounded to 2 d.p.
 * @param policyVersion — Policy version controlling which rule applies.
 * @returns             — Integer Term Grade in [60, 100].
 */
export function applyTransmutation(ig: number, policyVersion: GradingPolicyVersion): number {
  switch (policyVersion) {
    case 'SY_2026_2027':
      return transmute2026(ig);
    case 'SY_2027_2028_PLUS':
      return zeroBasedGrade(ig);
    default: {
      const _exhaustive: never = policyVersion;
      throw new TransmutationError(`Unknown policy version: "${_exhaustive}"`);
    }
  }
}

// ─── Module-Level Invariant Verification ─────────────────────────────────────

/**
 * Verifies structural invariants of the hardcoded transmutation table at import
 * time. This runs once and throws immediately if the table is malformed.
 *
 * Checks:
 *   1. Exactly 41 intervals.
 *   2. All TG values are integers in [ADJUSTED_MIN_TG, ADJUSTED_MAX_TG].
 *   3. Table covers [0.00, 100.00] with no gaps (sorted ascending, continuous).
 */
(function verifyTableInvariants() {
  if (ADJUSTED_TABLE_2026.length !== 41) {
    throw new Error(
      `[GRADING ENGINE DEFECT] Adjusted table has ${ADJUSTED_TABLE_2026.length} intervals; expected 41.`
    );
  }

  // Sort a copy ascending for continuity check
  const sorted = [...ADJUSTED_TABLE_2026].sort((a, b) => a[0] - b[0]);

  for (let i = 0; i < sorted.length; i++) {
    const [lo, hi, tg] = sorted[i];
    if (!Number.isInteger(tg) || tg < ADJUSTED_MIN_TG || tg > ADJUSTED_MAX_TG) {
      throw new Error(`[GRADING ENGINE DEFECT] Invalid TG value ${tg} at index ${i}.`);
    }
    if (lo > hi) {
      throw new Error(`[GRADING ENGINE DEFECT] Inverted interval [${lo}, ${hi}] at index ${i}.`);
    }
    if (i > 0) {
      const prevHi = sorted[i - 1][1];
      // Adjacent interval: next lo should be > prevHi at 2 d.p. precision
      const expectedNextLo = roundHalfUp(prevHi + 0.01, 2);
      if (roundHalfUp(lo, 2) !== expectedNextLo) {
        throw new Error(
          `[GRADING ENGINE DEFECT] Gap or overlap between intervals ` +
          `[..., ${prevHi}] and [${lo}, ...] at index ${i}.`
        );
      }
    }
  }

  // Verify full coverage
  const minLo = sorted[0][0];
  const maxHi = sorted[sorted.length - 1][1];
  if (minLo !== 0.00 || maxHi !== 100.00) {
    throw new Error(
      `[GRADING ENGINE DEFECT] Table does not cover [0.00, 100.00]; ` +
      `actual range: [${minLo}, ${maxHi}].`
    );
  }
})();
