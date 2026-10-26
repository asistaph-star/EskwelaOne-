/**
 * DIGISKWELA — DepEd 2026 Grading Calculation Engine
 * Module: index.ts
 *
 * Public API surface for the isolated grading calculation engine.
 *
 * Consumers import from this barrel file. Direct imports from
 * sub-modules (types.ts, transmutation.ts, etc.) are also permitted
 * when more specific access is needed.
 *
 * IMPORTANT: Nothing exported here touches the database.
 * Official grade publication (Phase 4) will import from here and
 * add persistence coordination separately.
 */

export type {
  GradingPolicyVersion,
  SubjectGroup,
  ComponentWeights,
  ExamInternalWeights,
  AssessmentScore,
  ExamScore,
  StudentTermScoreInput,
  GradingPolicy,
  ComponentResult,
  ExamComponentResult,
  MissingAssessmentRef,
  GradeCalculationResult,
  PolicySelectionParams,
} from './types.js';

export { getGradingPolicy, GradingPolicyError, type GradingPolicyErrorCode } from './policyRegistry.js';
export {
  roundHalfUp,
  transmute2026,
  zeroBasedGrade,
  applyTransmutation,
  TransmutationError,
  ADJUSTED_PASSING_IG_THRESHOLD,
  ADJUSTED_TABLE_2026,
} from './transmutation.js';
export { calculateStudentTermGrade } from './calculationEngine.js';
