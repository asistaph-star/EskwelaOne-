/**
 * DigiSkwela Server-Side AI Scope Guard
 * 
 * Enforces institutional boundaries before any LLM execution or tool dispatch.
 * Does NOT rely on future model obedience; evaluated deterministically on the server.
 */

export interface ScopeEvaluationResult {
  allowed: boolean;
  reason?: 'ALLOWED' | 'OUT_OF_SCOPE_CODING' | 'OUT_OF_SCOPE_SYSTEM_BUILDING' | 'OUT_OF_SCOPE_SECURITY_BYPASS' | 'OUT_OF_SCOPE_GENERAL';
  userMessage?: string;
}

// Patterns that must be rejected deterministically
const FORBIDDEN_CODING_PATTERNS = [
  /\bwrite\s+(python|javascript|typescript|java|c\+\+|c#|php|ruby|rust|go|sql|bash|powershell|code|script)\b/i,
  /\b(create|build|generate)\s+a\s+(script|function|program|class|algorithm|database|website|app|application|payroll)\b/i,
  /\b(write|generate)\s+(a\s+)?(website|web\s*page|html|css|react\s+component)\b/i,
  /\b(coding|programming|software\s+development)\b/i,
  /\bselect\s+\*\s+from\b/i,
  /\b(drop\s+table|delete\s+from|insert\s+into|update\s+\w+\s+set)\b/i,
];

const FORBIDDEN_SECURITY_PATTERNS = [
  /\bignore\s+(all\s+)?(previous|prior|system)\s+(instructions|rules|prompts|guidelines)\b/i,
  /\bbypass\s+(security|auth|authorization|rbac|permissions)\b/i,
  /\b(you\s+are\s+now|become)\s+(a\s+programmer|unrestricted|dan|jailbreak|root|admin)\b/i,
  /\b(dump|leak|print|show)\s+(passwords?|hashes|credentials|api\s*keys?|secrets?)\b/i,
  /\b(run|execute)\s+(shell|bash|cmd|powershell|terminal|command)\b/i,
];

const FORBIDDEN_SYSTEM_BUILDING_PATTERNS = [
  /\bbuild\s+(another|a\s+new)\s+(school\s+system|management\s+system|lms|portal)\b/i,
  /\bcreate\s+(a\s+)?payroll\s+(system|application|software)\b/i,
];

export function evaluateScope(promptText: string): ScopeEvaluationResult {
  const normalized = promptText.trim();

  // 1. Check for prompt injection / security bypass attempts
  for (const pattern of FORBIDDEN_SECURITY_PATTERNS) {
    if (pattern.test(normalized)) {
      return {
        allowed: false,
        reason: 'OUT_OF_SCOPE_SECURITY_BYPASS',
        userMessage: 'Security override or credential requests are strictly prohibited by DigiSkwela institutional policy.'
      };
    }
  }

  // 2. Check for external application building
  for (const pattern of FORBIDDEN_SYSTEM_BUILDING_PATTERNS) {
    if (pattern.test(normalized)) {
      return {
        allowed: false,
        reason: 'OUT_OF_SCOPE_SYSTEM_BUILDING',
        userMessage: 'Requests to build external software systems or payroll applications are outside DigiSkwela school operations.'
      };
    }
  }

  // 3. Check for coding / programming requests
  for (const pattern of FORBIDDEN_CODING_PATTERNS) {
    if (pattern.test(normalized)) {
      return {
        allowed: false,
        reason: 'OUT_OF_SCOPE_CODING',
        userMessage: 'DigiSkwela AI is an administrative school assistant and cannot write code, generate programming scripts, or execute database commands.'
      };
    }
  }

  return { allowed: true, reason: 'ALLOWED' };
}
