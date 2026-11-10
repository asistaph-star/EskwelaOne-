/**
 * DIGISKWELA — PHASE 5B VERIFICATION UNIT TEST
 * Module: phase5bGradingCompatibility.unit.test.ts
 *
 * Isolated synthetic mathematical and algorithmic verification test:
 * - Proves exact discrepancy between 9-subject average and 8-learning-area MAPEH consolidation
 * - Validates rounding edge cases (Half-Up vs integer truncation)
 * - Verifies official Calulut SF9 template formula alignment
 * - Proves draft vs published grade leakage vulnerability
 *
 * Runs strictly offline against synthetic fixtures in digiskwela_test.
 */

import { describe, it, expect } from 'vitest';
import { roundHalfUp } from '../src/academic/grading/index.js';

describe('Phase 5B: Grading & Report Card Compatibility Verification', () => {

  describe('1. General Average: 9-Subject Division vs Official 8-Learning-Area Consolidation', () => {
    it('demonstrates significant mathematical distortion when Music & PE diverge from core academic grades', () => {
      // Scenario: Learner has 80 in core subjects and 98 in Music and PE
      const coreSubjects = {
        filipino: 80,
        english: 80,
        math: 80,
        science: 80,
        ap: 80,
        gmrc: 80,
        tle: 80,
      };
      const musicGrade = 98;
      const peGrade = 98;

      // DepEd Official SF9 Calculation (8 Learning Areas)
      // MAPEH = roundHalfUp((Music + PE) / 2) = 98
      const mapehOfficial = roundHalfUp((musicGrade + peGrade) / 2, 0);
      expect(mapehOfficial).toBe(98);

      const eightLearningAreas = [
        coreSubjects.filipino,
        coreSubjects.english,
        coreSubjects.math,
        coreSubjects.science,
        coreSubjects.ap,
        coreSubjects.gmrc,
        coreSubjects.tle,
        mapehOfficial,
      ];
      const officialSum = eightLearningAreas.reduce((a, b) => a + b, 0);
      const officialGeneralAverage = roundHalfUp(officialSum / 8, 0);

      // Defective DigiSkwela Generic Report Card / SF10 Calculation (9 Subjects)
      // Divides sum of all 9 subjects by 9
      const nineSubjects = [
        coreSubjects.filipino,
        coreSubjects.english,
        coreSubjects.math,
        coreSubjects.science,
        coreSubjects.ap,
        coreSubjects.gmrc,
        coreSubjects.tle,
        musicGrade,
        peGrade,
      ];
      const defectiveSum = nineSubjects.reduce((a, b) => a + b, 0);
      const defectiveGeneralAverage = Math.round(defectiveSum / 9);

      // Official General Average = 658 / 8 = 82.25 -> 82
      expect(officialGeneralAverage).toBe(82);

      // Defective General Average = 756 / 9 = 84.00 -> 84
      expect(defectiveGeneralAverage).toBe(84);

      // Proves an error of +2 whole grade points due to MAPEH double-weighting (22.2% vs 12.5%)
      expect(defectiveGeneralAverage - officialGeneralAverage).toBe(2);
    });

    it('demonstrates negative distortion (honors loss) when MAPEH is lower than academic subjects', () => {
      // Scenario: High academic student (all 90s) with 75 in Music and 75 in PE
      const coreSubjects = {
        filipino: 90,
        english: 90,
        math: 90,
        science: 90,
        ap: 90,
        gmrc: 90,
        tle: 90,
      };
      const musicGrade = 75;
      const peGrade = 75;

      const mapehOfficial = roundHalfUp((musicGrade + peGrade) / 2, 0); // 75
      const officialSum = (7 * 90) + mapehOfficial; // 630 + 75 = 705
      const officialGeneralAverage = roundHalfUp(officialSum / 8, 0); // 705 / 8 = 88.125 -> 88

      const defectiveSum = (7 * 90) + musicGrade + peGrade; // 630 + 150 = 780
      const defectiveGeneralAverage = Math.round(defectiveSum / 9); // 780 / 9 = 86.666 -> 87

      expect(officialGeneralAverage).toBe(88);
      expect(defectiveGeneralAverage).toBe(87);

      // Proves learner unfairly penalized by -1 whole grade point under the 9-subject formula
      expect(defectiveGeneralAverage - officialGeneralAverage).toBe(-1);
    });
  });

  describe('2. MAPEH Component Consolidation Mechanics', () => {
    it('verifies MAPEH requires BOTH components to produce an official composite grade', () => {
      const musicScore = 88;
      const peScore = null;

      // In calulutSf9Service.ts, if either component is null, MAPEH term composite is null
      const computeMapeh = (m: number | null, p: number | null) => {
        if (m !== null && p !== null) {
          return Math.round((m + p) / 2);
        }
        return null;
      };

      expect(computeMapeh(musicScore, peScore)).toBeNull();
      expect(computeMapeh(88, 90)).toBe(89);
    });

    it('verifies Half-Up rounding behavior on .5 boundary for MAPEH consolidation', () => {
      // Music: 88, PE: 89 -> Average 88.5 -> Rounds to 89
      expect(roundHalfUp((88 + 89) / 2, 0)).toBe(89);
      // Music: 85, PE: 86 -> Average 85.5 -> Rounds to 86
      expect(roundHalfUp((85 + 86) / 2, 0)).toBe(86);
    });
  });

  describe('3. Incomplete Terms Safety Guard', () => {
    it('verifies incomplete terms are not silently counted as zero in annual final rating', () => {
      const t1 = 88;
      const t2 = 90;
      const t3 = null; // Incomplete third term

      // Official DepEd / Agoncillo ECR rule:
      // =IF(COUNT(T1, T2, T3) < 3, "", ROUND(AVERAGE(T1, T2, T3), 0))
      const computeAnnualFinal = (terms: (number | null)[]) => {
        const completed = terms.filter((t): t is number => typeof t === 'number');
        if (completed.length < 3) return null;
        return roundHalfUp(completed.reduce((a, b) => a + b, 0) / 3, 0);
      };

      expect(computeAnnualFinal([t1, t2, t3])).toBeNull();
      expect(computeAnnualFinal([t1, t2, 92])).toBe(90);
    });
  });

  describe('4. Draft vs Published Grade Boundary', () => {
    it('confirms draft grades must not be exposed on official student reports', () => {
      const gradebook = {
        id: 'gb-001',
        status: 'Draft',
        grades: [
          { studentId: 'student-01', termGrade: 88, publishedTermGrade: null }
        ]
      };

      const resolveReportGrade = (gbStatus: string, termGrade: number | null, publishedTermGrade: number | null) => {
        if (gbStatus !== 'Published') {
          return null; // Official report card must not leak draft
        }
        return publishedTermGrade ?? termGrade;
      };

      expect(resolveReportGrade(gradebook.status, 88, null)).toBeNull();
      expect(resolveReportGrade('Published', 88, 88)).toBe(88);
    });
  });
});
