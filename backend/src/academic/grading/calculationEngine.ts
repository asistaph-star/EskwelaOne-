/**
 * DIGISKWELA — DepEd 2026 Grading Calculation Engine
 * Module: calculationEngine.ts
 *
 * Pure calculation functions for the DepEd 2026 grading system.
 *
 * THIS FILE MUST NOT import Prisma, database config, Express, or any
 * persistence layer. All functions are pure: same input → same output,
 * no side effects, no I/O.
 *
 * Policy Sources:
 *   DO No. 015, s. 2026, Annex D, Steps 1–7 (Pages 35–37)
 *
 * ROUNDING CONTRACT (Engineering Conventions):
 *   1. Score ratios are computed at full floating-point precision.
 *   2. Weighted Scores are rounded to 2 d.p. using Half-Up before summation.
 *      This is an engineering convention to prevent cumulative floating-point error.
 *      DepEd mandates the final TG is a whole number but does not specify
 *      intermediate rounding precision explicitly.
 *   3. Initial Grade is rounded to 2 d.p. (Half-Up) before transmutation lookup.
 *   4. Term Grade is an integer produced by the transmutation table or
 *      zero-based rounding.
 *
 * CALCULATION REFERENCE (CALC-01, verified in Phase 1 spec):
 *   WW: 85/100  PT: 90/100  ST1: 25/30  ST2: 25/30  TE: 45/50
 *   PS_WW = 85.00  PS_PT = 90.00
 *   PS_ST1 = 83.3333...  PS_ST2 = 83.3333...  PS_TE = 90.00
 *   PS_EX = (83.3333 × 0.30) + (83.3333 × 0.30) + (90.00 × 0.40) = 25 + 25 + 36 = 86.00
 *   WS_WW = 85.00 × 0.20 = 17.00
 *   WS_PT = 90.00 × 0.50 = 45.00
 *   WS_EX = 86.00 × 0.30 = 25.80
 *   IG = 17.00 + 45.00 + 25.80 = 87.80
 *   TG = 90 (Table 4 interval [87.70, 88.87])
 */

import type {
  StudentTermScoreInput,
  GradingPolicy,
  GradeCalculationResult,
  ComponentResult,
  ExamComponentResult,
  MissingAssessmentRef,
  AssessmentScore,
  ExamScore,
} from './types.js';
import { roundHalfUp, applyTransmutation } from './transmutation.js';

// ─── Input Validation ─────────────────────────────────────────────────────────

/**
 * Validates a single assessment score entry.
 * Returns an error message string if invalid, or null if valid.
 *
 * Valid states:
 *   score === null  → missing (not an error for validation; reported via completeness)
 *   score >= 0      → valid numeric score (including 0)
 *   score <= max    → score within bounds
 *
 * Invalid states:
 *   non-finite score
 *   negative score
 *   score > maxScore
 *   non-finite maxScore
 *   maxScore <= 0
 */
function validateAssessmentScore(
  entry: AssessmentScore,
  context: string,
): string | null {
  if (!Number.isFinite(entry.maxScore) || entry.maxScore <= 0) {
    return `${context} "${entry.id}": maxScore must be a positive finite number (got ${entry.maxScore}).`;
  }
  if (entry.score !== null) {
    if (!Number.isFinite(entry.score)) {
      return `${context} "${entry.id}": score must be a finite number or null (got ${entry.score}).`;
    }
    if (entry.score < 0) {
      return `${context} "${entry.id}": score cannot be negative (got ${entry.score}).`;
    }
    if (entry.score > entry.maxScore) {
      return `${context} "${entry.id}": score (${entry.score}) exceeds maxScore (${entry.maxScore}).`;
    }
  }
  return null;
}

/**
 * Validates a single ExamScore entry.
 * Returns an error message string if invalid, or null if valid.
 */
function validateExamScore(entry: ExamScore, label: string): string | null {
  if (!Number.isFinite(entry.maxScore) || entry.maxScore <= 0) {
    return `${label}: maxScore must be a positive finite number (got ${entry.maxScore}).`;
  }
  if (entry.score !== null) {
    if (!Number.isFinite(entry.score)) {
      return `${label}: score must be a finite number or null (got ${entry.score}).`;
    }
    if (entry.score < 0) {
      return `${label}: score cannot be negative (got ${entry.score}).`;
    }
    if (entry.score > entry.maxScore) {
      return `${label}: score (${entry.score}) exceeds maxScore (${entry.maxScore}).`;
    }
  }
  return null;
}

