/**
 * DIGISKWELA — DepEd 2026 Grading Calculation Engine
 * Module: types.ts
 *
 * Pure type definitions for the isolated grading calculation engine.
 * This file MUST NOT import Prisma, database config, Express, or any
 * persistence layer. All types are plain data-transfer objects.
 *
 * Policy Reference: DepEd Order No. 015, s. 2026
 * https://www.deped.gov.ph/wp-content/uploads/DO_s2026_015r.pdf
 */

// ─── Policy Version ───────────────────────────────────────────────────────────

/**
 * Identifies which grading policy version applies.
 *   SY_2026_2027        — Adjusted Transmutation Table (DO 015 s. 2026 Annex D Table 4)
 *   SY_2027_2028_PLUS   — Zero-Based Grading (DO 015 s. 2026 Para. 50)
 */
export type GradingPolicyVersion = 'SY_2026_2027' | 'SY_2027_2028_PLUS';

/**
 * Subject group classification determining the component weight profile.
 *   CORE      — Languages, Math, Science, AP, GMRC/VE  → WW 20 %, PT 50 %, EX 30 %
 *   TECHNICAL — EPP/TLE, MAPEH                         → WW 20 %, PT 60 %, EX 20 %
 * DO 015, s. 2026 Table 9 & Annex D Table 1.
 */
export type SubjectGroup = 'CORE' | 'TECHNICAL';

// ─── Assessment Component Weights ─────────────────────────────────────────────

/**
 * Decimal-fraction component weights for a specific subject group.
 * Invariant: wwWeight + ptWeight + exWeight === 1.0 (exactly).
 * DO 015, s. 2026 Table 9.
 */
export interface ComponentWeights {
  wwWeight: number;
  ptWeight: number;
  exWeight: number;
}

/**
 * Internal weights for the Examinations (EXs) component.
 * These are fractions of the EX percentage score — NOT fractions of the term grade.
 * Invariant: st1Weight + st2Weight + teWeight === 1.0 (exactly).
 * DO 015, s. 2026 Para. 45 & Annex D Step 6.
 */
export interface ExamInternalWeights {
  st1Weight: number; // Summative Test 1 — 0.30
  st2Weight: number; // Summative Test 2 — 0.30
  teWeight:  number; // Term Examination  — 0.40
}

// ─── Assessment Score Inputs ──────────────────────────────────────────────────

/**
 * A single raw assessment score entry (Written Work or Performance Task).
 *
 *   score === null   → assessment is MISSING (unrecorded).  Not a recorded zero.
 *   score === 0      → assessment was taken and earned zero points (RECORDED_ZERO).
 *
 * These two states are semantically distinct and must not be collapsed.
 */
export interface AssessmentScore {
  id:       string;
  label?:   string;
  score:    number | null;
  maxScore: number;
}

/**
 * A single Examination score (ST1, ST2, or TE).
 *   score === null → examination score is missing / not yet recorded.
 */
export interface ExamScore {
  score:    number | null;
  maxScore: number;
}

/**
 * Complete raw-score payload for one student's term calculation.
 *
 * All inputs must be pre-loaded by the integration layer.
 * The engine NEVER reads from or writes to the database.
 */
export interface StudentTermScoreInput {
  enrollmentId: string;
  wwScores:     AssessmentScore[];
  ptScores:     AssessmentScore[];
  st1:          ExamScore;
  st2:          ExamScore;
  te:           ExamScore;
}

// ─── Policy Configuration ─────────────────────────────────────────────────────

/**
 * A resolved, validated grading policy selected by the policy registry.
 */
export interface GradingPolicy {
  policyVersion: GradingPolicyVersion;
  subjectGroup:  SubjectGroup;
  schoolYear:    string;
  gradeLevel:    number;
  weights:       ComponentWeights;
  examWeights:   ExamInternalWeights;
  description:   string;
}

// ─── Calculation Outputs ──────────────────────────────────────────────────────

/** Breakdown of a single WW or PT component. */
export interface ComponentResult {
  totalEarned:     number;
  totalPossible:   number;
  percentageScore: number; // 0–100, full precision intermediate
  weightedScore:   number; // rounded to 2 d.p. (engineering convention — see calculation contract)
}

/** Breakdown of the Examinations component. */
export interface ExamComponentResult {
  st1PercentageScore:  number | null;
  st2PercentageScore:  number | null;
  tePercentageScore:   number | null;
  examPercentageScore: number | null; // null when any required exam score is missing
  weightedScore:       number | null;
}

/** Reference to a specific missing assessment for diagnostic output. */
export interface MissingAssessmentRef {
  type:   'WW' | 'PT' | 'ST1' | 'ST2' | 'TE';
  id?:    string;
  label?: string;
}

/**
 * The complete output produced by the grading engine for one student/term.
 *
 * IMPORTANT: `termGrade` in this structure is a CALCULATED result.
 * It is NOT an official published Grade record.
 * Official grade publication is a separate workflow (Phase 4).
 */
export interface GradeCalculationResult {
  enrollmentId:       string;
  policy:             GradingPolicy;
  wwResult:           ComponentResult | null;
  ptResult:           ComponentResult | null;
  exResult:           ExamComponentResult;
  /**
   * Initial Grade rounded to 2 decimal places.
   * Null when the input is incomplete or invalid.
   */
  initialGrade:       number | null;
  /**
   * Term Grade: integer 60–100 (SY 2026–2027 transmutation) or
   * integer produced by zero-based rounding (SY 2027–2028+).
   * Null when the input is incomplete or IG cannot be determined.
   */
  termGrade:          number | null;
  isComplete:         boolean;
  missingAssessments: MissingAssessmentRef[];
  validationErrors:   string[];
}

/** Parameters for policy registry lookup. */
export interface PolicySelectionParams {
  schoolYear:   string;
  gradeLevel:   number;
  subjectGroup: SubjectGroup;
}
