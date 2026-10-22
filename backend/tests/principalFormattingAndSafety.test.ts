import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { humanizeValue, sanitizeNarrativeEnums } from '../../src/app/principal/ai/utils/humanizeValue.js';
import { getStatusStyle } from '../../src/app/principal/ai/components/StatusBadge.js';
import { formatAiDate, formatDateRange } from '../../src/app/principal/ai/utils/formatAiDate.js';

describe('DIGISKWELA — PRINCIPAL AI GLOBAL FORMATTING, VALUE HUMANIZATION & SAFETY', () => {
  // ─── 1. GLOBAL HUMAN-READABLE VALUE FORMATTER ──────────────────────────────
  describe('Global Human-Readable Value Formatter (humanizeValue)', () => {
    it('TC-HUMAN-01: Correctly transforms required status and enum examples', () => {
      expect(humanizeValue('partial_terms')).toBe('Partial terms');
      expect(humanizeValue('TIME_OUT_PENDING')).toBe('Time-out pending');
      expect(humanizeValue('ON_APPROVED_LEAVE')).toBe('On approved leave');
      expect(humanizeValue('NO_GATE_CHECK_IN_NO_APPROVED_LEAVE_FOUND')).toBe(
        'No gate check-in / no approved leave found'
      );
    });

    it('TC-HUMAN-02: Humanizes generalized CONSTANT_CASE and snake_case tokens', () => {
      expect(humanizeValue('UNDER_INVESTIGATION')).toBe('Under investigation');
      expect(humanizeValue('PARENT_NOTIFIED')).toBe('Parent notified');
      expect(humanizeValue('ANNUAL_PASS_RATE')).toBe('Annual pass rate');
      expect(humanizeValue('complete_annual_evaluation')).toBe('Complete annual evaluation');
      expect(humanizeValue('all_terms_completed')).toBe('All terms completed');
      expect(humanizeValue('days_count')).toBe('Days count');
    });

    it('TC-HUMAN-03: Leaves standard plain English words untouched', () => {
      expect(humanizeValue('Approved')).toBe('Approved');
      expect(humanizeValue('Completed')).toBe('Completed');
      expect(humanizeValue('Faculty Member')).toBe('Faculty Member');
    });
  });

  // ─── 2. NARRATIVE ENUM SANITIZATION ────────────────────────────────────────
  describe('Narrative Enum Sanitization (sanitizeNarrativeEnums)', () => {
    it('TC-HUMAN-04: Replaces embedded enums in conversational AI text', () => {
      const rawText = 'There are 2 teachers in TIME_OUT_PENDING status and grading status is partial_terms.';
      const clean = sanitizeNarrativeEnums(rawText);
      expect(clean).toBe('There are 2 teachers in Time-out pending status and grading status is Partial terms.');
      expect(clean).not.toContain('TIME_OUT_PENDING');
      expect(clean).not.toContain('partial_terms');
    });

    it('TC-HUMAN-05: Replaces gate check-in multi-word token inside text', () => {
      const rawText = 'Status recorded: NO_GATE_CHECK_IN_NO_APPROVED_LEAVE_FOUND for 3 faculty members.';
      const clean = sanitizeNarrativeEnums(rawText);
      expect(clean).toBe('Status recorded: No gate check-in / no approved leave found for 3 faculty members.');
    });
  });

  // ─── 3. STATUS BADGE PRESENTATION ──────────────────────────────────────────
  describe('StatusBadge Formatter', () => {
    it('TC-BADGE-01: Uses humanized labels for gate, leave, and academic badges', () => {
      const leave = getStatusStyle('ON_APPROVED_LEAVE');
      expect(leave.label).toBe('On approved leave');

      const gate = getStatusStyle('NO_GATE_CHECK_IN_NO_APPROVED_LEAVE_FOUND');
      expect(gate.label).toBe('No gate check-in / no approved leave found');

      const pending = getStatusStyle('TIME_OUT_PENDING');
      expect(pending.label).toBe('Time-out pending');
    });
  });

  // ─── 4. GLOBAL RESPONSE FORMATTING & XSS DEFENSE ───────────────────────────
  describe('Safe Markdown Renderer Contracts & Untrusted Model Output Defense', () => {
    const safeRendererSource = fs.readFileSync(
      path.resolve(__dirname, '../../src/app/principal/ai/components/SafeMarkdownRenderer.tsx'),
      'utf-8'
    );

    it('TC-SEC-01: Zero dangerouslySetInnerHTML or raw HTML execution', () => {
      expect(safeRendererSource).not.toContain('dangerouslySetInnerHTML');
      expect(safeRendererSource).not.toContain('innerHTML');
      expect(safeRendererSource).not.toContain('<script');
      expect(safeRendererSource).not.toContain('<iframe');
      expect(safeRendererSource).not.toContain('eval(');
    });

    it('TC-SEC-02: Strips escaped markdown artifacts and cleans separator lines', () => {
      expect(safeRendererSource).toContain("sanitized.replace(/\\\\([*#_`[\\]()\\-+!|])/g, '$1')");
      expect(safeRendererSource).toContain('/^\\\\?[-*_]{3,}$/');
    });

    it('TC-SEC-03: Suppresses redundant Markdown tables when structured data is present (Deduplication)', () => {
      expect(safeRendererSource).toContain('hasStructuredData = false');
      expect(safeRendererSource).toContain('if (hasStructuredData) {');
      expect(safeRendererSource).toContain('continue;');
    });

    it('TC-SEC-04: AssistantMessageItem wires hasStructuredData to SafeMarkdownRenderer', () => {
      const assistantItemSource = fs.readFileSync(
        path.resolve(__dirname, '../../src/app/principal/ai/components/AssistantMessageItem.tsx'),
        'utf-8'
      );
      expect(assistantItemSource).toContain('hasStructuredData={Boolean(message.structuredData)}');
    });
  });

  // ─── 5. SEMANTIC SAFETY & GROQ PROMPT GUIDANCE ─────────────────────────────
  describe('Semantic Safety & Neutral Language Invariants', () => {
    const groqProviderSource = fs.readFileSync(
      path.resolve(__dirname, '../src/ai/provider/groqAIProvider.ts'),
      'utf-8'
    );

    it('TC-SAFE-01: Prohibits unsupported inferences of lateness, absence, AWOL, undertime', () => {
      expect(groqProviderSource).toContain('NEUTRAL ATTENDANCE SEMANTICS:');
      expect(groqProviderSource).toContain('Never convert gate presence data into: "Late", "Tardy", "Undertime", "Absent", "Unexcused Absence", or "AWOL"');
      expect(groqProviderSource).toContain('No gate check-in recorded today and no approved leave record was found');
      expect(groqProviderSource).toContain('Never say "absent"');
    });

    it('TC-SAFE-02: Prohibits disciplinary recommendations, parent contact mandates, and referral directives', () => {
      expect(groqProviderSource).toContain('ADMINISTRATIVE & DISCIPLINARY SAFETY:');
      expect(groqProviderSource).toContain('Disciplinary actions or punitive consequences');
      expect(groqProviderSource).toContain('Mandatory parent contact requirements');
      expect(groqProviderSource).toContain('Mandatory guidance counseling referrals');
      expect(groqProviderSource).toContain('Leave approval or denial decisions');
    });

    it('TC-SAFE-03: Enforces academic completeness rules for annual promotion metrics', () => {
      expect(groqProviderSource).toContain('ACADEMIC COMPLETENESS SEMANTICS:');
      expect(groqProviderSource).toContain('The annual pass rate requires complete verified grades for all four terms (T1, T2, T3, T4)');
      expect(groqProviderSource).toContain('partial_terms');
    });

    it('TC-SAFE-04: Guides model against raw enums, separators, and repeating structured data', () => {
      expect(groqProviderSource).toContain('Avoid raw enum identifiers');
      expect(groqProviderSource).toContain('Avoid unnecessary separators like "---" or "***"');
      expect(groqProviderSource).toContain('Avoid repeating structured data verbatim in your narrative text');
      expect(groqProviderSource).toContain('AVOID generating wide Markdown tables with multiple columns');
    });

    it('TC-SAFE-05: Enforces brief natural social replies and eliminates canned closings and excessive em dashes', () => {
      expect(groqProviderSource).toContain('CONVERSATIONAL STYLE, PUNCTUATION & CLOSINGS:');
      expect(groqProviderSource).toContain('Respond naturally and briefly (e.g., "You’re welcome." or "Glad I could help.")');
      expect(groqProviderSource).toContain('Do NOT automatically append:');
      expect(groqProviderSource).toContain('"If you need anything else..."');
      expect(groqProviderSource).toContain('"Just let me know."');
      expect(groqProviderSource).toContain('Lists of DigiSkwela features or modules');
      expect(groqProviderSource).toContain('Avoid canned chatbot closings');
      expect(groqProviderSource).toContain('Em dash rule: Avoid excessive use of em dashes (—)');
    });
  });

  // ─── 6. STRUCTURED DATA RENDERER CENTRALIZED HUMANIZATION ──────────────────
  describe('Structured Data Renderer Humanization', () => {
    const structuredRendererSource = fs.readFileSync(
      path.resolve(__dirname, '../../src/app/principal/ai/components/StructuredDataRenderer.tsx'),
      'utf-8'
    );

    it('TC-STRUCT-01: Imports and applies humanizeValue across completeness status and categories', () => {
      expect(structuredRendererSource).toContain("import { humanizeValue } from '../utils/humanizeValue.js'");
      expect(structuredRendererSource).toContain('humanizeValue(raw.academics.completenessStatus)');
      expect(structuredRendererSource).toContain('humanizeValue(raw.completenessStatus)');
      expect(structuredRendererSource).toContain('humanizeValue(acad.completenessStatus)');
      expect(structuredRendererSource).toContain('humanizeValue(p.category)');
    });
  });
});
