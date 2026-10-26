import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/config/database.js';
import { hashPassword } from '../src/auth/auth.service.js';
import { generateId } from '../src/common/utils/uuid.js';

describe('DIGISKWELA — SCHOOL ID ONLY AUTHENTICATION TEST SUITE', () => {
  const createdUserIds: string[] = [];
  let itAdminToken: string;

  beforeAll(async () => {
    // Authenticate as ITAdmin using School ID
    const itLogin = await request(app)
      .post('/api/auth/login')
      .send({
        schoolId: 'IT-001',
        password: 'password123',
      });

    if (itLogin.status === 200) {
      const cookieHeader = itLogin.headers['set-cookie'] as string[];
      itAdminToken = cookieHeader.find(c => c.startsWith('auth_token='))!.split(';')[0].replace('auth_token=', '');
    }
  });

  afterAll(async () => {
    if (createdUserIds.length > 0) {
      await prisma.student.deleteMany({ where: { user_id: { in: createdUserIds } } }).catch(() => {});
      await prisma.teacher.deleteMany({ where: { user_id: { in: createdUserIds } } }).catch(() => {});
      await prisma.staff.deleteMany({ where: { user_id: { in: createdUserIds } } }).catch(() => {});
      await prisma.userRole.deleteMany({ where: { user_id: { in: createdUserIds } } }).catch(() => {});
      await prisma.auditLog.deleteMany({
        where: {
          OR: [
            { actor_user_id: { in: createdUserIds } },
            { resource_id: { in: createdUserIds } },
          ],
        },
      }).catch(() => {});
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  describe('1. Canonical Roles Authentication using School ID', () => {
    it('Student logs in using Student ID (2026-00001) + Password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          schoolId: '2026-00001',
          password: 'password123',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.schoolId).toBe('2026-00001');
      expect(res.body.data.user.roles).toContain('Student');
    });

    it('Teacher logs in using Employee ID (EMP-T-001) + Password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          schoolId: 'EMP-T-001',
          password: 'password123',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.schoolId).toBe('EMP-T-001');
      expect(res.body.data.user.roles).toContain('Teacher');
      expect(res.body.data.user.teacherProfile?.employeeId).toBe('EMP-T-001');
    });

    it('Principal logs in using Staff Employee ID (EMP-P-001) + Password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          schoolId: 'EMP-P-001',
          password: 'password123',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.schoolId).toBe('EMP-P-001');
      expect(res.body.data.user.roles).toContain('Principal');
    });

    it('Registrar logs in using Staff Employee ID (EMP-R-001) + Password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          schoolId: 'EMP-R-001',
          password: 'password123',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.schoolId).toBe('EMP-R-001');
      expect(res.body.data.user.roles).toContain('Registrar');
    });

    it('Guidance logs in using Staff Employee ID (EMP-G-001) + Password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          schoolId: 'EMP-G-001',
          password: 'password123',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.schoolId).toBe('EMP-G-001');
      expect(res.body.data.user.roles).toContain('Guidance');
    });

    it('Nurse logs in using Staff Employee ID (EMP-N-001) + Password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          schoolId: 'EMP-N-001',
          password: 'password123',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.schoolId).toBe('EMP-N-001');
      expect(res.body.data.user.roles).toContain('Nurse');
    });

    it('Admin logs in using School ID (ADM-001) + Password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          schoolId: 'ADM-001',
          password: 'password123',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.schoolId).toBe('ADM-001');
      expect(res.body.data.user.roles).toContain('Admin');
    });

    it('ITAdmin logs in using School ID (IT-001) + Password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          schoolId: 'IT-001',
          password: 'password123',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.schoolId).toBe('IT-001');
      expect(res.body.data.user.roles).toContain('ITAdmin');
    });

    it('GateOperator logs in using School ID (GATE-001) + Password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          schoolId: 'GATE-001',
          password: 'password123',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.schoolId).toBe('GATE-001');
      expect(res.body.data.user.roles).toContain('GateOperator');
    });
  });

  describe('2. Email Login Rejection (Email MUST NOT authenticate)', () => {
    it('Student email + correct password fails with generic Invalid credentials (401)', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'student@demo.com',
          password: 'password123',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
      expect(res.body.error.message).toBe('Invalid credentials.');
    });

    it('Teacher email + correct password fails with generic Invalid credentials (401)', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'teacher@demo.com',
          password: 'password123',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
      expect(res.body.error.message).toBe('Invalid credentials.');
    });

    it('Admin email + correct password fails with generic Invalid credentials (401)', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin@demo.com',
          password: 'password123',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
      expect(res.body.error.message).toBe('Invalid credentials.');
    });

    it('Email sent as schoolId field fails with generic Invalid credentials (401)', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          schoolId: 'admin@demo.com',
          password: 'password123',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
      expect(res.body.error.message).toBe('Invalid credentials.');
    });

    it('Payload with both valid schoolId and email is rejected (email not accepted in auth contract)', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          schoolId: 'ADM-001',
          email: 'admin@demo.com',
          password: 'password123',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    });
  });

  describe('3. Negative Identity Tests (LRN, UUID, and Token Rejection)', () => {
    it('DepEd LRN + correct password fails login -> 401 INVALID_CREDENTIALS', async () => {
      const student = await prisma.student.findFirst({
        where: { user: { school_id: '2026-00001' } },
      });
      expect(student?.lrn).toBeDefined();

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          schoolId: student!.lrn,
          password: 'password123',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
      expect(res.body.error.message).toBe('Invalid credentials.');
    });

    it('User internal UUID + correct password fails login -> 401 INVALID_CREDENTIALS', async () => {
      const user = await prisma.user.findUnique({
        where: { school_id: 'ADM-001' },
      });
      expect(user?.id).toBeDefined();

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          schoolId: user!.id,
          password: 'password123',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
      expect(res.body.error.message).toBe('Invalid credentials.');
    });

    it('Gate scan credential token / terminal ID cannot authenticate human portal account', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          schoolId: 'GATE-TERMINAL-001',
          password: 'password123',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    });
  });

  describe('4. Normalization: Trimming and Case-Insensitivity', () => {
    it('Case-insensitive login succeeds for alphabetic staff IDs (emp-t-001)', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          schoolId: 'emp-t-001',
          password: 'password123',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.schoolId).toBe('EMP-T-001');
    });

    it('Surrounding whitespace is trimmed before lookup ( 2026-00001 )', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          schoolId: '   2026-00001   ',
          password: 'password123',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.schoolId).toBe('2026-00001');
    });

    it('Preserves leading zeroes and hyphens (2026-00001)', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          schoolId: '2026-00001',
          password: 'password123',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.user.schoolId).toBe('2026-00001');
    });
  });

  describe('5. Security, Status & Privilege Boundaries', () => {
    it('Wrong School ID + correct password fails with generic Invalid credentials (401)', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          schoolId: 'NONEXISTENT-999',
          password: 'password123',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
      expect(res.body.error.message).toBe('Invalid credentials.');
    });

    it('Correct School ID + wrong password fails with generic Invalid credentials (401)', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          schoolId: 'ADM-001',
          password: 'IncorrectPassword999!',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
      expect(res.body.error.message).toBe('Invalid credentials.');
    });

    it('Inactive account is blocked from login (401 ACCOUNT_INACTIVE)', async () => {
      const inactiveId = generateId();
      const inactiveSchoolId = `INACT-${Date.now().toString().slice(-6)}`;
      const pwHash = await hashPassword('password123');
      await prisma.user.create({
        data: {
          id: inactiveId,
          school_id: inactiveSchoolId,
          password_hash: pwHash,
          first_name: 'Inactive',
          last_name: 'User',
          status: 'inactive',
        },
      });
      createdUserIds.push(inactiveId);

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          schoolId: inactiveSchoolId,
          password: 'password123',
        });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('ACCOUNT_INACTIVE');
    });

    it('Suspended account is blocked from login (401 ACCOUNT_INACTIVE)', async () => {
      const suspendedId = generateId();
      const suspendedSchoolId = `SUSP-${Date.now().toString().slice(-6)}`;
      const pwHash = await hashPassword('password123');
      await prisma.user.create({
        data: {
          id: suspendedId,
          school_id: suspendedSchoolId,
          password_hash: pwHash,
          first_name: 'Suspended',
          last_name: 'User',
          status: 'suspended',
        },
      });
      createdUserIds.push(suspendedId);

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          schoolId: suspendedSchoolId,
          password: 'password123',
        });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('ACCOUNT_INACTIVE');
    });

    it('Supplying a role in login request payload does NOT alter or elevate server-resolved role', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          schoolId: '2026-00001',
          password: 'password123',
          role: 'Admin', // Attacker attempts to inject Admin role
          roles: ['Admin', 'ITAdmin'],
        });

      expect(res.status).toBe(200);
      expect(res.body.data.user.roles).toContain('Student');
      expect(res.body.data.user.roles).not.toContain('Admin');
      expect(res.body.data.user.roles).not.toContain('ITAdmin');
    });
  });

  describe('6. Provisioning & School ID Uniqueness', () => {
    it('Admin provisions a student specifying studentNumber -> user.school_id and student.student_number are synchronized', async () => {
      const studentNum = `2026-TEST-${Date.now().toString().slice(-4)}`;
      const res = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${itAdminToken}`)
        .send({
          firstName: 'Clara',
          lastName: 'Salcedo',
          roles: ['Student'],
          studentProfile: {
            studentNumber: studentNum,
            lrn: `1199${Date.now()}`.substring(0, 12),
            gradeLevel: 10,
          },
        });

      expect(res.status).toBe(201);
      expect(res.body.data.user.school_id).toBe(studentNum);
      createdUserIds.push(res.body.data.user.id);

      const dbStudent = await prisma.student.findUnique({
        where: { user_id: res.body.data.user.id },
      });
      expect(dbStudent?.student_number).toBe(studentNum);
    });

    it('Attempting to provision an exact duplicate School ID fails safely (409 Conflict)', async () => {
      const duplicateSchoolId = 'ADM-001'; // already exists
      const res = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${itAdminToken}`)
        .send({
          schoolId: duplicateSchoolId,
          firstName: 'Duplicate',
          lastName: 'User',
          roles: ['Admin'],
        });

      expect(res.status).toBe(409);
      expect(res.body.error.message).toMatch(/School ID is already assigned/i);
    });

    it('Attempting to provision a case-variant duplicate School ID (adm-001 vs ADM-001) is strictly rejected (409 Conflict)', async () => {
      const res = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${itAdminToken}`)
        .send({
          schoolId: 'adm-001', // lowercase variant of ADM-001
          firstName: 'CaseVariant',
          lastName: 'Duplicate',
          roles: ['Admin'],
        });

      expect(res.status).toBe(409);
      expect(res.body.error.message).toMatch(/School ID is already assigned/i);
    });

    it('Creating account 1 with TEST-CASE-001 then account 2 with test-case-001 fails on account 2', async () => {
      const uniqueSuffix = Date.now().toString().slice(-4);
      const idUpper = `TEST-CASE-${uniqueSuffix}`;
      const idLower = `test-case-${uniqueSuffix}`;

      // Create Account 1
      const res1 = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${itAdminToken}`)
        .send({
          schoolId: idUpper,
          firstName: 'Account',
          lastName: 'One',
          roles: ['Admin'],
        });

      expect(res1.status).toBe(201);
      expect(res1.body.data.user.school_id).toBe(idUpper);
      createdUserIds.push(res1.body.data.user.id);

      // Create Account 2 with lowercase variant
      const res2 = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${itAdminToken}`)
        .send({
          schoolId: idLower,
          firstName: 'Account',
          lastName: 'Two',
          roles: ['Admin'],
        });

      expect(res2.status).toBe(409);
      expect(res2.body.error.message).toMatch(/School ID is already assigned/i);
    });

    it('Normal user update (PATCH /api/users/:id) cannot alter school_id or cause identifier drift', async () => {
      const testId = `DRIFT-STU-${Date.now().toString().slice(-4)}`;
      const createRes = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${itAdminToken}`)
        .send({
          firstName: 'DriftTest',
          lastName: 'Student',
          roles: ['Student'],
          studentProfile: {
            studentNumber: testId,
            lrn: `1399${Date.now()}`.substring(0, 12),
            gradeLevel: 10,
          },
        });

      expect(createRes.status).toBe(201);
      const testUserId = createRes.body.data.user.id;
      createdUserIds.push(testUserId);

      const res = await request(app)
        .patch(`/api/users/${testUserId}`)
        .set('Authorization', `Bearer ${itAdminToken}`)
        .send({
          firstName: 'DriftTestRenamed',
          schoolId: 'HACKED-ID-999', // Attacker attempts to change school_id
          school_id: 'HACKED-ID-999',
        });

      expect(res.status).toBe(200);

      // Verify DB records remain unchanged and perfectly synchronized
      const refreshedUser = await prisma.user.findUnique({
        where: { id: testUserId },
        include: { student: true },
      });
      expect(refreshedUser?.school_id).toBe(testId);
      expect(refreshedUser?.student?.student_number).toBe(testId);
      expect(refreshedUser?.first_name).toBe('DriftTestRenamed');
    });

    it('Student can be provisioned without personal email (email is optional for student)', async () => {
      const studentNum = `2026-NOEMAIL-${Date.now().toString().slice(-4)}`;
      const res = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${itAdminToken}`)
        .send({
          firstName: 'NoEmail',
          lastName: 'Student',
          roles: ['Student'],
          studentProfile: {
            studentNumber: studentNum,
            lrn: `1299${Date.now()}`.substring(0, 12),
            gradeLevel: 10,
          },
        });

      expect(res.status).toBe(201);
      expect(res.body.data.user.school_id).toBe(studentNum);
      expect(res.body.data.user.email).toBeNull();
      createdUserIds.push(res.body.data.user.id);
    });
  });
});
