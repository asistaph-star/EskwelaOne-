/**
 * DIGISKWELA — DepEd 2026 Grading Calculation Engine
 * Module: policyRegistry.ts
 *
 * Explicit, versioned registry of grading policies as mandated by DepEd.
 *
 * THIS FILE MUST NOT import Prisma, database config, Express, or any
 * persistence layer. All policy data is static and fully type-checked.
 *
 * Policy Sources:
 *   DO No. 015, s. 2026 — Table 9 & Annex D Table 1 (assessment weights)
 *   DO No. 015, s. 2026 — Para. 45 & Annex D Step 6 (EX internal weights)
 *   DO No. 015, s. 2026 — Para. 50 (zero-based grading from SY 2027–2028)
 *
 * ENGINEERING NOTES:
 *   - Only policies with a verified primary-source reference are included.
 *   - Unknown school-year / subject-group combinations throw explicitly.
 *   - Never silently fall back to a default weight profile.
 *   - Do NOT add speculative profiles for grade levels not yet supported.
 */

import type {
  GradingPolicy,
  GradingPolicyVersion,
  SubjectGroup,
  PolicySelectionParams,
} from './types.js';

// ─── Standard Examination Internal Weights (DO 015 Para. 45) ─────────────────
// ST1: 30 % of EXs, ST2: 30 % of EXs, TE: 40 % of EXs.
// Same for all subjects where EXs apply (CORE and TECHNICAL).
const STANDARD_EXAM_WEIGHTS = {
  st1Weight: 0.30,
  st2Weight: 0.30,
  teWeight:  0.40,
} as const;

// ─── Component Weight Profiles ────────────────────────────────────────────────

/**
 * CORE subjects (Languages, Mathematics, Science, AP, GMRC/VE / Values Education)
 * Grades 4–10 numerical grading.
 * DO 015, s. 2026 Table 9 & Annex D Table 1.
 * WWs: 20 %, PTs: 50 %, EXs: 30 %.
 */
const CORE_WEIGHTS = {
  wwWeight: 0.20,
  ptWeight: 0.50,
  exWeight: 0.30,
} as const;

/**
 * TECHNICAL subjects (EPP/TLE, MAPEH)
 * Grades 4–10 numerical grading.
 * DO 015, s. 2026 Table 9 & Annex D Table 1.
 * WWs: 20 %, PTs: 60 %, EXs: 20 %.
 */
const TECHNICAL_WEIGHTS = {
  wwWeight: 0.20,
  ptWeight: 0.60,
  exWeight: 0.20,
} as const;

// ─── Supported School Year Keys ───────────────────────────────────────────────

/**
 * Normalises various school-year string formats to a canonical policy version.
 * Acceptable formats: 'SY 2026-2027', '2026-2027', 'SY 2026–2027' (en-dash).
 */
function normalisePolicyYear(schoolYear: string): GradingPolicyVersion {
  // Strip common prefixes and whitespace, normalise dash variants
  const cleaned = schoolYear.trim()
    .replace(/^SY\s*/i, '')
    .replace(/[–—]/g, '-'); // normalise en-dash / em-dash

  if (cleaned === '2026-2027') return 'SY_2026_2027';
  if (/^20(27|2[89]|[3-9]\d)-/.test(cleaned)) return 'SY_2027_2028_PLUS';

  throw new GradingPolicyError(
    `Unsupported or unrecognised school year: "${schoolYear}". ` +
    `Supported: "SY 2026-2027" (adjusted transmutation), "SY 2027-2028" or later (zero-based).`,
    'UNSUPPORTED_SCHOOL_YEAR'
  );
}

// ─── Policy Registry Error ────────────────────────────────────────────────────

export type GradingPolicyErrorCode =
  | 'UNSUPPORTED_SCHOOL_YEAR'
  | 'DESCRIPTIVE_GRADING_NOT_SUPPORTED_IN_NUMERICAL_ENGINE'
  | 'NUMERICAL_GRADING_PROFILE_NOT_IMPLEMENTED_FOR_THIS_GRADE_AND_POLICY_YEAR'
  | 'SHS_PROFILES_NOT_IMPLEMENTED'
  | 'UNSUPPORTED_GRADE_LEVEL'
  | 'INVALID_SUBJECT_GROUP';

export class GradingPolicyError extends Error {
  public readonly code: GradingPolicyErrorCode;

  constructor(message: string, code: GradingPolicyErrorCode = 'UNSUPPORTED_GRADE_LEVEL') {
    super(message);
    this.name = 'GradingPolicyError';
    this.code = code;
  }
}

