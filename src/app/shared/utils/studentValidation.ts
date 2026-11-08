/**
 * DigiSkwela — Student Information Frontend Validation Utilities
 * Module: src/app/shared/utils/studentValidation.ts
 *
 * Provides real-time field validation, accessible error messages, and form-level checks
 * matching backend authoritative rules for Calulut Integrated School:
 * - Exactly 12-digit numeric LRN (leading zeros preserved, letters/symbols rejected)
 * - Names (allows letters, spaces, hyphens, apostrophes, accents/ñ; rejects numbers/code)
 * - Real calendar dates (rejects impossible days e.g. Feb 31, rejects future dates)
 * - Strict numeric validation for phone numbers and postal ZIP codes (rejects letters)
 * - Biological sex enum ('Male' | 'Female')
 */

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export interface FormValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

// ============================================================================
// FIELD-SPECIFIC VALIDATORS
// ============================================================================

export function validateLrn(lrn: string): ValidationResult {
  const trimmed = (lrn || '').trim();
  if (!trimmed) {
    return { valid: false, error: 'Learner Reference Number (LRN) is required.' };
  }
  if (/[a-zA-Z]/.test(trimmed)) {
    return { valid: false, error: 'Student LRN cannot contain letters. Please enter numbers only.' };
  }
  if (!/^\d+$/.test(trimmed)) {
    return { valid: false, error: 'Student LRN cannot contain symbols or spaces. Enter digits only.' };
  }
  if (trimmed.length !== 12) {
    return { valid: false, error: `Student LRN must contain exactly 12 digits (currently ${trimmed.length}).` };
  }
  return { valid: true };
}

