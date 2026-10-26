import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/config/database.js';
import { generateId } from '../src/common/utils/uuid.js';
import { hashPassword } from '../src/auth/auth.service.js';
import jwt from 'jsonwebtoken';
import { config } from '../src/config/env.js';

const { sign } = jwt;

describe('Account Provisioning Policy & Authorization', () => {
  let itAdminToken: string;
  let adminToken: string;
  let teacherToken: string;
  let studentToken: string;

  let itAdminUserId: string;
  let adminUserId: string;
  let teacherUserId: string;
  let studentUserId: string;

  const createdUserIds: string[] = [];

  beforeAll(async () => {
    const passwordHash = await hashPassword('password123');

    // Ensure roles exist
    const rolesToEnsure = [
      'ITAdmin', 'Admin', 'Principal', 'Teacher', 'Student',
      'Registrar', 'Guidance', 'Nurse', 'GateOperator'
    ];

    for (const roleName of rolesToEnsure) {
      await prisma.role.upsert({
        where: { name: roleName },
        update: {},
        create: { id: generateId(), name: roleName }
      });
    }

    const itAdminRole = await prisma.role.findUniqueOrThrow({ where: { name: 'ITAdmin' } });
    const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: 'Admin' } });
    const teacherRole = await prisma.role.findUniqueOrThrow({ where: { name: 'Teacher' } });
    const studentRole = await prisma.role.findUniqueOrThrow({ where: { name: 'Student' } });

    // Ensure permissions
    const userRead = await prisma.permission.upsert({
      where: { key: 'user:read' },
      update: {},
      create: { id: generateId(), key: 'user:read' }
    });
    const userWrite = await prisma.permission.upsert({
      where: { key: 'user:write' },
      update: {},
      create: { id: generateId(), key: 'user:write' }
    });

    // ITAdmin gets user:write & user:read
    await prisma.rolePermission.upsert({
      where: { role_id_permission_id: { role_id: itAdminRole.id, permission_id: userWrite.id } },
      update: {},
      create: { role_id: itAdminRole.id, permission_id: userWrite.id }
    });
    await prisma.rolePermission.upsert({
      where: { role_id_permission_id: { role_id: itAdminRole.id, permission_id: userRead.id } },
      update: {},
      create: { role_id: itAdminRole.id, permission_id: userRead.id }
    });

    // Admin gets user:read (no user:write in seed)
    await prisma.rolePermission.upsert({
      where: { role_id_permission_id: { role_id: adminRole.id, permission_id: userRead.id } },
      update: {},
      create: { role_id: adminRole.id, permission_id: userRead.id }
    });

    // Create ITAdmin User
    itAdminUserId = generateId();
    await prisma.user.create({
      data: {
        id: itAdminUserId,
        school_id: `IT-${itAdminUserId.slice(-6)}`,
        email: `itadmin_test_${Date.now()}@calulut.edu.ph`,
        password_hash: passwordHash,
        first_name: 'IT',
        last_name: 'Superadmin',
        status: 'active',
        must_change_password: false,
        user_roles: { create: { role_id: itAdminRole.id } }
      }
    });
    itAdminToken = sign({ userId: itAdminUserId }, config.jwt.secret, { expiresIn: '1h' });
    createdUserIds.push(itAdminUserId);

    // Create Admin User
    adminUserId = generateId();
    await prisma.user.create({
      data: {
        id: adminUserId,
        school_id: `ADM-${adminUserId.slice(-6)}`,
        email: `admin_test_${Date.now()}@calulut.edu.ph`,
        password_hash: passwordHash,
        first_name: 'Standard',
        last_name: 'Admin',
        status: 'active',
        must_change_password: false,
        user_roles: { create: { role_id: adminRole.id } }
      }
    });
    adminToken = sign({ userId: adminUserId }, config.jwt.secret, { expiresIn: '1h' });
    createdUserIds.push(adminUserId);

    // Create Teacher User
    teacherUserId = generateId();
    await prisma.user.create({
      data: {
        id: teacherUserId,
        school_id: `TEA-${teacherUserId.slice(-6)}`,
        email: `teacher_test_${Date.now()}@calulut.edu.ph`,
        password_hash: passwordHash,
        first_name: 'Regular',
        last_name: 'Teacher',
        status: 'active',
        must_change_password: false,
        user_roles: { create: { role_id: teacherRole.id } }
      }
    });
    teacherToken = sign({ userId: teacherUserId }, config.jwt.secret, { expiresIn: '1h' });
    createdUserIds.push(teacherUserId);

    // Create Student User
    studentUserId = generateId();
    await prisma.user.create({
      data: {
        id: studentUserId,
        school_id: `STU-${studentUserId.slice(-6)}`,
        email: `student_test_${Date.now()}@calulut.edu.ph`,
        password_hash: passwordHash,
        first_name: 'Regular',
        last_name: 'Student',
        status: 'active',
        must_change_password: false,
        user_roles: { create: { role_id: studentRole.id } }
      }
    });
    studentToken = sign({ userId: studentUserId }, config.jwt.secret, { expiresIn: '1h' });
    createdUserIds.push(studentUserId);
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
            { resource_id: { in: createdUserIds } }
          ]
        }
      }).catch(() => {});
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  describe('Standard Admin Role-Creation Authority', () => {
    it('Admin can create Student account with studentProfile', async () => {
      const email = `std_stud_${Date.now()}@calulut.edu.ph`;
      const res = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email,
          firstName: 'Juan',
          lastName: 'Student',
          roles: ['Student'],
          studentProfile: {
            lrn: `LRN${Date.now()}`,
            gradeLevel: 10,
            gender: 'Male',
          }
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe(email);
      expect(res.body.data.temporaryPassword).toBeDefined();

      const newId = res.body.data.user.id;
      createdUserIds.push(newId);

      const dbStudent = await prisma.student.findUnique({ where: { user_id: newId } });
      expect(dbStudent).not.toBeNull();
      expect(dbStudent?.grade_level).toBe(10);
    });

    it('Admin can create Teacher account with teacherProfile', async () => {
      const email = `std_teach_${Date.now()}@calulut.edu.ph`;
      const res = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email,
          firstName: 'Maria',
          lastName: 'Teacher',
          roles: ['Teacher'],
          teacherProfile: {
            employeeId: `EMP-T-${Date.now()}`,
            department: 'Science',
            position: 'Teacher I'
          }
        });

      expect(res.status).toBe(201);
      const newId = res.body.data.user.id;
      createdUserIds.push(newId);

      const dbTeacher = await prisma.teacher.findUnique({ where: { user_id: newId } });
      expect(dbTeacher).not.toBeNull();
      expect(dbTeacher?.department).toBe('Science');
    });

    it('Admin can create Principal account with staffProfile', async () => {
      const email = `std_prin_${Date.now()}@calulut.edu.ph`;
      const res = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email,
          firstName: 'Elena',
          lastName: 'Principal',
          roles: ['Principal'],
          staffProfile: {
            employeeId: `EMP-P-${Date.now()}`,
            department: 'Administration',
            position: 'School Principal IV'
          }
        });

      expect(res.status).toBe(201);
      const newId = res.body.data.user.id;
      createdUserIds.push(newId);

      const dbStaff = await prisma.staff.findUnique({ where: { user_id: newId } });
      expect(dbStaff).not.toBeNull();
    });

    it('Admin can create Registrar account with staffProfile', async () => {
      const email = `std_reg_${Date.now()}@calulut.edu.ph`;
      const res = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email,
          firstName: 'Rita',
          lastName: 'Registrar',
          roles: ['Registrar'],
          staffProfile: {
            employeeId: `EMP-R-${Date.now()}`,
            department: 'Registrar Office',
            position: 'Registrar I'
          }
        });

      expect(res.status).toBe(201);
      createdUserIds.push(res.body.data.user.id);
    });

    it('Admin can create Guidance account with staffProfile', async () => {
      const email = `std_guid_${Date.now()}@calulut.edu.ph`;
      const res = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email,
          firstName: 'Grace',
          lastName: 'Guidance',
          roles: ['Guidance'],
          staffProfile: {
            employeeId: `EMP-G-${Date.now()}`,
            department: 'Guidance Center',
            position: 'Guidance Counselor III'
          }
        });

      expect(res.status).toBe(201);
      createdUserIds.push(res.body.data.user.id);
    });

    it('Admin can create Nurse account with staffProfile', async () => {
      const email = `std_nurse_${Date.now()}@calulut.edu.ph`;
      const res = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email,
          firstName: 'Nancy',
          lastName: 'Nurse',
          roles: ['Nurse'],
          staffProfile: {
            employeeId: `EMP-N-${Date.now()}`,
            department: 'School Clinic',
            position: 'School Nurse II'
          }
        });

      expect(res.status).toBe(201);
      createdUserIds.push(res.body.data.user.id);
    });

    it('Admin can create GateOperator account (User + role only)', async () => {
      const email = `std_gate_${Date.now()}@calulut.edu.ph`;
      const res = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email,
          firstName: 'Gary',
          lastName: 'GateOperator',
          roles: ['GateOperator'],
        });

      expect(res.status).toBe(201);
      createdUserIds.push(res.body.data.user.id);
    });

    it('Admin CANNOT create Admin account -> returns 403 Forbidden', async () => {
      const email = `blocked_admin_${Date.now()}@calulut.edu.ph`;
      const res = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email,
          firstName: 'Rogue',
          lastName: 'Admin',
          roles: ['Admin']
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toMatch(/not authorized to create Admin or ITAdmin accounts/i);
    });

    it('Admin CANNOT create ITAdmin account -> returns 403 Forbidden', async () => {
      const email = `blocked_itadmin_${Date.now()}@calulut.edu.ph`;
      const res = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email,
          firstName: 'Rogue',
          lastName: 'ITAdmin',
          roles: ['ITAdmin']
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toMatch(/not authorized to create Admin or ITAdmin accounts/i);
    });

    it('Admin CANNOT escalate privileges with mixed roles [Teacher, Admin] -> returns 403', async () => {
      const email = `blocked_mixed_${Date.now()}@calulut.edu.ph`;
      const res = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email,
          firstName: 'Mixed',
          lastName: 'Role',
          roles: ['Teacher', 'Admin']
        });

      expect(res.status).toBe(403);
    });
  });

  describe('ITAdmin Account-Creation Authority', () => {
    it('ITAdmin can create Admin account -> returns 201', async () => {
      const email = `it_created_admin_${Date.now()}@calulut.edu.ph`;
      const res = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${itAdminToken}`)
        .send({
          email,
          firstName: 'Created',
          lastName: 'AdminByIT',
          roles: ['Admin']
        });

      expect(res.status).toBe(201);
      createdUserIds.push(res.body.data.user.id);
    });

    it('ITAdmin can create ITAdmin account -> returns 201', async () => {
      const email = `it_created_it_${Date.now()}@calulut.edu.ph`;
      const res = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${itAdminToken}`)
        .send({
          email,
          firstName: 'Created',
          lastName: 'ITByIT',
          roles: ['ITAdmin']
        });

      expect(res.status).toBe(201);
      createdUserIds.push(res.body.data.user.id);
    });
  });

  describe('Unauthorized Callers Account Creation', () => {
    it('Teacher cannot create accounts -> returns 403', async () => {
      const res = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          email: `unauth_t_${Date.now()}@calulut.edu.ph`,
          firstName: 'Test',
          lastName: 'Test',
          roles: ['Student']
        });

      expect(res.status).toBe(403);
    });

    it('Student cannot create accounts -> returns 403', async () => {
      const res = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          email: `unauth_s_${Date.now()}@calulut.edu.ph`,
          firstName: 'Test',
          lastName: 'Test',
          roles: ['Student']
        });

      expect(res.status).toBe(403);
    });
  });

  describe('Password Reset Endpoint & Protection', () => {
    it('Admin can reset password for Student -> returns 200 with temporaryPassword', async () => {
      const res = await request(app)
        .post(`/api/users/${studentUserId}/reset-password`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.temporaryPassword).toBeDefined();
      expect(res.body.data.temporaryPassword.length).toBe(8);

      const dbUser = await prisma.user.findUnique({ where: { id: studentUserId } });
      expect(dbUser?.must_change_password).toBe(true);
    });

    it('Admin CANNOT reset password for ITAdmin -> returns 403 Forbidden', async () => {
      const res = await request(app)
        .post(`/api/users/${itAdminUserId}/reset-password`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.message).toMatch(/not authorized to reset passwords for Admin or ITAdmin accounts/i);
    });

    it('ITAdmin CAN reset password for any account including Admin -> returns 200', async () => {
      const res = await request(app)
        .post(`/api/users/${adminUserId}/reset-password`)
        .set('Authorization', `Bearer ${itAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.temporaryPassword).toBeDefined();

      // Clear forced change on adminUserId so adminToken remains valid for subsequent test assertions
      await prisma.user.update({
        where: { id: adminUserId },
        data: { must_change_password: false }
      });
    });

    it('Unauthorized user cannot reset passwords -> returns 403', async () => {
      const res = await request(app)
        .post(`/api/users/${studentUserId}/reset-password`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('Protection Against Privilege Escalation on PATCH', () => {
    it('Admin CANNOT modify ITAdmin account -> returns 403', async () => {
      const res = await request(app)
        .patch(`/api/users/${itAdminUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ firstName: 'HackedName' });

      expect(res.status).toBe(403);
      expect(res.body.error.message).toMatch(/not authorized to modify Admin or ITAdmin accounts/i);
    });

    it('Admin CAN modify normal staff account status -> returns 200', async () => {
      const res = await request(app)
        .patch(`/api/users/${teacherUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'inactive' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('inactive');

      // Re-activate for safety
      await request(app)
        .patch(`/api/users/${teacherUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'active' });
    });
  });

  describe('Password Security in Read APIs', () => {
    it('GET /api/users does NOT expose password_hash or temporaryPassword', async () => {
      const res = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const users = res.body.data;
      expect(Array.isArray(users)).toBe(true);

      for (const u of users) {
        expect(u.password_hash).toBeUndefined();
        expect(u.passwordHash).toBeUndefined();
        expect(u.password).toBeUndefined();
        expect(u.temporaryPassword).toBeUndefined();
      }
    });

    it('GET /api/users/:id does NOT expose password_hash or temporaryPassword', async () => {
      const res = await request(app)
        .get(`/api/users/${teacherUserId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.password_hash).toBeUndefined();
      expect(res.body.data.passwordHash).toBeUndefined();
      expect(res.body.data.password).toBeUndefined();
      expect(res.body.data.temporaryPassword).toBeUndefined();
    });
  });
});
