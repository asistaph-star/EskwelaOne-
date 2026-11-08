/**
 * Data Privacy & Masking Utilities for DigiSkwela
 * Compliant with Philippine Data Privacy Act of 2012 (RA 10173)
 */

/**
 * Masks an email address for safe logging, diagnostics, and monitoring screens.
 * Example: 'juan.delacruz@gmail.com' -> 'j***z@gmail.com'
 * Example: 'ab@test.com' -> 'a***b@test.com'
 */
export function maskEmail(email: string | null | undefined): string {
  if (!email || typeof email !== 'string') return '[NO_EMAIL]';
  const trimmed = email.trim();
  const atIdx = trimmed.indexOf('@');
  if (atIdx <= 0) return '***';

  const userPart = trimmed.substring(0, atIdx);
  const domainPart = trimmed.substring(atIdx);

  if (userPart.length <= 2) {
    return `${userPart[0]}***${domainPart}`;
  }

  const firstChar = userPart[0];
  const lastChar = userPart[userPart.length - 1];
  return `${firstChar}***${lastChar}${domainPart}`;
}

/**
 * Masks a student or guardian name for public/administrative diagnostic logs.
 * Example: 'Juan Dela Cruz' -> 'J*** D*** C***'
 */
export function maskName(name: string | null | undefined): string {
  if (!name || typeof name !== 'string') return '[ANONYMOUS]';
  const parts = name.trim().split(/\s+/);
  return parts
    .map(p => {
      if (p.length <= 1) return p;
      return `${p[0]}***`;
    })
    .join(' ');
}

/**
 * Masks a 12-digit DepEd Learner Reference Number (LRN).
 * Example: '999026000013' -> '999******013'
 */
export function maskLrn(lrn: string | null | undefined): string {
  if (!lrn || typeof lrn !== 'string') return '[NO_LRN]';
  const trimmed = lrn.trim();
  if (trimmed.length < 6) return '******';
  return `${trimmed.substring(0, 3)}******${trimmed.substring(trimmed.length - 3)}`;
}

