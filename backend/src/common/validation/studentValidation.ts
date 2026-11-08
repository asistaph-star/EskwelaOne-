/**
 * DigiSkwela — Authoritative Student Personal Information Validation
 * Module: backend/src/common/validation/studentValidation.ts
 *
 * Enforces authoritative validation for Calulut Integrated School student records:
 * - Exactly 12-digit numeric DepEd LRN (preserves leading zeros, rejects letters/symbols)
 * - Authentic Filipino names (letters, spaces, hyphens, apostrophes, accents/ñ, max 100 chars)
 * - Real calendar dates (checks valid days per month, rejects impossible/future dates)
 * - Numeric constraint enforcement for phone numbers and postal ZIP codes
 * - DepEd biological sex / gender enumerations
 */

import { z } from 'zod';

// ============================================================================
// FIELD-SPECIFIC VALIDATORS
// ============================================================================

/**
 * Validates a 12-digit DepEd Learner Reference Number (LRN).
 * Must consist strictly of 12 numeric digits. Leading zeros are preserved.
 */
export function isValidLrn(lrn: unknown): boolean {
  if (typeof lrn !== 'string') return false;
  return /^\d{12}$/.test(lrn.trim());
}

/**
 * Validates a person's name (first, last, middle, guardian names).
 * Allows letters (including Unicode accents like ñ, Ñ, é), spaces, hyphens, periods, and apostrophes.
 * Rejects numbers, script/HTML tags, control characters, and pure punctuation.
 */
export function isValidName(name: unknown, maxLen = 100): boolean {
  if (typeof name !== 'string') return false;
  const trimmed = name.trim();
  if (trimmed.length < 1 || trimmed.length > maxLen) return false;
  // Must contain at least one alphabetic character
  if (!/[a-zA-Z\u00C0-\u024F\u1E00-\u1EFF]/.test(trimmed)) return false;
  // Must only contain letters, spaces, hyphens, apostrophes, and periods
  return /^[a-zA-Z\u00C0-\u024F\u1E00-\u1EFF\s'\-\.]+$/.test(trimmed);
}

/**
 * Validates a real calendar date string (YYYY-MM-DD).
 * Rejects impossible dates (e.g. Feb 30/31, April 31) and future dates.
 */
export function isValidCalendarDate(
  dateStr: unknown,
  options: { allowFuture?: boolean; minAgeYears?: number } = {}
): { valid: boolean; reason?: string } {
  if (typeof dateStr !== 'string') {
    return { valid: false, reason: 'Date must be a string in YYYY-MM-DD format.' };
  }

  const trimmed = dateStr.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!match) {
    return { valid: false, reason: 'Date must be formatted as YYYY-MM-DD.' };
  }

  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);

  if (month < 1 || month > 12) {
    return { valid: false, reason: `Month ${month} is invalid. Month must be between 01 and 12.` };
  }

  // Days in month calculation (accounting for leap years)
  const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const daysInMonth = [0, 31, isLeap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  if (day < 1 || day > daysInMonth[month]) {
    return {
      valid: false,
      reason: `Day ${day} is invalid for month ${month} (year ${year} allows 1-${daysInMonth[month]}).`,
    };
  }

  const parsed = new Date(`${trimmed}T00:00:00.000Z`);
  if (isNaN(parsed.getTime())) {
    return { valid: false, reason: 'Invalid calendar date.' };
  }

  const now = new Date();
  if (!options.allowFuture && parsed > now) {
    return { valid: false, reason: 'Birth date cannot be in the future.' };
  }

  if (year < 1920) {
    return { valid: false, reason: 'Year of birth is outside valid range (must be 1920 or later).' };
  }

  if (options.minAgeYears !== undefined) {
    const ageCutoff = new Date();
    ageCutoff.setFullYear(ageCutoff.getFullYear() - options.minAgeYears);
    if (parsed > ageCutoff) {
      return { valid: false, reason: `Learner must be at least ${options.minAgeYears} years old.` };
    }
  }

  return { valid: true };
}

