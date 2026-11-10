import { describe, it, expect } from 'vitest';
import {
  calculateAgeAsOf,
  calculateBoSYAge,
  calculateSchoolFormAge,
  calculateMeasurementAge,
  parseDateOnly,
} from '../src/academic/health/ageCalculator.js';
import {
  classifyWhoBmi,
  classifyWhoHfa,
  calculateBmiValue,
  normalizeSex,
  WHO_BMI_BOYS,
  WHO_BMI_GIRLS,
  WHO_HFA_BOYS,
  WHO_HFA_GIRLS,
} from '../src/academic/health/whoBmiCalculator.js';

describe('DepEd & WHO 2007 Health Calculation Engine', () => {

  describe('Date-Only Age Calculation Engine', () => {
    it('accurately parses date strings without timezone shifts', () => {
      const parts = parseDateOnly('2012-04-15');
      expect(parts).toEqual({ year: 2012, month: 4, day: 15 });
    });

    it('calculates regular age correctly as of a reference date', () => {
      // Born 2012-05-10, as of 2026-10-31
      const age = calculateAgeAsOf('2012-05-10', '2026-10-31');
      expect(age).not.toBeNull();
      expect(age?.years).toBe(14);
      expect(age?.months).toBe(5);
      expect(age?.totalMonths).toBe(14 * 12 + 5);
      expect(age?.formatted).toBe('14 yrs 5 mos');
    });

    it('handles exact birthday matching reference date', () => {
      const age = calculateAgeAsOf('2011-10-31', '2026-10-31');
      expect(age).not.toBeNull();
      expect(age?.years).toBe(15);
      expect(age?.months).toBe(0);
      expect(age?.formatted).toBe('15 yrs 0 mos');
    });

    it('handles day before birthday correctly (does not award extra year)', () => {
      const age = calculateAgeAsOf('2011-11-01', '2026-10-31');
      expect(age).not.toBeNull();
      expect(age?.years).toBe(14);
      expect(age?.months).toBe(11);
    });

    it('handles leap-year birthday (Feb 29) evaluated on a non-leap year', () => {
      const ageBefore = calculateAgeAsOf('2012-02-29', '2026-02-28');
      expect(ageBefore?.years).toBe(13);

      const ageAfter = calculateAgeAsOf('2012-02-29', '2026-03-01');
      expect(ageAfter?.years).toBe(14);
    });

    it('flags school-form age as unverified when no official reference date is provided', () => {
      const result = calculateSchoolFormAge('2010-09-12', null);
      expect(result.isVerified).toBe(false);
      expect(result.age).toBeNull();
      expect(result.statusNote).toContain('pending institutional calendar verification');
    });

    it('calculates age at the actual health measurement date (conforming to DO 058 s. 2017)', () => {
      // Born 2010-09-12, measured on 2026-08-15
      const measurementAge = calculateMeasurementAge('2010-09-12', '2026-08-15');
      expect(measurementAge?.years).toBe(15);
      expect(measurementAge?.months).toBe(11);
    });

    it('returns null if reference date is earlier than birth date', () => {
      const age = calculateAgeAsOf('2026-01-01', '2020-01-01');
      expect(age).toBeNull();
    });

    it('returns null for missing, null, or invalid birth dates', () => {
      expect(calculateAgeAsOf(null, '2026-10-31')).toBeNull();
      expect(calculateAgeAsOf('', '2026-10-31')).toBeNull();
      expect(calculateAgeAsOf(undefined, '2026-10-31')).toBeNull();
      expect(calculateAgeAsOf('invalid-date', '2026-10-31')).toBeNull();
    });
  });

  describe('WHO 2007 BMI-for-Age Engine', () => {
    it('normalizes biological sex correctly', () => {
      expect(normalizeSex('Male')).toBe('Male');
      expect(normalizeSex('M')).toBe('Male');
      expect(normalizeSex('boy')).toBe('Male');
      expect(normalizeSex('Female')).toBe('Female');
      expect(normalizeSex('F')).toBe('Female');
      expect(normalizeSex('girl')).toBe('Female');
      expect(normalizeSex('unknown')).toBeNull();
      expect(normalizeSex(null)).toBeNull();
    });

    it('computes BMI value to 1 decimal place', () => {
      expect(calculateBmiValue(150, 45)).toBe(20.0);
      expect(calculateBmiValue(162, 52)).toBe(19.8);
    });

    it('classifies 16-year-old Boy across all 5 WHO categories (Calulut JHS learner)', () => {
      // 16y Boy cutoffs: sdMinus3: 15.1, sdMinus2: 16.5, median: 20.5, sdPlus1: 23.5, sdPlus2: 27.9
      const cutoffs = WHO_BMI_BOYS[16];
      expect(cutoffs).toBeDefined();

      // 1. Severely Wasted (< 15.1): height 165 cm, weight 39 kg -> BMI 14.3
      const sevWasted = classifyWhoBmi(165, 39, 16, 'Male');
      expect(sevWasted.bmi).toBe(14.3);
      expect(sevWasted.status).toBe('Severely Wasted');

      // 2. Wasted (15.1 to < 16.5): height 165 cm, weight 43 kg -> BMI 15.8
      const wasted = classifyWhoBmi(165, 43, 16, 'Male');
      expect(wasted.bmi).toBe(15.8);
      expect(wasted.status).toBe('Wasted');

      // 3. Normal (16.5 to <= 23.5): height 165 cm, weight 55 kg -> BMI 20.2
      const normal = classifyWhoBmi(165, 55, 16, 'Male');
      expect(normal.bmi).toBe(20.2);
      expect(normal.status).toBe('Normal');

      // 4. Overweight (> 23.5 to <= 27.9): height 165 cm, weight 68 kg -> BMI 25.0
      const overweight = classifyWhoBmi(165, 68, 16, 'Male');
      expect(overweight.bmi).toBe(25.0);
      expect(overweight.status).toBe('Overweight');

      // 5. Obese (> 27.9): height 165 cm, weight 80 kg -> BMI 29.4
      const obese = classifyWhoBmi(165, 80, 16, 'Male');
      expect(obese.bmi).toBe(29.4);
      expect(obese.status).toBe('Obese');
    });

    it('classifies 16-year-old Girl across all 5 WHO categories (Calulut JHS learner)', () => {
      // 16y Girl cutoffs: sdMinus3: 14.6, sdMinus2: 16.2, median: 20.7, sdPlus1: 24.1, sdPlus2: 28.9
      const cutoffs = WHO_BMI_GIRLS[16];
      expect(cutoffs).toBeDefined();

      // 1. Severely Wasted (< 14.6): height 155 cm, weight 34 kg -> BMI 14.2
      const sevWasted = classifyWhoBmi(155, 34, 16, 'Female');
      expect(sevWasted.bmi).toBe(14.2);
      expect(sevWasted.status).toBe('Severely Wasted');

      // 2. Wasted (14.6 to < 16.2): height 155 cm, weight 37 kg -> BMI 15.4
      const wasted = classifyWhoBmi(155, 37, 16, 'Female');
      expect(wasted.bmi).toBe(15.4);
      expect(wasted.status).toBe('Wasted');

      // 3. Normal (16.2 to <= 24.1): height 155 cm, weight 48 kg -> BMI 20.0
      const normal = classifyWhoBmi(155, 48, 16, 'Female');
      expect(normal.bmi).toBe(20.0);
      expect(normal.status).toBe('Normal');

      // 4. Overweight (> 24.1 to <= 28.9): height 155 cm, weight 60 kg -> BMI 25.0
      const overweight = classifyWhoBmi(155, 60, 16, 'Female');
      expect(overweight.bmi).toBe(25.0);
      expect(overweight.status).toBe('Overweight');

      // 5. Obese (> 28.9): height 155 cm, weight 72 kg -> BMI 30.0
      const obese = classifyWhoBmi(155, 72, 16, 'Female');
      expect(obese.bmi).toBe(30.0);
      expect(obese.status).toBe('Obese');
    });

    it('returns Pending Verification / Not Calculated when data is incomplete or out-of-range', () => {
      expect(classifyWhoBmi(null, 45, 14, 'Male').status).toBe('Pending Verification / Not Calculated');
      expect(classifyWhoBmi(150, 0, 14, 'Male').status).toBe('Pending Verification / Not Calculated');
      expect(classifyWhoBmi(150, 45, 14, null).status).toBe('Pending Verification / Not Calculated');
      expect(classifyWhoBmi(100, 15, 4, 'Male').status).toBe('Pending Verification / Not Calculated');
      expect(classifyWhoBmi(170, 65, 22, 'Male').status).toBe('Pending Verification / Not Calculated');
    });
  });

  describe('WHO 2007 Height-for-Age (HFA) Engine', () => {
    it('classifies 10-year-old Boy across all 4 WHO HFA categories', () => {
      // 10y Boy cutoffs: sdMinus3: 125.8, sdMinus2: 131.8, median: 140.1, sdPlus2: 148.5
      expect(classifyWhoHfa(124.0, 10, 'Male').status).toBe('Severely Stunted');
      expect(classifyWhoHfa(128.0, 10, 'Male').status).toBe('Stunted');
      expect(classifyWhoHfa(140.0, 10, 'Male').status).toBe('Normal');
      expect(classifyWhoHfa(150.0, 10, 'Male').status).toBe('Tall');
    });

    it('classifies 10-year-old Girl across all 4 WHO HFA categories', () => {
      // 10y Girl cutoffs: sdMinus3: 124.9, sdMinus2: 131.0, median: 139.5, sdPlus2: 148.1
      expect(classifyWhoHfa(123.0, 10, 'Female').status).toBe('Severely Stunted');
      expect(classifyWhoHfa(128.0, 10, 'Female').status).toBe('Stunted');
      expect(classifyWhoHfa(139.0, 10, 'Female').status).toBe('Normal');
      expect(classifyWhoHfa(150.0, 10, 'Female').status).toBe('Tall');
    });

    it('returns Pending Verification / Not Calculated for incomplete HFA inputs', () => {
      expect(classifyWhoHfa(null, 10, 'Male').status).toBe('Pending Verification / Not Calculated');
      expect(classifyWhoHfa(140, null, 'Male').status).toBe('Pending Verification / Not Calculated');
      expect(classifyWhoHfa(140, 10, null).status).toBe('Pending Verification / Not Calculated');
      expect(classifyWhoHfa(140, 4, 'Male').status).toBe('Pending Verification / Not Calculated');
    });
  });
});
