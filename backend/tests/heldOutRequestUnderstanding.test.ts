import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { sign } from 'jsonwebtoken';
import app from '../src/app.js';
import prisma from '../src/config/database.js';
import { generateId } from '../src/common/utils/uuid.js';
import { config } from '../src/config/env.js';
import { aiConfig } from '../src/config/ai.config.js';
import { buildRequestPlan, analyzeRequest } from '../src/ai/orchestration/requestPlanner.js';
import { aiConversationSessionService } from '../src/ai/session/aiConversationSession.service.js';

describe('DIGISKWELA — HELD-OUT REQUEST UNDERSTANDING & CONSTRAINT SUITE', { timeout: 60000 }, () => {
  let token: string;
  let principalUserId: string;
  let originalMode: any;

  const principalTools = new Set([
    'getFacultyAttendanceAudit',
    'getPendingLeaves',
    'getAdministrativeBehaviorSummary',
    'getAcademicAnalytics',
    'getUpcomingEvents',
    'getSchoolOperationalFactSheet',
    'generatePrincipalMeetingBrief',
    'generateWeeklyOperationsReport',
  ]);

  beforeAll(async () => {
    originalMode = aiConfig.providerMode;
    aiConfig.providerMode = 'mock';

    principalUserId = generateId();
    await prisma.user.create({
      data: {
        id: principalUserId,
        email: `heldout_prin_${Date.now()}@calulut.edu.ph`,
        password_hash: 'hashed_pw',
        first_name: 'Principal',
        last_name: 'HeldOutTest',
        status: 'active',
      },
    });

    const role = await prisma.role.findFirst({ where: { name: 'Principal' } });
    if (role) {
      await prisma.userRole.create({
        data: {
          user_id: principalUserId,
          role_id: role.id,
        },
      });
    }

    token = sign({ userId: principalUserId }, config.jwt.secret, { expiresIn: '8h' });
  });

  afterAll(async () => {
    aiConfig.providerMode = originalMode;
    aiConversationSessionService._resetAll();
    await prisma.aIAuditLog.deleteMany({ where: { user_id: principalUserId } });
    await prisma.userRole.deleteMany({ where: { user_id: principalUserId } });
    await prisma.user.deleteMany({ where: { id: principalUserId } });
  });

  // 1. Multi-Question (Attendance → Leave → Priority)
  it('Case 1: Multi-Question: attendance + leave + review priority', () => {
    const raw = 'Which instructors have attendance flags today, do any have active leave applications on file, and what should I inspect first?';
    const plan = buildRequestPlan([{ role: 'user', content: raw }], 'Principal', 'Principal', principalTools);

    expect(plan).not.toBeNull();
    const domains = plan!.domainObligations.map(d => d.domain);
    expect(domains).toContain('faculty_attendance');
    expect(domains).toContain('leaves');

    const ops = plan!.operationObligations.map(o => o.operation);
    expect(ops).toContain('retrieve');
    expect(ops).toContain('correlate');
    expect(ops).toContain('prioritize');

    const toolNames = plan!.toolsToExecute.map(t => t.name);
    expect(toolNames).toContain('getFacultyAttendanceAudit');
    expect(toolNames).toContain('getPendingLeaves');
  });

  // 2. Multi-Domain (Behavior + Academics + Events)
  it('Case 2: Multi-Domain: discipline + grades + activities', () => {
    const raw = 'Give me an update on current discipline incidents, grade submission completion, and upcoming school activities on the calendar.';
    const plan = buildRequestPlan([{ role: 'user', content: raw }], 'Principal', 'Principal', principalTools);

    expect(plan).not.toBeNull();
    expect(plan!.intent).toBe('MULTI_DOMAIN');
    const domains = plan!.domainObligations.map(d => d.domain);
    expect(domains).toContain('behavior');
    expect(domains).toContain('academics');
    expect(domains).toContain('events');

    const toolNames = plan!.toolsToExecute.map(t => t.name);
    expect(toolNames).toContain('getAdministrativeBehaviorSummary');
    expect(toolNames).toContain('getAcademicAnalytics');
    expect(toolNames).toContain('getUpcomingEvents');
  });

  // 3. Multi-Operation (Retrieve + Explain + Compare + Draft)
  it('Case 3: Multi-Operation: retrieve + explain + compare + draft', () => {
    const raw = 'Look into quarterly academic submission rates, explain what causes the delay, compare it with past periods, and draft a notice to teachers.';
    const plan = buildRequestPlan([{ role: 'user', content: raw }], 'Principal', 'Principal', principalTools);

    expect(plan).not.toBeNull();
    const ops = plan!.operationObligations.map(o => o.operation);
    expect(ops).toContain('retrieve');
    expect(ops).toContain('explain');
    expect(ops).toContain('compare');
    expect(ops).toContain('draft');
    expect(plan!.isDraft).toBe(true);

    const toolNames = plan!.toolsToExecute.map(t => t.name);
    expect(toolNames).toContain('getAcademicAnalytics');
  });

  // 4. Indirect Correlation (Cross-check without literal "related")
  it('Case 4: Indirect Correlation: gate check-ins covered by leave requests', () => {
    const raw = 'Check missing gate check-ins and examine if any leave requests cover their absence today.';
    const plan = buildRequestPlan([{ role: 'user', content: raw }], 'Principal', 'Principal', principalTools);

    expect(plan).not.toBeNull();
    expect(plan!.isCorrelate).toBe(true);
    const domains = plan!.domainObligations.map(d => d.domain);
    expect(domains).toContain('faculty_attendance');
    expect(domains).toContain('leaves');

    const toolNames = plan!.toolsToExecute.map(t => t.name);
    expect(toolNames).toContain('getFacultyAttendanceAudit');
    expect(toolNames).toContain('getPendingLeaves');
  });

  // 5. Negation (not attendance, focus on behavior and events)
  it('Case 5: Negation: suppress attendance and focus on behavior and events', () => {
    const raw = 'I do not want to see faculty attendance today; focus purely on unresolved behavior incidents and calendar events.';
    const plan = buildRequestPlan([{ role: 'user', content: raw }], 'Principal', 'Principal', principalTools);

    expect(plan).not.toBeNull();
    const domains = plan!.domainObligations.map(d => d.domain);
    expect(domains).not.toContain('faculty_attendance');
    expect(domains).toContain('behavior');
    expect(domains).toContain('events');

    const toolNames = plan!.toolsToExecute.map(t => t.name);
    expect(toolNames).not.toContain('getFacultyAttendanceAudit');
    expect(toolNames).toContain('getAdministrativeBehaviorSummary');
    expect(toolNames).toContain('getUpcomingEvents');

    const excludeConstraint = plan!.constraints?.find(c => c.type === 'EXCLUDE_DOMAIN');
    expect(excludeConstraint).toBeDefined();
    expect(excludeConstraint!.targetDomain).toBe('faculty_attendance');
  });

  // 6. Exclusion Filter (don't include resolved cases)
  it('Case 6: Exclusion Filter: propagate status exclusion to tool arguments', () => {
    const raw = 'Review student behavioral infractions but exclude resolved cases from the report.';
    const plan = buildRequestPlan([{ role: 'user', content: raw }], 'Principal', 'Principal', principalTools);

    expect(plan).not.toBeNull();
    const behaviorTool = plan!.toolsToExecute.find(t => t.name === 'getAdministrativeBehaviorSummary');
    expect(behaviorTool).toBeDefined();
    expect(behaviorTool!.args.status).toBe('Under investigation');

    const statusConstraint = plan!.constraints?.find(c => c.type === 'EXCLUDE_STATUS');
    expect(statusConstraint).toBeDefined();
    expect(statusConstraint!.value).toBe('Resolved');
  });

  // 7. Clause Qualifier (only assigned classes applies to attendance clause)
  it('Case 7: Clause Qualifier: preserve clause association without leaking', () => {
    const raw = 'Examine faculty attendance only for my assigned classes, and explain why annual academic grades are incomplete.';
    const analysis = analyzeRequest(raw, [{ role: 'user', content: raw }]);

    expect(analysis.clauses.length).toBeGreaterThanOrEqual(2);
    const attClause = analysis.clauses.find(c => c.domains.includes('faculty_attendance'));
    expect(attClause).toBeDefined();
    expect(attClause!.constraints.some(c => c.type === 'SCOPE' && c.value === 'assigned_classes')).toBe(true);

    const acadClause = analysis.clauses.find(c => c.domains.includes('academics'));
    expect(acadClause).toBeDefined();
    expect(acadClause!.constraints.some(c => c.type === 'SCOPE')).toBe(false);
  });

  // 8. Pronoun Same-Turn (Noun earlier in message + "them")
  it('Case 8: Pronoun Same-Turn: resolve "them" to current prompt behavior cases', () => {
    const raw = 'Retrieve open discipline infractions and tell me where to review them.';
    const plan = buildRequestPlan([{ role: 'user', content: raw }], 'Principal', 'Principal', principalTools);

    expect(plan).not.toBeNull();
    expect(plan!.intent).not.toBe('CLARIFICATION');
    const domains = plan!.domainObligations.map(d => d.domain);
    expect(domains).toContain('behavior');

    const ops = plan!.operationObligations.map(o => o.operation);
    expect(ops).toContain('retrieve');
    expect(ops).toContain('navigate');

    expect(plan!.navigationAction).toBeDefined();
    expect(plan!.navigationAction!.screen).toBe('p-behavior');
  });

  // 9. Pronoun Previous-Turn (Follow-up leave cross-check)
  it('Case 9: Pronoun Previous-Turn: authoritative leave check on follow-up', () => {
    const history = [
      { role: 'user', content: 'Audit faculty check-ins for today.' },
      { role: 'assistant', content: 'Here is today faculty attendance monitoring audit.' }
    ];
    const followUp = 'Do any of those have supporting leave records?';
    const plan = buildRequestPlan([...history, { role: 'user', content: followUp }], 'Principal', 'Principal', principalTools);

    expect(plan).not.toBeNull();
    expect(plan!.intent).toBe('ATTENDANCE_CROSSCHECK');
    const toolNames = plan!.toolsToExecute.map(t => t.name);
    expect(toolNames).toContain('getFacultyAttendanceAudit');
    expect(toolNames).toContain('getPendingLeaves');
  });

  // 10. Natural Attention Request (Broad operational sweep without rigid regex)
  it('Case 10: Natural Attention Request: broad prioritization', () => {
    const raw = 'What matters most today that requires my direct supervision?';
    const plan = buildRequestPlan([{ role: 'user', content: raw }], 'Principal', 'Principal', principalTools);

    expect(plan).not.toBeNull();
    const toolNames = plan!.toolsToExecute.map(t => t.name);
    expect(toolNames).toContain('getFacultyAttendanceAudit');
    expect(toolNames).toContain('getPendingLeaves');
    expect(toolNames).toContain('getAdministrativeBehaviorSummary');

    expect(plan!.isPrioritize).toBe(true);
  });

  // 11. Simple Narrow Request (One domain remains one domain)
  it('Case 11: Simple Narrow Request: events only', () => {
    const raw = 'When is the next scheduled parent-teacher conference on the school calendar?';
    const plan = buildRequestPlan([{ role: 'user', content: raw }], 'Principal', 'Principal', principalTools);

    expect(plan).not.toBeNull();
    expect(plan!.intent).toBe('SINGLE_DOMAIN');
    expect(plan!.toolsToExecute.length).toBe(1);
    expect(plan!.toolsToExecute[0].name).toBe('getUpcomingEvents');
    expect(plan!.domainObligations.map(d => d.domain)).toEqual(['events']);
  });

  // 12. Composite Navigation + Retrieval Integration (End-to-End API)
  it('Case 12: End-to-End API: composite retrieval + navigation returns data and navigation action', async () => {
    const res = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({
        messages: [{
          role: 'user',
          content: 'Show me incomplete grades and tell me where I can review them.'
        }],
        portal: 'Principal'
      });

    expect(res.status).toBe(200);
    const d = res.body.data;
    expect(d.toolsExecuted).toContain('getAcademicAnalytics');
    expect(d.navigationActions).toBeDefined();
    expect(d.navigationActions.length).toBeGreaterThan(0);
    expect(d.navigationActions[0].screen).toBe('p-analytics');
    expect(d.origin).toBe('AI_PROVIDER');
  });

  // 13. Social Greeting Origin Distinction (End-to-End API)
  it('Case 13: End-to-End API: greeting returns LOCAL_APPLICATION origin without consuming AI provider', async () => {
    const res = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({
        messages: [{
          role: 'user',
          content: 'Good morning'
        }],
        portal: 'Principal'
      });

    expect(res.status).toBe(200);
    const d = res.body.data;
    expect(d.toolsExecuted).toEqual([]);
    expect(d.origin).toBe('LOCAL_APPLICATION');
    expect(d.message.content).toContain('Good day. How may I assist you with school operations?');
  });

  // 14. Attendance Status Qualifier Preservation (TC-PUI-07 regression)
  it('Case 14: Attendance Status Qualifiers: preserve qualifiers in plan, constraints, and tool args', () => {
    // 14a: No gate check-in (TC-PUI-07)
    const promptNoCheckIn = 'Show all faculty who have no gate check-in today and show their department.';
    const planNoCheckIn = buildRequestPlan([{ role: 'user', content: promptNoCheckIn }], 'Principal', 'Principal', principalTools);
    expect(planNoCheckIn).not.toBeNull();
    expect(planNoCheckIn!.primaryToolName).toBe('getFacultyAttendanceAudit');
    expect(planNoCheckIn!.toolsToExecute[0].args.statusFilter).toBe('NO_GATE_CHECK_IN_NO_APPROVED_LEAVE_FOUND');
    const constraintNoCheckIn = planNoCheckIn!.constraints?.find(c => c.type === 'INCLUDE_ONLY');
    expect(constraintNoCheckIn).toBeDefined();
    expect(constraintNoCheckIn!.value).toBe('NO_GATE_CHECK_IN_NO_APPROVED_LEAVE_FOUND');

    // 14b: Has checked in
    const promptCheckedIn = 'Show all faculty who have checked in today.';
    const planCheckedIn = buildRequestPlan([{ role: 'user', content: promptCheckedIn }], 'Principal', 'Principal', principalTools);
    expect(planCheckedIn!.toolsToExecute[0].args.statusFilter).toBe('CHECKED_IN');

    // 14c: Time-out recorded
    const promptTimeOut = 'List faculty with time-out recorded today.';
    const planTimeOut = buildRequestPlan([{ role: 'user', content: promptTimeOut }], 'Principal', 'Principal', principalTools);
    expect(planTimeOut!.toolsToExecute[0].args.statusFilter).toBe('COMPLETED');

    // 14d: No time-out
    const promptPending = 'List faculty with no time-out recorded today.';
    const planPending = buildRequestPlan([{ role: 'user', content: promptPending }], 'Principal', 'Principal', principalTools);
    expect(planPending!.toolsToExecute[0].args.statusFilter).toBe('TIME_OUT_PENDING');

    // 14e: General attendance (no qualifier) does not restrict statusFilter
    const promptGeneral = 'Show all faculty attendance records for today.';
    const planGeneral = buildRequestPlan([{ role: 'user', content: promptGeneral }], 'Principal', 'Principal', principalTools);
    expect(planGeneral!.toolsToExecute[0].args.statusFilter).toBeUndefined();
  });
});
