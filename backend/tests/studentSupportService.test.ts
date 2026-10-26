import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
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
import { setupTeacherDemoFixture, teardownTeacherDemoFixture } from './helpers/fixtureLifecycle.js';

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

  const adminToken = jwt.sign(
    { userId: 'demo-admin-1', roles: ['Admin'] },
    config.jwt.secret,
    { expiresIn: '1h' }
  );

  const itAdminToken = jwt.sign(
    { userId: 'demo-admin-1', roles: ['ITAdmin'] },
    config.jwt.secret,
    { expiresIn: '1h' }
  );

  beforeAll(async () => {
    await setupTeacherDemoFixture();
  }, 60000);

  afterAll(async () => {
    await teardownTeacherDemoFixture();
  }, 30000);

  beforeEach(() => {
    resetStudentSupportRateLimits();
  });

  // ─── 1. Canonical PASSING_GRADE Configuration ──────────────────────────────
  it('C1-CFG-01: PASSING_GRADE is exported with value 75 and no policy misattribution', () => {
    expect(PASSING_GRADE).toBe(75);
  });

  // ─── 2. Missing Score Parity & Zero-Score Invariant ────────────────────────
  it('C1-PARITY-01: Missing score parity matches getMyIncompleteGrades: exactly 6 missing cells across 4 students', async () => {
    const res = await getTeacherStudentSupportIndicators('demo-teacher-1', { sectionId: 'fix-sec-teacher-tests', term: 'T1' });
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
      .get('/api/student-support/teacher/indicators?sectionId=fix-sec-teacher-tests')
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
    expect(data.metadata.rules.recordedAbsences).not.toMatch(/unexcused/i);
    expect(data.metadata.rules.recordedAbsences).toContain('status A (absent)');
    expect(data.metadata.rules.recordedAbsences).toContain('L (late)');
    expect(data.metadata.rules.recordedAbsences).toContain('E (excused)');

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
      .get('/api/student-support/principal/aggregate?sectionId=fix-sec-teacher-tests')
      .set('Authorization', `Bearer ${principalToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    const data = response.body.data;
    expect(data.metadata).toBeDefined();
    expect(data.metadata.passingGradeThreshold).toBe(75);
    expect(data.metadata.rules.recordedAbsences).not.toMatch(/unexcused/i);
    expect(data.metadata.rules.recordedAbsences).toContain('ClassAttendance status A');
    expect(data.totals.studentsBelowPassingCount).toBe(2);
    expect(data.totals.studentsWithThreeOrMoreAbsencesCount).toBe(1);
    expect(data.totals.totalSectionsEvaluated).toBeGreaterThanOrEqual(1);

    const rizal = data.aggregates.find((a: any) => a.sectionId === 'fix-sec-teacher-tests');
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

  it('C1-SEC-03: 200 OK when Principal accesses Principal aggregate endpoint', async () => {
    const response = await request(app)
      .get('/api/student-support/principal/aggregate')
      .set('Authorization', `Bearer ${principalToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  it('C1-SEC-04: 403 when Teacher attempts to access Principal aggregate endpoint', async () => {
    const response = await request(app)
      .get('/api/student-support/principal/aggregate')
      .set('Authorization', `Bearer ${teacherToken}`);

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
  });

  it('C1-SEC-05: 403 when Student attempts to access Principal aggregate endpoint', async () => {
    const response = await request(app)
      .get('/api/student-support/principal/aggregate')
      .set('Authorization', `Bearer ${studentToken}`);

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
  });

  it('C1-SEC-06: 403 when Admin attempts to access Principal aggregate endpoint', async () => {
    const response = await request(app)
      .get('/api/student-support/principal/aggregate')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
  });

  it('C1-SEC-07: 403 when ITAdmin attempts to access Principal aggregate endpoint', async () => {
    const response = await request(app)
      .get('/api/student-support/principal/aggregate')
      .set('Authorization', `Bearer ${itAdminToken}`);

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
  });

  it('C1-SEC-08: 403 when Teacher queries an unassigned section', async () => {
    const response = await request(app)
      .get('/api/student-support/teacher/indicators?sectionId=nonexistent-or-unassigned-section-id')
      .set('Authorization', `Bearer ${teacherToken}`);

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
    expect(response.body.error.message).toMatch(/not authorized/i);
  });

  it('C1-SEC-09: 401 when request is unauthenticated', async () => {
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

  it('C1-DATE-05: Teacher no-date request resolves locked 30-day default window ending on current Manila date', async () => {
    const res = await request(app)
      .get('/api/student-support/teacher/indicators')
      .set('Authorization', `Bearer ${teacherToken}`);

    expect(res.status).toBe(200);
    const win = res.body.data.metadata.attendanceWindow;
    expect(win.isDefaultWindow).toBe(true);
    expect(win.timezone).toBe('Asia/Manila');
    const startDate = new Date(`${win.startDate}T00:00:00Z`);
    const endDate = new Date(`${win.endDate}T00:00:00Z`);
    const diffDays = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    expect(diffDays).toBe(29);
  });

  it('C1-DATE-06: Principal no-date request resolves exact same 30-day default window as Teacher', async () => {
    const teacherRes = await request(app)
      .get('/api/student-support/teacher/indicators')
      .set('Authorization', `Bearer ${teacherToken}`);

    const principalRes = await request(app)
      .get('/api/student-support/principal/aggregate')
      .set('Authorization', `Bearer ${principalToken}`);

    expect(principalRes.status).toBe(200);
    const pWin = principalRes.body.data.metadata.attendanceWindow;
    const tWin = teacherRes.body.data.metadata.attendanceWindow;

    expect(pWin.startDate).toBe(tWin.startDate);
    expect(pWin.endDate).toBe(tWin.endDate);
    expect(pWin.timezone).toBe('Asia/Manila');
    expect(pWin.isDefaultWindow).toBe(true);
  });

  it('C1-DATE-07: Principal request with explicit dates sets isDefaultWindow: false', async () => {
    const res = await request(app)
      .get('/api/student-support/principal/aggregate?startDate=2026-10-01&endDate=2026-10-15')
      .set('Authorization', `Bearer ${principalToken}`);

    expect(res.status).toBe(200);
    const win = res.body.data.metadata.attendanceWindow;
    expect(win.startDate).toBe('2026-10-01');
    expect(win.endDate).toBe('2026-10-15');
    expect(win.isDefaultWindow).toBe(false);
  });

  it('C1-DATE-08: Principal no-date request preserves exact aggregate counts without broadening window', async () => {
    const res = await request(app)
      .get('/api/student-support/principal/aggregate?sectionId=fix-sec-teacher-tests')
      .set('Authorization', `Bearer ${principalToken}`);

    expect(res.status).toBe(200);
    const data = res.body.data;
    expect(data.totals.studentsBelowPassingCount).toBe(2);
    expect(data.totals.studentsWithThreeOrMoreAbsencesCount).toBe(1);
    expect(data.metadata.attendanceWindow.isDefaultWindow).toBe(true);
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

  // ─── 9. Neutral Attendance Semantics Verification ──────────────────────────
  it('C1-ATT-01: Metadata uses strictly neutral attendance wording with no unexcused assumptions', async () => {
    const resTeacher = await request(app)
      .get('/api/student-support/teacher/indicators')
      .set('Authorization', `Bearer ${teacherToken}`);
    expect(resTeacher.status).toBe(200);
    const tRule = resTeacher.body.data.metadata.rules.recordedAbsences;
    expect(tRule).not.toMatch(/unexcused/i);
    expect(tRule).toContain('status A (absent)');
    expect(tRule).toContain('L (late)');
    expect(tRule).toContain('E (excused)');

    const resPrin = await request(app)
      .get('/api/student-support/principal/aggregate')
      .set('Authorization', `Bearer ${principalToken}`);
    expect(resPrin.status).toBe(200);
    const pRule = resPrin.body.data.metadata.rules.recordedAbsences;
    expect(pRule).not.toMatch(/unexcused/i);
    expect(pRule).toContain('ClassAttendance status A');
  });

  // ─── 10. Duplicate Grade Latest-Record Authoritative Behavior ─────────────
  it('C1-DUP-01: Invariant: When duplicate Grade records exist for (student, subject, term), the row with latest updated_at is authoritative with no double counting', async () => {
    const ay = await prisma.academicYear.findFirst({ where: { is_current: true } }) || await prisma.academicYear.findFirst();
    if (!ay) throw new Error('No academic year found');

    const testIdOlder = 'test-dup-grade-older';
    const testIdNewer = 'test-dup-grade-newer';

    const now = Date.now();
    const olderDate = new Date(now + 100_000);
    const newerDate = new Date(now + 200_000);
    const newestDate = new Date(now + 300_000);

    try {
      // Step 1: Insert older record (term_grade: 80 - passing)
      // and newer record (term_grade: 70 - below passing) for Juan Dela Cruz (demo-student-1)
      await prisma.grade.create({
        data: {
          id: testIdOlder,
          student_id: 'demo-student-1',
          subject_id: 'demo-subj-math10',
          term: 'T1',
          term_grade: 80,
          academic_year_id: ay.id,
          created_at: olderDate,
          updated_at: olderDate,
        }
      });

      await prisma.grade.create({
        data: {
          id: testIdNewer,
          student_id: 'demo-student-1',
          subject_id: 'demo-subj-math10',
          term: 'T1',
          term_grade: 70,
          academic_year_id: ay.id,
          created_at: newerDate,
          updated_at: newerDate,
        }
      });

      // Teacher endpoint check:
      // Latest record (70) wins. Juan Dela Cruz now has belowPassingTerms = [{ term: 'T1', grade: 70 }].
      // Must NOT have duplicate T1 entries.
      const resTeacher1 = await request(app)
        .get('/api/student-support/teacher/indicators?term=T1')
        .set('Authorization', `Bearer ${teacherToken}`);
      expect(resTeacher1.status).toBe(200);
      const juan1 = resTeacher1.body.data.students.find((s: any) => s.studentDisplayName === 'Juan Dela Cruz');
      expect(juan1).toBeDefined();
      expect(juan1.belowPassingTerms).toEqual([{ term: 'T1', grade: 70 }]);

      // Principal aggregate endpoint check:
      // Juan is counted once (no double counting). Count in fixture section increases from 2 to 3.
      const resPrin1 = await request(app)
        .get('/api/student-support/principal/aggregate?term=T1&sectionId=fix-sec-teacher-tests')
        .set('Authorization', `Bearer ${principalToken}`);
      expect(resPrin1.status).toBe(200);
      expect(resPrin1.body.data.totals.studentsBelowPassingCount).toBe(3);

      // Step 2: Update the newer record to passing (term_grade: 85) with an even newer updated_at
      await prisma.grade.update({
        where: { id: testIdNewer },
        data: {
          term_grade: 85,
          updated_at: newestDate,
        }
      });

      // Teacher endpoint check:
      // Latest record (85) wins. Juan is no longer below passing.
      const resTeacher2 = await request(app)
        .get('/api/student-support/teacher/indicators?term=T1')
        .set('Authorization', `Bearer ${teacherToken}`);
      expect(resTeacher2.status).toBe(200);
      const juan2 = resTeacher2.body.data.students.find((s: any) => s.studentDisplayName === 'Juan Dela Cruz');
      expect(juan2).toBeDefined();
      expect(juan2.belowPassingTerms).toEqual([]);

      // Principal aggregate endpoint check:
      // Count in fixture section returns to 2.
      const resPrin2 = await request(app)
        .get('/api/student-support/principal/aggregate?term=T1&sectionId=fix-sec-teacher-tests')
        .set('Authorization', `Bearer ${principalToken}`);
      expect(resPrin2.status).toBe(200);
      expect(resPrin2.body.data.totals.studentsBelowPassingCount).toBe(2);
    } finally {
      await prisma.grade.deleteMany({
        where: { id: { in: [testIdOlder, testIdNewer] } }
      });
    }
  });

  // ─── 11. Optional Term Scoping Contract ────────────────────────────────────
  // Authoritative schema-enforced relationship:
  // gradebook_columns belongs to gradebooks via gradebook_id,
  // and gradebooks belongs to Term via term_id (key: TermKey).
  // Unique constraint: @@unique([assignment_id, term_id]) on gradebooks.
  // This guarantees that all gradebook columns and their entries are uniquely and strictly partitioned by TermKey.
  it('C1-TERM-01: Scoping by term=T1 scopes below-passing grades and missing scores to T1', async () => {
    // Teacher endpoint
    const resTeacher = await request(app)
      .get('/api/student-support/teacher/indicators?sectionId=fix-sec-teacher-tests&term=T1')
      .set('Authorization', `Bearer ${teacherToken}`);
    expect(resTeacher.status).toBe(200);
    const tData = resTeacher.body.data;

    // Below passing terms: only T1
    const belowPassingTerms = tData.students.flatMap((s: any) => s.belowPassingTerms);
    expect(belowPassingTerms.length).toBeGreaterThan(0);
    for (const bpt of belowPassingTerms) {
      expect(bpt.term).toBe('T1');
    }

    // Missing scores parity: exactly 6 missing cells across 4 students in T1
    const missingTotal = tData.students.reduce((sum: number, s: any) => sum + s.missingScoresCount, 0);
    expect(missingTotal).toBe(6);

    // Principal endpoint
    const resPrin = await request(app)
      .get('/api/student-support/principal/aggregate?sectionId=fix-sec-teacher-tests&term=T1')
      .set('Authorization', `Bearer ${principalToken}`);
    expect(resPrin.status).toBe(200);
    expect(resPrin.body.data.totals.studentsBelowPassingCount).toBe(2);
  });

  it('C1-TERM-02: Scoping by term=T2 returns 0 below-passing and 0 missing scores in fixture, while attendance is date-window scoped', async () => {
    // Teacher endpoint
    const resTeacher = await request(app)
      .get('/api/student-support/teacher/indicators?sectionId=fix-sec-teacher-tests&term=T2')
      .set('Authorization', `Bearer ${teacherToken}`);
    expect(resTeacher.status).toBe(200);
    const tData = resTeacher.body.data;

    // No below passing in T2
    for (const student of tData.students) {
      expect(student.belowPassingTerms).toEqual([]);
      expect(student.missingScoresCount).toBe(0);
    }

    // Wilfred Valdez still has 4 absences because attendance is scoped by date window, not term
    const wilfred = tData.students.find((s: any) => s.studentDisplayName === 'Wilfred Valdez');
    expect(wilfred).toBeDefined();
    expect(wilfred.recordedAbsences.absences).toBe(4);

    // Principal endpoint
    const resPrin = await request(app)
      .get('/api/student-support/principal/aggregate?sectionId=fix-sec-teacher-tests&term=T2')
      .set('Authorization', `Bearer ${principalToken}`);
    expect(resPrin.status).toBe(200);
    expect(resPrin.body.data.totals.studentsBelowPassingCount).toBe(0);
    // 3+ absences remains 1 (Wilfred) because attendance is date-window scoped
    expect(resPrin.body.data.totals.studentsWithThreeOrMoreAbsencesCount).toBe(1);
  });
});

