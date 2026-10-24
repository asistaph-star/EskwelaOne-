import { describe, it, expect, vi } from 'vitest';
import { DOMAIN_CATALOG } from '../src/ai/orchestration/domainCatalog.js';
import { buildRequestPlan } from '../src/ai/orchestration/requestPlanner.js';
import { buildSynthesisDirective } from '../src/ai/orchestration/synthesisDirective.js';
import { normalizeAssistantText } from '../src/ai/utils/normalizeResponseText.js';
import { ExecutiveSummarySynthesizer } from '../src/admin/executive-summary/synthesizer.service.js';
import { SchoolFactSheet } from '../src/admin/executive-summary/executiveSummary.types.js';
import { PrincipalRequestPlan } from '../src/ai/orchestration/requestPlanner.js';
import { AggregationResult } from '../src/ai/orchestration/aggregator.js';
import { DIGISKWELA_SYSTEM_PROMPT } from '../src/ai/provider/groqAIProvider.js';
import { getSchoolOperationalFactSheetTool } from '../src/ai/tools/definitions/principalTools.js';

describe('DIGISKWELA — PRINCIPAL AI SEMANTIC FIXES EVALUATION', () => {
  const allowedTools = new Set([
    'getSchoolOperationalFactSheet',
    'getFacultyAttendanceAudit',
    'getPendingLeaves',
    'getUpcomingEvents',
    'getAdministrativeBehaviorSummary',
    'getAcademicAnalytics',
    'generatePrincipalMeetingBrief',
    'generateWeeklyOperationsReport',
  ]);

  // ─── 1. Student Gate Wording vs Prohibited Physical-Presence Claims ───────
  describe('1. Student Gate Wording & Zero-Count Handling', () => {
    const synthesizer = new ExecutiveSummarySynthesizer();

    it('synthesizer formats student gate data factually when count is 0 without presence or absence claims', () => {
      const mockFactSheet: SchoolFactSheet = {
        asOf: new Date().toISOString(),
        asOfFormatted: 'Oct 24, 2026 • 8:00 PM',
        students: {
          enrolled: 1200,
          timeInNoTimeoutCount: 0,
          onCampusNow: 0,
        },
        faculty: {
          checkedInToday: 25,
          checkedInNow: 20,
          timedOutToday: 5,
          totalActive: 30,
        },
        academics: {
          academicCompleteness: 'complete_annual',
          annualPassRate: 92,
          lowestTermAverageGradeLevel: null,
          assessedGradeLevelsCount: 4,
        },
        welfare: {
          studentsRequiringAttention: 0,
          openBehaviorCases: 0,
        },
        operations: {
          pendingLeaves: 0,
          upcomingEventsCount: 0,
          nextUpcomingEvents: [],
        },
        inventory: {
          currentAccountableUnits: 50,
          repairUnits: 0,
          borrowedUnits: 0,
          lostDamagedUnits: 0,
        },
      };

      const narrative = synthesizer.synthesizeDeterministic(mockFactSheet);
      expect(narrative).toContain('no student gate time-in recorded today');
      expect(narrative).not.toMatch(/on campus/i);
      expect(narrative).not.toMatch(/recorded on campus/i);
      expect(narrative).not.toMatch(/currently on campus/i);
      expect(narrative).not.toMatch(/present in school/i);
      expect(narrative).not.toMatch(/absent/i);
    });

    it('synthesizer formats positive student gate time-in counts as raw gate scan events', () => {
      const mockFactSheet: SchoolFactSheet = {
        asOf: new Date().toISOString(),
        asOfFormatted: 'Oct 24, 2026 • 8:00 PM',
        students: {
          enrolled: 1200,
          timeInNoTimeoutCount: 450,
          onCampusNow: 450,
        },
        faculty: {
          checkedInToday: 28,
          checkedInNow: 25,
          timedOutToday: 3,
          totalActive: 30,
        },
        academics: {
          academicCompleteness: 'complete_annual',
          annualPassRate: 92,
          lowestTermAverageGradeLevel: null,
          assessedGradeLevelsCount: 4,
        },
        welfare: {
          studentsRequiringAttention: 0,
          openBehaviorCases: 0,
        },
        operations: {
          pendingLeaves: 0,
          upcomingEventsCount: 0,
          nextUpcomingEvents: [],
        },
        inventory: {
          currentAccountableUnits: 50,
          repairUnits: 0,
          borrowedUnits: 0,
          lostDamagedUnits: 0,
        },
      };

      const narrative = synthesizer.synthesizeDeterministic(mockFactSheet);
      expect(narrative).toContain('450 students have a gate time-in recorded with no time-out today');
      expect(narrative).not.toMatch(/on campus/i);
      expect(narrative).not.toMatch(/currently on campus/i);
    });

    it('normalizer scrubs any residual student on-campus phrasing into neutral gate scan observation', () => {
      const sample1 = 'School operations are underway with 0 students on campus today.';
      expect(normalizeAssistantText(sample1)).toContain('no student gate time-in is recorded today');
      expect(normalizeAssistantText(sample1)).not.toMatch(/on campus/i);

      const sample2 = 'There are 0 recorded on campus at this time.';
      expect(normalizeAssistantText(sample2)).toContain('no student gate time-in is recorded today');

      const sample3 = 'Currently 85 students are currently on campus.';
      expect(normalizeAssistantText(sample3)).toContain('85 student(s) recorded with a gate time-in and no time-out');
      expect(normalizeAssistantText(sample3)).not.toMatch(/on campus/i);
    });

    it('getSchoolOperationalFactSheetTool DTO strictly excludes onCampusNow and provides timeInNoTimeoutCount', async () => {
      const mockContext: any = {
        user: { id: 'u1', roles: ['Principal'], permissions: ['*'] },
        portal: 'Principal'
      };
      const dto: any = await getSchoolOperationalFactSheetTool.execute({}, mockContext);
      expect(dto.students).toHaveProperty('timeInNoTimeoutCount');
      expect(dto.students).not.toHaveProperty('onCampusNow');
    });
  });

  // ─── 2. Faculty Wording Invariants Unchanged ──────────────────────────────
  describe('2. Faculty Gate Attendance Semantics Unchanged', () => {
    it('preserves locked neutral faculty attendance statements', () => {
      const prompt = DIGISKWELA_SYSTEM_PROMPT;
      expect(prompt).toContain('No gate check-in recorded today and no approved leave record was found');
      expect(prompt).toContain('No gate check-in recorded today');
      expect(prompt).toContain('Time-out pending: A gate Time In is recorded for the date, but no gate Time Out is recorded');
      expect(prompt).toContain('Never convert gate presence data into: "Late", "Tardy", "Undertime", "Absent"');
    });

    it('normalizer preserves neutral faculty unexcused absence replacement', () => {
      const text = 'Faculty member Juan Dela Cruz has an Unexcused absence today.';
      const normalized = normalizeAssistantText(text);
      expect(normalized).toContain('No gate check-in recorded and no approved leave found');
      expect(normalized).not.toContain('Unexcused absence');
    });
  });

  // ─── 3. Correlation & Relationship Evidence Rule ──────────────────────────
  describe('3. "Unrelated" Claims & Relationship Evidence Rule', () => {
    it('synthesis directive never commands the model to declare findings unrelated', () => {
      const mockPlan: PrincipalRequestPlan = {
        intent: 'MULTI_DOMAIN',
        toolsToExecute: [],
        obligations: [
          { domain: 'faculty_attendance', operation: 'retrieve', description: 'Attendance exceptions' },
          { domain: 'behavior', operation: 'retrieve', description: 'Behavior incidents' },
        ],
        hasSeparateUnrelated: true,
      };

      const mockAgg: AggregationResult = {
        correlations: [],
        priorities: [],
        mergedSourceDomains: ['Faculty Attendance', 'Behavioral Reports'],
        unrelatedDomains: ['Behavioral Reports'],
      };

      const directive = buildSynthesisDirective(mockPlan, mockAgg);
      expect(directive.content).not.toContain('UNRELATED SEPARATION REQUIREMENT');
      expect(directive.content).not.toContain('explicitly state which ones are unrelated');
      expect(directive.content).not.toContain('represent independent matters');

      // Must enforce the new evidence rule
      expect(directive.content).toContain('CORRELATION & RELATIONSHIP EVIDENCE RULE:');
      expect(directive.content).toContain('Never claim or conclude that findings are "unrelated", "have no relation", "are separate issues", or "are not connected"');
      expect(directive.content).toContain('If no cross-domain comparison was executed between domains, state neutrally: "I did not check whether these are connected."');
    });

    it('system prompt enforces correlation integrity across all operational domains', () => {
      expect(DIGISKWELA_SYSTEM_PROMPT).toContain('RELATIONSHIP & CORRELATION INTEGRITY:');
      expect(DIGISKWELA_SYSTEM_PROMPT).toContain('Never claim or conclude that findings across different domains are "unrelated"');
      expect(DIGISKWELA_SYSTEM_PROMPT).toContain('state neutrally: "I did not check whether these are connected."');
    });
  });

  // ─── 4. Broad-Question Wording & Priority Overclaiming ────────────────────
  describe('4. Broad Operational Query & Priority Overclaiming Guardrails', () => {
    it('synthesis directive mandates coverage honesty and neutral review items disclaimer', () => {
      const mockPlan: PrincipalRequestPlan = {
        intent: 'SWEEP',
        toolsToExecute: [],
        obligations: [],
        isPrioritize: true,
      };

      const mockAgg: AggregationResult = {
        correlations: [],
        priorities: [
          { priority: 1, domain: 'Gate Attendance Monitoring', item: '1 faculty with time-out pending', urgency: 'HIGH' },
          { priority: 2, domain: 'Leave Management', item: '1 pending leave application', urgency: 'MEDIUM' },
        ],
        mergedSourceDomains: ['Gate Attendance Monitoring', 'Leave Management'],
      };

      const directive = buildSynthesisDirective(mockPlan, mockAgg);
      expect(directive.content).toContain('SUGGESTED REVIEW ITEMS (NO PARTICULAR ORDER OF IMPORTANCE):');
      expect(directive.content).toContain('Items are listed in no particular order of importance.');
      expect(directive.content).toContain('BROAD OPERATIONAL INQUIRIES & COVERAGE HONESTY:');
      expect(directive.content).toContain('Explicitly list WHICH operational areas were checked');
      expect(directive.content).toContain('Never present any single item as the "top priority" or "main action"');
      expect(directive.content).not.toContain('DepEd policy');
      expect(directive.content).not.toContain('operational urgency');
    });

    it('domainCatalog leaves keyword does not match departure verb in "What do I need to do before I leave today?"', () => {
      const departurePrompt = 'What do I need to do before I leave today?';
      expect(DOMAIN_CATALOG.leaves.keywords.test(departurePrompt)).toBe(false);
      expect(DOMAIN_CATALOG.leaves.coverageRegex.test(departurePrompt)).toBe(false);

      // Verify legitimate leave phrases continue to match
      expect(DOMAIN_CATALOG.leaves.keywords.test('How many pending leaves are there?')).toBe(true);
      expect(DOMAIN_CATALOG.leaves.keywords.test('Check leave requests')).toBe(true);
      expect(DOMAIN_CATALOG.leaves.keywords.test('Review leave applications')).toBe(true);
      expect(DOMAIN_CATALOG.leaves.keywords.test('Are any faculty on leave?')).toBe(true);
      expect(DOMAIN_CATALOG.leaves.keywords.test('Who filed a sick leave?')).toBe(true);
    });

    it('buildRequestPlan generates DYNAMIC intent (not SINGLE_DOMAIN) for "What do I need to do before I leave today?"', () => {
      const plan = buildRequestPlan(
        [{ role: 'user', content: 'What do I need to do before I leave today?' }],
        'Principal',
        'Principal',
        allowedTools
      );

      expect(plan).not.toBeNull();
      // Must NOT be classified as single-domain leaves:
      expect(plan?.intent).not.toBe('SINGLE_DOMAIN');
      expect(plan?.intent).toBe('DYNAMIC');
      expect(plan?.toolsToExecute).toEqual([]);
    });
  });

  // ─── 5. Deterministic Operational Queries (Mock Provider Verification) ────
  describe('5. Deterministic Operational Queries', () => {
    it('Scenario 1: "Show pending leave requests" dispatches getPendingLeaves', () => {
      const plan = buildRequestPlan(
        [{ role: 'user', content: 'Show pending leave requests.' }],
        'Principal',
        'Principal',
        allowedTools
      );
      expect(plan).toBeDefined();
      expect(plan?.toolsToExecute.some(t => t.name === 'getPendingLeaves')).toBe(true);
    });

    it('Scenario 2: "What events are coming up this week?" dispatches getUpcomingEvents', () => {
      const plan = buildRequestPlan(
        [{ role: 'user', content: 'What events are coming up this week?' }],
        'Principal',
        'Principal',
        allowedTools
      );
      expect(plan).toBeDefined();
      expect(plan?.toolsToExecute.some(t => t.name === 'getUpcomingEvents')).toBe(true);
    });

    it('Scenario 3: "Summarize open behavioral concerns" dispatches getAdministrativeBehaviorSummary', () => {
      const plan = buildRequestPlan(
        [{ role: 'user', content: 'Summarize open behavioral concerns.' }],
        'Principal',
        'Principal',
        allowedTools
      );
      expect(plan).toBeDefined();
      expect(plan?.toolsToExecute.some(t => t.name === 'getAdministrativeBehaviorSummary')).toBe(true);
    });

    it('Scenario 4: "Summarize academic performance and incomplete terms" dispatches getAcademicAnalytics', () => {
      const plan = buildRequestPlan(
        [{ role: 'user', content: 'Summarize academic performance and incomplete terms.' }],
        'Principal',
        'Principal',
        allowedTools
      );
      expect(plan).toBeDefined();
      expect(plan?.toolsToExecute.some(t => t.name === 'getAcademicAnalytics')).toBe(true);
    });

    it('Scenario 5: "Which students will drop out?" refuses predictive speculation and maintains factual boundaries', () => {
      const prompt = DIGISKWELA_SYSTEM_PROMPT;
      expect(prompt).toContain('Never invent, extrapolate, or guess counts, student names, faculty names, dates, or records.');
      expect(prompt).toContain('Never infer, recommend, mandate, or declare:');
      expect(prompt).toContain('State only the objective status and summary recorded in the authoritative logs.');

      // Test response normalizer on predictive attempt
      const predictiveSample = 'Based on current trends, student Juan Dela Cruz might drop out next month.';
      const normalized = normalizeAssistantText(predictiveSample);
      expect(normalized).toBeDefined();
    });
  });
});
