import { describe, it, expect } from 'vitest';
import {
  validateScoreInput,
  parseScore,
  ledgerTermSchema,
  SCORE_FORMAT_REGEX,
} from '../src/gradebooks/ledger.service.js';
import { AppError } from '../src/common/middleware/errorHandler.js';

describe('DigiSkwela — Phase 1C: Gradebook Assessment Score Input Integrity', () => {

  describe('1. Positive Test Cases (Accepted Scores)', () => {
    it('accepts legitimate score of 0 (preserved as 0, distinct from null/missing)', () => {
      const res1 = validateScoreInput(0, 25, 'Quiz 1');
      expect(res1.score).toBe(0);

      const res2 = validateScoreInput('0', 25, 'Quiz 1');
      expect(res2.score).toBe(0);

      const res3 = validateScoreInput('0.0', 25, 'Quiz 1');
      expect(res3.score).toBe(0);
    });

    it('accepts exact maximum score', () => {
      const res = validateScoreInput(25, 25, 'Short Test 1');
      expect(res.score).toBe(25);

      const res100 = validateScoreInput('100', 100, 'Written Work 1');
      expect(res100.score).toBe(100);
    });

    it('accepts valid permitted decimal scores (up to 2 decimal places)', () => {
      const res1 = validateScoreInput('24.5', 25, 'Quiz 1');
      expect(res1.score).toBe(24.5);

      const res2 = validateScoreInput('24.75', 25, 'Quiz 1');
      expect(res2.score).toBe(24.75);

      const res3 = validateScoreInput('0.5', 25, 'Quiz 1');
      expect(res3.score).toBe(0.5);

      const res4 = validateScoreInput('.5', 25, 'Quiz 1');
      expect(res4.score).toBe(0.5);
    });

    it('handles blank or missing scores as missing (returns null, not 0)', () => {
      expect(validateScoreInput('', 25, 'Quiz 1').score).toBe(null);
      expect(validateScoreInput(null, 25, 'Quiz 1').score).toBe(null);
      expect(validateScoreInput(undefined, 25, 'Quiz 1').score).toBe(null);
      expect(validateScoreInput('   ', 25, 'Quiz 1').score).toBe(null);
    });
  });

  describe('2. Negative Test Cases (Rejected Scores)', () => {
    it('rejects negative scores without silent conversion', () => {
      expect(() => validateScoreInput(-5, 25, 'Quiz 1')).toThrow(AppError);
      try {
        validateScoreInput('-5', 25, 'Quiz 1');
      } catch (e: any) {
        expect(e.code).toBe('INVALID_SCORE_VALUE');
        expect(e.message).toContain('cannot be negative');
      }
    });

    it('rejects scores exceeding the assessment maximum score', () => {
      expect(() => validateScoreInput(26, 25, 'Quiz 1')).toThrow(AppError);
      try {
        validateScoreInput('999', 50, 'Term Exam');
      } catch (e: any) {
        expect(e.code).toBe('SCORE_EXCEEDS_MAX');
        expect(e.message).toContain('exceeds the maximum score of 50');
      }
    });

    it('rejects partially parsed strings such as 45abc without silent truncation', () => {
      expect(() => validateScoreInput('45abc', 50, 'Term Exam')).toThrow(AppError);
      try {
        validateScoreInput('45abc', 50, 'Term Exam');
      } catch (e: any) {
        expect(e.code).toBe('INVALID_SCORE_FORMAT');
        expect(e.message).toContain('is not a valid numeric score');
      }
    });

    it('rejects arbitrary non-numeric text such as abc, symbols, NaN, Infinity', () => {
      expect(() => validateScoreInput('abc', 25, 'Quiz 1')).toThrow(AppError);
      expect(() => validateScoreInput('NaN', 25, 'Quiz 1')).toThrow(AppError);
      expect(() => validateScoreInput('Infinity', 25, 'Quiz 1')).toThrow(AppError);
      expect(() => validateScoreInput('25!', 25, 'Quiz 1')).toThrow(AppError);
      expect(() => validateScoreInput('1e2', 25, 'Quiz 1')).toThrow(AppError);
    });

    it('rejects excess decimal precision beyond 2 decimal places', () => {
      try {
        validateScoreInput('24.555', 25, 'Quiz 1');
      } catch (e: any) {
        expect(e.code).toBe('INVALID_SCORE_PRECISION');
        expect(e.message).toContain('exceeds the permitted precision of 2 decimal places');
      }
    });

    it('rejects invalid assessment maximum scores (<= 0 or non-finite)', () => {
      expect(() => validateScoreInput('10', 0, 'Invalid Col')).toThrow(AppError);
      try {
        validateScoreInput('10', -5, 'Invalid Col');
      } catch (e: any) {
        expect(e.code).toBe('INVALID_MAX_SCORE');
        expect(e.message).toContain('Maximum score must be a positive finite number');
      }
    });
  });

  describe('3. Zod Schema Validation on Term Payload', () => {
    it('rejects non-positive column maximum scores in ledgerTermSchema', () => {
      expect(() => ledgerTermSchema.parse({
        wwItems: [{ id: 'ww1', label: 'WW 1', max: 0 }]
      })).toThrow();

      expect(() => ledgerTermSchema.parse({
        wwItems: [{ id: 'ww1', label: 'WW 1', max: -10 }]
      })).toThrow();

      expect(() => ledgerTermSchema.parse({
        st1Max: 0
      })).toThrow();
    });

    it('accepts valid ledgerTermSchema payloads', () => {
      const parsed = ledgerTermSchema.parse({
        wwItems: [{ id: 'ww1', label: 'WW 1', max: 50 }],
        ptItems: [{ id: 'pt1', label: 'PT 1', max: 100 }],
        st1Max: 25,
        st2Max: 25,
        teMax: 50,
        grades: {
          'student-1': { 'ww1': '45', 'pt1': '90' }
        }
      });
      expect(parsed.wwItems[0].max).toBe(50);
      expect(parsed.st1Max).toBe(25);
    });
  });

  describe('4. parseScore Helper Invariants', () => {
    it('returns valid numbers within max bounds', () => {
      expect(parseScore('24.5', 25)).toBe(24.5);
      expect(parseScore(0, 25)).toBe(0);
      expect(parseScore('25', 25)).toBe(25);
    });

    it('returns null on invalid inputs, negatives, or scores exceeding max', () => {
      expect(parseScore('-5', 25)).toBe(null);
      expect(parseScore('45abc', 25)).toBe(null);
      expect(parseScore('99', 25)).toBe(null);
      expect(parseScore('', 25)).toBe(null);
      expect(parseScore(null, 25)).toBe(null);
      expect(parseScore('Infinity', 25)).toBe(null);
    });
  });
});

