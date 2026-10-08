import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import prisma from '../src/config/database';
import bcrypt from 'bcrypt';
import { generateId } from '../src/common/utils/uuid';
import { sign } from 'jsonwebtoken';
import { config } from '../src/config/env';

const TEST_PASSWORD = 'Password123!';

let adminUserId: string;
let adminToken: string;
let unauthUserId: string;
let unauthorizedToken: string;

let inventoryItem1Id: string;
let inventoryItem2Id: string;

describe('Phase 4I.1: Clinic Inventory Characterization Tests', () => {
  beforeAll(async () => {
    try {
      const users = await prisma.user.findMany({
        where: { email: { in: ['admin_inv_test@calulut.edu.ph', 'unauth_inv_test@calulut.edu.ph'] } }
      });
      if (users.length > 0) {
        const uids = users.map(u => u.id);
        await prisma.userRole.deleteMany({ where: { user_id: { in: uids } } });
        await prisma.staff.deleteMany({ where: { user_id: { in: uids } } });
        await prisma.user.deleteMany({ where: { id: { in: uids } } });
      }
    } catch(err) {}

    const password_hash = await bcrypt.hash(TEST_PASSWORD, 10);
    
    // Roles & Permissions
    let adminRole = await prisma.role.findFirst({ where: { name: 'Admin' } });
    if (!adminRole) adminRole = await prisma.role.create({ data: { id: generateId(), name: 'Admin' } });
    
    let permWrite = await prisma.permission.findFirst({ where: { key: 'clinic:write' } });
    if (!permWrite) permWrite = await prisma.permission.create({ data: { id: generateId(), key: 'clinic:write' } });
    let permRead = await prisma.permission.findFirst({ where: { key: 'clinic:read' } });
    if (!permRead) permRead = await prisma.permission.create({ data: { id: generateId(), key: 'clinic:read' } });

    await prisma.rolePermission.createMany({
      data: [
        { role_id: adminRole.id, permission_id: permRead.id },
        { role_id: adminRole.id, permission_id: permWrite.id },
      ],
      skipDuplicates: true
    });

    // Admin User
    adminUserId = generateId();
    await prisma.user.create({
      data: {
        id: adminUserId, email: 'admin_inv_test@calulut.edu.ph', password_hash, first_name: 'Admin', last_name: 'Inv', status: 'active', must_change_password: false,
        user_roles: { create: { role_id: adminRole.id } },
        staff: { create: { id: generateId(), employee_id: 'ADM-INV', position: 'Admin', department: 'Admin' } }
      }
    });
    adminToken = sign({ userId: adminUserId }, config.jwt.secret, { expiresIn: '1h' });

    // Unauthorized User
    unauthUserId = generateId();
    await prisma.user.create({
      data: {
        id: unauthUserId, email: 'unauth_inv_test@calulut.edu.ph', password_hash, first_name: 'Un', last_name: 'Auth', status: 'active', must_change_password: false,
      }
    });
    unauthorizedToken = sign({ userId: unauthUserId }, config.jwt.secret, { expiresIn: '1h' });

  });

  afterAll(async () => {
    // Narrow cleanup
    if (inventoryItem1Id) {
      await prisma.inventoryUpdate.deleteMany({ where: { item_id: inventoryItem1Id } });
      await prisma.inventoryItem.deleteMany({ where: { id: inventoryItem1Id } });
    }
    if (inventoryItem2Id) {
      await prisma.inventoryUpdate.deleteMany({ where: { item_id: inventoryItem2Id } });
      await prisma.inventoryItem.deleteMany({ where: { id: inventoryItem2Id } });
    }
    
    // Cleanup items created by this user
    const userItems = await prisma.inventoryUpdate.findMany({ where: { user_id: adminUserId }, select: { item_id: true } });
    const itemIds = userItems.map(ui => ui.item_id);
    await prisma.inventoryUpdate.deleteMany({ where: { item_id: { in: itemIds } } });
    await prisma.inventoryItem.deleteMany({ where: { id: { in: itemIds } } });
    
    const uids = [adminUserId, unauthUserId];
    await prisma.userRole.deleteMany({ where: { user_id: { in: uids } } });
    await prisma.staff.deleteMany({ where: { user_id: { in: uids } } });
    await prisma.user.deleteMany({ where: { id: { in: uids } } });
  });

  describe('POST /api/student-services/clinic/inventory', () => {
    it('should allow authorized user to create inventory item', async () => {
      const res = await request(app)
        .post('/api/student-services/clinic/inventory')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Test Paracetamol',
          category: 'Medicine',
          description: 'Pain reliever',
          quantity: 100,
          unit: 'tablets',
          reorder_level: 20
        });
      
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.name).toBe('Test Paracetamol');
      expect(res.body.data.quantity).toBe(100);
      inventoryItem1Id = res.body.data.id;

      // Verify Database state and atomic InventoryUpdate creation
      const item = await prisma.inventoryItem.findUnique({ where: { id: inventoryItem1Id }, include: { updates: true } });
      expect(item).not.toBeNull();
      expect(item!.location).toBe('Clinic');
      expect(item!.updates.length).toBe(1);
      expect(item!.updates[0].action).toBe('Added');
      expect(item!.updates[0].user_id).toBe(adminUserId);
    });

    it('should reject invalid category', async () => {
      const res = await request(app)
        .post('/api/student-services/clinic/inventory')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Invalid Item',
          category: 'Food',
          quantity: 10,
          unit: 'packs'
        });
      
      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/Invalid clinic category/);
    });

    it('should reject negative quantity (zod)', async () => {
      const res = await request(app)
        .post('/api/student-services/clinic/inventory')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Invalid Item',
          category: 'Medicine',
          quantity: -5,
          unit: 'packs'
        });
      
      expect(res.status).toBe(422); // Bad request from zod error
    });

    it('should reject unauthorized users', async () => {
      const res = await request(app)
        .post('/api/student-services/clinic/inventory')
        .set('Authorization', `Bearer ${unauthorizedToken}`)
        .send({
          name: 'Unauth Item',
          category: 'Medicine',
          quantity: 10,
          unit: 'packs'
        });
      
      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/student-services/clinic/inventory', () => {
    it('should fetch inventory items including updates structure', async () => {
      const res = await request(app)
        .get('/api/student-services/clinic/inventory')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      
      const item = res.body.data.find((i: any) => i.id === inventoryItem1Id);
      expect(item).toBeDefined();
      expect(item.name).toBe('Test Paracetamol');
      expect(Array.isArray(item.updates)).toBe(true);
      expect(item.updates[0].user).toBeDefined();
    });
  });

  describe('POST /api/student-services/clinic/inventory/:id/use', () => {
    it('should successfully consume stock sequentially and log update', async () => {
      const res = await request(app)
        .post(`/api/student-services/clinic/inventory/${inventoryItem1Id}/use`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          quantity: 10,
          reason: 'Headache'
        });
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.quantity).toBe(90); // 100 - 10

      // Verify DB
      const item = await prisma.inventoryItem.findUnique({ where: { id: inventoryItem1Id }, include: { updates: { orderBy: { created_at: 'desc' } } } });
      expect(item!.quantity).toBe(90);
      expect(item!.updates[0].action).toBe('Stock Consumed');
      expect(item!.updates[0].details).toContain('Used 10');
    });

    it('should reject unknown item with 404', async () => {
      const fakeId = generateId();
      const res = await request(app)
        .post(`/api/student-services/clinic/inventory/${fakeId}/use`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ quantity: 1, reason: 'test' });
      
      expect(res.status).toBe(404);
      expect(res.body.error.message).toMatch(/Item not found/);
    });

    it('should reject consumption exceeding stock with 400', async () => {
      const res = await request(app)
        .post(`/api/student-services/clinic/inventory/${inventoryItem1Id}/use`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ quantity: 100, reason: 'Too much' }); // only 90 left
      
      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/Insufficient stock/);

      // Verify no stock was consumed and no log was added
      const item = await prisma.inventoryItem.findUnique({ where: { id: inventoryItem1Id }, include: { updates: true } });
      expect(item!.quantity).toBe(90);
      expect(item!.updates.length).toBe(2); // 1 for creation, 1 for previous consume, none for this failed one
    });

    it('should reject non-positive quantity (zod)', async () => {
      const res = await request(app)
        .post(`/api/student-services/clinic/inventory/${inventoryItem1Id}/use`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ quantity: 0, reason: 'Zero' });
      
      expect(res.status).toBe(422);
    });

    it('should correctly handle concurrent consumption (Data Integrity Fix)', async () => {
      // Create a fresh item with quantity 5
      const createRes = await request(app)
        .post('/api/student-services/clinic/inventory')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Concurrent Item',
          category: 'Medicine',
          quantity: 5,
          unit: 'packs'
        });
      
      const concurrentItemId = createRes.body.data.id;

      // Fire two concurrent requests, each asking for 4
      const req1 = request(app)
        .post(`/api/student-services/clinic/inventory/${concurrentItemId}/use`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ quantity: 4, reason: 'Req 1' });
      
      const req2 = request(app)
        .post(`/api/student-services/clinic/inventory/${concurrentItemId}/use`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ quantity: 4, reason: 'Req 2' });
      
      const [res1, res2] = await Promise.all([req1, req2]);

      // Exactly one should succeed, one should fail
      const statuses = [res1.status, res2.status].sort();
      expect(statuses).toEqual([200, 400]);

      // Verify the final state
      const item = await prisma.inventoryItem.findUnique({ 
        where: { id: concurrentItemId }, 
        include: { updates: { orderBy: { created_at: 'desc' } } } 
      });
      
      expect(item!.quantity).toBe(1); // 5 - 4
      
      // Updates length should be 2: 1 for creation, 1 for the successful consumption
      expect(item!.updates.length).toBe(2);
      expect(item!.updates[0].action).toBe('Stock Consumed');
    });
  });
});