/**
 * Validates a Philippine mobile contact phone number according to standard carrier specifications (Globe, Smart, DITO).
 * Accept:
 * - 09171234567 (Standard 11-digit mobile)
 * - +639171234567 (International format)
 * - 0917 123 4567 (Formatting spaces only)
 * - 0917-123-4567 (Formatting hyphens only)
 *
 * Reject with exact user-facing messages:
 * - Extra digits: "Mobile number is too long. Enter an 11-digit Philippine mobile number."
 * - Incomplete: "Enter a complete Philippine mobile number."
 * - Letters: "Enter a valid phone number using digits only."
 * - Unsupported pattern: "Enter a valid Philippine mobile number, such as 0917 123 4567."
 */
export function isValidPhoneNumber(phone: unknown): { valid: boolean; reason?: string; normalized?: string } {
  if (phone === null || phone === undefined || phone === '') {
    return { valid: true };
  }
  if (typeof phone !== 'string') {
    return { valid: false, reason: 'Phone number must be a string.' };
  }

  const raw = phone.trim();
  if (raw === '') return { valid: true };

  // 1. Letters check
  if (/[a-zA-Z]/.test(raw)) {
    return { valid: false, reason: 'Enter a valid phone number using digits only.' };
  }

  // 2. Disallowed characters check (only digits, +, spaces, hyphens)
  if (/[^0-9+\s\-]/.test(raw)) {
    return { valid: false, reason: 'Enter a valid phone number using digits only.' };
  }

  // Extract digits
  const cleanDigits = raw.replace(/\D/g, '');

  // 3. International format starting with '+'
  if (raw.startsWith('+')) {
    if (!raw.startsWith('+63')) {
      return { valid: false, reason: 'Enter a valid Philippine mobile number, such as 0917 123 4567.' };
    }
    // Expected digits: 63 followed by 10 digits (639XXXXXXXXX = 12 digits total)
    if (cleanDigits.length > 12) {
      return { valid: false, reason: 'Mobile number is too long. Enter an 11-digit Philippine mobile number.' };
    }
    if (cleanDigits.length < 12) {
      return { valid: false, reason: 'Enter a complete Philippine mobile number.' };
    }
    if (!cleanDigits.startsWith('639')) {
      return { valid: false, reason: 'Enter a valid Philippine mobile number, such as 0917 123 4567.' };
    }
    return { valid: true, normalized: '+' + cleanDigits };
  }

  // 4. Local format starting with '0'
  if (raw.startsWith('0')) {
    if (cleanDigits.length > 11) {
      return { valid: false, reason: 'Mobile number is too long. Enter an 11-digit Philippine mobile number.' };
    }
    if (cleanDigits.length < 11) {
      return { valid: false, reason: 'Enter a complete Philippine mobile number.' };
    }
    if (!cleanDigits.startsWith('09')) {
      return { valid: false, reason: 'Enter a valid Philippine mobile number, such as 0917 123 4567.' };
    }
    return { valid: true, normalized: '+63' + cleanDigits.slice(1) };
  }

  // 5. 10 digits starting with '9' (without leading 0)
  if (cleanDigits.startsWith('9')) {
    if (cleanDigits.length > 10) {
      return { valid: false, reason: 'Mobile number is too long. Enter an 11-digit Philippine mobile number.' };
    }
    if (cleanDigits.length < 10) {
      return { valid: false, reason: 'Enter a complete Philippine mobile number.' };
    }
    return { valid: true, normalized: '+63' + cleanDigits };
  }

  // 6. Fallback length checks for other prefixes
  if (cleanDigits.length > 11) {
    return { valid: false, reason: 'Mobile number is too long. Enter an 11-digit Philippine mobile number.' };
  }
  if (cleanDigits.length < 10) {
    return { valid: false, reason: 'Enter a complete Philippine mobile number.' };
  }

  return { valid: false, reason: 'Enter a valid Philippine mobile number, such as 0917 123 4567.' };
}

/**
 * Normalizes a valid Philippine mobile number into standard E.164 format (+639XXXXXXXXX).
 * Returns null if input is empty or null.
 * Never converts to integer.
 */
export function normalizePhilippinePhone(phone: unknown): string | null {
  if (phone === null || phone === undefined || typeof phone !== 'string') return null;
  const trimmed = phone.trim();
  if (!trimmed) return null;
  const res = isValidPhoneNumber(trimmed);
  if (res.valid && res.normalized) {
    return res.normalized;
  }
  return trimmed;
}

/**
 * Formats a Philippine mobile number for clean display (e.g. 0917 123 4567).
 */
