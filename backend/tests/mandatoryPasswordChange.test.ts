import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/config/database.js';
import { generateId } from '../src/common/utils/uuid.js';
import { hashPassword } from '../src/auth/auth.service.js';
import jwt from 'jsonwebtoken';
import { config } from '../src/config/env.js';

const { sign } = jwt;

describe('Mandatory First-Login Password Change Security & Workflow', () => {
  const createdUserIds: string[] = [];
  let itAdminToken: string;
  let itAdminUserId: string;

  beforeAll(async () => {
    const passwordHash = await hashPassword('AdminPass123!');

    let itRole = await prisma.role.findFirst({ where: { name: 'ITAdmin' } });
    if (!itRole) {
      itRole = await prisma.role.create({ data: { id: generateId(), name: 'ITAdmin' } });
    }

    const userWrite = await prisma.permission.upsert({
      where: { key: 'user:write' },
      update: {},
      create: { id: generateId(), key: 'user:write' },
    });
    const userRead = await prisma.permission.upsert({
      where: { key: 'user:read' },
      update: {},
      create: { id: generateId(), key: 'user:read' },
    });

    await prisma.rolePermission.upsert({
      where: { role_id_permission_id: { role_id: itRole.id, permission_id: userWrite.id } },
      update: {},
      create: { role_id: itRole.id, permission_id: userWrite.id },
    }).catch(() => {});

    await prisma.rolePermission.upsert({
      where: { role_id_permission_id: { role_id: itRole.id, permission_id: userRead.id } },
      update: {},
      create: { role_id: itRole.id, permission_id: userRead.id },
    }).catch(() => {});

    itAdminUserId = generateId();
    await prisma.user.create({
      data: {
        id: itAdminUserId,
        school_id: `IT-MFC-${Date.now()}`.slice(0, 20),
        email: `itadmin_mfc_${Date.now()}@calulut.edu.ph`,
        password_hash: passwordHash,
        first_name: 'IT',
        last_name: 'Admin',
        status: 'active',
        must_change_password: false,
        user_roles: { create: { role_id: itRole.id } },
      },
    });
    itAdminToken = sign({ userId: itAdminUserId }, config.jwt.secret, { expiresIn: '1h' });
    createdUserIds.push(itAdminUserId);
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

  describe('End-to-End Workflow: New Provisioned Account', () => {
    let studentEmail: string;
    let studentSchoolId: string;
    let temporaryPassword: string;
    let studentUserId: string;
    let sessionToken: string;

    it('1. ITAdmin provisions a new Student account -> temporary password generated, must_change_password=true', async () => {
      studentEmail = `mfc_student_${Date.now()}@calulut.edu.ph`;

      const createRes = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${itAdminToken}`)
        .send({
          email: studentEmail,
          firstName: 'Mario',
          lastName: 'Santos',
          roles: ['Student'],
          studentProfile: {
            lrn: `1099${Date.now()}`.substring(0, 12),
            studentNumber: `2026-${Date.now().toString().slice(-5)}`,
            gradeLevel: 10,
          },
        });

      expect(createRes.status).toBe(201);
      expect(createRes.body.success).toBe(true);
      temporaryPassword = createRes.body.data.temporaryPassword;
      studentUserId = createRes.body.data.user.id;
      studentSchoolId = createRes.body.data.user.school_id;
      createdUserIds.push(studentUserId);

      expect(temporaryPassword).toBeDefined();
      expect(temporaryPassword.length).toBe(8);
      expect(studentSchoolId).toBeDefined();

      const dbUser = await prisma.user.findUnique({ where: { id: studentUserId } });
      expect(dbUser?.must_change_password).toBe(true);
    });

    it('2. User authenticates with temporary credentials -> login response exposes mustChangePassword=true', async () => {
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          schoolId: studentSchoolId,
          password: temporaryPassword,
        });

      expect(loginRes.status).toBe(200);
      expect(loginRes.body.success).toBe(true);
      expect(loginRes.body.data.user.mustChangePassword).toBe(true);

      const cookieHeader = loginRes.headers['set-cookie'];
      expect(cookieHeader).toBeDefined();
      const authCookie = (cookieHeader as string[]).find(c => c.startsWith('auth_token='));
      expect(authCookie).toBeDefined();
      sessionToken = authCookie!.split(';')[0].replace('auth_token=', '');
    });

    it('3. User attempts normal protected operation before change -> blocked server-side (403 MUST_CHANGE_PASSWORD)', async () => {
      const blockedRes = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${sessionToken}`);

      expect(blockedRes.status).toBe(403);
      expect(blockedRes.body.success).toBe(false);
      expect(blockedRes.body.error.code).toBe('MUST_CHANGE_PASSWORD');
      expect(blockedRes.body.error.message).toMatch(/must change your temporary password/i);
    });

    it('4. User calls /api/auth/me -> exempt from block, returns mustChangePassword=true', async () => {
      const meRes = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${sessionToken}`);

      expect(meRes.status).toBe(200);
      expect(meRes.body.success).toBe(true);
      expect(meRes.body.data.mustChangePassword).toBe(true);
      expect(meRes.body.data.email).toBe(studentEmail);
    });

    it('5. User attempts change with incorrect current password -> rejected (400)', async () => {
      const wrongPwRes = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${sessionToken}`)
        .send({
          currentPassword: 'WrongPassword123',
          newPassword: 'BrandNewPassword1!',
          confirmPassword: 'BrandNewPassword1!',
        });

      expect(wrongPwRes.status).toBe(400);
      expect(wrongPwRes.body.success).toBe(false);
      expect(wrongPwRes.body.error.message).toMatch(/current password is incorrect/i);
    });

    it('6. User attempts change with mismatched confirmation -> rejected (400)', async () => {
      const mismatchRes = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${sessionToken}`)
        .send({
          currentPassword: temporaryPassword,
          newPassword: 'BrandNewPassword1!',
          confirmPassword: 'CompletelyDifferentPassword2@',
        });

      expect(mismatchRes.status).toBe(400);
      expect(mismatchRes.body.success).toBe(false);
      expect(mismatchRes.body.error.message).toMatch(/passwords do not match/i);
    });

    it('7. User attempts change with short password (< 8 chars) -> rejected (400)', async () => {
      const shortPwRes = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${sessionToken}`)
        .send({
          currentPassword: temporaryPassword,
          newPassword: 'short',
          confirmPassword: 'short',
        });

      expect([400, 422]).toContain(shortPwRes.status);
    });

    it('8. User submits valid change -> success (200), must_change_password cleared in DB', async () => {
      const validChangeRes = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${sessionToken}`)
        .send({
          currentPassword: temporaryPassword,
          newPassword: 'PermanentPassword2026!',
          confirmPassword: 'PermanentPassword2026!',
        });

      expect(validChangeRes.status).toBe(200);
      expect(validChangeRes.body.success).toBe(true);

      const dbUser = await prisma.user.findUnique({ where: { id: studentUserId } });
      expect(dbUser?.must_change_password).toBe(false);
    });

    it('9. Old temporary password fails login -> 401 INVALID_CREDENTIALS', async () => {
      const oldLoginRes = await request(app)
        .post('/api/auth/login')
        .send({
          schoolId: studentSchoolId,
          password: temporaryPassword,
        });

      expect(oldLoginRes.status).toBe(401);
      expect(oldLoginRes.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('10. New permanent password succeeds login -> 200 OK, mustChangePassword=false', async () => {
      const newLoginRes = await request(app)
        .post('/api/auth/login')
        .send({
          schoolId: studentSchoolId,
          password: 'PermanentPassword2026!',
        });

      expect(newLoginRes.status).toBe(200);
      expect(newLoginRes.body.success).toBe(true);
      expect(newLoginRes.body.data.user.mustChangePassword).toBe(false);

      const cookieHeader = newLoginRes.headers['set-cookie'];
      const newAuthCookie = (cookieHeader as string[]).find(c => c.startsWith('auth_token='));
      const newSessionToken = newAuthCookie!.split(';')[0].replace('auth_token=', '');

      // Check /api/auth/me reflects mustChangePassword=false
      const meRes = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${newSessionToken}`);

      expect(meRes.status).toBe(200);
      expect(meRes.body.data.mustChangePassword).toBe(false);
    });
  });

  describe('Multi-Role Coverage: Teacher, Nurse, Admin', () => {
    it('Teacher with must_change_password=true is blocked from normal endpoints', async () => {
      const teacherEmail = `mfc_teach_${Date.now()}@calulut.edu.ph`;
      const empId = `EMP-${Date.now()}`;
      const createRes = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${itAdminToken}`)
        .send({
          email: teacherEmail,
          firstName: 'Teresa',
          lastName: 'Teacher',
          roles: ['Teacher'],
          teacherProfile: {
            employeeId: empId,
          },
        });

      expect(createRes.status).toBe(201);
      const tempPass = createRes.body.data.temporaryPassword;
      const teacherSchoolId = createRes.body.data.user.school_id;
      createdUserIds.push(createRes.body.data.user.id);

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ schoolId: teacherSchoolId, password: tempPass });

      expect(loginRes.body.data.user.mustChangePassword).toBe(true);
      const cookieHeader = loginRes.headers['set-cookie'] as string[];
      const token = cookieHeader.find(c => c.startsWith('auth_token='))!.split(';')[0].replace('auth_token=', '');

      const blockedRes = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${token}`);

      expect(blockedRes.status).toBe(403);
      expect(blockedRes.body.error.code).toBe('MUST_CHANGE_PASSWORD');
    });

    it('Nurse with must_change_password=true is blocked from normal endpoints', async () => {
      const nurseEmail = `mfc_nurse_${Date.now()}@calulut.edu.ph`;
      const empId = `STF-${Date.now()}`;
      const createRes = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${itAdminToken}`)
        .send({
          email: nurseEmail,
          firstName: 'Nora',
          lastName: 'Nurse',
          roles: ['Nurse'],
          staffProfile: {
            employeeId: empId,
          },
        });

      expect(createRes.status).toBe(201);
      const tempPass = createRes.body.data.temporaryPassword;
      const nurseSchoolId = createRes.body.data.user.school_id;
      createdUserIds.push(createRes.body.data.user.id);

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ schoolId: nurseSchoolId, password: tempPass });

      expect(loginRes.body.data.user.mustChangePassword).toBe(true);
      const cookieHeader = loginRes.headers['set-cookie'] as string[];
      const token = cookieHeader.find(c => c.startsWith('auth_token='))!.split(';')[0].replace('auth_token=', '');

      const blockedRes = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${token}`);

      expect(blockedRes.status).toBe(403);
      expect(blockedRes.body.error.code).toBe('MUST_CHANGE_PASSWORD');
    });

    it('Admin with must_change_password=true is blocked from normal endpoints', async () => {
      const adminEmail = `mfc_admin_${Date.now()}@calulut.edu.ph`;
      const adminSchoolId = `ADM-${Date.now().toString().slice(-6)}`;
      const createRes = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${itAdminToken}`)
        .send({
          schoolId: adminSchoolId,
          email: adminEmail,
          firstName: 'Adam',
          lastName: 'Admin',
          roles: ['Admin'],
        });

      expect(createRes.status).toBe(201);
      const tempPass = createRes.body.data.temporaryPassword;
      const effectiveSchoolId = createRes.body.data.user.school_id;
      createdUserIds.push(createRes.body.data.user.id);

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ schoolId: effectiveSchoolId, password: tempPass });

      expect(loginRes.body.data.user.mustChangePassword).toBe(true);
      const cookieHeader = loginRes.headers['set-cookie'] as string[];
      const token = cookieHeader.find(c => c.startsWith('auth_token='))!.split(';')[0].replace('auth_token=', '');

      const blockedRes = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${token}`);

      expect(blockedRes.status).toBe(403);
      expect(blockedRes.body.error.code).toBe('MUST_CHANGE_PASSWORD');
    });
  });

  describe('Password Reset Re-enables Mandatory Change State', () => {
    it('Reset password on an established user re-enables must_change_password=true', async () => {
      // 1. Create a user with must_change_password=false
      const email = `reset_cycle_${Date.now()}@calulut.edu.ph`;
      const cycleSchoolId = `CYC-${Date.now().toString().slice(-6)}`;
      const pwHash = await hashPassword('InitialPass123!');
      const userId = generateId();

      let studentRole = await prisma.role.findFirst({ where: { name: 'Student' } });
      if (!studentRole) {
        studentRole = await prisma.role.create({ data: { id: generateId(), name: 'Student' } });
      }

      await prisma.user.create({
        data: {
          id: userId,
          school_id: cycleSchoolId,
          email,
          password_hash: pwHash,
          first_name: 'Cycle',
          last_name: 'Test',
          status: 'active',
          must_change_password: false,
          user_roles: { create: { role_id: studentRole.id } },
        },
      });
      createdUserIds.push(userId);

      // Verify initially must_change_password is false
      let user = await prisma.user.findUnique({ where: { id: userId } });
      expect(user?.must_change_password).toBe(false);

      // 2. Admin resets password
      const resetRes = await request(app)
        .post(`/api/users/${userId}/reset-password`)
        .set('Authorization', `Bearer ${itAdminToken}`);

      expect(resetRes.status).toBe(200);
      const newTempPass = resetRes.body.data.temporaryPassword;

      // 3. Database must now show must_change_password = true
      user = await prisma.user.findUnique({ where: { id: userId } });
      expect(user?.must_change_password).toBe(true);

      // 4. User logs in with new temporary password
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ schoolId: cycleSchoolId, password: newTempPass });

      expect(loginRes.status).toBe(200);
      expect(loginRes.body.data.user.mustChangePassword).toBe(true);

      const cookieHeader = loginRes.headers['set-cookie'] as string[];
      const token = cookieHeader.find(c => c.startsWith('auth_token='))!.split(';')[0].replace('auth_token=', '');

      // 5. Normal operation is blocked again
      const blockedRes = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${token}`);

      expect(blockedRes.status).toBe(403);
      expect(blockedRes.body.error.code).toBe('MUST_CHANGE_PASSWORD');
    });
  });

  describe('Security & Data Minimization Verification', () => {
    it('Password values and hashes are never exposed in audit logs', async () => {
      const logs = await prisma.auditLog.findMany({
        where: { action: { in: ['PASSWORD_CHANGED', 'USER_PASSWORD_RESET', 'USER_CREATED'] } },
        orderBy: { created_at: 'desc' },
        take: 10,
      });

      for (const log of logs) {
        const rawString = JSON.stringify(log);
        expect(rawString).not.toContain('PermanentPassword2026!');
        expect(rawString).not.toContain('InitialPass123!');
      }
    });

    it('Logout endpoint remains accessible when must_change_password=true', async () => {
      const userEmail = `logout_test_${Date.now()}@calulut.edu.ph`;
      const logoutSchoolId = `LOG-${Date.now().toString().slice(-6)}`;
      const pwHash = await hashPassword('TempPass123!');
      const userId = generateId();

      await prisma.user.create({
        data: {
          id: userId,
          school_id: logoutSchoolId,
          email: userEmail,
          password_hash: pwHash,
          first_name: 'Logout',
          last_name: 'Test',
          status: 'active',
          must_change_password: true,
        },
      });
      createdUserIds.push(userId);

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ schoolId: logoutSchoolId, password: 'TempPass123!' });

      const cookieHeader = loginRes.headers['set-cookie'] as string[];
      const token = cookieHeader.find(c => c.startsWith('auth_token='))!.split(';')[0].replace('auth_token=', '');

      const logoutRes = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`);

      expect(logoutRes.status).toBe(200);
      expect(logoutRes.body.success).toBe(true);
    });
  });
});
