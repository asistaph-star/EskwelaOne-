import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { PrismaClient } from '@prisma/client';
import { generateId } from '../src/common/utils/uuid';
import { sign } from 'jsonwebtoken';
import { config } from '../src/config/env';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

describe('Phase 5D: Principal Least-Privilege User Creation Authorization', () => {
  let principalToken: string;
  let adminToken: string;
  let studentToken: string;

  let adminUserId: string;
  let studentUserId: string;
  let principalUserId: string;
  let createdUsers: string[] = [];

  beforeAll(async () => {
    // Defensive cleanup
    await prisma.user.deleteMany({
      where: { email: { in: ['p_create@calulut.edu.ph', 'a_create@calulut.edu.ph', 's_create@calulut.edu.ph'] } }
    });

    const password_hash = await bcrypt.hash('password123', 10);
    
    // Ensure roles exist
    let pRole = await prisma.role.findFirst({ where: { name: 'Principal' } });
    if (!pRole) pRole = await prisma.role.create({ data: { id: generateId(), name: 'Principal' } });
    
    let aRole = await prisma.role.findFirst({ where: { name: 'Admin' } });
    if (!aRole) aRole = await prisma.role.create({ data: { id: generateId(), name: 'Admin' } });

    let itRole = await prisma.role.findFirst({ where: { name: 'ITAdmin' } });
    if (!itRole) itRole = await prisma.role.create({ data: { id: generateId(), name: 'ITAdmin' } });

    let sRole = await prisma.role.findFirst({ where: { name: 'Student' } });
    if (!sRole) sRole = await prisma.role.create({ data: { id: generateId(), name: 'Student' } });

    // Ensure Permissions
    const userWrite = await prisma.permission.upsert({
      where: { key: 'user:write' },
      update: {},
      create: { id: generateId(), key: 'user:write' }
    });
    const userRead = await prisma.permission.upsert({
      where: { key: 'user:read' },
      update: {},
      create: { id: generateId(), key: 'user:read' }
    });

    // Admin gets user:write
    await prisma.rolePermission.upsert({
      where: { role_id_permission_id: { role_id: aRole.id, permission_id: userWrite.id } },
      update: {},
      create: { role_id: aRole.id, permission_id: userWrite.id }
    });
    
    // Principal gets ONLY user:read (no user:write!)
    await prisma.rolePermission.upsert({
      where: { role_id_permission_id: { role_id: pRole.id, permission_id: userRead.id } },
      update: {},
      create: { role_id: pRole.id, permission_id: userRead.id }
    });

    // Create Principal
    principalUserId = generateId();
    await prisma.user.create({
      data: {
        id: principalUserId, school_id: `PRIN-${principalUserId.slice(-6)}`, email: 'p_create@calulut.edu.ph', password_hash, first_name: 'P', last_name: 'Test', status: 'active', must_change_password: false,
        user_roles: { create: { role_id: pRole.id } }
      }
    });
    principalToken = sign({ userId: principalUserId }, config.jwt.secret, { expiresIn: '1h' });

    // Create Admin/ITAdmin
    adminUserId = generateId();
    await prisma.user.create({
      data: {
        id: adminUserId, school_id: `ADM-${adminUserId.slice(-6)}`, email: 'a_create@calulut.edu.ph', password_hash, first_name: 'A', last_name: 'Test', status: 'active', must_change_password: false,
        user_roles: { create: [{ role_id: aRole.id }, { role_id: itRole.id }] }
      }
    });
    adminToken = sign({ userId: adminUserId }, config.jwt.secret, { expiresIn: '1h' });

    // Create Student
    studentUserId = generateId();
    await prisma.user.create({
      data: {
        id: studentUserId, school_id: `STU-${studentUserId.slice(-6)}`, email: 's_create@calulut.edu.ph', password_hash, first_name: 'S', last_name: 'Test', status: 'active', must_change_password: false,
        user_roles: { create: { role_id: sRole.id } }
      }
    });
    studentToken = sign({ userId: studentUserId }, config.jwt.secret, { expiresIn: '1h' });
  });

  afterAll(async () => {
    const userIds = [principalUserId, adminUserId, studentUserId, ...createdUsers].filter(Boolean) as string[];
    
    if (userIds.length > 0) {
      await prisma.userRole.deleteMany({ where: { user_id: { in: userIds } } });
      await prisma.auditLog.deleteMany({
        where: {
          OR: [
            { actor_user_id: { in: userIds } },
            { resource_id: { in: userIds } }
          ]
        }
      });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }

    // Defensive sweep for any test artifacts created by this test suite
    const sweepUsers = await prisma.user.findMany({
      where: {
        OR: [
          { email: { startsWith: 'new_teacher_' } },
          { email: { startsWith: 'admin_created_' } }
        ]
      },
      select: { id: true }
    });
    if (sweepUsers.length > 0) {
      const sweepIds = sweepUsers.map(u => u.id);
      await prisma.userRole.deleteMany({ where: { user_id: { in: sweepIds } } });
      await prisma.auditLog.deleteMany({ where: { resource_id: { in: sweepIds } } });
      await prisma.user.deleteMany({ where: { id: { in: sweepIds } } });
    }

    await prisma.$disconnect();
  });

  it('Principal creates Teacher -> success', async () => {
    const email = `new_teacher_${Date.now()}@calulut.edu.ph`;
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${principalToken}`)
      .send({
        email,
        firstName: 'New',
        lastName: 'Teacher',
        roles: ['Teacher']
      });
    
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    const newId = res.body.data?.user?.id || res.body.data?.id;
    if (newId) createdUsers.push(newId);
  });

  it('Principal attempts Admin creation -> denied', async () => {
    const email = `new_admin_${Date.now()}@calulut.edu.ph`;
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${principalToken}`)
      .send({
        email,
        firstName: 'New',
        lastName: 'Admin',
        roles: ['Admin']
      });
    
    expect(res.status).toBe(403);
    expect(res.body.error.message).toMatch(/only authorized to create Teacher accounts/i);
  });

  it('Principal attempts Principal creation -> denied', async () => {
    const email = `new_prin_${Date.now()}@calulut.edu.ph`;
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${principalToken}`)
      .send({
        email,
        firstName: 'New',
        lastName: 'Prin',
        roles: ['Principal']
      });
    
    expect(res.status).toBe(403);
  });

  it('Principal attempts arbitrary role escalation (Teacher + Admin) -> denied', async () => {
    const email = `new_mixed_${Date.now()}@calulut.edu.ph`;
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${principalToken}`)
      .send({
        email,
        firstName: 'New',
        lastName: 'Mixed',
        roles: ['Teacher', 'Admin']
      });
    
    expect(res.status).toBe(403);
  });

  it('Admin/ITAdmin existing user-management behavior -> preserved (can create Admin)', async () => {
    const email = `admin_created_${Date.now()}@calulut.edu.ph`;
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        email,
        firstName: 'Admin',
        lastName: 'Created',
        roles: ['Admin']
      });
    
    expect(res.status).toBe(201);
    const newId = res.body.data?.user?.id || res.body.data?.id;
    if (newId) createdUsers.push(newId);
  });

  it('Student -> denied', async () => {
    const email = `student_created_${Date.now()}@calulut.edu.ph`;
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        email,
        firstName: 'S',
        lastName: 'Created',
        roles: ['Teacher']
      });
    
    expect(res.status).toBe(403);
  });

  it('unauthenticated -> 401', async () => {
    const res = await request(app)
      .post('/api/users')
      .send({
        email: 'anon@calulut.edu.ph',
        firstName: 'A',
        lastName: 'A',
        roles: ['Teacher']
      });
    
    expect(res.status).toBe(401);
  });

  describe('PRIN-037: Self-Service Profile Update & Protection', () => {
    it('Principal reads own profile -> 200 OK', async () => {
      const res = await request(app)
        .get(`/api/users/${principalUserId}`)
        .set('Authorization', `Bearer ${principalToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(principalUserId);
    });

    it('Principal updates own permitted profile fields -> 200 OK', async () => {
      const res = await request(app)
        .patch(`/api/users/${principalUserId}`)
        .set('Authorization', `Bearer ${principalToken}`)
        .send({
          firstName: 'Roberto',
          lastName: 'Santos Updated',
          middleName: 'M.',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.first_name).toBe('Roberto');
      expect(res.body.data.last_name).toBe('Santos Updated');
      expect(res.body.data.middle_name).toBe('M.');
    });

    it('Persisted values read back correctly via GET /api/users/:id -> 200 OK', async () => {
      const res = await request(app)
        .get(`/api/users/${principalUserId}`)
        .set('Authorization', `Bearer ${principalToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.first_name).toBe('Roberto');
      expect(res.body.data.last_name).toBe('Santos Updated');
      expect(res.body.data.middle_name).toBe('M.');
    });

    it('Principal attempts to modify another user profile (Horizontal Escalation / ID substitution) -> 403 Forbidden', async () => {
      const res = await request(app)
        .patch(`/api/users/${adminUserId}`)
        .set('Authorization', `Bearer ${principalToken}`)
        .send({
          firstName: 'Hacked',
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(res.body.error.message).toMatch(/not authorized to modify another user profile/i);
    });

    it('Principal attempts to modify own account status without user:write (Vertical Escalation) -> 403 Forbidden', async () => {
      const res = await request(app)
        .patch(`/api/users/${principalUserId}`)
        .set('Authorization', `Bearer ${principalToken}`)
        .send({
          status: 'suspended',
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(res.body.error.message).toMatch(/not authorized to modify restricted fields: status/i);
    });

    it('Principal attempts to inject roles (Vertical Escalation) -> 403 Forbidden', async () => {
      const res = await request(app)
        .patch(`/api/users/${principalUserId}`)
        .set('Authorization', `Bearer ${principalToken}`)
        .send({
          roles: ['Admin', 'ITAdmin'],
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(res.body.error.message).toMatch(/not authorized to modify restricted fields: roles/i);
    });

    it('Principal attempts to inject email (Credential Tampering) -> 403 Forbidden', async () => {
      const res = await request(app)
        .patch(`/api/users/${principalUserId}`)
        .set('Authorization', `Bearer ${principalToken}`)
        .send({
          email: 'escalated@calulut.edu.ph',
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(res.body.error.message).toMatch(/not authorized to modify restricted fields: email/i);
    });

    it('Principal attempts to inject permissions (Privilege Escalation) -> 403 Forbidden', async () => {
      const res = await request(app)
        .patch(`/api/users/${principalUserId}`)
        .set('Authorization', `Bearer ${principalToken}`)
        .send({
          permissions: ['user:write'],
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(res.body.error.message).toMatch(/not authorized to modify restricted fields: permissions/i);
    });

    it('Principal attempts mixed safe + sensitive payload -> 403 Forbidden', async () => {
      const res = await request(app)
        .patch(`/api/users/${principalUserId}`)
        .set('Authorization', `Bearer ${principalToken}`)
        .send({
          firstName: 'ValidName',
          status: 'suspended',
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(res.body.error.message).toMatch(/not authorized to modify restricted fields: status/i);
    });

    it('Principal attempts mixed safe + privilege injection payload -> 403 Forbidden', async () => {
      const res = await request(app)
        .patch(`/api/users/${principalUserId}`)
        .set('Authorization', `Bearer ${principalToken}`)
        .send({
          firstName: 'ValidName',
          roles: ['Admin'],
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(res.body.error.message).toMatch(/not authorized to modify restricted fields: roles/i);
    });

    it('Unauthenticated PATCH -> 401 Unauthorized', async () => {
      const res = await request(app)
        .patch(`/api/users/${principalUserId}`)
        .send({
          firstName: 'Anon',
        });

      expect(res.status).toBe(401);
    });

    it('Legitimate Admin with user:write can update another user and status -> 200 OK', async () => {
      const res = await request(app)
        .patch(`/api/users/${principalUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          firstName: 'Roberto',
          status: 'active',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.first_name).toBe('Roberto');
      expect(res.body.data.status).toBe('active');
    });
  });
});