/**
 * Validates that assessment IDs within a component are unique (no duplicate active entries).
 */
function validateUniqueIds(items: AssessmentScore[], label: string): string | null {
  const seen = new Set<string>();
  for (const item of items) {
    if (seen.has(item.id)) {
      return `${label}: duplicate assessment ID "${item.id}". Active entries must be unique.`;
    }
    seen.add(item.id);
  }
  return null;
}

// ─── Component Score Calculations ─────────────────────────────────────────────

/**
 * Calculates the Percentage Score for a WW or PT component using the
 * verified DepEd aggregation formula:
 *
 *   PS = (Total Earned Points / Total Possible Points) × 100
 *
 * This is NOT an average of individual item percentages.
 * DO 015, s. 2026 Annex D Steps 1–2.
 *
 * If no assessments exist, returns null (treated as an incomplete component).
 */
function calcComponentScore(
  scores: AssessmentScore[],
  weightFraction: number,
): ComponentResult | null {
  if (scores.length === 0) return null;

  let totalEarned = 0;
  let totalPossible = 0;

  for (const item of scores) {
    totalPossible += item.maxScore;
    if (item.score !== null) {
      totalEarned += item.score;
    }
    // null scores are not added to earned (treated as 0 in provisional calc)
    // but completeness check is handled separately
  }

  const percentageScore = totalPossible > 0
    ? (totalEarned / totalPossible) * 100
    : 0;

  const weightedScore = roundHalfUp(percentageScore * weightFraction, 2);

  return { totalEarned, totalPossible, percentageScore, weightedScore };
}

/**
 * Calculates the Examinations component Percentage Score.
 *
 *   PS_EX = (PS_ST1 × st1W) + (PS_ST2 × st2W) + (PS_TE × teW)
 *
 * Returns null for any component if the corresponding exam score is missing.
 * DO 015, s. 2026 Para. 45 & Annex D Step 6.
 */
function calcExamScore(
  st1: ExamScore,
  st2: ExamScore,
  te:  ExamScore,
  examInternalWeights: { st1Weight: number; st2Weight: number; teWeight: number },
  exWeightFraction: number,
): ExamComponentResult {
  const ps_st1 = (st1.score !== null && st1.maxScore > 0)
    ? (st1.score / st1.maxScore) * 100
    : null;

  const ps_st2 = (st2.score !== null && st2.maxScore > 0)
    ? (st2.score / st2.maxScore) * 100
    : null;

  const ps_te = (te.score !== null && te.maxScore > 0)
    ? (te.score / te.maxScore) * 100
    : null;

  let examPercentageScore: number | null = null;
  let weightedScore: number | null = null;

  if (ps_st1 !== null && ps_st2 !== null && ps_te !== null) {
    examPercentageScore =
      (ps_st1 * examInternalWeights.st1Weight) +
      (ps_st2 * examInternalWeights.st2Weight) +
      (ps_te  * examInternalWeights.teWeight);

    weightedScore = roundHalfUp(examPercentageScore * exWeightFraction, 2);
  }

  return {
    st1PercentageScore:  ps_st1,
    st2PercentageScore:  ps_st2,
    tePercentageScore:   ps_te,
    examPercentageScore,
    weightedScore,
  };
}

// ─── Completeness Check ───────────────────────────────────────────────────────

/**
 * Identifies all missing assessment entries.
 * A missing entry has score === null (NOT a recorded zero).
 */
function findMissingAssessments(
  input: StudentTermScoreInput,
): MissingAssessmentRef[] {
  const missing: MissingAssessmentRef[] = [];

  for (const item of input.wwScores) {
    if (item.score === null) {
      missing.push({ type: 'WW', id: item.id, label: item.label });
    }
  }
  for (const item of input.ptScores) {
    if (item.score === null) {
      missing.push({ type: 'PT', id: item.id, label: item.label });
    }
  }
  if (input.st1.score === null) missing.push({ type: 'ST1' });
  if (input.st2.score === null) missing.push({ type: 'ST2' });
  if (input.te.score  === null) missing.push({ type: 'TE'  });

  return missing;
}