export function formatPhilippinePhoneForDisplay(phone: unknown): string {
  if (!phone || typeof phone !== 'string') return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('639') && digits.length === 12) {
    const p = digits.slice(2);
    return `0${p.slice(0, 3)} ${p.slice(3, 6)} ${p.slice(6)}`;
  }
  if (digits.startsWith('09') && digits.length === 11) {
    return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  }
  return phone;
}

/**
 * Validates a Philippine postal ZIP code.
 * Must consist strictly of 4 numeric digits (e.g. 2000 for San Fernando, Pampanga).
 * Explicitly rejects alphabetic characters.
 */
export function isValidZipCode(zip: unknown): { valid: boolean; reason?: string } {
  if (zip === null || zip === undefined || zip === '') {
    return { valid: true };
  }
  if (typeof zip !== 'string') {
    return { valid: false, reason: 'ZIP code must be a string.' };
  }

  const trimmed = zip.trim();
  if (trimmed === '') return { valid: true };

  // Explicit check for letters
  if (/[a-zA-Z]/.test(trimmed)) {
    return { valid: false, reason: 'ZIP code cannot contain letters. Please enter numbers only.' };
  }

  if (!/^\d{4}$/.test(trimmed)) {
    return { valid: false, reason: 'ZIP code must consist of exactly 4 numeric digits (e.g. 2000).' };
  }

  return { valid: true };
}

// ============================================================================
// REUSABLE ZOD SCHEMAS
// ============================================================================

export const lrnZodSchema = z
  .string({ required_error: 'Learner Reference Number (LRN) is required.' })
  .trim()
  .refine(val => isValidLrn(val), {
    message: 'Student LRN must contain exactly 12 numeric digits.',
  });

export const nameZodSchema = (fieldLabel: string, maxLen = 100) =>
  z
    .string({ required_error: `${fieldLabel} is required.` })
    .trim()
    .min(1, `${fieldLabel} is required.`)
    .max(maxLen, `${fieldLabel} must not exceed ${maxLen} characters.`)
    .refine(val => isValidName(val, maxLen), {
      message: `${fieldLabel} must contain valid letters and name punctuation only (spaces, hyphens, apostrophes).`,
    });

export const optionalNameZodSchema = (fieldLabel: string, maxLen = 100) =>
  z
    .string()
    .trim()
    .max(maxLen, `${fieldLabel} must not exceed ${maxLen} characters.`)
    .refine(val => !val || isValidName(val, maxLen), {
      message: `${fieldLabel} must contain valid letters and name punctuation only (spaces, hyphens, apostrophes).`,
    })
    .optional()
    .nullable()
    .or(z.literal(''));

export const dateOfBirthZodSchema = z
  .string({ required_error: 'Date of birth is required.' })
  .trim()
  .refine(
    val => isValidCalendarDate(val, { allowFuture: false }).valid,
    val => ({
      message: isValidCalendarDate(val, { allowFuture: false }).reason || 'Invalid date of birth.',
    })
  );

export const optionalDateOfBirthZodSchema = z
  .string()
  .trim()
  .refine(
    val => !val || isValidCalendarDate(val, { allowFuture: false }).valid,
    val => ({
      message: isValidCalendarDate(val, { allowFuture: false }).reason || 'Invalid date of birth.',
    })
  )
  .optional()
  .nullable()
  .or(z.literal(''));

export const phoneZodSchema = z
  .string()
  .trim()
  .refine(
    val => isValidPhoneNumber(val).valid,
    val => ({
      message: isValidPhoneNumber(val).reason || 'Invalid contact phone number format.',
    })
  )
  .optional()
  .nullable()
  .or(z.literal(''));

export const zipCodeZodSchema = z
  .string()
  .trim()
  .refine(
    val => isValidZipCode(val).valid,
    val => ({
      message: isValidZipCode(val).reason || 'Invalid ZIP code format.',
    })
  )
  .optional()
  .nullable()
  .or(z.literal(''));

export const genderZodSchema = z.enum(['Male', 'Female'], {
  errorMap: () => ({ message: "Recorded biological sex must be 'Male' or 'Female'." }),
});

export const bloodTypeZodSchema = z
  .enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'], {
    errorMap: () => ({ message: "Blood type must be one of: A+, A-, B+, B-, AB+, AB-, O+, O-." }),
  })
  .optional()
  .nullable()
  .or(z.literal(''));

// ============================================================================
// COMPOSITE ACTION SCHEMAS
// ============================================================================

