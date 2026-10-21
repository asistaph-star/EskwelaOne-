/**
 * DigiSkwela Data Minimization & Sensitive Redaction Engine
 * 
 * Enforces the permanent architectural rule:
 * DATABASE RECORD -> DOMAIN SERVICE -> DATA MINIMIZATION -> AI TOOL RESULT -> PROVIDER
 * 
 * Strips prohibited fields before tool results reach the AI provider layer.
 */

// Critical sensitive fields that must NEVER enter any AI tool payload
const HARD_PROHIBITED_KEYS = new Set([
  // Authentication & Security
  'password', 'password_hash', 'passwordhash', 'token', 'jwt', 'secret', 'apikey', 'accesskey', 'secretkey',
  
  // Clinical / Medical (Strict Nurse Human UI Isolation)
  'diagnosis', 'medications', 'symptoms', 'treatments', 'blood_pressure', 'heart_rate',
  
  // Guidance Counseling Disclosures
  'counseling_notes', 'action_taken',
  
  // Direct PII Contact Details (Unless specifically authorized for human review draft)
  'guardian_phone', 'guardian_email', 'home_address', 'phone_number',
]);

/**
 * Deeply sanitizes and minimizes an object or array before returning to the AI provider.
 */
export function minimizePayload<T = any>(data: T): T {
  if (data === null || data === undefined) {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(item => minimizePayload(item)) as any;
  }

  if (typeof data === 'object') {
    const cleaned: Record<string, any> = {};

    for (const [key, value] of Object.entries(data)) {
      const lowerKey = key.toLowerCase();

      // Check against hard-prohibited sensitive keys
      if (HARD_PROHIBITED_KEYS.has(lowerKey) || lowerKey.includes('password') || lowerKey.includes('secret')) {
        continue; // Exclude completely
      }

      // Mask sensitive identifiers if present
      if (lowerKey === 'lrn' && typeof value === 'string' && value.length >= 8) {
        cleaned[key] = `***...${value.slice(-4)}`;
        continue;
      }

      // Recursively minimize nested objects
      if (typeof value === 'object' && value !== null) {
        cleaned[key] = minimizePayload(value);
      } else {
        cleaned[key] = value;
      }
    }

    return cleaned as T;
  }

  return data;
}
