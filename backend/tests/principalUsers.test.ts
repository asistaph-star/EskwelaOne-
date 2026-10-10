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
        id: principalUserId, email: 'p_create@calulut.edu.ph', password_hash, first_name: 'P', last_name: 'Test', status: 'active', must_change_password: false,
        user_roles: { create: { role_id: pRole.id } }
      }
    });
    principalToken = sign({ userId: principalUserId }, config.jwt.secret, { expiresIn: '1h' });

    // Create Admin
    adminUserId = generateId();
    await prisma.user.create({
      data: {
        id: adminUserId, email: 'a_create@calulut.edu.ph', password_hash, first_name: 'A', last_name: 'Test', status: 'active', must_change_password: false,
        user_roles: { create: { role_id: aRole.id } }
      }
    });
    adminToken = sign({ userId: adminUserId }, config.jwt.secret, { expiresIn: '1h' });

    // Create Student
    studentUserId = generateId();
    await prisma.user.create({
      data: {
        id: studentUserId, email: 's_create@calulut.edu.ph', password_hash, first_name: 'S', last_name: 'Test', status: 'active', must_change_password: false,
        user_roles: { create: { role_id: sRole.id } }
      }
    });
    studentToken = sign({ userId: studentUserId }, config.jwt.secret, { expiresIn: '1h' });
  });

  afterAll(async () => {
    const userIds = [principalUserId, adminUserId, studentUserId, ...createdUsers].filter(Boolean) as string[];
    
    if (userIds.length > 0) {
      await prisma.userRole.deleteMany({ where: { user_id: { in: userIds } } });
      await prisma.auditLog.deleteMany({ where: { actor_user_id: { in: userIds } } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
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
    createdUsers.push(res.body.data.id);
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
    createdUsers.push(res.body.data.id);
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
});