/**
 * Backend schema for Class Adviser learner registration.
 * Route: POST /api/academic/advisory/sections/:sectionId/register
 * Route: POST /api/academic/advisory/sections/:sectionId/validate-registration
 */
export const registerLearnerBackendSchema = z.object({
  lrn: lrnZodSchema,
  firstName: nameZodSchema('First name'),
  lastName: nameZodSchema('Last name'),
  middleName: optionalNameZodSchema('Middle name'),
  suffix: optionalNameZodSchema('Suffix', 20),
  gender: genderZodSchema,
  dateOfBirth: dateOfBirthZodSchema,
  street: z.string().trim().max(255).optional().nullable().or(z.literal('')),
  city: z.string().trim().max(100).optional().nullable().or(z.literal('')),
  stateProvince: z.string().trim().max(100).optional().nullable().or(z.literal('')),
  zipCode: zipCodeZodSchema,
  guardianFirstName: optionalNameZodSchema('Guardian first name'),
  guardianLastName: optionalNameZodSchema('Guardian last name'),
  guardianRelationship: z.string().trim().max(50).optional().nullable().or(z.literal('')),
  guardianPhone: phoneZodSchema,
  guardianEmail: z.string().trim().email('Guardian email must be a valid email address.').optional().nullable().or(z.literal('')),
  bloodType: bloodTypeZodSchema,
  allergies: z.string().trim().max(500).optional().nullable().or(z.literal('')),
  medicalConditions: z.string().trim().max(500).optional().nullable().or(z.literal('')),
  confirmGuardianContact: z.boolean().optional(),
  guardianConfirmationMethod: z.string().trim().max(100).optional(),
  guardianConfirmationSource: z.string().trim().max(255).optional(),
});

/**
 * Backend schema for Class Adviser learner personal information update.
 * Route: PATCH /api/academic/health/students/:studentId/personal-info
 * Route: PATCH /api/academic/health/students/:studentId/demographics
 */
export const updatePersonalInfoBackendSchema = z.object({
  firstName: nameZodSchema('First name').optional(),
  lastName: nameZodSchema('Last name').optional(),
  middleName: optionalNameZodSchema('Middle name'),
  suffix: optionalNameZodSchema('Suffix', 20),
  dateOfBirth: optionalDateOfBirthZodSchema,
  gender: genderZodSchema.optional(),
  street: z.string().trim().max(255).optional().nullable().or(z.literal('')),
  city: z.string().trim().max(100).optional().nullable().or(z.literal('')),
  stateProvince: z.string().trim().max(100).optional().nullable().or(z.literal('')),
  zipCode: zipCodeZodSchema,
  guardianFirstName: optionalNameZodSchema('Guardian first name'),
  guardianLastName: optionalNameZodSchema('Guardian last name'),
  guardianPhone: phoneZodSchema,
  guardianEmail: z.string().trim().email('Guardian email must be a valid email address.').optional().nullable().or(z.literal('')),
  bloodType: bloodTypeZodSchema,
  allergies: z.string().trim().max(500).optional().nullable().or(z.literal('')),
  medicalConditions: z.string().trim().max(500).optional().nullable().or(z.literal('')),
  confirmGuardianContact: z.boolean().optional(),
  guardianConfirmationMethod: z.string().trim().max(100).optional(),
  guardianConfirmationSource: z.string().trim().max(255).optional(),
});

/**
 * Backend schema for Student profile in Admin User creation.
 * File: backend/src/users/user.service.ts
 */
export const studentProfileUserBackendSchema = z.object({
  studentNumber: z.string().trim().min(1).max(100).optional(),
  lrn: lrnZodSchema,
  gradeLevel: z.number().int().min(7).max(12),
  gender: genderZodSchema.optional(),
  guardianFirstName: optionalNameZodSchema('Guardian first name'),
  guardianLastName: optionalNameZodSchema('Guardian last name'),
  guardianPhone: phoneZodSchema,
  guardianEmail: z.string().trim().email('Guardian email must be a valid email address.').optional().nullable().or(z.literal('')),
  street: z.string().trim().max(255).optional().nullable().or(z.literal('')),
  city: z.string().trim().max(100).optional().nullable().or(z.literal('')),
  stateProvince: z.string().trim().max(100).optional().nullable().or(z.literal('')),
  zipCode: zipCodeZodSchema,
});

