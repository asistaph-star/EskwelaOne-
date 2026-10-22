import { describe, it, expect } from 'vitest';
import { formatAiDate, formatDateRange, isIsoDateOnly, isIsoDateTime } from '../../src/app/principal/ai/utils/formatAiDate.js';
import { getStatusStyle } from '../../src/app/principal/ai/components/StatusBadge.js';
import fs from 'fs';
import path from 'path';

describe('DIGISKWELA — RESPONSIVE AI STRUCTURED RESPONSE RENDERING CONTRACTS', () => {
  // ─── 1. WIDE STRUCTURED DATA -> STACKED CARDS CONTRACT ─────────────────────
  it('TC-RESP-01: Wide tables with >3 columns are configured for stacked card presentation', () => {
    const adaptiveTableCode = fs.readFileSync(
      path.resolve(__dirname, '../../src/app/principal/ai/components/AdaptiveMarkdownTable.tsx'),
      'utf-8'
    );

    // Verify condition: headerRow.length > 3 switches to cards view by default
    expect(adaptiveTableCode).toContain('const isWide = headerRow.length > 3');
    expect(adaptiveTableCode).toContain("useState<'cards' | 'table'>(isWide ? 'cards' : 'table')");
    expect(adaptiveTableCode).toContain('ai-stacked-cards-container');
    expect(adaptiveTableCode).toContain('stacked-record-card-');
  });

  it('TC-RESP-02: StructuredDataRenderer uses stacked LeaveRecordCard for multi-field leave requests', () => {
    const structuredRendererCode = fs.readFileSync(
      path.resolve(__dirname, '../../src/app/principal/ai/components/StructuredDataRenderer.tsx'),
      'utf-8'
    );

    // Verify LeaveRecordCard implementation
    expect(structuredRendererCode).toContain('function LeaveRecordCard');
    expect(structuredRendererCode).toContain('Leave Request');
    expect(structuredRendererCode).toContain('applicantDisplayName');
    expect(structuredRendererCode).toContain('leaveType');
    expect(structuredRendererCode).toContain('formatDateRange');
  });

  // ─── 2. NARROW SIMPLE TABLE CONTRACT ───────────────────────────────────────
  it('TC-RESP-03: Small simple tables (<=3 columns) remain clean compact tables without squeezing', () => {
    const adaptiveTableCode = fs.readFileSync(
      path.resolve(__dirname, '../../src/app/principal/ai/components/AdaptiveMarkdownTable.tsx'),
      'utf-8'
    );

    // Small tables render directly as ai-table-container
    expect(adaptiveTableCode).toContain('ai-table-container');
    expect(adaptiveTableCode).toContain('minWidth: minTableWidth');
    expect(adaptiveTableCode).toContain("whiteSpace: 'nowrap'");
  });

  // ─── 3. UNEXPECTED WIDE MARKDOWN TABLE FALLBACK CONTRACT ───────────────────
  it('TC-RESP-04: Unexpected wide Markdown tables provide safe horizontal-scroll fallback with minimum width', () => {
    const adaptiveTableCode = fs.readFileSync(
      path.resolve(__dirname, '../../src/app/principal/ai/components/AdaptiveMarkdownTable.tsx'),
      'utf-8'
    );

    // Rule C: Min table width ensures columns never collapse into vertical letters
    expect(adaptiveTableCode).toContain('Math.max(headerRow.length * 110, 480)');
    expect(adaptiveTableCode).toContain("overflowX: 'auto'");
    expect(adaptiveTableCode).toContain('WebkitOverflowScrolling: \'touch\'');
  });

  // ─── 4. NO BREAK-ALL VERTICAL-LETTER RENDERING CONTRACT ────────────────────
  it('TC-RESP-05: Eliminates break-all and letter-stacking styles on assistant text and tables', () => {
    const assistantItemCode = fs.readFileSync(
      path.resolve(__dirname, '../../src/app/principal/ai/components/AssistantMessageItem.tsx'),
      'utf-8'
    );
    const adaptiveTableCode = fs.readFileSync(
      path.resolve(__dirname, '../../src/app/principal/ai/components/AdaptiveMarkdownTable.tsx'),
      'utf-8'
    );

    // Assistant narrative text container uses overflowWrap break-word and wordBreak normal
    expect(assistantItemCode).toContain("wordBreak: 'normal'");
    expect(assistantItemCode).toContain("overflowWrap: 'break-word'");

    // Table cells explicitly avoid break-all for standard content
    expect(adaptiveTableCode).toContain("wordBreak: 'normal'");
  });

  // ─── 5. PROGRESSIVE DISCLOSURE CONTRACT ────────────────────────────────────
  it('TC-RESP-06: Progressive disclosure hides secondary fields behind expandable toggle', () => {
    const adaptiveTableCode = fs.readFileSync(
      path.resolve(__dirname, '../../src/app/principal/ai/components/AdaptiveMarkdownTable.tsx'),
      'utf-8'
    );
    const structuredRendererCode = fs.readFileSync(
      path.resolve(__dirname, '../../src/app/principal/ai/components/StructuredDataRenderer.tsx'),
      'utf-8'
    );

    // AdaptiveMarkdownTable toggle details
    expect(adaptiveTableCode).toContain('toggle-details-btn-');
    expect(adaptiveTableCode).toContain('details-expanded-');
    expect(adaptiveTableCode).toContain('View details');
    expect(adaptiveTableCode).toContain('Hide details');

    // StructuredDataRenderer leave details toggle
    expect(structuredRendererCode).toContain('toggle-leave-details-');
    expect(structuredRendererCode).toContain('leave-details-expanded-');
    expect(structuredRendererCode).toContain('View details');
    expect(structuredRendererCode).toContain('Hide details');
  });

  // ─── 6. DATES & STATUS UTILITIES ───────────────────────────────────────────
  it('TC-RESP-07: Date formatting converts ISO dates and ranges into human-readable representations', () => {
    expect(formatAiDate('2026-10-14')).toBe('Oct 14, 2026');
    expect(formatDateRange('2026-06-10', '2026-06-14')).toBe('Jun 10–14, 2026');
    expect(formatDateRange('2026-10-14', '2026-10-14')).toBe('Oct 14, 2026');
    expect(formatDateRange('2026-05-28', '2026-06-02')).toBe('May 28 – Jun 2, 2026');

    const dt = formatAiDate('2026-10-14 03:02:11');
    expect(dt).toContain('Oct 14, 2026');
    expect(dt).toContain('3:02 AM');
  });

  it('TC-RESP-08: StatusBadge aligns with DigiSkwela color palette tokens', () => {
    const pending = getStatusStyle('Pending');
    expect(pending.color).toBe('#92400E'); // amber
    expect(pending.bg).toBe('#FEF3C7');

    const completed = getStatusStyle('COMPLETED');
    expect(completed.color).toBe('#155E36'); // green
    expect(completed.bg).toBe('#DCFCE7');

    const onLeave = getStatusStyle('ON_APPROVED_LEAVE');
    expect(onLeave.color).toBe('#1E3A8A'); // blue
    expect(onLeave.bg).toBe('#DBEAFE');
  });

  // ─── 7. BACKEND SYNTHESIS PROMPT GUIDELINES ───────────────────────────────
  it('TC-RESP-09: Backend Groq provider instructs model against wide Markdown tables on chat surface', () => {
    const groqProviderCode = fs.readFileSync(
      path.resolve(__dirname, '../src/ai/provider/groqAIProvider.ts'),
      'utf-8'
    );

    expect(groqProviderCode).toContain('CHAT SURFACE FORMATTING & PRESENTATION RULES:');
    expect(groqProviderCode).toContain('AVOID generating wide Markdown tables with multiple columns');
    expect(groqProviderCode).toContain('DigiSkwela Assistant is a compact, narrow conversational chat widget');
  });
});
