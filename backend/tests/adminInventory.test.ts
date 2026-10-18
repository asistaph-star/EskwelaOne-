import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { PrismaClient } from '@prisma/client';
import { generateId } from '../src/common/utils/uuid';
import { sign } from 'jsonwebtoken';
import { config } from '../src/config/env';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

describe('Inventory Asset Lifecycle & Retirement (Phase 5D / Model B)', () => {
  let principalToken: string;
  let adminToken: string;
  let itAdminToken: string;
  let studentToken: string;

  let adminUserId: string;
  let itAdminUserId: string;
  let studentUserId: string;
  let principalUserId: string;
  
  let itemId: string;

  beforeAll(async () => {
    // Defensive cleanup from prior failed runs
    await prisma.inventoryUpdate.deleteMany({
      where: { item: { name: { in: ['Test Item', 'Mistaken Item', 'Operational Test Item'] } } }
    });
    await prisma.inventoryItem.deleteMany({
      where: { name: { in: ['Test Item', 'Mistaken Item', 'Operational Test Item'] } }
    });
    await prisma.user.deleteMany({
      where: { email: { in: ['p_inv@calulut.edu.ph', 'a_inv@calulut.edu.ph', 'it_inv@calulut.edu.ph', 's_inv@calulut.edu.ph'] } }
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

    // Permissions: Admin/ITAdmin -> inventory:write, Principal -> inventory:read
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
      where: { role_id_permission_id: { role_id: itRole.id, permission_id: invWrite.id } },
      update: {},
      create: { role_id: itRole.id, permission_id: invWrite.id }
    });
    await prisma.rolePermission.upsert({
      where: { role_id_permission_id: { role_id: itRole.id, permission_id: invRead.id } },
      update: {},
      create: { role_id: itRole.id, permission_id: invRead.id }
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

    // Create ITAdmin
    itAdminUserId = generateId();
    await prisma.user.create({
      data: {
        id: itAdminUserId, email: 'it_inv@calulut.edu.ph', password_hash, first_name: 'IT', last_name: 'Admin', status: 'active', must_change_password: false,
        user_roles: { create: { role_id: itRole.id } }
      }
    });
    itAdminToken = sign({ userId: itAdminUserId }, config.jwt.secret, { expiresIn: '1h' });

    // Create Student
    studentUserId = generateId();
    await prisma.user.create({
      data: {
        id: studentUserId, email: 's_inv@calulut.edu.ph', password_hash, first_name: 'S', last_name: 'Test', status: 'active', must_change_password: false,
        user_roles: { create: { role_id: sRole.id } }
      }
    });
    studentToken = sign({ userId: studentUserId }, config.jwt.secret, { expiresIn: '1h' });

    // Create Base Test Item
    itemId = generateId();
    await prisma.inventoryItem.create({
      data: {
        id: itemId,
        name: 'Test Item',
        category: 'ICT',
        quantity: 10,
        unit: 'units',
        condition: 'Good',
        status: 'Good'
      }
    });
    await prisma.inventoryUpdate.create({
      data: {
        id: generateId(),
        item_id: itemId,
        user_id: adminUserId,
        action: 'Added',
        details: 'Initial acquisition'
      }
    });
  });

  afterAll(async () => {
    try {
      const userIds = [principalUserId, adminUserId, itAdminUserId, studentUserId].filter(Boolean) as string[];
      
      await prisma.inventoryUpdate.deleteMany({
        where: { item: { name: { in: ['Test Item', 'Mistaken Item', 'Operational Test Item'] } } }
      });
      await prisma.inventoryItem.deleteMany({
        where: { name: { in: ['Test Item', 'Mistaken Item', 'Operational Test Item'] } }
      });
      
      if (userIds.length > 0) {
        await prisma.userRole.deleteMany({ where: { user_id: { in: userIds } } });
        await prisma.auditLog.deleteMany({ where: { actor_user_id: { in: userIds } } });
        await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      }

      // Final sanity check: ensure zero test items remained
      const remaining = await prisma.inventoryItem.count({
        where: { name: { in: ['Test Item', 'Mistaken Item', 'Operational Test Item'] } }
      });
      expect(remaining).toBe(0);
    } finally {
      await prisma.$disconnect();
    }
  });

  // 1. Principal Read-Only Verification
  it('Principal GET inventory -> 200', async () => {
    const res = await request(app)
      .get('/api/admin/inventory')
      .set('Authorization', `Bearer ${principalToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('Principal inventory mutation (PATCH) -> 403', async () => {
    const res = await request(app)
      .patch(`/api/admin/inventory/${itemId}`)
      .set('Authorization', `Bearer ${principalToken}`)
      .send({ status: 'Lost' });
    expect(res.status).toBe(403);
  });

  it('Principal inventory retire -> 403', async () => {
    const res = await request(app)
      .post(`/api/admin/inventory/${itemId}/retire`)
      .set('Authorization', `Bearer ${principalToken}`)
      .send({ reason: 'Unauthorized attempt' });
    expect(res.status).toBe(403);
  });

  it('Principal inventory dispose -> 403', async () => {
    const res = await request(app)
      .post(`/api/admin/inventory/${itemId}/dispose`)
      .set('Authorization', `Bearer ${principalToken}`)
      .send({ reason: 'Unauthorized attempt' });
    expect(res.status).toBe(403);
  });

  it('Principal inventory void -> 403', async () => {
    const res = await request(app)
      .post(`/api/admin/inventory/${itemId}/void`)
      .set('Authorization', `Bearer ${principalToken}`)
      .send({ reason: 'Unauthorized attempt' });
    expect(res.status).toBe(403);
  });

  it('Principal inventory DELETE -> 403', async () => {
    const res = await request(app)
      .delete(`/api/admin/inventory/${itemId}`)
      .set('Authorization', `Bearer ${principalToken}`);
    expect(res.status).toBe(403);
  });

  // 2. Ordinary Hard Delete Removal Verification
  it('ordinary hard DELETE is blocked (405 Method Not Allowed) for Admin', async () => {
    const res = await request(app)
      .delete(`/api/admin/inventory/${itemId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(405);
    expect(res.body.error?.message).toContain('Ordinary deletion of inventory items is disabled');
    
    // Ensure item was NOT deleted
    const item = await prisma.inventoryItem.findUnique({ where: { id: itemId } });
    expect(item).not.toBeNull();
  });

  // 3. Authorized Admin Mutation & Model B Operations
  it('authorized inventory manager (Admin) PATCH mutation -> success', async () => {
    const res = await request(app)
      .patch(`/api/admin/inventory/${itemId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'Repair', update_details: 'Sent to IT room for diagnostics' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('Repair');
  });

  // 4. Retire Asset Lifecycle Workflow
  it('Admin can retire asset -> updates status to Retired and preserves history', async () => {
    const res = await request(app)
      .post(`/api/admin/inventory/${itemId}/retire`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        reason: 'Beyond economic repair, parts obsolete',
        reference_number: 'PROP-RET-2026-004'
      });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('Retired');

    // Verify record in PostgreSQL persists
    const itemInDb = await prisma.inventoryItem.findUnique({
      where: { id: itemId },
      include: { updates: { orderBy: { created_at: 'asc' } } }
    });
    expect(itemInDb).not.toBeNull();
    expect(itemInDb?.status).toBe('Retired');
    
    // Verify updates history is preserved and chronological
    expect(itemInDb?.updates.length).toBeGreaterThanOrEqual(3); // Added -> Repair -> Retired
    const latestUpdate = itemInDb?.updates[itemInDb.updates.length - 1];
    expect(latestUpdate?.action).toBe('Retired');
    expect(latestUpdate?.details).toContain('Beyond economic repair');
    expect(latestUpdate?.details).toContain('PROP-RET-2026-004');
  });

  it('Admin cannot retire an already retired asset -> 400', async () => {
    const res = await request(app)
      .post(`/api/admin/inventory/${itemId}/retire`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Duplicate retirement' });
    expect(res.status).toBe(400);
    expect(res.body.error?.message).toContain('Asset is already retired');
  });

  // 5. Dispose Asset Lifecycle Workflow
  it('Admin can move Retired -> Disposed -> updates status to Disposed and preserves all history', async () => {
    const res = await request(app)
      .post(`/api/admin/inventory/${itemId}/dispose`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        reason: 'Authorized e-waste scrap turnover',
        reference_number: 'DISP-AUTH-891'
      });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('Disposed');

    // Verify item remains in PostgreSQL
    const itemInDb = await prisma.inventoryItem.findUnique({
      where: { id: itemId },
      include: { updates: { orderBy: { created_at: 'asc' } } }
    });
    expect(itemInDb).not.toBeNull();
    expect(itemInDb?.status).toBe('Disposed');

    // Verify complete audit history survives (Added -> Repair -> Retired -> Disposed)
    const actions = itemInDb?.updates.map(u => u.action);
    expect(actions).toContain('Added');
    expect(actions).toContain('Retired');
    expect(actions).toContain('Disposed');
  });

  // 6. Principal Oversight on Retired & Disposed Assets
  it('Principal can read Retired and Disposed records', async () => {
    const res = await request(app)
      .get('/api/admin/inventory')
      .set('Authorization', `Bearer ${principalToken}`);
    expect(res.status).toBe(200);
    const disposedItem = res.body.data.find((i: any) => i.id === itemId);
    expect(disposedItem).toBeDefined();
    expect(disposedItem.status).toBe('Disposed');
    expect(disposedItem.updates.length).toBeGreaterThanOrEqual(3);
  });

  // 7. Model B KPI Semantics
  it('Current Accountable Units excludes Retired and Disposed records', async () => {
    const res = await request(app)
      .get('/api/admin/inventory')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);

    const items = res.body.data;
    const accountableItems = items.filter((i: any) => !['Retired', 'Disposed'].includes(i.status));
    const retiredOrDisposedItems = items.filter((i: any) => ['Retired', 'Disposed'].includes(i.status));

    const totalAccountableUnits = accountableItems.reduce((acc: number, item: any) => acc + (item.quantity || 0), 0);
    const totalRetiredDisposedUnits = retiredOrDisposedItems.reduce((acc: number, item: any) => acc + (item.quantity || 0), 0);

    // Our test item has quantity: 10, status: Disposed
    expect(accountableItems.some((i: any) => i.id === itemId)).toBe(false);
    expect(totalRetiredDisposedUnits).toBeGreaterThanOrEqual(10);
  });

  // 8. Void Entry Exceptional Correction Workflow
  it('Admin (non-ITAdmin) cannot void asset -> 403 Forbidden', async () => {
    const res = await request(app)
      .post(`/api/admin/inventory/${itemId}/void`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Mistaken data entry' });
    expect(res.status).toBe(403);
    expect(res.body.error?.message).toContain('restricted to ITAdmin authorization');
  });

  it('ITAdmin cannot void an asset with operational history -> 400 Bad Request', async () => {
    // itemId has lifecycle history (Added, Status changed, Retired, Disposed)
    const res = await request(app)
      .post(`/api/admin/inventory/${itemId}/void`)
      .set('Authorization', `Bearer ${itAdminToken}`)
      .send({ reason: 'Attempt to void historical record' });
    expect(res.status).toBe(400);
    expect(res.body.error?.message).toContain('operational history');
  });

  it('ITAdmin can void an un-mutated mistaken entry -> 200 and removes it', async () => {
    // 1. Create a mistaken item
    const createRes = await request(app)
      .post('/api/admin/inventory')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Mistaken Item',
        category: 'Supplies',
        quantity: 5,
        unit: 'boxes',
        condition: 'Good',
        status: 'Good'
      });
    expect(createRes.status).toBe(201);
    const mistakeId = createRes.body.data.id;

    // 2. ITAdmin voids the mistaken item
    const voidRes = await request(app)
      .post(`/api/admin/inventory/${mistakeId}/void`)
      .set('Authorization', `Bearer ${itAdminToken}`)
      .send({ reason: 'Clerical typo error made during data entry' });
    expect(voidRes.status).toBe(200);
    expect(voidRes.body.success).toBe(true);

    // 3. Confirm physical record is purged from PostgreSQL
    const checkDb = await prisma.inventoryItem.findUnique({ where: { id: mistakeId } });
    expect(checkDb).toBeNull();

    // 4. Confirm audit log recorded the VOID action
    const auditLog = await prisma.auditLog.findFirst({
      where: {
        resource_type: 'inventory_item',
        resource_id: mistakeId,
        action: 'VOID'
      }
    });
    expect(auditLog).not.toBeNull();
    expect(auditLog?.actor_user_id).toBe(itAdminUserId);
  });

  // 9. Standard Route Protection
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
