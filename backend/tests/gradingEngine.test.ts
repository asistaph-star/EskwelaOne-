/**
 * DIGISKWELA — DepEd 2026 Grading Calculation Engine Acceptance Test Suite
 *
 * Verifies all requirements specified in:
 *   - DepEd Order No. 015, s. 2026
 *   - Calculation Contract & Acceptance-Test Specification (CALC-01 to CALC-09)
 *   - Phase 1 Final Integrity Verification & Precision Verification Gates
 *
 * All tests run against the isolated grading calculation engine.
 * Zero database persistence is performed by the engine.
 */

import { describe, it, expect } from 'vitest';
import {
  calculateStudentTermGrade,
  getGradingPolicy,
  GradingPolicyError,
  transmute2026,
  zeroBasedGrade,
  applyTransmutation,
  TransmutationError,
  roundHalfUp,
  ADJUSTED_PASSING_IG_THRESHOLD,
  ADJUSTED_TABLE_2026,
  type StudentTermScoreInput,
  type GradingPolicy,
} from '../src/academic/grading/index.js';

describe('DepEd 2026 Grading Engine Acceptance Suite', () => {

  // ─── Fixtures ─────────────────────────────────────────────────────────────

  const corePolicy2026 = getGradingPolicy({
    schoolYear: 'SY 2026-2027',
    gradeLevel: 7,
    subjectGroup: 'CORE',
  });

  const technicalPolicy2026 = getGradingPolicy({
    schoolYear: 'SY 2026-2027',
    gradeLevel: 7,
    subjectGroup: 'TECHNICAL',
  });

  const corePolicy2027 = getGradingPolicy({
    schoolYear: 'SY 2027-2028',
    gradeLevel: 7,
    subjectGroup: 'CORE',
  });

  // ─── CALC-01: Verified Core Profile Reference Calculation ─────────────────

  describe('CALC-01: Verified Core Profile Reference Calculation', () => {
    it('calculates the exact verified benchmark from DepEd Order 015 s. 2026', () => {
      // Benchmark input from calculation contract:
      // WW: 85/100, PT: 90/100, ST1: 25/30, ST2: 25/30, TE: 45/50
      const input: StudentTermScoreInput = {
        enrollmentId: 'student-calc-01',
        wwScores: [{ id: 'ww-1', label: 'Written Work Total', score: 85, maxScore: 100 }],
        ptScores: [{ id: 'pt-1', label: 'Performance Task Total', score: 90, maxScore: 100 }],
        st1: { score: 25, maxScore: 30 },
        st2: { score: 25, maxScore: 30 },
        te:  { score: 45, maxScore: 50 },
      };

      const result = calculateStudentTermGrade(input, corePolicy2026);

      // Validation
      expect(result.validationErrors).toEqual([]);
      expect(result.isComplete).toBe(true);
      expect(result.missingAssessments).toEqual([]);

      // Component Percentage Scores
      expect(result.wwResult).not.toBeNull();
      expect(result.wwResult!.percentageScore).toBe(85.00);
      expect(result.wwResult!.weightedScore).toBe(17.00); // 85 * 0.20

      expect(result.ptResult).not.toBeNull();
      expect(result.ptResult!.percentageScore).toBe(90.00);
      expect(result.ptResult!.weightedScore).toBe(45.00); // 90 * 0.50

      // Exam Component breakdown:
      // ST1: 25/30 = 83.3333...%
      // ST2: 25/30 = 83.3333...%
      // TE:  45/50 = 90.00%
      // PS_EX = (83.3333... * 0.30) + (83.3333... * 0.30) + (90 * 0.40)
      //       = 25 + 25 + 36 = 86.00
      // WS_EX = 86.00 * 0.30 = 25.80
      expect(result.exResult.st1PercentageScore).toBeCloseTo(83.3333, 4);
      expect(result.exResult.st2PercentageScore).toBeCloseTo(83.3333, 4);
      expect(result.exResult.tePercentageScore).toBe(90.00);
      expect(result.exResult.examPercentageScore).toBeCloseTo(86.00, 4);
      expect(result.exResult.weightedScore).toBe(25.80);

      // Initial Grade: 17.00 + 45.00 + 25.80 = 87.80
      expect(result.initialGrade).toBe(87.80);

      // Transmutation: 87.80 falls into [87.70, 88.87] -> Term Grade 90
      expect(result.termGrade).toBe(90);
    });

    it('aggregates multiple WW and PT items by total earned / total possible points', () => {
      // DepEd Annex D Steps 1–2: PS = (Total Earned / Total Possible) * 100
      // Verifies that total points formula is used, NOT average of percentages.
      const input: StudentTermScoreInput = {
        enrollmentId: 'student-multi-item',
        wwScores: [
          { id: 'ww-1', label: 'Quiz 1', score: 10, maxScore: 10 },  // 100%
          { id: 'ww-2', label: 'Quiz 2', score: 30, maxScore: 90 },  // 33.33%
          // Total: 40 / 100 = 40.00%
          // (Average of percentages would be (100 + 33.33) / 2 = 66.67%, which would be WRONG)
        ],
        ptScores: [
          { id: 'pt-1', label: 'Task 1', score: 50, maxScore: 50 },
          { id: 'pt-2', label: 'Task 2', score: 50, maxScore: 50 },
        ],
        st1: { score: 30, maxScore: 30 },
        st2: { score: 30, maxScore: 30 },
        te:  { score: 50, maxScore: 50 },
      };

      const result = calculateStudentTermGrade(input, corePolicy2026);

      expect(result.wwResult!.totalEarned).toBe(40);
      expect(result.wwResult!.totalPossible).toBe(100);
      expect(result.wwResult!.percentageScore).toBe(40.00);
      expect(result.wwResult!.weightedScore).toBe(8.00); // 40 * 0.20
    });
  });

  // ─── CALC-02: Missing Assessment Safety (Incomplete Assessments) ──────────

  describe('CALC-02: Missing Assessment Safety', () => {
    it('marks result incomplete and returns null termGrade when WW item score is null', () => {
      const input: StudentTermScoreInput = {
        enrollmentId: 'student-missing-ww',
        wwScores: [
          { id: 'ww-1', label: 'Quiz 1', score: 20, maxScore: 25 },
          { id: 'ww-2', label: 'Quiz 2', score: null, maxScore: 25 }, // MISSING
        ],
        ptScores: [{ id: 'pt-1', label: 'PT 1', score: 90, maxScore: 100 }],
        st1: { score: 25, maxScore: 30 },
        st2: { score: 25, maxScore: 30 },
        te:  { score: 45, maxScore: 50 },
      };

      const result = calculateStudentTermGrade(input, corePolicy2026);

      expect(result.isComplete).toBe(false);
      expect(result.termGrade).toBeNull();
      expect(result.initialGrade).toBeNull();
      expect(result.missingAssessments).toEqual([
        { type: 'WW', id: 'ww-2', label: 'Quiz 2' },
      ]);
      expect(result.validationErrors).toEqual([]);
    });

    it('marks result incomplete when an examination score (TE) is null', () => {
      const input: StudentTermScoreInput = {
        enrollmentId: 'student-missing-te',
        wwScores: [{ id: 'ww-1', label: 'WW', score: 85, maxScore: 100 }],
        ptScores: [{ id: 'pt-1', label: 'PT', score: 90, maxScore: 100 }],
        st1: { score: 25, maxScore: 30 },
        st2: { score: 25, maxScore: 30 },
        te:  { score: null, maxScore: 50 }, // MISSING
      };

      const result = calculateStudentTermGrade(input, corePolicy2026);

      expect(result.isComplete).toBe(false);
      expect(result.termGrade).toBeNull();
      expect(result.initialGrade).toBeNull();
      expect(result.exResult.tePercentageScore).toBeNull();
      expect(result.exResult.examPercentageScore).toBeNull();
      expect(result.exResult.weightedScore).toBeNull();
      expect(result.missingAssessments).toEqual([{ type: 'TE' }]);
    });

    it('reports all missing items when multiple components are unrecorded', () => {
      const input: StudentTermScoreInput = {
        enrollmentId: 'student-multiple-missing',
        wwScores: [{ id: 'ww-1', label: 'WW 1', score: null, maxScore: 50 }],
        ptScores: [{ id: 'pt-1', label: 'PT 1', score: null, maxScore: 50 }],
        st1: { score: null, maxScore: 30 },
        st2: { score: 25, maxScore: 30 },
        te:  { score: null, maxScore: 50 },
      };

      const result = calculateStudentTermGrade(input, corePolicy2026);

      expect(result.isComplete).toBe(false);
      expect(result.termGrade).toBeNull();
      expect(result.missingAssessments).toHaveLength(4);
      expect(result.missingAssessments.map(m => m.type)).toEqual(['WW', 'PT', 'ST1', 'TE']);
    });
  });

  // ─── CALC-03: Confirmed Recorded Zero (score === 0) ────────────────────────

  describe('CALC-03: Confirmed Recorded Zero', () => {
    it('distinguishes a recorded zero (score === 0) from missing (null)', () => {
      const inputWithRecordedZero: StudentTermScoreInput = {
        enrollmentId: 'student-recorded-zero',
        wwScores: [{ id: 'ww-1', label: 'WW', score: 0, maxScore: 100 }], // EARNED ZERO
        ptScores: [{ id: 'pt-1', label: 'PT', score: 90, maxScore: 100 }],
        st1: { score: 25, maxScore: 30 },
        st2: { score: 25, maxScore: 30 },
        te:  { score: 45, maxScore: 50 },
      };

      const result = calculateStudentTermGrade(inputWithRecordedZero, corePolicy2026);

      // Recorded zero must NOT be marked missing
      expect(result.isComplete).toBe(true);
      expect(result.missingAssessments).toEqual([]);
      expect(result.validationErrors).toEqual([]);

      // WW earns 0 points
      expect(result.wwResult!.totalEarned).toBe(0);
      expect(result.wwResult!.percentageScore).toBe(0);
      expect(result.wwResult!.weightedScore).toBe(0);

      // PT: 90 * 0.50 = 45.00
      // EX: 86.00 * 0.30 = 25.80
      // IG: 0 + 45.00 + 25.80 = 70.80
      expect(result.initialGrade).toBe(70.80);

      // Transmutation: 70.80 falls into [70.00, 71.17] -> Term Grade 75
      expect(result.termGrade).toBe(75);
    });

    it('calculates properly when all assessments are confirmed recorded zeros', () => {
      const inputAllZeros: StudentTermScoreInput = {
        enrollmentId: 'student-all-zeros',
        wwScores: [{ id: 'ww-1', label: 'WW', score: 0, maxScore: 100 }],
        ptScores: [{ id: 'pt-1', label: 'PT', score: 0, maxScore: 100 }],
        st1: { score: 0, maxScore: 30 },
        st2: { score: 0, maxScore: 30 },
        te:  { score: 0, maxScore: 50 },
      };

      const result = calculateStudentTermGrade(inputAllZeros, corePolicy2026);

      expect(result.isComplete).toBe(true);
      expect(result.initialGrade).toBe(0.00);
      // Floor of Table 4: [0.00, 4.67] -> TG 60
      expect(result.termGrade).toBe(60);
    });
  });

  // ─── CALC-04: Transmutation Table Boundary Exactness ──────────────────────

  describe('CALC-04: Transmutation Table Boundary Exactness', () => {
    it('verifies all 41 intervals of the official DepEd 2026 adjusted table', () => {
      expect(ADJUSTED_TABLE_2026).toHaveLength(41);

      for (let i = 0; i < ADJUSTED_TABLE_2026.length; i++) {
        const [lo, hi, tg] = ADJUSTED_TABLE_2026[i];

        // Lower bound lookup
        expect(transmute2026(lo)).toBe(tg);
        // Upper bound lookup
        expect(transmute2026(hi)).toBe(tg);
        // Midpoint lookup
        const mid = roundHalfUp((lo + hi) / 2, 2);
        expect(transmute2026(mid)).toBe(tg);

        // Continuity check between adjacent intervals
        if (i < ADJUSTED_TABLE_2026.length - 1) {
          const [, nextHi] = ADJUSTED_TABLE_2026[i + 1];
          expect(roundHalfUp(lo - nextHi, 2)).toBe(0.01);
        }
      }
    });

    it('verifies critical specific boundary steps from the contract', () => {
      expect(transmute2026(69.99)).toBe(74);
      expect(transmute2026(70.00)).toBe(75);
      expect(transmute2026(71.17)).toBe(75);
      expect(transmute2026(71.18)).toBe(76);
      expect(transmute2026(87.69)).toBe(89);
      expect(transmute2026(87.70)).toBe(90);
      expect(transmute2026(88.87)).toBe(90);
      expect(transmute2026(88.88)).toBe(91);
      expect(transmute2026(99.49)).toBe(99);
      expect(transmute2026(99.50)).toBe(100);
      expect(transmute2026(100.00)).toBe(100);
    });

    it('rejects out-of-range initial grades with TransmutationError', () => {
      expect(() => transmute2026(-0.01)).toThrow(TransmutationError);
      expect(() => transmute2026(100.01)).toThrow(TransmutationError);
      expect(() => transmute2026(NaN)).toThrow(TransmutationError);
      expect(() => transmute2026(Infinity)).toThrow(TransmutationError);
    });
  });

  // ─── CALC-05: Non-Passing Floor Rule (TG 60 floor) ─────────────────────────

  describe('CALC-05: Non-Passing Floor Rule (TG 60 floor)', () => {
    it('guarantees no student receives a term grade below 60 under SY 2026–2027', () => {
      const testCases = [0.00, 0.50, 1.00, 2.34, 3.89, 4.66, 4.67];
      for (const ig of testCases) {
        expect(transmute2026(ig)).toBe(60);
      }
    });
  });

  // ─── CALC-06: Technical Subject Weight Profile ─────────────────────────────

  describe('CALC-06: Technical Subject Weight Profile', () => {
    it('applies WW 20%, PT 60%, EX 20% for TECHNICAL subjects (TLE/MAPEH)', () => {
      // In Technical: PT has 60% weight, EX has 20% weight (vs 50% and 30% in Core)
      const input: StudentTermScoreInput = {
        enrollmentId: 'student-technical',
        wwScores: [{ id: 'ww-1', label: 'WW Total', score: 80, maxScore: 100 }],
        ptScores: [{ id: 'pt-1', label: 'PT Total', score: 90, maxScore: 100 }],
        st1: { score: 30, maxScore: 30 }, // 100%
        st2: { score: 30, maxScore: 30 }, // 100%
        te:  { score: 50, maxScore: 50 }, // 100%
      };

      const techResult = calculateStudentTermGrade(input, technicalPolicy2026);

      // WW: 80 * 0.20 = 16.00
      expect(techResult.wwResult!.weightedScore).toBe(16.00);
      // PT: 90 * 0.60 = 54.00
      expect(techResult.ptResult!.weightedScore).toBe(54.00);
      // EX: 100 * 0.20 = 20.00
      expect(techResult.exResult.weightedScore).toBe(20.00);

      // IG = 16.00 + 54.00 + 20.00 = 90.00
      expect(techResult.initialGrade).toBe(90.00);

      // Transmutation: 90.00 falls in [88.88, 90.05] -> 91
      expect(techResult.termGrade).toBe(91);

      // Compare with CORE for same scores:
      const coreResult = calculateStudentTermGrade(input, corePolicy2026);
      // Core: WW 16.00, PT 45.00 (90*0.50), EX 30.00 (100*0.30) -> IG = 91.00
      expect(coreResult.initialGrade).toBe(91.00);
      // Core IG 91.00 falls in [90.06, 91.23] -> 92
      expect(coreResult.termGrade).toBe(92);

      // Confirm technical weights differ from core weights
      expect(techResult.initialGrade).not.toBe(coreResult.initialGrade);
      expect(techResult.termGrade).not.toBe(coreResult.termGrade);
    });
  });

  // ─── CALC-07: Future Policy Version (SY 2027–2028+ Zero-Based) ─────────────

  describe('CALC-07: Future Policy Version (SY 2027–2028+ Zero-Based)', () => {
    it('applies zero-based grading (TG = round(IG)) for SY 2027–2028', () => {
      const input: StudentTermScoreInput = {
        enrollmentId: 'student-2027',
        wwScores: [{ id: 'ww-1', score: 85, maxScore: 100 }],
        ptScores: [{ id: 'pt-1', score: 90, maxScore: 100 }],
        st1: { score: 25, maxScore: 30 },
        st2: { score: 25, maxScore: 30 },
        te:  { score: 45, maxScore: 50 },
      };

      const result = calculateStudentTermGrade(input, corePolicy2027);

      expect(result.policy.policyVersion).toBe('SY_2027_2028_PLUS');
      expect(result.initialGrade).toBe(87.80);
      // Zero-based: round(87.80) = 88 (NOT transmuted 90!)
      expect(result.termGrade).toBe(88);
    });

    it('verifies zeroBasedGrade boundary values and passing threshold', () => {
      // 74.50 rounds to 75 (Passing)
      expect(zeroBasedGrade(74.50)).toBe(75);
      // 74.49 rounds to 74 (Failing)
      expect(zeroBasedGrade(74.49)).toBe(74);

      // Floor rule (engineering convention: minimum reportable is 60)
      expect(zeroBasedGrade(50.00)).toBe(60);
      expect(zeroBasedGrade(0.00)).toBe(60);

      // High scores
      expect(zeroBasedGrade(99.60)).toBe(100);
      expect(zeroBasedGrade(100.00)).toBe(100);
    });

    it('dispatches to zero-based grading via applyTransmutation', () => {
      expect(applyTransmutation(87.80, 'SY_2026_2027')).toBe(90);
      expect(applyTransmutation(87.80, 'SY_2027_2028_PLUS')).toBe(88);
    });
  });

  // ─── CALC-08: Input Validation & Fail-Closed Behavior ──────────────────────

  describe('CALC-08: Input Validation & Fail-Closed Behavior', () => {
    it('fails closed when score is negative', () => {
      const input: StudentTermScoreInput = {
        enrollmentId: 'student-negative',
        wwScores: [{ id: 'ww-1', score: -5, maxScore: 100 }],
        ptScores: [{ id: 'pt-1', score: 90, maxScore: 100 }],
        st1: { score: 25, maxScore: 30 },
        st2: { score: 25, maxScore: 30 },
        te:  { score: 45, maxScore: 50 },
      };

      const result = calculateStudentTermGrade(input, corePolicy2026);
      expect(result.validationErrors.length).toBeGreaterThan(0);
      expect(result.validationErrors[0]).toContain('cannot be negative');
      expect(result.termGrade).toBeNull();
      expect(result.initialGrade).toBeNull();
    });

    it('fails closed when score exceeds maxScore', () => {
      const input: StudentTermScoreInput = {
        enrollmentId: 'student-exceeds',
        wwScores: [{ id: 'ww-1', score: 105, maxScore: 100 }],
        ptScores: [{ id: 'pt-1', score: 90, maxScore: 100 }],
        st1: { score: 25, maxScore: 30 },
        st2: { score: 25, maxScore: 30 },
        te:  { score: 45, maxScore: 50 },
      };

      const result = calculateStudentTermGrade(input, corePolicy2026);
      expect(result.validationErrors.length).toBeGreaterThan(0);
      expect(result.validationErrors[0]).toContain('exceeds maxScore');
      expect(result.termGrade).toBeNull();
    });

    it('fails closed when maxScore is zero or negative', () => {
      const input: StudentTermScoreInput = {
        enrollmentId: 'student-invalid-max',
        wwScores: [{ id: 'ww-1', score: 0, maxScore: 0 }],
        ptScores: [{ id: 'pt-1', score: 90, maxScore: 100 }],
        st1: { score: 25, maxScore: 30 },
        st2: { score: 25, maxScore: 30 },
        te:  { score: 45, maxScore: 50 },
      };

      const result = calculateStudentTermGrade(input, corePolicy2026);
      expect(result.validationErrors.length).toBeGreaterThan(0);
      expect(result.validationErrors[0]).toContain('maxScore must be a positive finite number');
      expect(result.termGrade).toBeNull();
    });

    it('fails closed when score is non-finite (NaN)', () => {
      const input: StudentTermScoreInput = {
        enrollmentId: 'student-nan',
        wwScores: [{ id: 'ww-1', score: NaN, maxScore: 100 }],
        ptScores: [{ id: 'pt-1', score: 90, maxScore: 100 }],
        st1: { score: 25, maxScore: 30 },
        st2: { score: 25, maxScore: 30 },
        te:  { score: 45, maxScore: 50 },
      };

      const result = calculateStudentTermGrade(input, corePolicy2026);
      expect(result.validationErrors.length).toBeGreaterThan(0);
      expect(result.termGrade).toBeNull();
    });

    it('fails closed when duplicate assessment IDs exist in a component', () => {
      const input: StudentTermScoreInput = {
        enrollmentId: 'student-dup-ids',
        wwScores: [
          { id: 'ww-duplicate', score: 20, maxScore: 50 },
          { id: 'ww-duplicate', score: 25, maxScore: 50 },
        ],
        ptScores: [{ id: 'pt-1', score: 90, maxScore: 100 }],
        st1: { score: 25, maxScore: 30 },
        st2: { score: 25, maxScore: 30 },
        te:  { score: 45, maxScore: 50 },
      };

      const result = calculateStudentTermGrade(input, corePolicy2026);
      expect(result.validationErrors.length).toBeGreaterThan(0);
      expect(result.validationErrors[0]).toContain('duplicate assessment ID "ww-duplicate"');
      expect(result.termGrade).toBeNull();
    });
  });

  // ─── CALC-09: Policy Registry Validation & Scope Clarification ────────────

  describe('CALC-09: Policy Registry Validation & Phased Transition Scope', () => {
    it('normalises various school year string formats', () => {
      const p1 = getGradingPolicy({ schoolYear: 'SY 2026-2027', gradeLevel: 7, subjectGroup: 'CORE' });
      const p2 = getGradingPolicy({ schoolYear: '2026-2027', gradeLevel: 7, subjectGroup: 'CORE' });
      const p3 = getGradingPolicy({ schoolYear: 'SY 2026–2027', gradeLevel: 7, subjectGroup: 'CORE' });

      expect(p1.policyVersion).toBe('SY_2026_2027');
      expect(p2.policyVersion).toBe('SY_2026_2027');
      expect(p3.policyVersion).toBe('SY_2026_2027');
    });

    it('resolves future policy version SY_2027_2028_PLUS for 2027 and beyond', () => {
      const p2027 = getGradingPolicy({ schoolYear: 'SY 2027-2028', gradeLevel: 8, subjectGroup: 'CORE' });
      const p2028 = getGradingPolicy({ schoolYear: 'SY 2028-2029', gradeLevel: 8, subjectGroup: 'CORE' });

      expect(p2027.policyVersion).toBe('SY_2027_2028_PLUS');
      expect(p2028.policyVersion).toBe('SY_2027_2028_PLUS');
    });

    it('rejects unsupported school years with GradingPolicyError and code UNSUPPORTED_SCHOOL_YEAR', () => {
      expect(() =>
        getGradingPolicy({ schoolYear: 'SY 2024-2025', gradeLevel: 7, subjectGroup: 'CORE' })
      ).toThrowError(expect.objectContaining({ code: 'UNSUPPORTED_SCHOOL_YEAR' }));

      expect(() =>
        getGradingPolicy({ schoolYear: 'random-string', gradeLevel: 7, subjectGroup: 'CORE' })
      ).toThrowError(expect.objectContaining({ code: 'UNSUPPORTED_SCHOOL_YEAR' }));
    });

    it('accurately classifies Kindergarten & Grade 1 as descriptive grading (DESCRIPTIVE_GRADING_NOT_SUPPORTED_IN_NUMERICAL_ENGINE)', () => {
      expect(() =>
        getGradingPolicy({ schoolYear: 'SY 2026-2027', gradeLevel: 0, subjectGroup: 'CORE' })
      ).toThrowError(expect.objectContaining({
        code: 'DESCRIPTIVE_GRADING_NOT_SUPPORTED_IN_NUMERICAL_ENGINE',
      }));

      expect(() =>
        getGradingPolicy({ schoolYear: 'SY 2026-2027', gradeLevel: 1, subjectGroup: 'CORE' })
      ).toThrowError(expect.objectContaining({
        code: 'DESCRIPTIVE_GRADING_NOT_SUPPORTED_IN_NUMERICAL_ENGINE',
      }));
    });

    it('accurately classifies Grades 2 & 3 as phased transition numerical (NUMERICAL_GRADING_PROFILE_NOT_IMPLEMENTED_FOR_THIS_GRADE_AND_POLICY_YEAR)', () => {
      try {
        getGradingPolicy({ schoolYear: 'SY 2026-2027', gradeLevel: 2, subjectGroup: 'CORE' });
        expect.unreachable('Should have thrown for Grade 2');
      } catch (err: any) {
        expect(err).toBeInstanceOf(GradingPolicyError);
        expect(err.code).toBe('NUMERICAL_GRADING_PROFILE_NOT_IMPLEMENTED_FOR_THIS_GRADE_AND_POLICY_YEAR');
        expect(err.message).toContain('NUMERICAL_GRADING_PROFILE_NOT_IMPLEMENTED_FOR_THIS_GRADE_AND_POLICY_YEAR');
        expect(err.message).toContain('continues numerical grading during the DepEd Order No. 015, s. 2026 phased transition');
      }

      try {
        getGradingPolicy({ schoolYear: 'SY 2026-2027', gradeLevel: 3, subjectGroup: 'CORE' });
        expect.unreachable('Should have thrown for Grade 3');
      } catch (err: any) {
        expect(err).toBeInstanceOf(GradingPolicyError);
        expect(err.code).toBe('NUMERICAL_GRADING_PROFILE_NOT_IMPLEMENTED_FOR_THIS_GRADE_AND_POLICY_YEAR');
      }
    });

    it('accurately classifies SHS Grades 11 & 12 as specialized track profiles not implemented (SHS_PROFILES_NOT_IMPLEMENTED)', () => {
      expect(() =>
        getGradingPolicy({ schoolYear: 'SY 2026-2027', gradeLevel: 11, subjectGroup: 'CORE' })
      ).toThrowError(expect.objectContaining({
        code: 'SHS_PROFILES_NOT_IMPLEMENTED',
      }));

      expect(() =>
        getGradingPolicy({ schoolYear: 'SY 2026-2027', gradeLevel: 12, subjectGroup: 'CORE' })
      ).toThrowError(expect.objectContaining({
        code: 'SHS_PROFILES_NOT_IMPLEMENTED',
      }));
    });

    it('supports all numerical grading grade levels (4 through 10)', () => {
      for (const gradeLevel of [4, 5, 6, 7, 8, 9, 10]) {
        const policy = getGradingPolicy({
          schoolYear: 'SY 2026-2027',
          gradeLevel,
          subjectGroup: 'CORE',
        });
        expect(policy.gradeLevel).toBe(gradeLevel);
      }
    });

    it('enforces component weight sum invariant: ww + pt + ex === 1.0', () => {
      for (const group of ['CORE', 'TECHNICAL'] as const) {
        const policy = getGradingPolicy({ schoolYear: 'SY 2026-2027', gradeLevel: 7, subjectGroup: group });
        const sum = policy.weights.wwWeight + policy.weights.ptWeight + policy.weights.exWeight;
        expect(Math.round(sum * 100) / 100).toBe(1.0);
      }
    });

    it('enforces exam internal weight sum invariant: st1 + st2 + te === 1.0', () => {
      const policy = getGradingPolicy({ schoolYear: 'SY 2026-2027', gradeLevel: 7, subjectGroup: 'CORE' });
      const sum = policy.examWeights.st1Weight + policy.examWeights.st2Weight + policy.examWeights.teWeight;
      expect(Math.round(sum * 100) / 100).toBe(1.0);
    });
  });

  // ─── Precision & IEEE-754 Decimal Shifting Verification ───────────────────

  describe('Precision & IEEE-754 Decimal Shifting Verification', () => {
    it('verifies all required decimal boundary cases for roundHalfUp', () => {
      // Direct boundary checks mandated in Phase B:
      expect(roundHalfUp(69.994, 2)).toBe(69.99);
      expect(roundHalfUp(69.995, 2)).toBe(70.00);
      expect(roundHalfUp(69.999, 2)).toBe(70.00);
      expect(roundHalfUp(70.000, 2)).toBe(70.00);
      expect(roundHalfUp(71.174, 2)).toBe(71.17);
      expect(roundHalfUp(71.175, 2)).toBe(71.18);
      expect(roundHalfUp(71.179, 2)).toBe(71.18);
      expect(roundHalfUp(99.495, 2)).toBe(99.50);

      // Binary float representation problem checks:
      // 1.005 * 100 is 100.49999999999999 in binary float (fails naive Math.floor/round)
      expect(roundHalfUp(1.005, 2)).toBe(1.01);
      // 2.675 * 100 is 267.49999999999994 in binary float (fails naive Math.floor/round)
      expect(roundHalfUp(2.675, 2)).toBe(2.68);
      // 87.805
      expect(roundHalfUp(87.805, 2)).toBe(87.81);
    });

    it('verifies end-to-end pipeline precision through calculateStudentTermGrade', () => {
      // Craft scores that hit the exact passing threshold boundary:
      // We want WW + PT + EX = 69.995 -> Initial Grade rounds to 70.00 -> Term Grade 75 (Passing)
      //
      // In Core (WW: 20%, PT: 50%, EX: 30%):
      // WW: 70.00 * 0.20 = 14.00
      // PT: 70.00 * 0.50 = 35.00
      // EX: We want EX weighted score to be such that IG rounds properly.
      // E.g., ST1: 70/100, ST2: 70/100, TE: 70/100 -> PS_EX = 70.00, WS_EX = 21.00 -> IG = 70.00 -> TG = 75
      const inputPassingExact: StudentTermScoreInput = {
        enrollmentId: 'student-passing-exact',
        wwScores: [{ id: 'ww-1', score: 70, maxScore: 100 }],
        ptScores: [{ id: 'pt-1', score: 70, maxScore: 100 }],
        st1: { score: 70, maxScore: 100 },
        st2: { score: 70, maxScore: 100 },
        te:  { score: 70, maxScore: 100 },
      };

      const resultPassing = calculateStudentTermGrade(inputPassingExact, corePolicy2026);
      expect(resultPassing.initialGrade).toBe(70.00);
      expect(resultPassing.termGrade).toBe(75);

      // Failing threshold test:
      // WW: 69.94 -> WS = 13.99, PT: 70 -> WS = 35.00, EX: 70 -> WS = 21.00 -> IG = 69.99 -> TG = 74
      const inputFailing: StudentTermScoreInput = {
        enrollmentId: 'student-failing-boundary',
        wwScores: [{ id: 'ww-1', score: 69.94, maxScore: 100 }],
        ptScores: [{ id: 'pt-1', score: 70, maxScore: 100 }],
        st1: { score: 70, maxScore: 100 },
        st2: { score: 70, maxScore: 100 },
        te:  { score: 70, maxScore: 100 },
      };

      const resultFailing = calculateStudentTermGrade(inputFailing, corePolicy2026);
      expect(resultFailing.initialGrade).toBe(69.99);
      expect(resultFailing.termGrade).toBe(74);
    });
  });

  // ─── Engine Purity & Invariants ───────────────────────────────────────────

  describe('Engine Purity & Determinism', () => {
    it('is strictly deterministic (identical inputs yield identical results)', () => {
      const input: StudentTermScoreInput = {
        enrollmentId: 'student-deterministic',
        wwScores: [{ id: 'ww-1', score: 85, maxScore: 100 }],
        ptScores: [{ id: 'pt-1', score: 90, maxScore: 100 }],
        st1: { score: 25, maxScore: 30 },
        st2: { score: 25, maxScore: 30 },
        te:  { score: 45, maxScore: 50 },
      };

      const first = calculateStudentTermGrade(input, corePolicy2026);
      for (let i = 0; i < 10; i++) {
        const repeated = calculateStudentTermGrade(input, corePolicy2026);
        expect(repeated).toEqual(first);
      }
    });

    it('does not mutate input structures', () => {
      const input: StudentTermScoreInput = {
        enrollmentId: 'student-immutable',
        wwScores: [{ id: 'ww-1', score: 85, maxScore: 100 }],
        ptScores: [{ id: 'pt-1', score: 90, maxScore: 100 }],
        st1: { score: 25, maxScore: 30 },
        st2: { score: 25, maxScore: 30 },
        te:  { score: 45, maxScore: 50 },
      };

      const originalSnapshot = JSON.stringify(input);
      calculateStudentTermGrade(input, corePolicy2026);
      expect(JSON.stringify(input)).toBe(originalSnapshot);
    });
  });
});
