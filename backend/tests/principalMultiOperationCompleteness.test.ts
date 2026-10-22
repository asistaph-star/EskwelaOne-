import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { prisma } from '../src/config/database.js';
import { aiConfig } from '../src/ai/config/aiConfig.js';
import { buildRequestPlan } from '../src/ai/orchestration/requestPlanner.js';
import { validateAndRemedyCompleteness } from '../src/ai/orchestration/completenessValidator.js';
import { aggregateFacts } from '../src/ai/orchestration/aggregator.js';

describe('DIGISKWELA — MULTI-OPERATION COMPLETENESS & FOLLOW-UP SCOPE EVALUATION', () => {
  const allowedTools = new Set([
    'getFacultyAttendanceAudit',
    'getPendingLeaves',
    'getAdministrativeBehaviorSummary',
    'getAcademicAnalytics',
    'getSchoolOperationalFactSheet',
    'getUpcomingEvents',
    'generatePrincipalMeetingBrief',
    'generateWeeklyOperationsReport',
  ]);

  // ─── 1. MULTI-OPERATION REQUESTS (Section 8) ──────────────────────────────
  describe('1. Multi-Operation Planning & Completeness Tracking', () => {
    it('TC-MULTI-01 (Scenario 8.A): Check academics + explain why annual view incomplete + draft reminder', () => {
      const prompt = 'Check academic reporting, explain why the annual view is incomplete, and draft a short reminder for faculty.';
      const plan = buildRequestPlan([{ role: 'user', content: prompt }], 'Principal', 'Principal', allowedTools);

      expect(plan).not.toBeNull();
      expect(plan!.toolsToExecute.map(t => t.name)).toContain('getAcademicAnalytics');
      expect(plan!.isDraft).toBe(true);

      // Verify domain obligations
      expect(plan!.domainObligations.map(d => d.domain)).toEqual(['academics']);
      expect(plan!.domainObligations.length).toBe(1);

      // Verify operation obligations independently tracked
      const ops = plan!.operationObligations.map(o => o.operation);
      expect(ops).toContain('retrieve');
      expect(ops).toContain('explain');
      expect(ops).toContain('draft');
      expect(plan!.operationObligations.length).toBe(3);

      // Verify synchronized obligations total
      expect(plan!.domainObligations.length + plan!.operationObligations.length).toBe(4);

      // Validate completeness
      const mockExecResults = [
        {
          name: 'getAcademicAnalytics',
          success: true,
          durationMs: 20,
          result: { academicCompleteness: 'partial_terms', summary: 'Grading status is partial_terms.' }
        }
      ];
      const agg = aggregateFacts(plan!, mockExecResults);
      const simulatedSynthesis = 'Current academic reporting reflects partial terms status because Q4 grades remain pending across 3 departments. Draft Notice:\nSubject: Quarter Grade Submissions\nPlease finalize all pending grades.\n(Draft for Principal review · Read-only AI assistance)';

      const validated = validateAndRemedyCompleteness(
        simulatedSynthesis,
        plan!,
        mockExecResults,
        agg,
        'getAcademicAnalytics',
        false
      );

      expect(validated.auditMetrics.domainObligationsTotal).toBe(1);
      expect(validated.auditMetrics.operationObligationsTotal).toBe(3);
      expect(validated.auditMetrics.satisfiedDomainCount).toBe(1);
      expect(validated.auditMetrics.satisfiedOperationCount).toBe(3);
      expect(validated.auditMetrics.satisfiedCount).toBe(4);
      expect(validated.auditMetrics.obligationsTotal).toBe(4);
      expect(validated.auditMetrics.unmetCount).toBe(0);
      expect(validated.auditMetrics.completionState).toBe('COMPLETE');
    });

    it('TC-MULTI-02 (Scenario 8.B): Where do I review behavior reports + are there unresolved cases', () => {
      const prompt = 'Where do I review behavior reports, and tell me whether any unresolved cases exist.';
      const plan = buildRequestPlan([{ role: 'user', content: prompt }], 'Principal', 'Principal', allowedTools);

      expect(plan).not.toBeNull();
      expect(plan!.toolsToExecute.map(t => t.name)).toContain('getAdministrativeBehaviorSummary');
      expect(plan!.navigationAction).toBeDefined();
      expect(plan!.navigationAction!.screen).toBe('p-behavior');

      expect(plan!.domainObligations.map(d => d.domain)).toEqual(['behavior']);
      const ops = plan!.operationObligations.map(o => o.operation);
      expect(ops).toContain('navigate');
      expect(ops).toContain('retrieve');
      expect(plan!.operationObligations.length).toBe(2);

      const mockExecResults = [
        {
          name: 'getAdministrativeBehaviorSummary',
          success: true,
          durationMs: 25,
          result: { summary: { activeCasesCount: 2, underInvestigation: 1, reported: 1 } }
        }
      ];
      const agg = aggregateFacts(plan!, mockExecResults);
      const synthesis = 'To review behavioral reports, open Behavioral Reports under Operations. Currently there are 2 active cases under investigation.';

      const validated = validateAndRemedyCompleteness(
        synthesis,
        plan!,
        mockExecResults,
        agg,
        'getAdministrativeBehaviorSummary',
        false,
        [plan!.navigationAction!]
      );

      expect(validated.auditMetrics.domainObligationsTotal).toBe(1);
      expect(validated.auditMetrics.operationObligationsTotal).toBe(2);
      expect(validated.auditMetrics.satisfiedDomainCount).toBe(1);
      expect(validated.auditMetrics.satisfiedOperationCount).toBe(2);
      expect(validated.auditMetrics.satisfiedCount).toBe(3);
      expect(validated.auditMetrics.completionState).toBe('COMPLETE');
    });

    it('TC-MULTI-03 (Scenario 8.C): Check attendance & leaves + explain if related + prioritize first item', () => {
      const prompt = 'Check attendance and leave records, explain whether they are related, and tell me which item should be reviewed first.';
      const plan = buildRequestPlan([{ role: 'user', content: prompt }], 'Principal', 'Principal', allowedTools);

      expect(plan).not.toBeNull();
      expect(plan!.toolsToExecute.map(t => t.name)).toEqual(expect.arrayContaining(['getFacultyAttendanceAudit', 'getPendingLeaves']));
      expect(plan!.toolsToExecute.length).toBe(2);
      expect(plan!.isCorrelate).toBe(true);
      expect(plan!.isPrioritize).toBe(true);

      expect(plan!.domainObligations.map(d => d.domain)).toEqual(['leaves', 'faculty_attendance']);
      const ops = plan!.operationObligations.map(o => o.operation);
      expect(ops).toContain('retrieve');
      expect(ops).toContain('correlate');
      expect(ops).toContain('prioritize');

      const mockExecResults = [
        {
          name: 'getFacultyAttendanceAudit',
          success: true,
          durationMs: 30,
          result: { summary: { noGateCheckInNoApprovedLeaveFoundCount: 1 } }
        },
        {
          name: 'getPendingLeaves',
          success: true,
          durationMs: 20,
          result: { totalPending: 1 }
        }
      ];
      const agg = aggregateFacts(plan!, mockExecResults);
      const synthesis = 'Cross-check between gate check-ins and pending leave records indicates 1 teacher on leave. Suggested review order: 1. Gate attendance. (Suggested review order based on operational urgency; not DepEd policy)';

      const validated = validateAndRemedyCompleteness(
        synthesis,
        plan!,
        mockExecResults,
        agg,
        'getFacultyAttendanceAudit',
        false
      );

      expect(validated.auditMetrics.domainObligationsTotal).toBe(2);
      expect(validated.auditMetrics.operationObligationsTotal).toBe(4);
      expect(validated.auditMetrics.satisfiedDomainCount).toBe(2);
      expect(validated.auditMetrics.satisfiedOperationCount).toBe(4);
      expect(validated.auditMetrics.satisfiedCount).toBe(6);
      expect(validated.auditMetrics.completionState).toBe('COMPLETE');
    });

    it('TC-MULTI-04 (Scenario 8.D): Summarize current academic reporting + prepare executive brief', () => {
      const prompt = 'Summarize current academic reporting and prepare a short executive brief.';
      const plan = buildRequestPlan([{ role: 'user', content: prompt }], 'Principal', 'Principal', allowedTools);

      expect(plan).not.toBeNull();
      expect(plan!.toolsToExecute.map(t => t.name)).toContain('getAcademicAnalytics');

      expect(plan!.domainObligations.map(d => d.domain)).toEqual(['academics']);
      const ops = plan!.operationObligations.map(o => o.operation);
      expect(ops).toContain('summarize');
      expect(ops).toContain('generate_report');

      const mockExecResults = [
        {
          name: 'getAcademicAnalytics',
          success: true,
          durationMs: 20,
          result: { academicCompleteness: 'partial_terms' }
        }
      ];
      const agg = aggregateFacts(plan!, mockExecResults);
      const synthesis = 'Executive Brief on Academic Analytics: Overall summary of grading across grade levels indicates partial terms.';

      const validated = validateAndRemedyCompleteness(
        synthesis,
        plan!,
        mockExecResults,
        agg,
        'getAcademicAnalytics',
        false
      );

      expect(validated.auditMetrics.domainObligationsTotal).toBe(1);
      expect(validated.auditMetrics.operationObligationsTotal).toBe(2);
      expect(validated.auditMetrics.satisfiedDomainCount).toBe(1);
      expect(validated.auditMetrics.satisfiedOperationCount).toBe(2);
      expect(validated.auditMetrics.satisfiedCount).toBe(3);
      expect(validated.auditMetrics.completionState).toBe('COMPLETE');
    });
  });

  // ─── 2. FOLLOW-UP SCOPE FIDELITY (Section 9 & 10) ─────────────────────────
  describe('2. Follow-Up Scope Fidelity & Referent Resolution', () => {
    it('TC-SCOPE-01 (Scenario 9.A): Follow-up "Which of those should I check first?" preserves Turn 1 domain and does NOT add Behavior or Events', () => {
      const messages = [
        { role: 'user' as const, content: 'What faculty attendance matters are pending today?' },
        { role: 'tool' as const, name: 'getFacultyAttendanceAudit', content: '{"summary":{"noGateCheckInNoApprovedLeaveFoundCount":1}}' },
        { role: 'assistant' as const, content: 'There is 1 faculty member with no gate check-in and no approved leave recorded.' },
        { role: 'user' as const, content: 'Which of those should I check first?' }
      ];

      const plan = buildRequestPlan(messages, 'Principal', 'Principal', allowedTools);

      expect(plan).not.toBeNull();
      const dispatchedTools = plan!.toolsToExecute.map(t => t.name);

      // Must execute attendance tool
      expect(dispatchedTools).toContain('getFacultyAttendanceAudit');

      // CRITICAL: MUST NOT BROADEN into unrelated domains!
      expect(dispatchedTools).not.toContain('getAdministrativeBehaviorSummary');
      expect(dispatchedTools).not.toContain('getAcademicAnalytics');
      expect(dispatchedTools).not.toContain('getUpcomingEvents');
      expect(dispatchedTools).not.toContain('getSchoolOperationalFactSheet');

      // Domain obligations must only contain faculty_attendance
      expect(plan!.domainObligations.map(d => d.domain)).toEqual(['faculty_attendance']);
      expect(plan!.isPrioritize).toBe(true);
    });

    it('TC-SCOPE-02 (Scenario 9.B): Turn 1 (leaves + attendance) -> Turn 2 ("Which of them involve the same faculty member?") scopes to leaves and attendance only', () => {
      const messages = [
        { role: 'user' as const, content: 'Show pending leave requests and attendance exceptions.' },
        { role: 'tool' as const, name: 'getFacultyAttendanceAudit', content: '{"records":[]}' },
        { role: 'tool' as const, name: 'getPendingLeaves', content: '{"requests":[]}' },
        { role: 'assistant' as const, content: 'Here are the pending leaves and attendance records.' },
        { role: 'user' as const, content: 'Which of them involve the same faculty member?' }
      ];

      const plan = buildRequestPlan(messages, 'Principal', 'Principal', allowedTools);

      expect(plan).not.toBeNull();
      const dispatchedTools = plan!.toolsToExecute.map(t => t.name);

      expect(dispatchedTools).toContain('getFacultyAttendanceAudit');
      expect(dispatchedTools).toContain('getPendingLeaves');
      expect(dispatchedTools).not.toContain('getAdministrativeBehaviorSummary');
      expect(dispatchedTools).not.toContain('getAcademicAnalytics');
      expect(plan!.isCorrelate).toBe(true);
      expect(plan!.domainObligations.map(d => d.domain)).toContain('faculty_attendance');
      expect(plan!.domainObligations.map(d => d.domain)).toContain('leaves');
    });

    it('TC-SCOPE-03 (Scenario 9.C): Turn 1 (academics) -> Turn 2 ("Explain the most important one.") keeps scope strictly on academics', () => {
      const messages = [
        { role: 'user' as const, content: 'What academic reporting problems exist?' },
        { role: 'tool' as const, name: 'getAcademicAnalytics', content: '{"academicCompleteness":"partial_terms"}' },
        { role: 'assistant' as const, content: 'Records reflect partial terms with Q4 grades pending.' },
        { role: 'user' as const, content: 'Explain the most important one.' }
      ];

      const plan = buildRequestPlan(messages, 'Principal', 'Principal', allowedTools);

      expect(plan).not.toBeNull();
      expect(plan!.toolsToExecute.map(t => t.name)).toEqual(['getAcademicAnalytics']);
      expect(plan!.domainObligations.map(d => d.domain)).toEqual(['academics']);
      expect(plan!.operationObligations.map(o => o.operation)).toContain('explain');
    });

    it('TC-SCOPE-04 (Scenario 9.D - Narrowing): Turn 1 (sweep) -> Turn 2 ("Only show me the faculty-related ones.") narrows from 4 domains to 1', () => {
      const messages = [
        { role: 'user' as const, content: 'What needs my attention today?' },
        { role: 'tool' as const, name: 'getFacultyAttendanceAudit', content: '{}' },
        { role: 'tool' as const, name: 'getPendingLeaves', content: '{}' },
        { role: 'tool' as const, name: 'getAdministrativeBehaviorSummary', content: '{}' },
        { role: 'tool' as const, name: 'getSchoolOperationalFactSheet', content: '{}' },
        { role: 'assistant' as const, content: 'Summary of operational exceptions across faculty, leaves, and behavior.' },
        { role: 'user' as const, content: 'Only show me the faculty-related ones.' }
      ];

      const plan = buildRequestPlan(messages, 'Principal', 'Principal', allowedTools);

      expect(plan).not.toBeNull();
      expect(plan!.toolsToExecute.map(t => t.name)).toEqual(['getFacultyAttendanceAudit']);
      expect(plan!.domainObligations.map(d => d.domain)).toEqual(['faculty_attendance']);
      expect(plan!.toolsToExecute.map(t => t.name)).not.toContain('getAdministrativeBehaviorSummary');
      expect(plan!.toolsToExecute.map(t => t.name)).not.toContain('getSchoolOperationalFactSheet');
    });

    it('TC-SCOPE-05 (Section 10 - Explicit Expansion): Turn 1 (attendance) -> Turn 2 ("Also check behavior cases and academics.") expands to union of 3 domains', () => {
      const messages = [
        { role: 'user' as const, content: 'What faculty attendance matters are pending?' },
        { role: 'tool' as const, name: 'getFacultyAttendanceAudit', content: '{}' },
        { role: 'assistant' as const, content: 'Here are the faculty attendance records.' },
        { role: 'user' as const, content: 'Also check behavior cases and academics.' }
      ];

      const plan = buildRequestPlan(messages, 'Principal', 'Principal', allowedTools);

      expect(plan).not.toBeNull();
      const dispatchedTools = plan!.toolsToExecute.map(t => t.name);

      expect(dispatchedTools).toContain('getFacultyAttendanceAudit');
      expect(dispatchedTools).toContain('getAdministrativeBehaviorSummary');
      expect(dispatchedTools).toContain('getAcademicAnalytics');
      expect(dispatchedTools.length).toBe(3);

      const domains = plan!.domainObligations.map(d => d.domain);
      expect(domains).toContain('faculty_attendance');
      expect(domains).toContain('behavior');
      expect(domains).toContain('academics');
    });
  });

  // ─── 3. ZERO SILENT OMISSION & GROUNDED REMEDIES ──────────────────────────
  describe('3. Controlled Failure & Zero Silent Omission', () => {
    it('TC-OMIT-01: When one operation cannot be satisfied due to tool failure, it is explicitly marked UNAVAILABLE', () => {
      const plan = buildRequestPlan(
        [{ role: 'user', content: 'Check academic reporting and behavior cases.' }],
        'Principal',
        'Principal',
        allowedTools
      );

      const mockExecResults = [
        {
          name: 'getAcademicAnalytics',
          success: true,
          durationMs: 20,
          result: { academicCompleteness: 'partial_terms' }
        },
        {
          name: 'getAdministrativeBehaviorSummary',
          success: false,
          error: 'Database connection failed',
          durationMs: 15
        }
      ];

      const agg = aggregateFacts(plan!, mockExecResults);
      const validated = validateAndRemedyCompleteness(
        'Academic reporting reflects partial terms.',
        plan!,
        mockExecResults,
        agg,
        'getAcademicAnalytics',
        false
      );

      // Academic domain satisfied
      expect(validated.auditMetrics.satisfiedDomainCount).toBe(1);
      // Behavior domain unavailable
      expect(validated.auditMetrics.unmetCount).toBe(2); // 1 domain + 1 retrieve operation
      expect(validated.auditMetrics.completionState).toBe('PARTIAL');
      expect(validated.finalizedContent).toContain('Note: Could not verify Behavioral Reports records at this time.');
    });
  });
});
