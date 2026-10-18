import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { PrismaClient } from '@prisma/client';
import { generateId } from '../src/common/utils/uuid';
import { sign } from 'jsonwebtoken';
import { config } from '../src/config/env';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

describe('PRIN-004: Welfare Alerts Domain & Privacy Boundaries', () => {
  let principalToken: string;
  let principalUserId: string;

  let studentToken: string;
  let studentUserId: string;

  let nurseToken: string;
  let nurseUserId: string;

  let testStudentId1: string;
  let testStudentId2: string;
  let testStudentUserId1: string;
  let testStudentUserId2: string;

  let logReportedId: string;
  let logInvestigationId: string;
  let logNotifiedId: string;
  let logResolvedId: string;

  let baselineActiveAlerts = 0;
  let baselineFlaggedStudents = 0;

  beforeAll(async () => {
    // 1. Cleanup any previous test data
    try {
      const existing = await prisma.user.findMany({
        where: {
          email: {
            in: [
              'prin_welfare_test@calulut.edu.ph',
              'stud_welfare_test@calulut.edu.ph',
              'nurse_welfare_test@calulut.edu.ph',
              'welfare_stud_1@calulut.edu.ph',
              'welfare_stud_2@calulut.edu.ph',
            ],
          },
        },
      });
      if (existing.length > 0) {
        const uids = existing.map((u) => u.id);
        await prisma.behaviorLog.deleteMany({ where: { student: { user_id: { in: uids } } } });
        await prisma.userRole.deleteMany({ where: { user_id: { in: uids } } });
        await prisma.student.deleteMany({ where: { user_id: { in: uids } } });
        await prisma.user.deleteMany({ where: { id: { in: uids } } });
      }
    } catch (_err) {}

    // Capture baseline counts of active alerts in DB
    baselineActiveAlerts = await prisma.behaviorLog.count({
      where: { status: { in: ['Reported', 'Under investigation', 'Parent notified'] } },
    });
    const baselineDistinct = await prisma.behaviorLog.findMany({
      where: { status: { in: ['Reported', 'Under investigation', 'Parent notified'] } },
      distinct: ['student_id'],
      select: { student_id: true },
    });
    baselineFlaggedStudents = baselineDistinct.length;

    const pwHash = await bcrypt.hash('TestPassword123!', 10);

    // Create Principal Role & User
    principalUserId = generateId();
    await prisma.user.create({
      data: {
        id: principalUserId,
        email: 'prin_welfare_test@calulut.edu.ph',
        password_hash: pwHash,
        first_name: 'WelfareTest',
        last_name: 'Principal',
        status: 'active',
      },
    });
    const principalRole = await prisma.role.findUnique({ where: { name: 'Principal' } });
    if (principalRole) {
      await prisma.userRole.create({
        data: { user_id: principalUserId, role_id: principalRole.id },
      });
    }

    // Create Student Role & User (No behavior:read)
    studentUserId = generateId();
    await prisma.user.create({
      data: {
        id: studentUserId,
        email: 'stud_welfare_test@calulut.edu.ph',
        password_hash: pwHash,
        first_name: 'Student',
        last_name: 'Unauthorized',
        status: 'active',
      },
    });
    const studentRole = await prisma.role.findUnique({ where: { name: 'Student' } });
    if (studentRole) {
      await prisma.userRole.create({
        data: { user_id: studentUserId, role_id: studentRole.id },
      });
    }

    // Create Nurse Role & User (Has clinic:read, but lacks behavior:read)
    nurseUserId = generateId();
    await prisma.user.create({
      data: {
        id: nurseUserId,
        email: 'nurse_welfare_test@calulut.edu.ph',
        password_hash: pwHash,
        first_name: 'Nurse',
        last_name: 'Medical',
        status: 'active',
      },
    });
    const nurseRole = await prisma.role.findUnique({ where: { name: 'Nurse' } });
    if (nurseRole) {
      await prisma.userRole.create({
        data: { user_id: nurseUserId, role_id: nurseRole.id },
      });
    }

    // Create 2 Test Students for Behavior logs
    testStudentUserId1 = generateId();
    testStudentId1 = generateId();
    await prisma.user.create({
      data: {
        id: testStudentUserId1,
        email: 'welfare_stud_1@calulut.edu.ph',
        password_hash: pwHash,
        first_name: 'Arthur',
        last_name: 'Dent',
        status: 'active',
      },
    });
    await prisma.student.create({
      data: {
        id: testStudentId1,
        user_id: testStudentUserId1,
        lrn: '987654321001',
        grade_level: 10,
      },
    });

    testStudentUserId2 = generateId();
    testStudentId2 = generateId();
    await prisma.user.create({
      data: {
        id: testStudentUserId2,
        email: 'welfare_stud_2@calulut.edu.ph',
        password_hash: pwHash,
        first_name: 'Ford',
        last_name: 'Prefect',
        status: 'active',
      },
    });
    await prisma.student.create({
      data: {
        id: testStudentId2,
        user_id: testStudentUserId2,
        lrn: '987654321002',
        grade_level: 9,
      },
    });

    // Create Fixture Behavior Logs
    // 1. Reported (Active)
    logReportedId = generateId();
    await prisma.behaviorLog.create({
      data: {
        id: logReportedId,
        student_id: testStudentId1,
        type: 'Classroom Disruption',
        date: new Date(),
        status: 'Reported',
        note: 'Disrupted math class repeatedly.',
        reported_by: principalUserId,
      },
    });

    // 2. Under investigation (Active)
    logInvestigationId = generateId();
    await prisma.behaviorLog.create({
      data: {
        id: logInvestigationId,
        student_id: testStudentId1,
        type: 'Bullying Allegation',
        date: new Date(),
        status: 'Under investigation',
        note: 'Hallway altercation reported.',
        reported_by: principalUserId,
      },
    });

    // 3. Parent notified (Active - Student 2)
    logNotifiedId = generateId();
    await prisma.behaviorLog.create({
      data: {
        id: logNotifiedId,
        student_id: testStudentId2,
        type: 'Truancy',
        date: new Date(),
        status: 'Parent notified',
        note: 'Skipped 3rd period.',
        reported_by: principalUserId,
      },
    });

    // 4. Resolved (Must be EXCLUDED from active alerts)
    logResolvedId = generateId();
    await prisma.behaviorLog.create({
      data: {
        id: logResolvedId,
        student_id: testStudentId2,
        type: 'Minor Dress Code',
        date: new Date(),
        status: 'Resolved',
        note: 'Resolved with adviser counseling.',
        reported_by: principalUserId,
      },
    });

    // JWT Tokens
    principalToken = sign(
      { userId: principalUserId },
      config.jwt.secret,
      { expiresIn: '1h' }
    );
    studentToken = sign(
      { userId: studentUserId },
      config.jwt.secret,
      { expiresIn: '1h' }
    );
    nurseToken = sign(
      { userId: nurseUserId },
      config.jwt.secret,
      { expiresIn: '1h' }
    );
  });

  afterAll(async () => {
    try {
      await prisma.behaviorLog.deleteMany({
        where: { id: { in: [logReportedId, logInvestigationId, logNotifiedId, logResolvedId] } },
      });
      await prisma.student.deleteMany({
        where: { id: { in: [testStudentId1, testStudentId2] } },
      });
      await prisma.userRole.deleteMany({
        where: {
          user_id: { in: [principalUserId, studentUserId, nurseUserId, testStudentUserId1, testStudentUserId2] },
        },
      });
      await prisma.user.deleteMany({
        where: {
          id: { in: [principalUserId, studentUserId, nurseUserId, testStudentUserId1, testStudentUserId2] },
        },
      });
    } catch (_err) {}
    await prisma.$disconnect();
  });

  it('1. should reject unauthenticated request with 401 Unauthorized', async () => {
    const res = await request(app).get('/api/admin/welfare-alerts');
    expect(res.status).toBe(401);
  });

  it('2. should reject role lacking behavior:read (Student) with 403 Forbidden', async () => {
    const res = await request(app)
      .get('/api/admin/welfare-alerts')
      .set('Authorization', `Bearer ${studentToken}`);
    expect(res.status).toBe(403);
  });

  it('3. should reject role lacking behavior:read (Nurse) with 403 Forbidden (Strict Domain Isolation)', async () => {
    const res = await request(app)
      .get('/api/admin/welfare-alerts')
      .set('Authorization', `Bearer ${nurseToken}`);
    expect(res.status).toBe(403);
  });

  it('4. should allow Principal with behavior:read to fetch welfare alerts (200 OK)', async () => {
    const res = await request(app)
      .get('/api/admin/welfare-alerts')
      .set('Authorization', `Bearer ${principalToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('summary');
    expect(res.body.data).toHaveProperty('alerts');
    expect(Array.isArray(res.body.data.alerts)).toBe(true);
  });

  it('5. should include unresolved cases (Reported, Under investigation, Parent notified) in active alerts', async () => {
    const res = await request(app)
      .get('/api/admin/welfare-alerts')
      .set('Authorization', `Bearer ${principalToken}`);

    const alerts = res.body.data.alerts;
    const alertIds = alerts.map((a: any) => a.id);

    expect(alertIds).toContain(logReportedId);
    expect(alertIds).toContain(logInvestigationId);
    expect(alertIds).toContain(logNotifiedId);

    const reportedAlert = alerts.find((a: any) => a.id === logReportedId);
    expect(reportedAlert.status).toBe('Reported');
    expect(reportedAlert.incidentType).toBe('Classroom Disruption');
    expect(reportedAlert.studentName).toBe('Arthur Dent');

    const notifiedAlert = alerts.find((a: any) => a.id === logNotifiedId);
    expect(notifiedAlert.status).toBe('Parent notified');
    expect(notifiedAlert.incidentType).toBe('Truancy');
    expect(notifiedAlert.studentName).toBe('Ford Prefect');
  });

  it('6. should strictly EXCLUDE Resolved behavior logs from active alerts and summary counts', async () => {
    const res = await request(app)
      .get('/api/admin/welfare-alerts')
      .set('Authorization', `Bearer ${principalToken}`);

    const alerts = res.body.data.alerts;
    const alertIds = alerts.map((a: any) => a.id);

    // Resolved log MUST NOT be in the active alerts list
    expect(alertIds).not.toContain(logResolvedId);

    // Summary counts must reflect baseline + 3 active test logs (NOT the 4th resolved log)
    expect(res.body.data.summary.totalActiveAlerts).toBe(baselineActiveAlerts + 3);
  });

  it('7. should guarantee Privacy Boundary: payload contains zero Clinic and zero Guidance private data', async () => {
    const res = await request(app)
      .get('/api/admin/welfare-alerts')
      .set('Authorization', `Bearer ${principalToken}`);

    const jsonStr = JSON.stringify(res.body.data);

    // Verify zero clinic medical disclosures exist in response
    expect(jsonStr).not.toContain('diagnosis');
    expect(jsonStr).not.toContain('medications');
    expect(jsonStr).not.toContain('symptoms');
    expect(jsonStr).not.toContain('blood_pressure');

    // Verify zero guidance counseling disclosures exist in response
    expect(jsonStr).not.toContain('counselor_id');
    expect(jsonStr).not.toContain('action_taken');
  });

  it('8. should calculate unique students requiring attention accurately in summary', async () => {
    const res = await request(app)
      .get('/api/admin/welfare-alerts')
      .set('Authorization', `Bearer ${principalToken}`);

    // We added 2 unique students (Arthur Dent has 2 active logs, Ford Prefect has 1 active log)
    expect(res.body.data.summary.studentsRequiringAttention).toBeGreaterThanOrEqual(2);
    expect(res.body.data.summary.byStatus.reported).toBeGreaterThanOrEqual(1);
    expect(res.body.data.summary.byStatus.underInvestigation).toBeGreaterThanOrEqual(1);
    expect(res.body.data.summary.byStatus.parentNotified).toBeGreaterThanOrEqual(1);
  });

  it('9. should ensure Admin Dashboard summary matches Welfare Alerts active counts', async () => {
    const dashRes = await request(app)
      .get('/api/admin/dashboard')
      .set('Authorization', `Bearer ${principalToken}`);

    expect(dashRes.status).toBe(200);
    expect(dashRes.body.data).toHaveProperty('pendingDisciplineCases');
    expect(dashRes.body.data).toHaveProperty('studentsRequiringAttention');

    const welfareRes = await request(app)
      .get('/api/admin/welfare-alerts')
      .set('Authorization', `Bearer ${principalToken}`);

    expect(dashRes.body.data.pendingDisciplineCases).toBe(welfareRes.body.data.summary.totalActiveAlerts);
    expect(dashRes.body.data.studentsRequiringAttention).toBe(welfareRes.body.data.summary.studentsRequiringAttention);
  });

  it('10. should aggregate unresolved concerns by student in attentionStudents (one entry per student)', async () => {
    const res = await request(app)
      .get('/api/admin/welfare-alerts')
      .set('Authorization', `Bearer ${principalToken}`);

    expect(res.status).toBe(200);
    const { attentionStudents } = res.body.data;
    expect(Array.isArray(attentionStudents)).toBe(true);

    // Arthur Dent had 2 active logs (Reported + Under investigation) -> must appear exactly once with openConcernsCount: 2
    const arthur = attentionStudents.find((s: any) => s.studentId === testStudentId1);
    expect(arthur).toBeDefined();
    expect(arthur.studentName).toBe('Arthur Dent');
    expect(arthur.openConcernsCount).toBe(2);
    expect(arthur.incidentTypes).toContain('Classroom Disruption');
    expect(arthur.incidentTypes).toContain('Bullying Allegation');

    // Ford Prefect had 1 active log (Parent notified) and 1 resolved log -> openConcernsCount must be 1
    const ford = attentionStudents.find((s: any) => s.studentId === testStudentId2);
    expect(ford).toBeDefined();
    expect(ford.studentName).toBe('Ford Prefect');
    expect(ford.openConcernsCount).toBe(1);
    expect(ford.latestStatus).toBe('Parent notified');

    // Total unique attention students count should match summary
    expect(attentionStudents.length).toBe(res.body.data.summary.studentsRequiringAttention);
  });

  it('11. should verify Behavioral Reports API (/student-services/behavior) includes both active and resolved records', async () => {
    const res = await request(app)
      .get('/api/student-services/behavior')
      .set('Authorization', `Bearer ${principalToken}`);

    expect(res.status).toBe(200);
    const logs = res.body.data;
    expect(Array.isArray(logs)).toBe(true);

    const logIds = logs.map((l: any) => l.id);
    // Active logs must be present
    expect(logIds).toContain(logReportedId);
    expect(logIds).toContain(logInvestigationId);
    expect(logIds).toContain(logNotifiedId);
    // Resolved log MUST also be present in full Behavioral Reports
    expect(logIds).toContain(logResolvedId);
  });
});
