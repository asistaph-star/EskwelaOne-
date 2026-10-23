import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('DIGISKWELA — CLIENT-SIDE ERROR MAPPING CONTRACT (A3)', () => {
  const assistantSourcePath = path.resolve(
    __dirname,
    '../../src/app/principal/ai/PrincipalAIAssistant.tsx'
  );
  const sourceCode = fs.readFileSync(assistantSourcePath, 'utf-8');

  it('TC-ERR-01: Never displays raw err.message string directly in the UI message bubble', () => {
    // The previous dangerous fallback was:
    // } else if (err.message) { errorMessage = err.message; }
    // which printed raw "Failed to fetch" into the UI.
    expect(sourceCode).not.toMatch(/else\s+if\s*\(\s*err\.message\s*\)\s*{\s*errorMessage\s*=\s*err\.message\s*;\s*}/);
  });

  it('TC-ERR-02: Intercepts TypeError and network failures, mapping them to SERVER_UNREACHABLE with a friendly message', () => {
    expect(sourceCode).toContain('SERVER_UNREACHABLE');
    expect(sourceCode).toContain('Server is currently unreachable. Please check your network connection and try again.');
  });

  it('TC-ERR-03: Maps 429 and rate limit codes to RATE_LIMITED with user-friendly guidance', () => {
    expect(sourceCode).toContain('RATE_LIMIT_EXCEEDED');
    expect(sourceCode).toContain('DAILY_LIMIT_EXCEEDED');
    expect(sourceCode).toContain('RATE_LIMITED');
    expect(sourceCode).toContain('Too many requests. Please wait a moment and try again.');
  });

  it('TC-ERR-04: Maps provider outages and unknown errors to generic safe availability message', () => {
    expect(sourceCode).toContain('PROVIDER_UNAVAILABLE');
    expect(sourceCode).toContain('DigiSkwela AI is temporarily unavailable. Please try again later.');
  });
});
