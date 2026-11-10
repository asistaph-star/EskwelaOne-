import { describe, it, expect } from 'vitest';
import {
  classifyWhoBmi,
  classifyWhoHfa,
  calculateBmiValue,
  normalizeSex,
  resolveAgeMonths,
  WHO_BMI_BOYS,
  WHO_BMI_GIRLS,
  WHO_HFA_BOYS,
  WHO_HFA_GIRLS,
} from '../src/academic/health/whoBmiCalculator.js';
import { calculateMeasurementAge } from '../src/academic/health/ageCalculator.js';

describe('Task 4 — Independent WHO 2007 Growth Reference Verification', () => {

  describe('1. Unrounded BMI Precision vs Display Formatting', () => {
    it('uses unrounded BMI for boundary comparison and returns display BMI to 1 decimal place', () => {
      // 16-year-old Boy (192 mos): sdMinus3 threshold = 15.1
      // If height = 160 cm, weight = 38.64 kg:
      // rawBmi = 38.64 / (1.6^2) = 15.09375
      // toFixed(1) would round 15.09375 to 15.1.
      // If rounded BMI were used: 15.1 < 15.1 is false -> wrongly classified as 'Wasted'.
      // With unrounded BMI: 15.09375 < 15.1 is true -> correctly classified as 'Severely Wasted'!
      const result = classifyWhoBmi(160, 38.64, 192, 'Male');
      expect(result.bmi).toBe(15.1); // formatted to 1 decimal place
      expect(result.status).toBe('Severely Wasted'); // correctly classified using raw unrounded BMI
    });

    it('formats display BMI to exactly 1 decimal place across values', () => {
      expect(calculateBmiValue(154.5, 46.5)).toBe(19.5);
      expect(calculateBmiValue(160.0, 50.0)).toBe(19.5);
      expect(calculateBmiValue(170.0, 65.0)).toBe(22.5);
    });
  });

  describe('2. Official WHO 2007 Age Coverage: 61–228 Months Strict Boundaries', () => {
    it('rejects 60 months (5 yrs 0 mos) as outside WHO 2007 reference coverage', () => {
      // 60 months belongs to the WHO Child Growth Standards (0-5 years), NOT WHO 2007 (5-19 years)
      const resBmi = classifyWhoBmi(110, 18, 60, 'Male');
      expect(resBmi.status).toBe('Pending Verification / Not Calculated');
      expect(resBmi.ageMonths).toBe(60);

      const resHfa = classifyWhoHfa(110, 60, 'Male');
      expect(resHfa.status).toBe('Pending Verification / Not Calculated');
      expect(resHfa.ageMonths).toBe(60);
    });

    it('accepts 61 months (5 yrs 1 mo) as official lower boundary of WHO 2007 reference', () => {
      // 61 months is the first valid month of the WHO 2007 reference
      // Height 110 cm, weight 18.5 kg -> BMI 15.3 (Normal)
      const resBmi = classifyWhoBmi(110, 18.5, 61, 'Male');
      expect(resBmi.status).toBe('Normal');
      expect(resBmi.ageMonths).toBe(61);
      expect(resBmi.bmi).toBe(15.3);

      const resHfa = classifyWhoHfa(110, 61, 'Male');
      expect(resHfa.status).toBe('Normal');
      expect(resHfa.ageMonths).toBe(61);
    });

    it('accepts 228 months (19 yrs 0 mos) as official upper boundary of WHO 2007 reference', () => {
      // 228 months is the final valid month of the WHO 2007 reference
      // Height 174 cm, weight 66.5 kg -> BMI 22.0 (Normal)
      const resBmi = classifyWhoBmi(174, 66.5, 228, 'Male');
      expect(resBmi.status).toBe('Normal');
      expect(resBmi.ageMonths).toBe(228);
      expect(resBmi.bmi).toBe(22.0);

      const resHfa = classifyWhoHfa(174.4, 228, 'Male');
      expect(resHfa.status).toBe('Normal');
      expect(resHfa.ageMonths).toBe(228);
    });

    it('rejects 229 months (19 yrs 1 mo) as outside WHO 2007 reference coverage', () => {
      // 229 months exceeds the 228-month maximum of the WHO 2007 reference
      const resBmi = classifyWhoBmi(174, 66.5, 229, 'Male');
      expect(resBmi.status).toBe('Pending Verification / Not Calculated');
      expect(resBmi.ageMonths).toBe(229);

      const resHfa = classifyWhoHfa(174.4, 229, 'Male');
      expect(resHfa.status).toBe('Pending Verification / Not Calculated');
      expect(resHfa.ageMonths).toBe(229);
    });

    it('rejects 19.99 years (~239 completed months) as outside WHO 2007 reference coverage', () => {
      // 19.99 years = 239 completed months, far beyond the 228-month cutoff
      const resBmi = classifyWhoBmi(174, 66.5, 19.99, 'Male');
      expect(resBmi.status).toBe('Pending Verification / Not Calculated');
      expect(resBmi.ageMonths).toBe(239);

      const resHfa = classifyWhoHfa(174.4, 19.99, 'Male');
      expect(resHfa.status).toBe('Pending Verification / Not Calculated');
      expect(resHfa.ageMonths).toBe(239);
    });

    it('evaluates actual birthdate and measurement date using calculateMeasurementAge', () => {
      // Test 1: Born 2021-06-01, Measured 2026-06-01 = exactly 60 months -> REJECTED (Pending)
      const age60 = calculateMeasurementAge('2021-06-01', '2026-06-01');
      expect(age60?.totalMonths).toBe(60);
      expect(classifyWhoBmi(110, 18, age60, 'Male').status).toBe('Pending Verification / Not Calculated');

      // Test 2: Born 2021-05-01, Measured 2026-06-01 = exactly 61 months -> SUPPORTED
      const age61 = calculateMeasurementAge('2021-05-01', '2026-06-01');
      expect(age61?.totalMonths).toBe(61);
      expect(classifyWhoBmi(110, 18.5, age61, 'Male').status).toBe('Normal');

      // Test 3: Born 2007-06-01, Measured 2026-06-01 = exactly 228 months -> SUPPORTED
      const age228 = calculateMeasurementAge('2007-06-01', '2026-06-01');
      expect(age228?.totalMonths).toBe(228);
      expect(classifyWhoBmi(174, 66.5, age228, 'Male').status).toBe('Normal');

      // Test 4: Born 2007-05-01, Measured 2026-06-01 = exactly 229 months -> REJECTED (Pending)
      const age229 = calculateMeasurementAge('2007-05-01', '2026-06-01');
      expect(age229?.totalMonths).toBe(229);
      expect(classifyWhoBmi(174, 66.5, age229, 'Male').status).toBe('Pending Verification / Not Calculated');
    });
  });

  describe('3. Male Learners Across Supported Ages & Categories', () => {
    // Verified against official WHO 2007 BMI-for-age tables (Boys)
    it('classifies 61-month-old boy (5 yrs 1 mo cohort)', () => {
      // Cutoffs: sdMinus3: 12.1, sdMinus2: 13.0, median: 15.3, sdPlus1: 16.6, sdPlus2: 18.3
      expect(classifyWhoBmi(110, 14.5, 61, 'Male').status).toBe('Severely Wasted'); // BMI ~ 12.0
      expect(classifyWhoBmi(110, 15.5, 61, 'Male').status).toBe('Wasted');         // BMI ~ 12.8
      expect(classifyWhoBmi(110, 18.5, 61, 'Male').status).toBe('Normal');         // BMI ~ 15.3
      expect(classifyWhoBmi(110, 21.0, 61, 'Male').status).toBe('Overweight');     // BMI ~ 17.4
      expect(classifyWhoBmi(110, 23.0, 61, 'Male').status).toBe('Obese');          // BMI ~ 19.0
    });

    it('classifies 10-year-old boy (120 mos) across all 5 BMI categories', () => {
      // Cutoffs: sdMinus3: 12.8, sdMinus2: 13.7, median: 16.4, sdPlus1: 18.5, sdPlus2: 21.4
      expect(classifyWhoBmi(138, 24.0, 120, 'Male').status).toBe('Severely Wasted'); // BMI ~ 12.6
      expect(classifyWhoBmi(138, 25.5, 120, 'Male').status).toBe('Wasted');         // BMI ~ 13.4
      expect(classifyWhoBmi(138, 31.0, 120, 'Male').status).toBe('Normal');         // BMI ~ 16.3
      expect(classifyWhoBmi(138, 38.0, 120, 'Male').status).toBe('Overweight');     // BMI ~ 20.0
      expect(classifyWhoBmi(138, 43.0, 120, 'Male').status).toBe('Obese');          // BMI ~ 22.6
    });

    it('classifies 14-year-old boy (170 mos, Calulut JHS Rizal cohort)', () => {
      // Cutoffs: sdMinus3: 14.3, sdMinus2: 15.4, median: 19.0, sdPlus1: 21.7, sdPlus2: 25.9
      expect(classifyWhoBmi(163, 37.0, 170, 'Male').status).toBe('Severely Wasted'); // BMI ~ 13.9
      expect(classifyWhoBmi(163, 40.0, 170, 'Male').status).toBe('Wasted');         // BMI ~ 15.1
      expect(classifyWhoBmi(163, 50.5, 170, 'Male').status).toBe('Normal');         // BMI ~ 19.0
      expect(classifyWhoBmi(163, 62.0, 170, 'Male').status).toBe('Overweight');     // BMI ~ 23.3
      expect(classifyWhoBmi(163, 72.0, 170, 'Male').status).toBe('Obese');          // BMI ~ 27.1
    });

    it('classifies 228-month-old young man (19 yrs 0 mos, upper limit)', () => {
      // Cutoffs: sdMinus3: 15.9, sdMinus2: 17.6, median: 22.0, sdPlus1: 25.5, sdPlus2: 29.8
      expect(classifyWhoBmi(174, 47.0, 228, 'Male').status).toBe('Severely Wasted'); // BMI ~ 15.5
      expect(classifyWhoBmi(174, 51.5, 228, 'Male').status).toBe('Wasted');         // BMI ~ 17.0
      expect(classifyWhoBmi(174, 66.5, 228, 'Male').status).toBe('Normal');         // BMI ~ 22.0
      expect(classifyWhoBmi(174, 82.0, 228, 'Male').status).toBe('Overweight');     // BMI ~ 27.1
      expect(classifyWhoBmi(174, 95.0, 228, 'Male').status).toBe('Obese');          // BMI ~ 31.4
    });
  });

  describe('4. Female Learners Across Supported Ages & Categories', () => {
    // Verified against official WHO 2007 BMI-for-age tables (Girls)
    it('classifies 61-month-old girl (5 yrs 1 mo cohort)', () => {
      // Cutoffs: sdMinus3: 11.7, sdMinus2: 12.7, median: 15.2, sdPlus1: 16.9, sdPlus2: 19.0
      expect(classifyWhoBmi(109, 13.5, 61, 'Female').status).toBe('Severely Wasted'); // BMI ~ 11.4
      expect(classifyWhoBmi(109, 14.5, 61, 'Female').status).toBe('Wasted');         // BMI ~ 12.2
      expect(classifyWhoBmi(109, 18.0, 61, 'Female').status).toBe('Normal');         // BMI ~ 15.2
      expect(classifyWhoBmi(109, 21.0, 61, 'Female').status).toBe('Overweight');     // BMI ~ 17.7
      expect(classifyWhoBmi(109, 23.5, 61, 'Female').status).toBe('Obese');          // BMI ~ 19.8
    });

    it('classifies 10-year-old girl (120 mos) across all 5 BMI categories', () => {
      // Cutoffs: sdMinus3: 12.4, sdMinus2: 13.5, median: 16.6, sdPlus1: 19.0, sdPlus2: 22.6
      expect(classifyWhoBmi(138, 23.0, 120, 'Female').status).toBe('Severely Wasted'); // BMI ~ 12.1
      expect(classifyWhoBmi(138, 25.0, 120, 'Female').status).toBe('Wasted');         // BMI ~ 13.1
      expect(classifyWhoBmi(138, 31.5, 120, 'Female').status).toBe('Normal');         // BMI ~ 16.5
      expect(classifyWhoBmi(138, 39.5, 120, 'Female').status).toBe('Overweight');     // BMI ~ 20.7
      expect(classifyWhoBmi(138, 45.0, 120, 'Female').status).toBe('Obese');          // BMI ~ 23.6
    });

    it('classifies 14-year-old girl (170 mos, Calulut JHS)', () => {
      // Cutoffs: sdMinus3: 14.0, sdMinus2: 15.4, median: 19.6, sdPlus1: 22.7, sdPlus2: 27.3
      expect(classifyWhoBmi(157, 34.0, 170, 'Female').status).toBe('Severely Wasted'); // BMI ~ 13.8
      expect(classifyWhoBmi(157, 37.0, 170, 'Female').status).toBe('Wasted');         // BMI ~ 15.0
      expect(classifyWhoBmi(157, 48.0, 170, 'Female').status).toBe('Normal');         // BMI ~ 19.5
      expect(classifyWhoBmi(157, 60.0, 170, 'Female').status).toBe('Overweight');     // BMI ~ 24.3
      expect(classifyWhoBmi(157, 70.0, 170, 'Female').status).toBe('Obese');          // BMI ~ 28.4
    });

    it('classifies 228-month-old young woman (19 yrs 0 mos, upper limit)', () => {
      // Cutoffs: sdMinus3: 14.7, sdMinus2: 16.5, median: 21.4, sdPlus1: 25.0, sdPlus2: 29.7
      expect(classifyWhoBmi(160, 37.0, 228, 'Female').status).toBe('Severely Wasted'); // BMI ~ 14.5
      expect(classifyWhoBmi(160, 42.0, 228, 'Female').status).toBe('Wasted');         // BMI ~ 16.4
      expect(classifyWhoBmi(160, 54.0, 228, 'Female').status).toBe('Normal');         // BMI ~ 21.1
      expect(classifyWhoBmi(160, 68.0, 228, 'Female').status).toBe('Overweight');     // BMI ~ 26.6
      expect(classifyWhoBmi(160, 80.0, 228, 'Female').status).toBe('Obese');          // BMI ~ 31.3
    });
  });

  describe('5. Height-for-Age (HFA) Stunting & Stature Thresholds', () => {
    it('classifies 14-year-old Boy across all 4 HFA categories', () => {
      // Cutoffs: sdMinus3: 146.6, sdMinus2: 153.9, median: 163.8, sdPlus2: 173.8
      expect(classifyWhoHfa(145.0, 170, 'Male').status).toBe('Severely Stunted');
      expect(classifyWhoHfa(150.0, 170, 'Male').status).toBe('Stunted');
      expect(classifyWhoHfa(163.8, 170, 'Male').status).toBe('Normal');
      expect(classifyWhoHfa(175.0, 170, 'Male').status).toBe('Tall');
    });

    it('classifies 14-year-old Girl across all 4 HFA categories', () => {
      // Cutoffs: sdMinus3: 142.7, sdMinus2: 148.8, median: 157.1, sdPlus2: 165.4
      expect(classifyWhoHfa(141.0, 170, 'Female').status).toBe('Severely Stunted');
      expect(classifyWhoHfa(145.0, 170, 'Female').status).toBe('Stunted');
      expect(classifyWhoHfa(157.1, 170, 'Female').status).toBe('Normal');
      expect(classifyWhoHfa(167.0, 170, 'Female').status).toBe('Tall');
    });
  });

  describe('6. Missing or Invalid Input Handling', () => {
    it('returns Pending Verification when height is missing, zero, or negative', () => {
      expect(classifyWhoBmi(null, 45, 120, 'Male').status).toBe('Pending Verification / Not Calculated');
      expect(classifyWhoBmi(0, 45, 120, 'Male').status).toBe('Pending Verification / Not Calculated');
      expect(classifyWhoBmi(-150, 45, 120, 'Male').status).toBe('Pending Verification / Not Calculated');
    });

    it('returns Pending Verification when weight is missing, zero, or negative', () => {
      expect(classifyWhoBmi(150, null, 120, 'Male').status).toBe('Pending Verification / Not Calculated');
      expect(classifyWhoBmi(150, 0, 120, 'Male').status).toBe('Pending Verification / Not Calculated');
      expect(classifyWhoBmi(150, -45, 120, 'Male').status).toBe('Pending Verification / Not Calculated');
    });

    it('returns Pending Verification when sex is missing or unrecognized', () => {
      expect(classifyWhoBmi(150, 45, 120, null).status).toBe('Pending Verification / Not Calculated');
      expect(classifyWhoBmi(150, 45, 120, 'Unknown').status).toBe('Pending Verification / Not Calculated');
      expect(classifyWhoBmi(150, 45, 120, '').status).toBe('Pending Verification / Not Calculated');
    });
  });
});