export function validateName(name: string, fieldLabel: string, required = false, maxLen = 100): ValidationResult {
  const trimmed = (name || '').trim();
  if (!trimmed) {
    if (required) {
      return { valid: false, error: `${fieldLabel} is required.` };
    }
    return { valid: true };
  }

  if (trimmed.length > maxLen) {
    return { valid: false, error: `${fieldLabel} must not exceed ${maxLen} characters.` };
  }

  if (/\d/.test(trimmed)) {
    return { valid: false, error: `${fieldLabel} cannot contain numeric numbers. Please enter letters only.` };
  }

  if (/[<>{}\\]/.test(trimmed)) {
    return { valid: false, error: `${fieldLabel} contains invalid characters.` };
  }

  // Support Filipino names, spaces, hyphens, periods, apostrophes, and accented characters (ñ, etc.)
  if (!/^[a-zA-Z\u00C0-\u024F\u1E00-\u1EFF\s'\-\.]+$/.test(trimmed)) {
    return { valid: false, error: `${fieldLabel} contains invalid symbols. Only letters, hyphens, spaces, and apostrophes are allowed.` };
  }

  if (!/[a-zA-Z\u00C0-\u024F\u1E00-\u1EFF]/.test(trimmed)) {
    return { valid: false, error: `${fieldLabel} must contain at least one letter.` };
  }

  return { valid: true };
}

export function validateDateOfBirth(dateStr: string, required = true): ValidationResult {
  const trimmed = (dateStr || '').trim();
  if (!trimmed) {
    if (required) {
      return { valid: false, error: 'Date of birth is required.' };
    }
    return { valid: true };
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!match) {
    return { valid: false, error: 'Date of birth must be in YYYY-MM-DD format.' };
  }

  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);

  if (month < 1 || month > 12) {
    return { valid: false, error: `Month ${month} is invalid. Month must be between 01 and 12.` };
  }

  const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const daysInMonth = [0, 31, isLeap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const maxDay = daysInMonth[month];

  if (day < 1 || day > maxDay) {
    return { valid: false, error: `Day ${day} is invalid for month ${month} (maximum is ${maxDay} days).` };
  }

  const parsed = new Date(`${trimmed}T00:00:00.000Z`);
  if (isNaN(parsed.getTime())) {
    return { valid: false, error: 'Invalid calendar date.' };
  }

  const now = new Date();
  if (parsed > now) {
    return { valid: false, error: 'Birth date cannot be in the future.' };
  }

  if (year < 1920) {
    return { valid: false, error: 'Year of birth must be 1920 or later.' };
  }

  return { valid: true };
}

export function validatePhone(phone: string, required = false): ValidationResult & { normalized?: string } {
  const trimmed = (phone || '').trim();
  if (!trimmed) {
    if (required) {
      return { valid: false, error: 'Contact phone number is required.' };
    }
    return { valid: true };
  }

  // 1. Letters check
  if (/[a-zA-Z]/.test(trimmed)) {
    return { valid: false, error: 'Enter a valid phone number using digits only.' };
  }

  // 2. Disallowed symbols check (only digits, +, spaces, hyphens)
  if (/[^0-9+\s\-]/.test(trimmed)) {
    return { valid: false, error: 'Enter a valid phone number using digits only.' };
  }

  // Extract clean digits
  const cleanDigits = trimmed.replace(/\D/g, '');

  // 3. International format starting with '+'
  if (trimmed.startsWith('+')) {
    if (!trimmed.startsWith('+63')) {
      return { valid: false, error: 'Enter a valid Philippine mobile number, such as 0917 123 4567.' };
    }
    if (cleanDigits.length > 12) {
      return { valid: false, error: 'Mobile number is too long. Enter an 11-digit Philippine mobile number.' };
    }
    if (cleanDigits.length < 12) {
      return { valid: false, error: 'Enter a complete Philippine mobile number.' };
    }
    if (!cleanDigits.startsWith('639')) {
      return { valid: false, error: 'Enter a valid Philippine mobile number, such as 0917 123 4567.' };
    }
    return { valid: true, normalized: '+' + cleanDigits };
  }

  // 4. Local format starting with '0'
  if (trimmed.startsWith('0')) {
    if (cleanDigits.length > 11) {
      return { valid: false, error: 'Mobile number is too long. Enter an 11-digit Philippine mobile number.' };
    }
    if (cleanDigits.length < 11) {
      return { valid: false, error: 'Enter a complete Philippine mobile number.' };
    }
    if (!cleanDigits.startsWith('09')) {
      return { valid: false, error: 'Enter a valid Philippine mobile number, such as 0917 123 4567.' };
    }
    return { valid: true, normalized: '+63' + cleanDigits.slice(1) };
  }

  // 5. 10 digits starting with '9'
  if (cleanDigits.startsWith('9')) {
    if (cleanDigits.length > 10) {
      return { valid: false, error: 'Mobile number is too long. Enter an 11-digit Philippine mobile number.' };
    }
    if (cleanDigits.length < 10) {
      return { valid: false, error: 'Enter a complete Philippine mobile number.' };
    }
    return { valid: true, normalized: '+63' + cleanDigits };
  }

  // 6. Length fallbacks
  if (cleanDigits.length > 11) {
    return { valid: false, error: 'Mobile number is too long. Enter an 11-digit Philippine mobile number.' };
  }
  if (cleanDigits.length < 10) {
    return { valid: false, error: 'Enter a complete Philippine mobile number.' };
  }

  return { valid: false, error: 'Enter a valid Philippine mobile number, such as 0917 123 4567.' };
}

export function normalizePhilippinePhone(phone?: string | null): string | null {
  if (!phone || typeof phone !== 'string') return null;
  const trimmed = phone.trim();
  if (!trimmed) return null;
  const res = validatePhone(trimmed);
  if (res.valid && res.normalized) {
    return res.normalized;
  }
  return trimmed;
}

export function formatPhilippinePhoneForDisplay(phone?: string | null): string {
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

export function validateZipCode(zip: string, required = false): ValidationResult {
  const trimmed = (zip || '').trim();
  if (!trimmed) {
    if (required) {
      return { valid: false, error: 'ZIP code is required.' };
    }
    return { valid: true };
  }

  // Explicit check for letters
  if (/[a-zA-Z]/.test(trimmed)) {
    return { valid: false, error: 'ZIP code cannot contain letters. Please enter numbers only.' };
  }

  if (!/^\d{4}$/.test(trimmed)) {
    return { valid: false, error: 'ZIP code must consist of exactly 4 numeric digits (e.g. 2000 for San Fernando).' };
  }

  return { valid: true };
}

export function validateEmail(email: string, required = false): ValidationResult {
  const trimmed = (email || '').trim();
  if (!trimmed) {
    if (required) {
      return { valid: false, error: 'Email address is required.' };
    }
    return { valid: true };
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return { valid: false, error: 'Please enter a valid email address (e.g. parent@example.com).' };
  }

  return { valid: true };
}

export function validateGender(gender: string): ValidationResult {
  if (gender !== 'Male' && gender !== 'Female') {
    return { valid: false, error: "Recorded biological sex must be 'Male' or 'Female'." };
  }
  return { valid: true };
}

export function validateBloodType(bloodType: string): ValidationResult {
  const trimmed = (bloodType || '').trim();
  if (!trimmed) return { valid: true };
  const allowed = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
  if (!allowed.includes(trimmed.toUpperCase())) {
    return { valid: false, error: 'Blood type must be one of: A+, A-, B+, B-, AB+, AB-, O+, O-.' };
  }
  return { valid: true };
}

// ============================================================================
// COMPOSITE FORM VALIDATORS
// ============================================================================

/**
 * Validates the full New Learner Registration form in AdviserAddLearnerModal.
 */
export function validateStudentRegistrationForm(data: {
  lrn: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  suffix?: string;
  dateOfBirth: string;
  gender: string;
  guardianFirstName?: string;
  guardianLastName?: string;
  guardianPhone?: string;
  guardianEmail?: string;
  zipCode?: string;
}): FormValidationResult {
  const errors: Record<string, string> = {};

  const lrnCheck = validateLrn(data.lrn);
  if (!lrnCheck.valid && lrnCheck.error) errors.lrn = lrnCheck.error;

  const fnCheck = validateName(data.firstName, 'First name', true);
  if (!fnCheck.valid && fnCheck.error) errors.firstName = fnCheck.error;

  const lnCheck = validateName(data.lastName, 'Last name', true);
  if (!lnCheck.valid && lnCheck.error) errors.lastName = lnCheck.error;

  if (data.middleName) {
    const mnCheck = validateName(data.middleName, 'Middle name', false);
    if (!mnCheck.valid && mnCheck.error) errors.middleName = mnCheck.error;
  }

  if (data.suffix) {
    const sfxCheck = validateName(data.suffix, 'Suffix', false, 20);
    if (!sfxCheck.valid && sfxCheck.error) errors.suffix = sfxCheck.error;
  }

  const dobCheck = validateDateOfBirth(data.dateOfBirth, true);
  if (!dobCheck.valid && dobCheck.error) errors.dateOfBirth = dobCheck.error;

  const genderCheck = validateGender(data.gender);
  if (!genderCheck.valid && genderCheck.error) errors.gender = genderCheck.error;

  if (data.guardianFirstName) {
    const gfnCheck = validateName(data.guardianFirstName, 'Guardian first name', false);
    if (!gfnCheck.valid && gfnCheck.error) errors.guardianFirstName = gfnCheck.error;
  }

  if (data.guardianLastName) {
    const glnCheck = validateName(data.guardianLastName, 'Guardian last name', false);
    if (!glnCheck.valid && glnCheck.error) errors.guardianLastName = glnCheck.error;
  }

  if (data.guardianPhone) {
    const phoneCheck = validatePhone(data.guardianPhone, false);
    if (!phoneCheck.valid && phoneCheck.error) errors.guardianPhone = phoneCheck.error;
  }

  if (data.guardianEmail) {
    const emailCheck = validateEmail(data.guardianEmail, false);
    if (!emailCheck.valid && emailCheck.error) errors.guardianEmail = emailCheck.error;
  }

  if (data.zipCode) {
    const zipCheck = validateZipCode(data.zipCode, false);
    if (!zipCheck.valid && zipCheck.error) errors.zipCode = zipCheck.error;
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Validates the Personal Information Edit form in LearnerProfileModal.
 */
export function validateLearnerPersonalInfoForm(data: {
  firstName?: string;
  lastName?: string;
  middleName?: string;
  suffix?: string;
  dateOfBirth?: string;
  gender?: string;
  guardianFirstName?: string;
  guardianLastName?: string;
  guardianPhone?: string;
  guardianEmail?: string;
  zipCode?: string;
  bloodType?: string;
}): FormValidationResult {
  const errors: Record<string, string> = {};

  if (data.firstName !== undefined) {
    const fnCheck = validateName(data.firstName, 'First name', true);
    if (!fnCheck.valid && fnCheck.error) errors.firstName = fnCheck.error;
  }

  if (data.lastName !== undefined) {
    const lnCheck = validateName(data.lastName, 'Last name', true);
    if (!lnCheck.valid && lnCheck.error) errors.lastName = lnCheck.error;
  }

  if (data.middleName) {
    const mnCheck = validateName(data.middleName, 'Middle name', false);
    if (!mnCheck.valid && mnCheck.error) errors.middleName = mnCheck.error;
  }

  if (data.suffix) {
    const sfxCheck = validateName(data.suffix, 'Suffix', false, 20);
    if (!sfxCheck.valid && sfxCheck.error) errors.suffix = sfxCheck.error;
  }

  if (data.dateOfBirth) {
    const dobCheck = validateDateOfBirth(data.dateOfBirth, false);
    if (!dobCheck.valid && dobCheck.error) errors.dateOfBirth = dobCheck.error;
  }

  if (data.gender) {
    const genderCheck = validateGender(data.gender);
    if (!genderCheck.valid && genderCheck.error) errors.gender = genderCheck.error;
  }

  if (data.guardianFirstName) {
    const gfnCheck = validateName(data.guardianFirstName, 'Guardian first name', false);
    if (!gfnCheck.valid && gfnCheck.error) errors.guardianFirstName = gfnCheck.error;
  }

  if (data.guardianLastName) {
    const glnCheck = validateName(data.guardianLastName, 'Guardian last name', false);
    if (!glnCheck.valid && glnCheck.error) errors.guardianLastName = glnCheck.error;
  }

  if (data.guardianPhone) {
    const phoneCheck = validatePhone(data.guardianPhone, false);
    if (!phoneCheck.valid && phoneCheck.error) errors.guardianPhone = phoneCheck.error;
  }

  if (data.guardianEmail) {
    const emailCheck = validateEmail(data.guardianEmail, false);
    if (!emailCheck.valid && emailCheck.error) errors.guardianEmail = emailCheck.error;
  }

  if (data.zipCode) {
    const zipCheck = validateZipCode(data.zipCode, false);
    if (!zipCheck.valid && zipCheck.error) errors.zipCode = zipCheck.error;
  }

  if (data.bloodType) {
    const btCheck = validateBloodType(data.bloodType);
    if (!btCheck.valid && btCheck.error) errors.bloodType = btCheck.error;
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