// ─── Main Calculation Function ────────────────────────────────────────────────

/**
 * Calculates a student's term grade for one subject and term.
 *
 * This is the primary public function of the calculation engine.
 *
 * INVARIANTS enforced:
 *   - Invalid inputs always produce a non-empty validationErrors array
 *     and null termGrade.
 *   - Incomplete inputs produce isComplete === false and null termGrade.
 *   - A missing score (null) is NEVER treated as a confirmed recorded zero.
 *   - Identical inputs always produce identical outputs (deterministic).
 *   - This function does NOT read from or write to the database.
 *   - Input objects are NOT mutated.
 *
 * @param input  — Raw score payload for one student/subject/term.
 * @param policy — Resolved grading policy (from getGradingPolicy).
 * @returns      — Full calculation result including diagnostic information.
 */
export function calculateStudentTermGrade(
  input: StudentTermScoreInput,
  policy: GradingPolicy,
): GradeCalculationResult {
  const validationErrors: string[] = [];

  // ── 1. Validate all input scores ────────────────────────────────────────────
  const dupWW = validateUniqueIds(input.wwScores, 'WW');
  if (dupWW) validationErrors.push(dupWW);

  const dupPT = validateUniqueIds(input.ptScores, 'PT');
  if (dupPT) validationErrors.push(dupPT);

  for (const item of input.wwScores) {
    const err = validateAssessmentScore(item, 'WW');
    if (err) validationErrors.push(err);
  }
  for (const item of input.ptScores) {
    const err = validateAssessmentScore(item, 'PT');
    if (err) validationErrors.push(err);
  }

  const st1Err = validateExamScore(input.st1, 'ST1');
  if (st1Err) validationErrors.push(st1Err);

  const st2Err = validateExamScore(input.st2, 'ST2');
  if (st2Err) validationErrors.push(st2Err);

  const teErr = validateExamScore(input.te, 'TE');
  if (teErr) validationErrors.push(teErr);

  // If validation errors exist, return immediately — no grade produced
  if (validationErrors.length > 0) {
    return {
      enrollmentId:       input.enrollmentId,
      policy,
      wwResult:           null,
      ptResult:           null,
      exResult: {
        st1PercentageScore:  null,
        st2PercentageScore:  null,
        tePercentageScore:   null,
        examPercentageScore: null,
        weightedScore:       null,
      },
      initialGrade:       null,
      termGrade:          null,
      isComplete:         false,
      missingAssessments: [],
      validationErrors,
    };
  }

  // ── 2. Check completeness ────────────────────────────────────────────────────
  const missingAssessments = findMissingAssessments(input);
  const isComplete = missingAssessments.length === 0;

  // ── 3. Calculate component scores ────────────────────────────────────────────
  // WW and PT are calculated even with missing scores for provisional display,
  // but the provisional component result uses only recorded entries.
  // The completeness flag governs official grade eligibility.
  const wwResult = input.wwScores.length > 0
    ? calcComponentScore(input.wwScores, policy.weights.wwWeight)
    : null;

  const ptResult = input.ptScores.length > 0
    ? calcComponentScore(input.ptScores, policy.weights.ptWeight)
    : null;

  const exResult = calcExamScore(
    input.st1,
    input.st2,
    input.te,
    policy.examWeights,
    policy.weights.exWeight,
  );

  // ── 4. Compute Initial Grade ─────────────────────────────────────────────────
  // Only when all components are available AND complete
  let initialGrade: number | null = null;
  let termGrade:    number | null = null;

  if (
    isComplete &&
    wwResult !== null &&
    ptResult !== null &&
    exResult.weightedScore !== null
  ) {
    const rawIG = wwResult.weightedScore + ptResult.weightedScore + exResult.weightedScore;
    initialGrade = roundHalfUp(rawIG, 2);

    // ── 5. Transmute to Term Grade ─────────────────────────────────────────────
    termGrade = applyTransmutation(initialGrade, policy.policyVersion);
  }

  return {
    enrollmentId:       input.enrollmentId,
    policy,
    wwResult,
    ptResult,
    exResult,
    initialGrade,
    termGrade,
    isComplete,
    missingAssessments,
    validationErrors: [],
  };
}
