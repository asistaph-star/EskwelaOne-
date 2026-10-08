import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import prisma from '../src/config/database';
import bcrypt from 'bcrypt';
import { generateId } from '../src/common/utils/uuid';
import { sign } from 'jsonwebtoken';
import { config } from '../src/config/env';

const TEST_PASSWORD = 'Password123!';

let nurseUserId: string;
let nurseToken: string;
let adminToken: string;

let student1UserId: string;
let student1Token: string;
let student1Id: string;

let student2UserId: string;
let student2Token: string;
let student2Id: string;

let clinicRecordId: string;
let inventoryItemId: string;

describe('Phase 4G: Clinic Records Characterization Tests', () => {
  beforeAll(async () => {
    try {
      const orphanedUsers = await prisma.user.findMany({
        where: { email: { in: ['nurse_g@calulut.edu.ph', 'student1_g@calulut.edu.ph', 'student2_g@calulut.edu.ph'] } }
      });
      if (orphanedUsers.length > 0) {
        const uids = orphanedUsers.map(u => u.id);
        await prisma.userRole.deleteMany({ where: { user_id: { in: uids } } });
        await prisma.auditLog.deleteMany({ where: { actor_user_id: { in: uids } } });
        await prisma.staff.deleteMany({ where: { user_id: { in: uids } } });
        await prisma.student.deleteMany({ where: { user_id: { in: uids } } });
        await prisma.user.deleteMany({ where: { id: { in: uids } } });
      }
    } catch(err) {}

    const password_hash = await bcrypt.hash(TEST_PASSWORD, 10);
    
    // Roles
    let clinicRole = await prisma.role.findFirst({ where: { name: 'Nurse' } });
    if (!clinicRole) clinicRole = await prisma.role.create({ data: { id: generateId(), name: 'Nurse' } });
    let adminRole = await prisma.role.findFirst({ where: { name: 'Admin' } });
    if (!adminRole) adminRole = await prisma.role.create({ data: { id: generateId(), name: 'Admin' } });
    let studentRole = await prisma.role.findFirst({ where: { name: 'Student' } });
    if (!studentRole) studentRole = await prisma.role.create({ data: { id: generateId(), name: 'Student' } });

    // Permissions
    let permRead = await prisma.permission.findFirst({ where: { key: 'clinic:read' } });
    if (!permRead) permRead = await prisma.permission.create({ data: { id: generateId(), key: 'clinic:read' } });
    let permWrite = await prisma.permission.findFirst({ where: { key: 'clinic:write' } });
    if (!permWrite) permWrite = await prisma.permission.create({ data: { id: generateId(), key: 'clinic:write' } });

    await prisma.rolePermission.createMany({
      data: [
        { role_id: clinicRole.id, permission_id: permRead.id },
        { role_id: clinicRole.id, permission_id: permWrite.id },
        { role_id: adminRole.id, permission_id: permRead.id },
        { role_id: adminRole.id, permission_id: permWrite.id },
        { role_id: studentRole.id, permission_id: permRead.id } // grant student read to test privacy scoping
      ],
      skipDuplicates: true
    });

    // 1. Create Nurse
    nurseUserId = generateId();
    await prisma.user.create({
      data: {
        id: nurseUserId, email: 'nurse_g@calulut.edu.ph', password_hash, first_name: 'Nuur', last_name: 'Se', status: 'active', must_change_password: false,
        user_roles: { create: { role_id: clinicRole.id } },
        staff: { create: { id: generateId(), employee_id: 'NURSE-1', position: 'Nurse', department: 'Clinic' } }
      }
    });
    nurseToken = sign({ userId: nurseUserId }, config.jwt.secret, { expiresIn: '1h' });

    // 2. Create Student 1
    student1UserId = generateId();
    student1Id = generateId();
    await prisma.user.create({
      data: {
        id: student1UserId, email: 'student1_g@calulut.edu.ph', password_hash, first_name: 'Student', last_name: 'One', status: 'active', must_change_password: false,
        user_roles: { create: { role_id: studentRole.id } },
        student: { create: { id: student1Id, lrn: '787878787878', grade_level: 10 } }
      }
    });
    student1Token = sign({ userId: student1UserId }, config.jwt.secret, { expiresIn: '1h' });

    // 3. Create Student 2
    student2UserId = generateId();
    student2Id = generateId();
    await prisma.user.create({
      data: {
        id: student2UserId, email: 'student2_g@calulut.edu.ph', password_hash, first_name: 'Student', last_name: 'Two', status: 'active', must_change_password: false,
        user_roles: { create: { role_id: studentRole.id } },
        student: { create: { id: student2Id, lrn: '797979797979', grade_level: 10 } }
      }
    });
    student2Token = sign({ userId: student2UserId }, config.jwt.secret, { expiresIn: '1h' });

    // Create a mock inventory item to test route collision
    inventoryItemId = generateId();
    await prisma.inventoryItem.create({
      data: {
        id: inventoryItemId,
        name: 'Test Med',
        category: 'Medicine',
        quantity: 10,
        unit: 'pcs',
        condition: 'Good',
        location: 'Clinic',
        status: 'Good',
      }
    });
  });

  afterAll(async () => {
    // Cleanup
    if (inventoryItemId) {
      await prisma.inventoryUpdate.deleteMany({ where: { item_id: inventoryItemId } });
      await prisma.inventoryItem.deleteMany({ where: { id: inventoryItemId } });
    }
    const validStudentIds = [student1Id, student2Id].filter(Boolean) as string[];
    if (validStudentIds.length > 0) {
      await prisma.clinicReferral.deleteMany({ where: { student_id: { in: validStudentIds } } });
    }
    
    const userIds = [nurseUserId, student1UserId, student2UserId].filter(Boolean) as string[];
    if (userIds.length > 0) {
      await prisma.userRole.deleteMany({ where: { user_id: { in: userIds } } });
      await prisma.auditLog.deleteMany({ where: { actor_user_id: { in: userIds } } });
      await prisma.staff.deleteMany({ where: { user_id: { in: userIds } } });
      await prisma.student.deleteMany({ where: { user_id: { in: userIds } } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
  });

  describe('Route Collision & Setup', () => {
    it('GET /api/student-services/clinic/inventory - should reach inventory and not studentId', async () => {
      // If it collides, it would return a 403 (Forbidden: student requesting someone else's record) or empty array for studentId = 'inventory'
      // But we expect the inventory items array (including Test Med)
      const res = await request(app)
        .get('/api/student-services/clinic/inventory')
        .set('Authorization', `Bearer ${nurseToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      const testItem = res.body.data.find((i: any) => i.id === inventoryItemId);
      expect(testItem).toBeTruthy();
    });

    it('POST /api/student-services/clinic/inventory - should reach inventory POST route', async () => {
      const res = await request(app)
        .post('/api/student-services/clinic/inventory')
        .set('Authorization', `Bearer ${nurseToken}`)
        .send({
          name: 'Another Med',
          category: 'Medicine',
          quantity: 5,
          unit: 'pcs'
        });
      
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      // Clean up
      await prisma.inventoryUpdate.deleteMany({ where: { item_id: res.body.data.id } });
      await prisma.inventoryItem.deleteMany({ where: { id: res.body.data.id } });
    });
  });

  describe('POST /api/student-services/clinic', () => {
    it('should create clinic record by authorized nurse', async () => {
      const res = await request(app)
        .post('/api/student-services/clinic')
        .set('Authorization', `Bearer ${nurseToken}`)
        .send({
          studentId: student1Id,
          date: '2026-10-08',
          time: '14:30',
          symptoms: 'Headache',
          diagnosis: 'Migraine',
          temperature: 37.5
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.student_id).toBe(student1Id);
      expect(res.body.data.symptoms).toBe('Headache');
      expect(res.body.data.recorded_by).toBe(nurseUserId);
      // Verify time parsing: 14:30 translated to 1970-01-01T14:30:00.000Z
      expect(new Date(res.body.data.time).getUTCHours()).toBe(14);
      expect(new Date(res.body.data.time).getUTCMinutes()).toBe(30);
      
      clinicRecordId = res.body.data.id;

      // Verify Audit Log
      const audit = await prisma.auditLog.findFirst({
        where: { resource_id: clinicRecordId, action: 'CLINIC_RECORD_CREATED' }
      });
      expect(audit).toBeTruthy();
      expect(audit?.actor_user_id).toBe(nurseUserId);
      expect(audit?.new_state).toHaveProperty('symptoms', 'Headache');
      expect(audit?.new_state).not.toHaveProperty('temperature'); // vitals omitted
    });

    it('should reject unauthorized user', async () => {
      const res = await request(app)
        .post('/api/student-services/clinic')
        .set('Authorization', `Bearer ${student1Token}`) // Students don't have clinic:write
        .send({
          studentId: student1Id,
          date: '2026-10-08',
          time: '14:30'
        });
      expect(res.status).toBe(403);
    });

    it('should accept missing time and default gracefully (nullable/optional)', async () => {
      const res = await request(app)
        .post('/api/student-services/clinic')
        .set('Authorization', `Bearer ${nurseToken}`)
        .send({
          studentId: student2Id,
          date: '2026-10-09',
        });
      expect(res.status).toBe(201);
      expect(res.body.data.time).toBeNull();
    });
  });

  describe('GET /api/student-services/clinic', () => {
    it('should return recent 100 clinic records for authorized staff', async () => {
      const res = await request(app)
        .get('/api/student-services/clinic')
        .set('Authorization', `Bearer ${nurseToken}`);
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeLessThanOrEqual(100);

      const record = res.body.data.find((r: any) => r.id === clinicRecordId);
      expect(record).toBeTruthy();
      expect(record.recorded_by).toBe('Nuur Se');
      expect(record.time).toBe('14:30'); // Stringified HH:mm
      expect(record.date).toBe('2026-10-08'); // Stringified YYYY-MM-DD
    });
  });

  describe('GET /api/student-services/clinic/:studentId', () => {
    it('should return records scoped to student for authorized staff', async () => {
      const res = await request(app)
        .get(`/api/student-services/clinic/${student1Id}`)
        .set('Authorization', `Bearer ${nurseToken}`);
      
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.every((r: any) => r.studentId === student1Id)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('should allow student to fetch their own records', async () => {
      const res = await request(app)
        .get(`/api/student-services/clinic/${student1Id}`)
        .set('Authorization', `Bearer ${student1Token}`);
        
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should block student from fetching another students records (403)', async () => {
      const res = await request(app)
        .get(`/api/student-services/clinic/${student2Id}`)
        .set('Authorization', `Bearer ${student1Token}`);
        
      expect(res.status).toBe(403);
      expect(res.body.error.message).toMatch(/only view your own/);
    });

    it('should return empty array for student with no records', async () => {
      const emptyId = generateId();
      const res = await request(app)
        .get(`/api/student-services/clinic/${emptyId}`)
        .set('Authorization', `Bearer ${nurseToken}`);
      
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });
  });

  afterAll(async () => {
    // Narrow cleanup of fixtures created by this test suite
    await prisma.clinicReferral.deleteMany({ where: { recorded_by: nurseUserId } });
    await prisma.inventoryUpdate.deleteMany({ where: { user_id: nurseUserId } });
    
    // Also cleanup users if needed, though they don't interfere with analytics
    const uids = [nurseUserId, student1UserId, student2UserId];
    await prisma.auditLog.deleteMany({ where: { actor_user_id: { in: uids } } });
    await prisma.userRole.deleteMany({ where: { user_id: { in: uids } } });
    await prisma.staff.deleteMany({ where: { user_id: { in: uids } } });
    await prisma.student.deleteMany({ where: { user_id: { in: uids } } });
    await prisma.user.deleteMany({ where: { id: { in: uids } } });
  });
});
