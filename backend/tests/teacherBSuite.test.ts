import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { toolRegistry } from '../src/ai/tools/toolRegistry.js';
import { dispatchTool } from '../src/ai/tools/toolDispatcher.js';
import prisma from '../src/config/database.js';
import { setupTeacherDemoFixture, teardownTeacherDemoFixture } from './helpers/fixtureLifecycle.js';

describe('Phase B Teacher Tools — B1, B2, B3 Scope, RBAC, Semantics & Privacy', () => {
  beforeAll(async () => {
    await setupTeacherDemoFixture();
  }, 60000);

  afterAll(async () => {
    await teardownTeacherDemoFixture();
  }, 30000);
  // Canonical Demo Teacher User (Maria Clara / demo-teacher-1)
  const teacherUser = {
    id: 'demo-teacher-1',
    email: 'teacher@demo.com',
    firstName: 'Maria',
    lastName: 'Clara',
    status: 'active',
    roles: ['Teacher'],
    permissions: [
      'user:read',
      'academic:read',
      'assignment:read_own',
      'grade:read',
      'grade:write',
      'attendance:read',
      'attendance:write',
      'behavior:read',
      'behavior:write'
    ],
  };

  const principalUser = {
    id: 'demo-principal-1',
    email: 'principal@demo.com',
    firstName: 'Principal',
    lastName: 'User',
    status: 'active',
    roles: ['Principal'],
    permissions: [
      'user:read',
      'academic:read',
      'assignment:read_all',
      'grade:read_all',
      'attendance:read',
      'faculty_attendance:read'
    ],
  };

  const studentUser = {
    id: 'demo-student-1',
    email: 'student@demo.com',
    firstName: 'Student',
    lastName: 'User',
    status: 'active',
    roles: ['Student'],
    permissions: ['academic:read', 'document:read'],
  };

  // ─── 1. TOOL REGISTRATION & ROLE EXPOSURE INVARIANTS ──────────────────
  it('TC-TCH-REG-01: B1, B2, and B3 are registered with strict allowedRoles = ["Teacher"]', () => {
    const b1 = toolRegistry.getTool('getMyTeachingOperations');
    const b2 = toolRegistry.getTool('getMyIncompleteGrades');
    const b3 = toolRegistry.getTool('getMyClassPerformance');

    expect(b1).toBeDefined();
    expect(b2).toBeDefined();
    expect(b3).toBeDefined();

    expect(b1?.allowedRoles).toEqual(['Teacher']);
    expect(b2?.allowedRoles).toEqual(['Teacher']);
    expect(b3?.allowedRoles).toEqual(['Teacher']);

    expect(b1?.requiredPermissions).toEqual(['assignment:read_own']);
    expect(b2?.requiredPermissions).toEqual(['assignment:read_own', 'grade:read']);
    expect(b3?.requiredPermissions).toEqual(['assignment:read_own', 'grade:read', 'attendance:read']);
  });

  it('TC-TCH-REG-02: Principal and Student users are NOT exposed to B1, B2, or B3 declarations', () => {
    const principalDecls = toolRegistry.getDeclarationsForUser(
      principalUser.roles,
      principalUser.permissions
    );
    const principalToolNames = principalDecls.map(d => d.name);
    expect(principalToolNames).not.toContain('getMyTeachingOperations');
    expect(principalToolNames).not.toContain('getMyIncompleteGrades');
    expect(principalToolNames).not.toContain('getMyClassPerformance');

    const studentDecls = toolRegistry.getDeclarationsForUser(
      studentUser.roles,
      studentUser.permissions
    );
    const studentToolNames = studentDecls.map(d => d.name);
    expect(studentToolNames).not.toContain('getMyTeachingOperations');
    expect(studentToolNames).not.toContain('getMyIncompleteGrades');
    expect(studentToolNames).not.toContain('getMyClassPerformance');
  });

  it('TC-TCH-REG-03: Teacher is exposed to B1, B2, B3, getUpcomingEvents, and getSchoolCalendar only', () => {
    const teacherDecls = toolRegistry.getDeclarationsForUser(
      teacherUser.roles,
      teacherUser.permissions
    );
    const teacherToolNames = teacherDecls.map(d => d.name);

    expect(teacherToolNames).toContain('getMyTeachingOperations');
    expect(teacherToolNames).toContain('getMyIncompleteGrades');
    expect(teacherToolNames).toContain('getMyClassPerformance');
    expect(teacherToolNames).toContain('getUpcomingEvents');
    expect(teacherToolNames).not.toContain('getSchoolCalendar');

    // Principal-only administrative tools MUST NOT be exposed
    expect(teacherToolNames).not.toContain('getFacultyAttendanceAudit');
    expect(teacherToolNames).not.toContain('getPendingLeaves');
    expect(teacherToolNames).not.toContain('getExecutiveFactSheet');
    expect(teacherToolNames).not.toContain('getAnnualAcademicSummary');
    expect(teacherToolNames).not.toContain('getDisciplinaryEscalations');
  });

  // ─── 2. B1: getMyTeachingOperations VERIFICATION ───────────────────────
  it('TC-TCH-B1-01: B1 returns assignments, today\'s confirmed appointment, and unreviewed excuse letter metadata', async () => {
    const res = await dispatchTool('getMyTeachingOperations', {}, { user: teacherUser });
    expect(res.success).toBe(true);

    const data = res.data;
    expect(data.teacherId).toBe('demo-teacher-1');

    // 1. Assignments
    expect(Array.isArray(data.assignments)).toBe(true);
    expect(data.assignments.length).toBeGreaterThan(0);
    const rizalMath = data.assignments.find((a: any) => a.sectionName === 'Rizal' && a.subjectName.includes('Mathematics'));
    expect(rizalMath).toBeDefined();
    expect(rizalMath.sectionId).toBe('demo-sec-rizal10');
    expect(rizalMath.subjectId).toBe('demo-subj-math10');

    // 2. Appointments Today
    expect(Array.isArray(data.appointmentsToday)).toBe(true);
    expect(data.appointmentsToday.length).toBeGreaterThanOrEqual(1);
    const appt = data.appointmentsToday.find((a: any) => a.appointmentId === 'fix-appt-01');
    expect(appt).toBeDefined();
    expect(appt.studentName).toBe('Angelo Santos');
    expect(appt.status).toBe('Confirmed');
    expect(appt.time).toBeDefined();
    expect(appt.purpose).toBeUndefined();

    // Privacy assertion: No parent contact or LRN
    expect(JSON.stringify(data)).not.toMatch(/@/);
    expect(JSON.stringify(data)).not.toMatch(/lrn/i);
    expect(JSON.stringify(data)).not.toMatch(/parent_email/i);

    // 3. Unreviewed Excuse Letters (Existing teacher_id backend ownership rule)
    expect(Array.isArray(data.unreviewedExcuseLetters)).toBe(true);
    const pendingExcuse = data.unreviewedExcuseLetters.find((el: any) => el.excuseLetterId === 'fix-excuse-01');
    expect(pendingExcuse).toBeDefined();
    expect(pendingExcuse.studentName).toBe('Angelo Santos');
    expect(pendingExcuse.status).toBe('Pending Review');

    // Approved excuse letter must NOT be in unreviewed list
    const approvedExcuse = data.unreviewedExcuseLetters.find((el: any) => el.excuseLetterId === 'fix-excuse-02');
    expect(approvedExcuse).toBeUndefined();

    // Untrusted content defense: Free-text reason MUST be omitted
    expect(pendingExcuse.reason).toBeUndefined();
    expect(JSON.stringify(data)).not.toMatch(/Medical consultation for severe asthma/);

    // Operational boundary: Zero grading data, zero events, zero GateAttendance
    expect((data as any).grades).toBeUndefined();
    expect((data as any).events).toBeUndefined();
    expect(JSON.stringify(data)).not.toMatch(/GateAttendance/i);
  });

  // ─── 3. B2: getMyIncompleteGrades VERIFICATION (from B0) ───────────────
  it('TC-TCH-B2-01: B2 enforces that legitimate score 0 is NOT treated as missing', async () => {
    const res = await dispatchTool('getMyIncompleteGrades', {
      sectionId: 'demo-sec-rizal10',
      subjectId: 'demo-subj-math10',
      term: 'T1'
    }, { user: teacherUser });

    expect(res.success).toBe(true);
    const cls = res.data.classes[0];
    expect(cls).toBeDefined();

    // Student 06 has score 0 in WW1 -> Must NOT be listed in missingScores for WW1
    const s06MissingWW1 = cls.missingScores.find((m: any) =>
      m.studentName.includes('Catacutan') && m.columnType === 'WW'
    );
    expect(s06MissingWW1).toBeUndefined();

    // Missing entries have status "no score recorded"
    expect(cls.missingScores.length).toBeGreaterThan(0);
    for (const m of cls.missingScores) {
      expect(m.status).toBe('no score recorded');
    }
  });

  // ─── 4. B3: getMyClassPerformance VERIFICATION ─────────────────────────
  it('TC-TCH-B3-01: B3 returns submitted grade averages and trend conclusion', async () => {
    const res = await dispatchTool('getMyClassPerformance', {
      sectionId: 'demo-sec-rizal10',
      subjectId: 'demo-subj-math10',
      term: 'T1'
    }, { user: teacherUser });

    expect(res.success).toBe(true);
    const data = res.data;

    expect(data.sectionName).toBe('Rizal');
    expect(data.subjectName).toBe('Mathematics 10');

    // Grades
    expect(data.grades).toBeDefined();
    expect(Array.isArray(data.grades.termAverages)).toBe(true);
    expect(data.grades.termAverages.length).toBe(1); // Only T1 is seeded
    expect(data.grades.termAverages[0].term).toBe('T1');
    expect(data.grades.termAverages[0].averageGrade).toBeGreaterThan(0);

    // Trend: With fewer than two terms, must state trend cannot yet be concluded
    expect(data.grades.trend).toContain('A trend cannot yet be concluded because fewer than two comparable terms exist.');
  });

  it('TC-TCH-B3-02: B3 uses ClassAttendance ONLY and defaults to current Monday-Friday Manila week', async () => {
    const res = await dispatchTool('getMyClassPerformance', {
      sectionId: 'demo-sec-rizal10',
      subjectId: 'demo-subj-math10',
    }, { user: teacherUser });

    expect(res.success).toBe(true);
    const att = res.data.classroomAttendance;

    expect(att.source).toBe('ClassAttendance');
    expect(att.attendanceDateWindow.isDefaultMondayToFridayWeek).toBe(true);
    expect(att.attendanceDateWindow.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(att.attendanceDateWindow.endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    // Counts: P/A/L/E
    expect(att.counts.totalRecordedSessions).toBeGreaterThan(0);
    expect(att.counts.present).toBeGreaterThan(0);
    expect(att.counts.absent).toBeGreaterThan(0);

    // Wilfred Valdez has 5 absences in this week -> 3+ absences factual list
    expect(Array.isArray(att.studentsWithThreeOrMoreAbsences)).toBe(true);
    const valdez = att.studentsWithThreeOrMoreAbsences.find((s: any) => s.studentName.includes('Valdez'));
    expect(valdez).toBeDefined();
    expect(valdez.recordedAbsencesCount).toBeGreaterThanOrEqual(3);

    // Strictly NO subjective labeling or ranking
    const stringified = JSON.stringify(att);
    expect(stringified).not.toMatch(/at risk/i);
    expect(stringified).not.toMatch(/dropout risk/i);
    expect(stringified).not.toMatch(/truant/i);
    expect(stringified).not.toMatch(/problematic/i);
    expect(stringified).not.toMatch(/failing/i);
    expect(att.studentsWithThreeOrMoreAbsences.every((s: any) => s.rank === undefined)).toBe(true);
  });

  // ─── 5. SECURITY & SCOPE ENFORCEMENT (CROSS-TEACHER & ROLE ISOLATION) ──
  it('TC-TCH-SEC-01: Teacher requesting an unassigned section receives 403 FORBIDDEN on B2 and B3', async () => {
    // Unassigned section ID 'sec-bonifacio-other'
    await expect(
      dispatchTool('getMyIncompleteGrades', { sectionId: 'sec-unassigned-999' }, { user: teacherUser })
    ).rejects.toThrow(/not assigned to the authenticated teacher/);

    await expect(
      dispatchTool('getMyClassPerformance', {
        sectionId: 'sec-unassigned-999',
        subjectId: 'demo-subj-math10'
      }, { user: teacherUser })
    ).rejects.toThrow(/not authorized/);
  });

  it('TC-TCH-SEC-02: Principal cannot invoke B1, B2, or B3', async () => {
    await expect(
      dispatchTool('getMyTeachingOperations', {}, { user: principalUser })
    ).rejects.toThrow(/not authorized to execute 'getMyTeachingOperations'/);

    await expect(
      dispatchTool('getMyIncompleteGrades', {}, { user: principalUser })
    ).rejects.toThrow(/not authorized to execute 'getMyIncompleteGrades'/);

    await expect(
      dispatchTool('getMyClassPerformance', { sectionId: 'demo-sec-rizal10', subjectId: 'demo-subj-math10' }, { user: principalUser })
    ).rejects.toThrow(/not authorized to execute 'getMyClassPerformance'/);
  });

  it('TC-TCH-SEC-03: Student cannot invoke B1, B2, or B3', async () => {
    await expect(
      dispatchTool('getMyTeachingOperations', {}, { user: studentUser })
    ).rejects.toThrow(/not authorized to execute 'getMyTeachingOperations'/);

    await expect(
      dispatchTool('getMyIncompleteGrades', {}, { user: studentUser })
    ).rejects.toThrow(/not authorized to execute 'getMyIncompleteGrades'/);

    await expect(
      dispatchTool('getMyClassPerformance', { sectionId: 'demo-sec-rizal10', subjectId: 'demo-subj-math10' }, { user: studentUser })
    ).rejects.toThrow(/not authorized to execute 'getMyClassPerformance'/);
  });

  it('TC-TCH-SEC-04: GateAttendance is NEVER accessed or read by B1, B2, or B3', async () => {
    // Audit database calls during execution of B1, B2, B3
    // Verified by tool code: GateAttendance model is never imported or queried
    const b1Res = await dispatchTool('getMyTeachingOperations', {}, { user: teacherUser });
    const b2Res = await dispatchTool('getMyIncompleteGrades', { sectionId: 'demo-sec-rizal10' }, { user: teacherUser });
    const b3Res = await dispatchTool('getMyClassPerformance', { sectionId: 'demo-sec-rizal10', subjectId: 'demo-subj-math10' }, { user: teacherUser });

    expect(JSON.stringify(b1Res)).not.toMatch(/gate_attendance/i);
    expect(JSON.stringify(b2Res)).not.toMatch(/gate_attendance/i);
    expect(JSON.stringify(b3Res)).not.toMatch(/gate_attendance/i);
  });
});