// ─── Supported Grade Levels ───────────────────────────────────────────────────

/**
 * Phase 1 supports the explicitly tested scope: Grades 4–10 numerical grading.
 * Under DepEd Order No. 015, s. 2026:
 *   - Kindergarten & Grade 1 adopt descriptive grading (Section VI.A).
 *   - Grades 2 & 3 continue numerical grading during the phased transition,
 *     but are not implemented in Phase 1.
 *   - Senior High School (Grades 11–12) has specialized track weighting profiles
 *     excluded from Phase 1.
 */
const SUPPORTED_NUMERICAL_GRADE_LEVELS = new Set([4, 5, 6, 7, 8, 9, 10]);

// ─── Public Policy Lookup ─────────────────────────────────────────────────────

/**
 * Returns the verified grading policy for the given parameters.
 *
 * @throws GradingPolicyError for unsupported school years, grade levels,
 *         or subject groups.
 */
export function getGradingPolicy(params: PolicySelectionParams): GradingPolicy {
  const { schoolYear, gradeLevel, subjectGroup } = params;

  // 1. Resolve policy version from school year
  const policyVersion = normalisePolicyYear(schoolYear);

  // 2. Validate grade level with phased policy distinction
  if (gradeLevel <= 1) {
    throw new GradingPolicyError(
      `Grade level ${gradeLevel} (Kindergarten / Grade 1) adopts descriptive grading under DepEd Order No. 015, s. 2026 Section VI.A. ` +
      `Descriptive grading does not use numerical calculation and is not supported by this engine.`,
      'DESCRIPTIVE_GRADING_NOT_SUPPORTED_IN_NUMERICAL_ENGINE'
    );
  }

  if (gradeLevel === 2 || gradeLevel === 3) {
    throw new GradingPolicyError(
      `NUMERICAL_GRADING_PROFILE_NOT_IMPLEMENTED_FOR_THIS_GRADE_AND_POLICY_YEAR: ` +
      `Grade level ${gradeLevel} continues numerical grading during the DepEd Order No. 015, s. 2026 phased transition, ` +
      `but its specific assessment weighting profile is not implemented in Phase 1 (scoped to Grades 4–10).`,
      'NUMERICAL_GRADING_PROFILE_NOT_IMPLEMENTED_FOR_THIS_GRADE_AND_POLICY_YEAR'
    );
  }

  if (gradeLevel >= 11) {
    throw new GradingPolicyError(
      `Senior High School (Grade ${gradeLevel}) specialized track weighting profiles are not implemented in Phase 1.`,
      'SHS_PROFILES_NOT_IMPLEMENTED'
    );
  }

  if (!SUPPORTED_NUMERICAL_GRADE_LEVELS.has(gradeLevel)) {
    throw new GradingPolicyError(
      `Grade level ${gradeLevel} is outside the supported range (Grades 4–10 numerical grading).`,
      'UNSUPPORTED_GRADE_LEVEL'
    );
  }

  // 3. Select weight profile based on subject group
  const weights = subjectGroup === 'TECHNICAL' ? TECHNICAL_WEIGHTS : CORE_WEIGHTS;

  // 4. Validate subject group
  if (subjectGroup !== 'CORE' && subjectGroup !== 'TECHNICAL') {
    throw new GradingPolicyError(
      `Unknown subject group: "${subjectGroup as string}". Valid groups: "CORE", "TECHNICAL".`,
      'INVALID_SUBJECT_GROUP'
    );
  }

  // 5. Compose policy
  const description = buildPolicyDescription(policyVersion, gradeLevel, subjectGroup);

  return {
    policyVersion,
    subjectGroup,
    schoolYear: schoolYear.trim(),
    gradeLevel,
    weights: { ...weights },
    examWeights: { ...STANDARD_EXAM_WEIGHTS },
    description,
  };
}

function buildPolicyDescription(
  version: GradingPolicyVersion,
  gradeLevel: number,
  subjectGroup: SubjectGroup,
): string {
  const groupLabel = subjectGroup === 'CORE'
    ? 'Core (Languages/Math/Science/AP/VE) — WW 20%, PT 50%, EX 30%'
    : 'Technical (TLE/MAPEH) — WW 20%, PT 60%, EX 20%';

  const policyLabel = version === 'SY_2026_2027'
    ? 'SY 2026–2027 Adjusted Transmutation (DO 015, s. 2026 Annex D Table 4)'
    : 'SY 2027–2028+ Zero-Based Grading (DO 015, s. 2026 Para. 50)';

  return `Grade ${gradeLevel} | ${groupLabel} | ${policyLabel}`;
}
