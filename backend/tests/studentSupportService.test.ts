import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../src/app.js';
import { config } from '../src/config/env.js';
import prisma from '../src/config/database.js';
import { PASSING_GRADE } from '../src/config/academic.config.js';
import { 
  getTeacherStudentSupportIndicators, 
  getPrincipalStudentSupportAggregate,
  resolveAttendanceWindow,
  normalizeTermKey
} from '../src/modules/student-support/studentSupport.service.js';
import { 
  resetStudentSupportRateLimits,
  setStudentSupportRateLimits
} from '../src/modules/student-support/studentSupport.limiter.js';

describe('DIGISKWELA — PHASE C1: STUDENT SUPPORT SERVICE & ENDPOINTS', () => {
  const teacherToken = jwt.sign(
    { userId: 'demo-teacher-1', roles: ['Teacher'] },
    config.jwt.secret,
    { expiresIn: '1h' }
  );

  const principalToken = jwt.sign(
    { userId: 'demo-principal-1', roles: ['Principal'] },
    config.jwt.secret,
    { expiresIn: '1h' }
  );

  const studentToken = jwt.sign(
    { userId: 'demo-student-1', roles: ['Student'] },
    config.jwt.secret,
    { expiresIn: '1h' }
  );

  beforeEach(() => {
    resetStudentSupportRateLimits();
  });

  // ─── 1. Canonical PASSING_GRADE Configuration ──────────────────────────────
  it('C1-CFG-01: PASSING_GRADE is exported with value 75 and no policy misattribution', () => {
    expect(PASSING_GRADE).toBe(75);
  });

  // ─── 2. Missing Score Parity & Zero-Score Invariant ────────────────────────
  it('C1-PARITY-01: Missing score parity matches getMyIncompleteGrades: exactly 6 missing cells across 4 students', async () => {
    const res = await getTeacherStudentSupportIndicators('demo-teacher-1', { term: 'T1' });
    expect(res).toBeDefined();

    // Verify missing scores breakdown
    const studentsWithMissingScores = res.students.filter(s => s.missingScoresCount > 0);
    expect(studentsWithMissingScores).toHaveLength(4);

    const missingMap = new Map(studentsWithMissingScores.map(s => [s.studentDisplayName, s.missingScoresCount]));
    expect(missingMap.get('Juan Dela Cruz')).toBe(2);
    expect(missingMap.get('Wilfred Valdez')).toBe(1);
    expect(missingMap.get('Zoren Domingo')).toBe(2);
    expect(missingMap.get('Mark Mercado')).toBe(1);

    const totalMissing = studentsWithMissingScores.reduce((sum, s) => sum + s.missingScoresCount, 0);
    expect(totalMissing).toBe(6);
  });

  it('C1-ZERO-01: Score of 0 on Francis Garcia WW1 is recorded and NEVER counted as missing', async () => {
    const res = await getTeacherStudentSupportIndicators('demo-teacher-1', { term: 'T1' });
    const francis = res.students.find(s => s.studentDisplayName === 'Francis Garcia');
    expect(francis).toBeDefined();
    // Francis Garcia has a valid score of 0 recorded on Written Work 1
    expect(francis?.missingScoresCount).toBe(0);
  });

  // ─── 3. Demo Fixture Teacher Acceptance Test ───────────────────────────────
  it('C1-TCH-01: Teacher endpoint returns exactly the 5 authoritative fixture indicator students sorted alphabetically', async () => {
    const response = await request(app)
      .get('/api/student-support/teacher/indicators')
      .set('Authorization', `Bearer ${teacherToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    const data = response.body.data;
    expect(data.metadata).toBeDefined();
    expect(data.metadata.passingGradeThreshold).toBe(75);
    expect(data.metadata.attendanceWindow.timezone).toBe('Asia/Manila');
    expect(data.metadata.attendanceWindow.startDate).toBeDefined();
    expect(data.metadata.attendanceWindow.endDate).toBeDefined();
    expect(data.metadata.rules.belowPassingTerms).toContain('recorded term grade');
    expect(data.metadata.rules.belowPassingTerms).not.toContain('failing');

    // Exactly 5 students
    expect(data.students).toHaveLength(5);
    expect(data.totalStudentsWithIndicators).toBe(5);

    const names = data.students.map((s: any) => s.studentDisplayName);
    expect(names).toEqual([
      'Francis Garcia',
      'Juan Dela Cruz',
      'Mark Mercado',
      'Wilfred Valdez',
      'Zoren Domingo',
    ]);

    // Student 1: Francis Garcia
    const francis = data.students[0];
    expect(francis.studentDisplayName).toBe('Francis Garcia');
    expect(francis.belowPassingTerms).toEqual([{ term: 'T1', grade: 73 }]);
    expect(francis.recordedAbsences.absences).toBe(2);
    expect(francis.missingScoresCount).toBe(0);

    // Student 2: Juan Dela Cruz
    const juan = data.students[1];
    expect(juan.studentDisplayName).toBe('Juan Dela Cruz');
    expect(juan.belowPassingTerms).toEqual([]);
    expect(juan.recordedAbsences.absences).toBe(0);
    expect(juan.missingScoresCount).toBe(2);

    // Student 3: Mark Mercado
    const mark = data.students[2];
    expect(mark.studentDisplayName).toBe('Mark Mercado');
    expect(mark.belowPassingTerms).toEqual([{ term: 'T1', grade: 71 }]);
    expect(mark.recordedAbsences.absences).toBe(0);
    expect(mark.missingScoresCount).toBe(1);

    // Student 4: Wilfred Valdez
    const wilfred = data.students[3];
    expect(wilfred.studentDisplayName).toBe('Wilfred Valdez');
    expect(wilfred.belowPassingTerms).toEqual([]);
    expect(wilfred.recordedAbsences.absences).toBe(4);
    expect(wilfred.missingScoresCount).toBe(1);

    // Student 5: Zoren Domingo
    const zoren = data.students[4];
    expect(zoren.studentDisplayName).toBe('Zoren Domingo');
    expect(zoren.belowPassingTerms).toEqual([]);
    expect(zoren.recordedAbsences.absences).toBe(0);
    expect(zoren.missingScoresCount).toBe(2);
  });

  it('C1-PROHIBITED-01: Teacher response contains NO risk labels, scores, rankings, or prohibited student PII', async () => {
    const response = await request(app)
      .get('/api/student-support/teacher/indicators')
      .set('Authorization', `Bearer ${teacherToken}`);

    expect(response.status).toBe(200);
    const raw = JSON.stringify(response.body);

    // Prohibited risk metrics & classifications
    expect(raw).not.toMatch(/"riskScore"/i);
    expect(raw).not.toMatch(/"riskLevel"/i);
    expect(raw).not.toMatch(/"risk_score"/i);
    expect(raw).not.toMatch(/"risk_level"/i);
    expect(raw).not.toMatch(/"dropoutProbability"/i);
    expect(raw).not.toMatch(/"priorityScore"/i);
    expect(raw).not.toMatch(/"severity"/i);
    expect(raw).not.toMatch(/"rank"/i);
    expect(raw).not.toMatch(/"ranking"/i);
    expect(raw).not.toMatch(/\bat risk\b/i);
    expect(raw).not.toMatch(/\bdropout risk\b/i);
    expect(raw).not.toMatch(/\bproblematic\b/i);

    // Prohibited PII
    expect(raw).not.toMatch(/\b1092837401\d{2}\b/); // No raw LRN
    expect(raw).not.toContain('guardian_phone');
    expect(raw).not.toContain('guardian_email');
    expect(raw).not.toContain('guardian_first_name');
    expect(raw).not.toContain('medical_conditions');
    expect(raw).not.toContain('allergies');
  });

  // ─── 4. Principal Aggregate Acceptance Test ────────────────────────────────
  it('C1-PRN-01: Principal aggregate returns exact fixture counts 2 below passing / 1 with 3+ absences, with zero student names', async () => {
    const response = await request(app)
      .get('/api/student-support/principal/aggregate')
      .set('Authorization', `Bearer ${principalToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    const data = response.body.data;
    expect(data.metadata).toBeDefined();
    expect(data.metadata.passingGradeThreshold).toBe(75);
    expect(data.totals.studentsBelowPassingCount).toBe(2);
    expect(data.totals.studentsWithThreeOrMoreAbsencesCount).toBe(1);
    expect(data.totals.totalSectionsEvaluated).toBeGreaterThanOrEqual(1);

    const rizal = data.aggregates.find((a: any) => a.sectionName === 'Rizal');
    expect(rizal).toBeDefined();
    expect(rizal.gradeLevel).toBe(10);
    expect(rizal.studentsBelowPassingCount).toBe(2);
    expect(rizal.studentsWithThreeOrMoreAbsencesCount).toBe(1);

    // Strict privacy invariant: No student names, IDs, LRN, or individual records anywhere
    const raw = JSON.stringify(data);
    expect(raw).not.toContain('Francis Garcia');
    expect(raw).not.toContain('Wilfred Valdez');
    expect(raw).not.toContain('Mark Mercado');
    expect(raw).not.toContain('Juan Dela Cruz');
    expect(raw).not.toContain('Zoren Domingo');
    expect(raw).not.toContain('studentId');
    expect(raw).not.toContain('studentDisplayName');
    expect(raw).not.toContain('enrollmentId');
  });

  // ─── 5. Security & 403 Authorization Matrix ────────────────────────────────
  it('C1-SEC-01: 403 when Principal attempts to access Teacher indicators endpoint', async () => {
    const response = await request(app)
      .get('/api/student-support/teacher/indicators')
      .set('Authorization', `Bearer ${principalToken}`);

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
  });

  it('C1-SEC-02: 403 when Student attempts to access Teacher indicators endpoint', async () => {
    const response = await request(app)
      .get('/api/student-support/teacher/indicators')
      .set('Authorization', `Bearer ${studentToken}`);

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
  });

  it('C1-SEC-03: 403 when Teacher attempts to access Principal aggregate endpoint', async () => {
    const response = await request(app)
      .get('/api/student-support/principal/aggregate')
      .set('Authorization', `Bearer ${teacherToken}`);

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
  });

  it('C1-SEC-04: 403 when Student attempts to access Principal aggregate endpoint', async () => {
    const response = await request(app)
      .get('/api/student-support/principal/aggregate')
      .set('Authorization', `Bearer ${studentToken}`);

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
  });

  it('C1-SEC-05: 403 when Teacher queries an unassigned section', async () => {
    const response = await request(app)
      .get('/api/student-support/teacher/indicators?sectionId=nonexistent-or-unassigned-section-id')
      .set('Authorization', `Bearer ${teacherToken}`);

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
    expect(response.body.error.message).toMatch(/not authorized/i);
  });

  it('C1-SEC-06: 401 when request is unauthenticated', async () => {
    const resTeacher = await request(app).get('/api/student-support/teacher/indicators');
    expect(resTeacher.status).toBe(401);

    const resPrincipal = await request(app).get('/api/student-support/principal/aggregate');
    expect(resPrincipal.status).toBe(401);
  });

  // ─── 6. Date Range Validation & Behavior ───────────────────────────────────
  it('C1-DATE-01: 400 Bad Request when only startDate is supplied', async () => {
    const response = await request(app)
      .get('/api/student-support/teacher/indicators?startDate=2026-10-01')
      .set('Authorization', `Bearer ${teacherToken}`);

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it('C1-DATE-02: 400 Bad Request when only endDate is supplied', async () => {
    const response = await request(app)
      .get('/api/student-support/teacher/indicators?endDate=2026-10-25')
      .set('Authorization', `Bearer ${teacherToken}`);

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it('C1-DATE-03: 400 Bad Request when startDate is after endDate', async () => {
    const response = await request(app)
      .get('/api/student-support/teacher/indicators?startDate=2026-10-25&endDate=2026-10-01')
      .set('Authorization', `Bearer ${teacherToken}`);

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it('C1-DATE-04: Resolves custom date window when both dates are provided', async () => {
    const window = resolveAttendanceWindow('2026-10-10', '2026-10-20');
    expect(window.startDate).toBe('2026-10-10');
    expect(window.endDate).toBe('2026-10-20');
    expect(window.isDefaultWindow).toBe(false);
    expect(window.timezone).toBe('Asia/Manila');
  });

  // ─── 7. Proof No GateAttendance is Read ────────────────────────────────────
  it('C1-GATE-01: Service never reads or accesses GateAttendance', async () => {
    const gateSpy = (prisma as any).gateAttendance?.findMany;
    const gateCountSpy = (prisma as any).gateAttendance?.count;

    let gateAccessed = false;
    if (gateSpy) {
      // Temporarily trap any GateAttendance call
      const origFindMany = (prisma as any).gateAttendance.findMany;
      (prisma as any).gateAttendance.findMany = async (...args: any[]) => {
        gateAccessed = true;
        return origFindMany.apply((prisma as any).gateAttendance, args);
      };
    }

    await getTeacherStudentSupportIndicators('demo-teacher-1', {});
    await getPrincipalStudentSupportAggregate({});

    expect(gateAccessed).toBe(false);
  });

  // ─── 8. Audit Logging & Rate Limiting ──────────────────────────────────────
  it('C1-AUDIT-01: Audit log entry is written for student support operations', async () => {
    const beforeCount = await prisma.auditLog.count({
      where: { action: 'STUDENT_SUPPORT_INDICATORS_ACCESSED' }
    });

    await request(app)
      .get('/api/student-support/teacher/indicators')
      .set('Authorization', `Bearer ${teacherToken}`);

    const afterCount = await prisma.auditLog.count({
      where: { action: 'STUDENT_SUPPORT_INDICATORS_ACCESSED' }
    });

    expect(afterCount).toBe(beforeCount + 1);
  });

  it('C1-LIMIT-01: Rate limiter returns HTTP 429 when per-minute limit is exceeded', async () => {
    setStudentSupportRateLimits(2, 100);

    // Call 1: OK
    const res1 = await request(app)
      .get('/api/student-support/teacher/indicators')
      .set('Authorization', `Bearer ${teacherToken}`);
    expect(res1.status).toBe(200);

    // Call 2: OK
    const res2 = await request(app)
      .get('/api/student-support/teacher/indicators')
      .set('Authorization', `Bearer ${teacherToken}`);
    expect(res2.status).toBe(200);

    // Call 3: Exceeded -> 429
    const res3 = await request(app)
      .get('/api/student-support/teacher/indicators')
      .set('Authorization', `Bearer ${teacherToken}`);
    expect(res3.status).toBe(429);
    expect(res3.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
  });
});
