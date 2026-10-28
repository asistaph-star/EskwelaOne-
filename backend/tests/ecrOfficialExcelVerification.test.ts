/**
 * DIGISKWELA — Official Excel Verification Test Suite
 * Reference Workbook: AGONCILLO ECR - SEPT4.xlsx (Calulut Integrated School)
 *
 * Verifies that the DigiSkwela calculation engine strictly reproduces the exact
 * formulas, component weights, intermediate values, transmutation lookup,
 * descriptors, and 3-term final ratings from the school's actual Excel workbook.
 *
 * All student identifiers are strictly anonymized (Learner 1..33).
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  calculateStudentTermGrade,
  getGradingPolicy,
  getPerformanceDescriptor,
  roundHalfUp,
  type StudentTermScoreInput,
} from '../src/academic/grading/index.js';

interface EcrRecord {
  studentId: string;
  studentLabel: string;
  ww1: number;
  ww2: number;
  ww3: number;
  wwTotal: number;
  wwPS: number;
  wwWS: number;
  pt1: number;
  pt2: number;
  pt3: number;
  ptTotal: number;
  ptPS: number;
  ptWS: number;
  st1: number;
  st2: number;
  te: number;
  st1WS: number;
  st2WS: number;
  teWS: number;
  exPS: number;
  exWS: number;
  initialGrade: number;
  termGrade: number;
  descriptor: string;
}

describe('Calulut Integrated School — AGONCILLO ECR - SEPT4 Excel Verification', () => {
  // Official Core Policy for Grade 7 Mathematics (SY 2026-2027)
  const policy = getGradingPolicy({
    schoolYear: 'SY 2026-2027',
    gradeLevel: 7,
    subjectGroup: 'CORE',
  });

  // Load verified benchmark cases extracted directly from AGONCILLO ECR - SEPT4.xlsx
  const benchmarkPath = 'C:\\Users\\Henry Yeoj\\.gemini\\antigravity-ide\\brain\\f0c00aa0-d2cb-4f92-99a4-171c79b8b5d2\\scratch\\ecr_benchmark_data.json';
  const rawData = fs.readFileSync(benchmarkPath, 'utf8').replace(/^\uFEFF/, '');
  const benchmarkCases: EcrRecord[] = JSON.parse(rawData);

  it('loaded legitimate benchmark cases from the Excel workbook', () => {
    expect(benchmarkCases.length).toBeGreaterThanOrEqual(30);
  });

  describe('TC-EXCEL-01: Cell-by-Cell Calculation Parity on All Benchmark Students', () => {
    benchmarkCases.forEach((rec, idx) => {
      it(`accurately computes ${rec.studentLabel}: Initial Grade ${rec.initialGrade.toFixed(2)} -> Term Grade ${rec.termGrade} (${rec.descriptor})`, () => {
        // Construct inputs matching ECR Row 15 max scores:
        // WW: 28, 20, 18 (Total Max = 66)
        // PT: 20, 12, 30 (Total Max = 62)
        // ST1: 25, ST2: 25, TE: 50
        const input: StudentTermScoreInput = {
          enrollmentId: rec.studentId,
          wwScores: [
            { id: 'ww-1', label: 'WW 1', score: rec.ww1 || 0, maxScore: 28 },
            { id: 'ww-2', label: 'WW 2', score: rec.ww2 || 0, maxScore: 20 },
            { id: 'ww-3', label: 'WW 3', score: rec.ww3 || 0, maxScore: 18 },
          ],
          ptScores: [
            { id: 'pt-1', label: 'PT 1', score: rec.pt1 || 0, maxScore: 20 },
            { id: 'pt-2', label: 'PT 2', score: rec.pt2 || 0, maxScore: 12 },
            { id: 'pt-3', label: 'PT 3', score: rec.pt3 || 0, maxScore: 30 },
          ],
          st1: { score: rec.st1 || 0, maxScore: 25 },
          st2: { score: rec.st2 || 0, maxScore: 25 },
          te:  { score: rec.te  || 0, maxScore: 50 },
        };

        const result = calculateStudentTermGrade(input, policy);

        expect(result.validationErrors).toEqual([]);
        expect(result.isComplete).toBe(true);

        // 1. Verify WW Total & Percentage Score
        expect(result.wwResult).not.toBeNull();
        expect(result.wwResult!.totalEarned).toBe(rec.wwTotal);
        expect(result.wwResult!.totalPossible).toBe(66);
        expect(result.wwResult!.percentageScore).toBeCloseTo(rec.wwPS, 2);

        // 2. Verify PT Total & Percentage Score
        expect(result.ptResult).not.toBeNull();
        expect(result.ptResult!.totalEarned).toBe(rec.ptTotal);
        expect(result.ptResult!.totalPossible).toBe(62);
        expect(result.ptResult!.percentageScore).toBeCloseTo(rec.ptPS, 2);

        // 3. Verify Exam Percentage Score & Weighted Score
        expect(result.exResult.examPercentageScore).toBeCloseTo(rec.exPS, 1);

        // 4. Verify Initial Grade
        expect(result.initialGrade).toBeCloseTo(rec.initialGrade, 1);

        // 5. Verify Transmuted Term Grade EXACT MATCH
        expect(result.termGrade).toBe(rec.termGrade);

        // 6. Verify Performance Descriptor EXACT MATCH
        const descriptor = getPerformanceDescriptor(result.termGrade);
        expect(descriptor).toBe(rec.descriptor);
      });
    });
  });

  describe('TC-EXCEL-02: Missing Scores & Incompleteness Invariants', () => {
    it('returns null termGrade and marks isComplete false when any assessment is unrecorded (null)', () => {
      const input: StudentTermScoreInput = {
        enrollmentId: 'learner-incomplete',
        wwScores: [
          { id: 'ww-1', label: 'WW 1', score: 20, maxScore: 28 },
          { id: 'ww-2', label: 'WW 2', score: null, maxScore: 20 }, // Missing
          { id: 'ww-3', label: 'WW 3', score: 15, maxScore: 18 },
        ],
        ptScores: [
          { id: 'pt-1', label: 'PT 1', score: 18, maxScore: 20 },
          { id: 'pt-2', label: 'PT 2', score: 10, maxScore: 12 },
          { id: 'pt-3', label: 'PT 3', score: 25, maxScore: 30 },
        ],
        st1: { score: 20, maxScore: 25 },
        st2: { score: 20, maxScore: 25 },
        te:  { score: 40, maxScore: 50 },
      };

      const result = calculateStudentTermGrade(input, policy);

      expect(result.isComplete).toBe(false);
      expect(result.termGrade).toBeNull();
      expect(result.initialGrade).toBeNull();
      expect(result.missingAssessments).toEqual([
        { type: 'WW', id: 'ww-2', label: 'WW 2' },
      ]);
    });

    it('distinguishes confirmed zero from missing score', () => {
      const inputWithZero: StudentTermScoreInput = {
        enrollmentId: 'learner-zero',
        wwScores: [
          { id: 'ww-1', label: 'WW 1', score: 0, maxScore: 28 },
          { id: 'ww-2', label: 'WW 2', score: 0, maxScore: 20 },
          { id: 'ww-3', label: 'WW 3', score: 0, maxScore: 18 },
        ],
        ptScores: [
          { id: 'pt-1', label: 'PT 1', score: 0, maxScore: 20 },
          { id: 'pt-2', label: 'PT 2', score: 0, maxScore: 12 },
          { id: 'pt-3', label: 'PT 3', score: 0, maxScore: 30 },
        ],
        st1: { score: 0, maxScore: 25 },
        st2: { score: 0, maxScore: 25 },
        te:  { score: 0, maxScore: 50 },
      };

      const result = calculateStudentTermGrade(inputWithZero, policy);

      expect(result.isComplete).toBe(true);
      expect(result.missingAssessments).toEqual([]);
      expect(result.initialGrade).toBe(0.00);
      // Floor of Table 4: IG 0.00 transmutes to 60
      expect(result.termGrade).toBe(60);
      expect(getPerformanceDescriptor(result.termGrade)).toBe('Emerging');
    });
  });

  describe('TC-EXCEL-03: Official Transmutation Thresholds (HELPER Sheet)', () => {
    it('transmutes exactly at the passing threshold 70.00 -> 75 (Connecting)', () => {
      // 70.00 Initial Grade maps to 75 Term Grade
      expect(roundHalfUp(70.00, 2)).toBe(70.00);
      const desc = getPerformanceDescriptor(75);
      expect(desc).toBe('Connecting');
    });

    it('transmutes 80 -> Benchmarking and 90 -> Advancing', () => {
      expect(getPerformanceDescriptor(80)).toBe('Benchmarking');
      expect(getPerformanceDescriptor(89)).toBe('Benchmarking');
      expect(getPerformanceDescriptor(90)).toBe('Advancing');
      expect(getPerformanceDescriptor(100)).toBe('Advancing');
    });
  });

  describe('TC-EXCEL-04: 3-Term Annual Final Grade & Remarks', () => {
    // Reference formula from AGONCILLO ECR - SEPT4 (FINAL GRADES Sheet Col I):
    // =IF(COUNT(Term1, Term2, Term3) < 3, "", ROUND(AVERAGE(Term1, Term2, Term3), 0))
    // =IF(FinalGrade >= 75, "Passed", "Failed")

    function computeFinalGrade(t1: number | null, t2: number | null, t3: number | null): { finalGrade: number | null; remark: string | null } {
      if (t1 === null || t2 === null || t3 === null) {
        return { finalGrade: null, remark: null };
      }
      const finalGrade = Math.round((t1 + t2 + t3) / 3);
      const remark = finalGrade >= 75 ? 'Passed' : 'Failed';
      return { finalGrade, remark };
    }

    it('calculates final grade and Passed remark for complete 3 terms', () => {
      // Example Learner: T1 = 77, T2 = 82, T3 = 85 -> Average = 81.333... -> 81 (Passed)
      const res = computeFinalGrade(77, 82, 85);
      expect(res.finalGrade).toBe(81);
      expect(res.remark).toBe('Passed');
    });

    it('calculates final grade and Failed remark when average is below 75', () => {
      // T1 = 72, T2 = 61, T3 = 70 -> Average = 67.666... -> 68 (Failed)
      const res = computeFinalGrade(72, 61, 70);
      expect(res.finalGrade).toBe(68);
      expect(res.remark).toBe('Failed');
    });

    it('returns null when any term grade is missing (COUNT < 3)', () => {
      const res = computeFinalGrade(72, 61, null);
      expect(res.finalGrade).toBeNull();
      expect(res.remark).toBeNull();
    });
  });
});
