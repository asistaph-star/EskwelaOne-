import { describe, it, expect } from 'vitest';
import {
  isValidPhoneNumber,
  normalizePhilippinePhone,
  formatPhilippinePhoneForDisplay,
} from '../src/common/validation/studentValidation.js';

describe('DigiSkwela — Phase 1B: Philippine Phone Number Validation & Normalization', () => {
  describe('1. Accepted Formats', () => {
    it('accepts standard 11-digit local mobile number (09171234567)', () => {
      const res = isValidPhoneNumber('09171234567');
      expect(res.valid).toBe(true);
      expect(normalizePhilippinePhone('09171234567')).toBe('+639171234567');
      expect(formatPhilippinePhoneForDisplay('09171234567')).toBe('0917 123 4567');
    });

    it('accepts international E.164 format (+639171234567)', () => {
      const res = isValidPhoneNumber('+639171234567');
      expect(res.valid).toBe(true);
      expect(normalizePhilippinePhone('+639171234567')).toBe('+639171234567');
      expect(formatPhilippinePhoneForDisplay('+639171234567')).toBe('0917 123 4567');
    });

    it('accepts numbers with formatting spaces (0917 123 4567)', () => {
      const res = isValidPhoneNumber('0917 123 4567');
      expect(res.valid).toBe(true);
      expect(normalizePhilippinePhone('0917 123 4567')).toBe('+639171234567');
    });

    it('accepts numbers with formatting hyphens (0917-123-4567)', () => {
      const res = isValidPhoneNumber('0917-123-4567');
      expect(res.valid).toBe(true);
      expect(normalizePhilippinePhone('0917-123-4567')).toBe('+639171234567');
    });

    it('accepts international format with spaces (+63 917 123 4567)', () => {
      const res = isValidPhoneNumber('+63 917 123 4567');
      expect(res.valid).toBe(true);
      expect(normalizePhilippinePhone('+63 917 123 4567')).toBe('+639171234567');
    });

    it('accepts empty/null values gracefully for optional guardian phone', () => {
      expect(isValidPhoneNumber('').valid).toBe(true);
      expect(isValidPhoneNumber(null).valid).toBe(true);
      expect(isValidPhoneNumber(undefined).valid).toBe(true);
      expect(normalizePhilippinePhone('')).toBe(null);
      expect(normalizePhilippinePhone(null)).toBe(null);
    });
  });

  describe('2. Rejected Formats & Exact Error Messages', () => {
    it('rejects extra digits in local format with exact message (091712345678)', () => {
      const res = isValidPhoneNumber('091712345678');
      expect(res.valid).toBe(false);
      expect(res.reason).toBe('Mobile number is too long. Enter an 11-digit Philippine mobile number.');
    });

    it('rejects extra digits in international format with exact message (+6391712345678)', () => {
      const res = isValidPhoneNumber('+6391712345678');
      expect(res.valid).toBe(false);
      expect(res.reason).toBe('Mobile number is too long. Enter an 11-digit Philippine mobile number.');
    });

    it('rejects letters with exact message (0917ABC4567)', () => {
      const res = isValidPhoneNumber('0917ABC4567');
      expect(res.valid).toBe(false);
      expect(res.reason).toBe('Enter a valid phone number using digits only.');
    });

    it('rejects incomplete numbers with exact message (0917123)', () => {
      const res = isValidPhoneNumber('0917123');
      expect(res.valid).toBe(false);
      expect(res.reason).toBe('Enter a complete Philippine mobile number.');
    });

    it('rejects unsupported patterns with exact message (08123456789)', () => {
      const res = isValidPhoneNumber('08123456789');
      expect(res.valid).toBe(false);
      expect(res.reason).toBe('Enter a valid Philippine mobile number, such as 0917 123 4567.');
    });

    it('rejects foreign prefixes with exact message (+1234567890)', () => {
      const res = isValidPhoneNumber('+1234567890');
      expect(res.valid).toBe(false);
      expect(res.reason).toBe('Enter a valid Philippine mobile number, such as 0917 123 4567.');
    });
  });
});
