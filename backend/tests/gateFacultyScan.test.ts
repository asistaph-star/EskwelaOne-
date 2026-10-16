import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../src/app.js';
import prisma from '../src/config/database.js';
import { generateId } from '../src/common/utils/uuid.js';
import { config } from '../src/config/env.js';
import { getPhilippineCalendarDate } from '../src/common/utils/dateTime.js';

describe('Unified Gate Attendance Dispatcher (Student & Faculty Physical Scan)', () => {
  const ts = Date.now();
  let gateOperatorToken: string;
  let principalToken: string;

  let testStudentId: string;
  let testStudentUserId: string;
  const studentLrn = `99${ts.toString().slice(-10)}`; // 12-digit numeric LRN

  let testTeacherId: string;
  let testTeacherUserId: string;
  const teacherScanIdentifier = `EMP-TEST-${ts}`;
  const inactiveScanIdentifier = `EMP-INACT-${ts}`;

  let collisionBarcode: string;
  let collisionStudentId: string;
  let collisionTeacherId: string;

  const createdUserIds: string[] = [];
  const createdStudentIds: string[] = [];
  const createdTeacherIds: string[] = [];
  const createdCredentialIds: string[] = [];

  const createUserWithToken = async (email: string, roles: string[], permissions: string[]) => {
    const id = generateId();
    createdUserIds.push(id);
    const user = await prisma.user.create({
      data: {
        id,
        email,
        password_hash: 'test_hash',
        first_name: 'GateTest',
        last_name: 'User',
        status: 'active',
      },
    });

    for (const roleName of roles) {
      let role = await prisma.role.findFirst({ where: { name: roleName } });
      if (!role) role = await prisma.role.create({ data: { id: generateId(), name: roleName } });
      await prisma.userRole.create({ data: { user_id: user.id, role_id: role.id } });

      for (const p of permissions) {
        let perm = await prisma.permission.findFirst({ where: { key: p } });
        if (!perm) perm = await prisma.permission.create({ data: { id: generateId(), key: p } });
        const existingRP = await prisma.rolePermission.findFirst({
          where: { role_id: role.id, permission_id: perm.id },
        });
        if (!existingRP) {
          await prisma.rolePermission.create({ data: { role_id: role.id, permission_id: perm.id } });
        }
      }
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email, roles, permissions },
      config.jwt.secret,
      { expiresIn: '1h' }
    );
    return { user, token };
  };

  beforeAll(async () => {
    // 1. GateOperator user with attendance:write (least privilege: NO faculty_attendance:write)
    const gateUser = await createUserWithToken(`gate-op-${ts}@test.com`, ['GateOperator'], ['attendance:write', 'attendance:read']);
    gateOperatorToken = gateUser.token;

    // 2. Principal user with faculty_attendance:read
    const principalUser = await createUserWithToken(`principal-${ts}@test.com`, ['Principal'], ['faculty_attendance:read', 'attendance:read']);
    principalToken = principalUser.token;

    // 3. Test Student
    const studentUser = await createUserWithToken(`student-${ts}@test.com`, ['Student'], []);
    testStudentUserId = studentUser.user.id;
    testStudentId = generateId();
    createdStudentIds.push(testStudentId);
    await prisma.student.create({
      data: {
        id: testStudentId,
        user_id: testStudentUserId,
        lrn: studentLrn,
        grade_level: 10,
      },
    });

    // 4. Test Teacher with TeacherScanCredential
    const teacherUser = await createUserWithToken(`teacher-${ts}@test.com`, ['Teacher'], []);
    testTeacherUserId = teacherUser.user.id;
    testTeacherId = generateId();
    createdTeacherIds.push(testTeacherId);
    await prisma.teacher.create({
      data: {
        id: testTeacherId,
        user_id: testTeacherUserId,
        employee_id: `EMP-INST-${ts}`,
        department: 'Science',
        position: 'Master Teacher I',
      },
    });

    // Active scan credential
    const credId = generateId();
    createdCredentialIds.push(credId);
    await prisma.teacherScanCredential.create({
      data: {
        id: credId,
        teacher_id: testTeacherId,
        scan_identifier: teacherScanIdentifier,
        is_active: true,
      },
    });

    // Inactive scan credential (simulating retired card)
    const inactCredId = generateId();
    createdCredentialIds.push(inactCredId);
    await prisma.teacherScanCredential.create({
      data: {
        id: inactCredId,
        teacher_id: testTeacherId,
        scan_identifier: inactiveScanIdentifier,
        is_active: false,
      },
    });

    // 5. Setup collision scenario (same barcode assigned to a student and an active teacher credential)
    collisionBarcode = `COLLIDE-${ts}`;
    const collisionStudentUser = await createUserWithToken(`col-std-${ts}@test.com`, ['Student'], []);
    collisionStudentId = generateId();
    createdStudentIds.push(collisionStudentId);
    await prisma.student.create({
      data: {
        id: collisionStudentId,
        user_id: collisionStudentUser.user.id,
        lrn: collisionBarcode,
        grade_level: 9,
      },
    });

    const collisionTeacherUser = await createUserWithToken(`col-tch-${ts}@test.com`, ['Teacher'], []);
    collisionTeacherId = generateId();
    createdTeacherIds.push(collisionTeacherId);
    await prisma.teacher.create({
      data: {
        id: collisionTeacherId,
        user_id: collisionTeacherUser.user.id,
        employee_id: `EMP-COL-${ts}`,
        department: 'Mathematics',
        position: 'Teacher I',
      },
    });

    const colCredId = generateId();
    createdCredentialIds.push(colCredId);
    await prisma.teacherScanCredential.create({
      data: {
        id: colCredId,
        teacher_id: collisionTeacherId,
        scan_identifier: collisionBarcode,
        is_active: true,
      },
    });
  });

  afterAll(async () => {
    try {
      await prisma.auditLog.deleteMany({ where: { actor_user_id: { in: createdUserIds } } });
      await prisma.gateAttendance.deleteMany({ where: { student_id: { in: createdStudentIds } } });
      await prisma.facultyAttendance.deleteMany({ where: { teacher_id: { in: createdTeacherIds } } });
      await prisma.teacherScanCredential.deleteMany({ where: { id: { in: createdCredentialIds } } });
      await prisma.student.deleteMany({ where: { id: { in: createdStudentIds } } });
      await prisma.teacher.deleteMany({ where: { id: { in: createdTeacherIds } } });
      await prisma.userRole.deleteMany({ where: { user_id: { in: createdUserIds } } });
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    } catch (err) {
      console.error('Teardown error in gateFacultyScan.test.ts:', err);
    }
  });

  describe('1. Dedicated Student Gate Scanner (/api/attendance/gate/student/scan)', () => {
    it('should successfully record Student Time In via 12-digit LRN and write GateAttendance only', async () => {
      const res = await request(app)
        .post('/api/attendance/gate/student/scan')
        .set('Authorization', `Bearer ${gateOperatorToken}`)
        .send({ barcode: studentLrn });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.entityType).toBe('STUDENT');
      expect(res.body.data.action).toBe('Time In');
      expect(res.body.data.studentId).toBe(testStudentId);

      // Verify Student GateAttendance created in DB
      const { dateObj: today } = getPhilippineCalendarDate();
      const studentRec = await prisma.gateAttendance.findUnique({
        where: { student_id_date: { student_id: testStudentId, date: today } }
      });
      expect(studentRec).not.toBeNull();
      expect(studentRec?.time_in).not.toBeNull();

      // Verify ZERO FacultyAttendance created
      const facultyRec = await prisma.facultyAttendance.findFirst({
        where: { teacher_id: testTeacherId }
      });
      expect(facultyRec).toBeNull();
    });

    it('should debounce duplicate student scan within 1 minute', async () => {
      const res = await request(app)
        .post('/api/attendance/gate/student/scan')
        .set('Authorization', `Bearer ${gateOperatorToken}`)
        .send({ barcode: studentLrn });

      expect(res.status).toBe(422);
      expect(res.body.error.message).toContain('duplicate scan within 1 minute');
    });

    it('should record Student Time Out on valid scan after debounce', async () => {
      const { dateObj: today } = getPhilippineCalendarDate();
      await prisma.gateAttendance.update({
        where: {
          student_id_date: {
            student_id: testStudentId,
            date: today,
          },
        },
        data: {
          updated_at: new Date(Date.now() - 70000),
        },
      });

      const res = await request(app)
        .post('/api/attendance/gate/student/scan')
        .set('Authorization', `Bearer ${gateOperatorToken}`)
        .send({ barcode: studentLrn });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.entityType).toBe('STUDENT');
      expect(res.body.data.action).toBe('Time Out');
    });

    it('should reject student scan when already timed out today', async () => {
      const res = await request(app)
        .post('/api/attendance/gate/student/scan')
        .set('Authorization', `Bearer ${gateOperatorToken}`)
        .send({ barcode: studentLrn });

      expect(res.status).toBe(422);
      expect(res.body.error.message).toContain('Student already timed out today');
    });

    it('should strictly reject Teacher credential on Student Scanner with diagnostic error (zero attendance created)', async () => {
      const facultyCountBefore = await prisma.facultyAttendance.count();
      const studentCountBefore = await prisma.gateAttendance.count();

      const res = await request(app)
        .post('/api/attendance/gate/student/scan')
        .set('Authorization', `Bearer ${gateOperatorToken}`)
        .send({ barcode: teacherScanIdentifier });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_CREDENTIAL_TYPE');
      expect(res.body.error.message).toBe('This ID is not valid for the Student Attendance scanner.');

      // Verify zero attendance records created anywhere
      const facultyCountAfter = await prisma.facultyAttendance.count();
      const studentCountAfter = await prisma.gateAttendance.count();
      expect(facultyCountAfter).toBe(facultyCountBefore);
      expect(studentCountAfter).toBe(studentCountBefore);
    });

    it('should reject unknown barcode on Student Scanner with 404 NOT_FOUND', async () => {
      const res = await request(app)
        .post('/api/attendance/gate/student/scan')
        .set('Authorization', `Bearer ${gateOperatorToken}`)
        .send({ barcode: 'UNKNOWN-STUDENT-999' });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
      expect(res.body.error.message).toBe('Identifier not recognized.');
    });
  });

  describe('2. Dedicated Faculty Gate Scanner (/api/attendance/gate/faculty/scan)', () => {
    it('should successfully record Faculty Time In via valid TeacherScanCredential and write FacultyAttendance only', async () => {
      const res = await request(app)
        .post('/api/attendance/gate/faculty/scan')
        .set('Authorization', `Bearer ${gateOperatorToken}`)
        .send({ barcode: teacherScanIdentifier });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.entityType).toBe('FACULTY');
      expect(res.body.data.action).toBe('Time In');
      expect(res.body.data.teacherId).toBe(testTeacherId);
      expect(res.body.data.department).toBe('Science');
      expect(res.body.data.position).toBe('Master Teacher I');
      expect(res.body.data.record.captureSource).toBe('gate_scanner');

      // Verify in database
      const { dateObj: today } = getPhilippineCalendarDate();
      const dbRecord = await prisma.facultyAttendance.findUnique({
        where: {
          teacher_id_date: {
            teacher_id: testTeacherId,
            date: today,
          },
        },
      });
      expect(dbRecord).not.toBeNull();
      expect(dbRecord?.time_in).not.toBeNull();
      expect(dbRecord?.time_out).toBeNull();
      expect(dbRecord?.capture_source).toBe('gate_scanner');
    });

    it('should debounce accidental immediate duplicate faculty scan within 60 seconds', async () => {
      const res = await request(app)
        .post('/api/attendance/gate/faculty/scan')
        .set('Authorization', `Bearer ${gateOperatorToken}`)
        .send({ barcode: teacherScanIdentifier });

      expect(res.status).toBe(422);
      expect(res.body.error.message).toContain('duplicate scan within 1 minute');
    });

    it('should record Faculty Time Out on second valid physical scan after debounce', async () => {
      const { dateObj: today } = getPhilippineCalendarDate();
      await prisma.facultyAttendance.update({
        where: {
          teacher_id_date: {
            teacher_id: testTeacherId,
            date: today,
          },
        },
        data: {
          updated_at: new Date(Date.now() - 70000),
        },
      });

      const res = await request(app)
        .post('/api/attendance/gate/faculty/scan')
        .set('Authorization', `Bearer ${gateOperatorToken}`)
        .send({ barcode: teacherScanIdentifier });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.entityType).toBe('FACULTY');
      expect(res.body.data.action).toBe('Time Out');
      expect(res.body.data.record.timeOut).not.toBeNull();

      // Verify in database
      const dbRecord = await prisma.facultyAttendance.findUnique({
        where: {
          teacher_id_date: {
            teacher_id: testTeacherId,
            date: today,
          },
        },
      });
      expect(dbRecord?.time_out).not.toBeNull();
    });

    it('should reject scan after completed Time Out for the day', async () => {
      const res = await request(app)
        .post('/api/attendance/gate/faculty/scan')
        .set('Authorization', `Bearer ${gateOperatorToken}`)
        .send({ barcode: teacherScanIdentifier });

      expect(res.status).toBe(422);
      expect(res.body.error.message).toContain('Teacher already timed out today');
    });

    it('should strictly reject Student ID on Faculty Scanner with diagnostic error (zero attendance created)', async () => {
      const facultyCountBefore = await prisma.facultyAttendance.count();
      const studentCountBefore = await prisma.gateAttendance.count();

      const res = await request(app)
        .post('/api/attendance/gate/faculty/scan')
        .set('Authorization', `Bearer ${gateOperatorToken}`)
        .send({ barcode: studentLrn });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_CREDENTIAL_TYPE');
      expect(res.body.error.message).toBe('This ID is not valid for the Faculty Attendance scanner.');

      // Verify zero attendance records created anywhere
      const facultyCountAfter = await prisma.facultyAttendance.count();
      const studentCountAfter = await prisma.gateAttendance.count();
      expect(facultyCountAfter).toBe(facultyCountBefore);
      expect(studentCountAfter).toBe(studentCountBefore);
    });

    it('should reject inactive faculty scan credential with 404 NOT_FOUND', async () => {
      const res = await request(app)
        .post('/api/attendance/gate/faculty/scan')
        .set('Authorization', `Bearer ${gateOperatorToken}`)
        .send({ barcode: inactiveScanIdentifier });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('should reject partial / corrupted credential with 404 NOT_FOUND (exact matching)', async () => {
      const partialBarcode = teacherScanIdentifier.slice(0, -1);
      const res = await request(app)
        .post('/api/attendance/gate/faculty/scan')
        .set('Authorization', `Bearer ${gateOperatorToken}`)
        .send({ barcode: partialBarcode });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('should reject unknown barcode on Faculty Scanner with 404 NOT_FOUND', async () => {
      const res = await request(app)
        .post('/api/attendance/gate/faculty/scan')
        .set('Authorization', `Bearer ${gateOperatorToken}`)
        .send({ barcode: 'UNKNOWN-FACULTY-999' });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
      expect(res.body.error.message).toBe('Identifier not recognized.');
    });
  });

  describe('3. Deprecated Unified Scanner Route (/api/attendance/gate/scan)', () => {
    it('should reject requests to legacy unified endpoint and instruct clients to use separated endpoints', async () => {
      const res = await request(app)
        .post('/api/attendance/gate/scan')
        .set('Authorization', `Bearer ${gateOperatorToken}`)
        .send({ barcode: studentLrn });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('DEPRECATED_ENDPOINT');
      expect(res.body.error.message).toContain('/api/attendance/gate/student/scan');
    });
  });

  describe('4. Principal Faculty Attendance Live Read Verification', () => {
    it('should return live recorded gate attendance in Principal Faculty List API', async () => {
      const res = await request(app)
        .get('/api/attendance/faculty')
        .set('Authorization', `Bearer ${principalToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const items = res.body.data;
      const matched = items.find((item: any) => item.teacherId === testTeacherId);
      expect(matched).toBeDefined();
      expect(matched.status).toBe('Completed');
      expect(matched.captureSource).toBe('gate_scanner');
      expect(matched.timeIn).not.toBeNull();
      expect(matched.timeOut).not.toBeNull();
    });
  });
});
