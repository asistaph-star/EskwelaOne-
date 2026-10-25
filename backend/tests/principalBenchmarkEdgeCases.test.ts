import { describe, it, expect } from 'vitest';
import { analyzeRequest, buildRequestPlan, isDomainNegated } from '../src/ai/orchestration/requestPlanner.js';
import { DOMAIN_CATALOG } from '../src/ai/orchestration/domainCatalog.js';
import { validateAndRemedyCompleteness } from '../src/ai/orchestration/completenessValidator.js';
import { principalTools } from '../src/ai/tools/definitions/principalTools.js';

describe('DIGISKWELA — PRINCIPAL BENCHMARK DEFECT PASS DETERMINISTIC SUITE', () => {
  const allowedTools = new Set(principalTools.map(t => t.name));

  // ─── A. NEGATION BUG ────────────────────────────────────────────────────────
  it('TC-BENCH-01: "without a gate check-in" phrases MUST NOT exclude faculty_attendance', () => {
    const includedPhrases = [
      'without a gate check-in',
      'without gate check-in',
      'faculty without a gate check-in',
      'teachers without a gate check-in',
    ];

    for (const phrase of includedPhrases) {
      const isNegated = isDomainNegated('faculty_attendance', phrase, phrase);
      expect(isNegated).toBe(false);

      const analysis = analyzeRequest(phrase, [{ role: 'user', content: phrase }]);
      expect(analysis.excludedDomains).not.toContain('faculty_attendance');
    }
  });

  it('TC-BENCH-02: Real exclusions MUST continue to exclude faculty_attendance', () => {
    const excludedPhrases = [
      "don't check faculty attendance",
      'exclude faculty attendance',
      'ignoring faculty attendance',
      'ignore attendance',
    ];

    for (const phrase of excludedPhrases) {
      const isNegated = isDomainNegated('faculty_attendance', phrase, phrase);
      expect(isNegated).toBe(true);

      const analysis = analyzeRequest(phrase, [{ role: 'user', content: phrase }]);
      expect(analysis.excludedDomains).toContain('faculty_attendance');
    }
  });

  // ─── B. ATTENDANCE/LEAVE CROSS-CHECK ────────────────────────────────────────
  it('TC-BENCH-03: Benchmark question routes to existing ATTENDANCE_CROSSCHECK without clarification', () => {
    const query = "Check today's faculty attendance and tell me if anyone without a gate check-in also has an approved leave";
    const analysis = analyzeRequest(query, [{ role: 'user', content: query }]);

    expect(analysis.isAttendanceCrossCheck).toBe(true);
    expect(analysis.excludedDomains).not.toContain('faculty_attendance');

    const plan = buildRequestPlan([{ role: 'user', content: query }], 'principal', 'principal', allowedTools);
    expect(plan).not.toBeNull();
    expect(plan?.intent).toBe('ATTENDANCE_CROSSCHECK');

    const toolNames = plan?.toolsToExecute.map(t => t.name);
    expect(toolNames).toContain('getFacultyAttendanceAudit');
    expect(toolNames).toContain('getPendingLeaves');

    const hasCorrelate = plan?.operationObligations.some(o => o.operation === 'correlate') ||
      plan?.obligations.some(o => o.operation === 'correlate');
    expect(hasCorrelate).toBe(true);
  });

  // ─── C. DEPARTURE-LANGUAGE REGRESSION ───────────────────────────────────────
  it('TC-BENCH-04: "What do I need to do before I leave today?" does NOT match HR Leave domain', () => {
    const query = 'What do I need to do before I leave today?';
    const analysis = analyzeRequest(query, [{ role: 'user', content: query }]);

    expect(analysis.positiveDomains).not.toContain('leaves');
  });

  // ─── D. CAMPUS-PRESENCE SOURCE STRING ───────────────────────────────────────
  it('TC-BENCH-05: domainCatalog overview summarizeResult uses "student gate activity", never "campus presence"', () => {
    const overviewSummary = DOMAIN_CATALOG.overview.summarizeResult({});
    expect(overviewSummary).toContain('student gate activity');
    expect(overviewSummary).not.toContain('campus presence');
  });

  // ─── E. EXPLANATION FALLBACK ────────────────────────────────────────────────
  it('TC-BENCH-06: Explanation fallback never contains "explain across" or internal obligation descriptions', () => {
    const mockPlan: any = {
      intent: 'MULTI_DOMAIN',
      toolsToExecute: [
        { name: 'getPendingLeaves', args: {} },
        { name: 'getFacultyAttendanceAudit', args: {} }
      ],
      primaryToolName: 'getFacultyAttendanceAudit',
      domainObligations: [
        { domain: 'leaves', description: 'Leave Management records' },
        { domain: 'faculty_attendance', description: 'Gate Attendance Monitoring records' }
      ],
      operationObligations: [
        { operation: 'explain', description: 'explain across Leave Management, Gate Attendance Monitoring' }
      ],
      obligations: []
    };

    const mockToolResults = [
      { toolName: 'getPendingLeaves', success: false, result: null },
      { toolName: 'getFacultyAttendanceAudit', success: false, result: null }
    ];

    const mockAggregate = {
      successfulTools: [],
      failedTools: ['getPendingLeaves', 'getFacultyAttendanceAudit'],
      summaryMetrics: {},
      correlations: [],
      priorities: []
    };

    const validated = validateAndRemedyCompleteness(
      'Here is the general operational update.',
      mockPlan,
      mockToolResults as any,
      mockAggregate as any,
      'getFacultyAttendanceAudit',
      false
    );

    expect(validated.finalizedContent).not.toContain('explain across');
    expect(validated.finalizedContent).not.toContain('Could not explain operational cause for explain across');
    expect(validated.finalizedContent).toContain('No verified operational cause was established');
  });

  // ─── F. INVENTORY BOUNDARY ──────────────────────────────────────────────────
  it('TC-BENCH-07: getSchoolOperationalFactSheet contains aggregate inventory totals, tool count remains 8', () => {
    expect(principalTools.length).toBe(8);

    const factSheetTool = principalTools.find(t => t.name === 'getSchoolOperationalFactSheet');
    expect(factSheetTool).toBeDefined();

    // Verify there is no dedicated inventory roster tool
    const dedicatedInventoryTool = principalTools.find(t => t.name.toLowerCase().includes('inventory'));
    expect(dedicatedInventoryTool).toBeUndefined();
  });
});
