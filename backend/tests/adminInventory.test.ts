import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { PrismaClient } from '@prisma/client';
import { generateId } from '../src/common/utils/uuid';
import { sign } from 'jsonwebtoken';
import { config } from '../src/config/env';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

describe('Phase 5D: Admin Inventory Authorization', () => {
  let principalToken: string;
  let adminToken: string;
  let studentToken: string;

  let adminUserId: string;
  let studentUserId: string;
  let principalUserId: string;
  
  let itemId: string;

  beforeAll(async () => {
    // Defensive cleanup from prior failed runs
    await prisma.inventoryUpdate.deleteMany({
      where: { item: { name: 'Test Item' } }
    });
    await prisma.inventoryItem.deleteMany({
      where: { name: 'Test Item' }
    });
    await prisma.user.deleteMany({
      where: { email: { in: ['p_inv@calulut.edu.ph', 'a_inv@calulut.edu.ph', 's_inv@calulut.edu.ph'] } }
    });

    const password_hash = await bcrypt.hash('password123', 10);
    
    // Ensure roles exist
    let pRole = await prisma.role.findFirst({ where: { name: 'Principal' } });
    if (!pRole) pRole = await prisma.role.create({ data: { id: generateId(), name: 'Principal' } });
    
    let aRole = await prisma.role.findFirst({ where: { name: 'Admin' } });
    if (!aRole) aRole = await prisma.role.create({ data: { id: generateId(), name: 'Admin' } });

    let sRole = await prisma.role.findFirst({ where: { name: 'Student' } });
    if (!sRole) sRole = await prisma.role.create({ data: { id: generateId(), name: 'Student' } });

    // Permissions: Admin -> inventory:write, Principal -> inventory:read
    const invWrite = await prisma.permission.upsert({
      where: { key: 'inventory:write' },
      update: {},
      create: { id: generateId(), key: 'inventory:write' }
    });
    const invRead = await prisma.permission.upsert({
      where: { key: 'inventory:read' },
      update: {},
      create: { id: generateId(), key: 'inventory:read' }
    });

    await prisma.rolePermission.upsert({
      where: { role_id_permission_id: { role_id: aRole.id, permission_id: invWrite.id } },
      update: {},
      create: { role_id: aRole.id, permission_id: invWrite.id }
    });
    await prisma.rolePermission.upsert({
      where: { role_id_permission_id: { role_id: aRole.id, permission_id: invRead.id } },
      update: {},
      create: { role_id: aRole.id, permission_id: invRead.id }
    });

    await prisma.rolePermission.upsert({
      where: { role_id_permission_id: { role_id: pRole.id, permission_id: invRead.id } },
      update: {},
      create: { role_id: pRole.id, permission_id: invRead.id }
    });

    // Create Principal
    principalUserId = generateId();
    await prisma.user.create({
      data: {
        id: principalUserId, email: 'p_inv@calulut.edu.ph', password_hash, first_name: 'P', last_name: 'Test', status: 'active', must_change_password: false,
        user_roles: { create: { role_id: pRole.id } }
      }
    });
    principalToken = sign({ userId: principalUserId }, config.jwt.secret, { expiresIn: '1h' });

    // Create Admin
    adminUserId = generateId();
    await prisma.user.create({
      data: {
        id: adminUserId, email: 'a_inv@calulut.edu.ph', password_hash, first_name: 'A', last_name: 'Test', status: 'active', must_change_password: false,
        user_roles: { create: { role_id: aRole.id } }
      }
    });
    adminToken = sign({ userId: adminUserId }, config.jwt.secret, { expiresIn: '1h' });

    // Create Student
    studentUserId = generateId();
    await prisma.user.create({
      data: {
        id: studentUserId, email: 's_inv@calulut.edu.ph', password_hash, first_name: 'S', last_name: 'Test', status: 'active', must_change_password: false,
        user_roles: { create: { role_id: sRole.id } }
      }
    });
    studentToken = sign({ userId: studentUserId }, config.jwt.secret, { expiresIn: '1h' });

    itemId = generateId();
    await prisma.inventoryItem.create({
      data: {
        id: itemId,
        name: 'Test Item',
        category: 'ICT',
        quantity: 10,
        unit: 'pcs',
        condition: 'Good',
        status: 'Good'
      }
    });
  });

  afterAll(async () => {
    try {
      const userIds = [principalUserId, adminUserId, studentUserId].filter(Boolean) as string[];
      if (itemId) {
        await prisma.inventoryUpdate.deleteMany({ where: { item_id: itemId } });
        await prisma.inventoryItem.deleteMany({ where: { id: itemId } });
      }
      await prisma.inventoryUpdate.deleteMany({ where: { item: { name: 'Test Item' } } });
      await prisma.inventoryItem.deleteMany({ where: { name: 'Test Item' } });
      
      if (userIds.length > 0) {
        await prisma.userRole.deleteMany({ where: { user_id: { in: userIds } } });
        await prisma.auditLog.deleteMany({ where: { actor_user_id: { in: userIds } } });
        await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      }
    } finally {
      await prisma.$disconnect();
    }
  });

  it('Principal GET inventory -> 200', async () => {
    const res = await request(app)
      .get('/api/admin/inventory')
      .set('Authorization', `Bearer ${principalToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('Principal inventory mutation -> 403', async () => {
    const res = await request(app)
      .patch(`/api/admin/inventory/${itemId}`)
      .set('Authorization', `Bearer ${principalToken}`)
      .send({ status: 'Lost' });
    expect(res.status).toBe(403);
  });

  it('authorized inventory manager (Admin) GET -> 200', async () => {
    const res = await request(app)
      .get('/api/admin/inventory')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });

  it('authorized inventory manager (Admin) mutation -> success', async () => {
    const res = await request(app)
      .patch(`/api/admin/inventory/${itemId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'Lost' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('Principal inventory DELETE -> 403', async () => {
    const res = await request(app)
      .delete(`/api/admin/inventory/${itemId}`)
      .set('Authorization', `Bearer ${principalToken}`);
    expect(res.status).toBe(403);
  });

  it('authorized inventory manager (Admin) DELETE -> success', async () => {
    const res = await request(app)
      .delete(`/api/admin/inventory/${itemId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('role without inventory:read GET -> 403', async () => {
    const res = await request(app)
      .get('/api/admin/inventory')
      .set('Authorization', `Bearer ${studentToken}`);
    expect(res.status).toBe(403);
  });

  it('unauthenticated GET -> 401', async () => {
    const res = await request(app)
      .get('/api/admin/inventory');
    expect(res.status).toBe(401);
  });
});
