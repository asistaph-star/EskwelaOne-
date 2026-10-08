import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/config/database.js';
import { generateId } from '../src/common/utils/uuid.js';
import { sign } from 'jsonwebtoken';
import { config } from '../src/config/env.js';

describe('Phase 4H: Clinic Analytics Characterization Tests', () => {
  let adminToken: string;
  let unauthorizedToken: string;
  let testStudentId: string;
  let testUserId: string;

  let inventoryItem1: string;
  let inventoryItem2: string;

  const now = new Date();
  
  // Deterministic dates based on today's execution for the rolling 5-day window
  const getDaysAgo = (days: number) => new Date(now.getTime() - days * 86400000);
  const getDaysAgoStr = (days: number) => getDaysAgo(days).toISOString().split('T')[0];

  beforeAll(async () => {
    // 0. Targeted cleanup of known interfering seeded fixture
    await prisma.clinicReferral.deleteMany({ where: { id: 'demo-clinic-ref-1' } });

    // 1. Setup Actor Tokens
    const adminUser = await prisma.user.create({
      data: {
        id: generateId(),
        email: `nurse-analytics-${Date.now()}@test.com`,
        password_hash: 'hash',
        first_name: 'Test',
        last_name: 'Nurse'
      }
    });
    testUserId = adminUser.id;
    // Roles
    let clinicRole = await prisma.role.findFirst({ where: { name: 'Nurse' } });
    if (!clinicRole) clinicRole = await prisma.role.create({ data: { id: generateId(), name: 'Nurse' } });
    let studentRole = await prisma.role.findFirst({ where: { name: 'Student' } });
    if (!studentRole) studentRole = await prisma.role.create({ data: { id: generateId(), name: 'Student' } });

    // Permissions
    let permRead = await prisma.permission.findFirst({ where: { key: 'clinic:read' } });
    if (!permRead) permRead = await prisma.permission.create({ data: { id: generateId(), key: 'clinic:read' } });

    await prisma.rolePermission.createMany({
      data: [{ role_id: clinicRole.id, permission_id: permRead.id }],
      skipDuplicates: true
    });

    await prisma.userRole.create({ data: { user_id: adminUser.id, role_id: clinicRole.id } });

    adminToken = sign({ userId: adminUser.id }, process.env.JWT_SECRET as string, { expiresIn: '1h' });

    // 2. Setup Student
    const studentUser = await prisma.user.create({
      data: {
        id: generateId(),
        email: `student-analytics-${Date.now()}@test.com`,
        password_hash: 'hash',
        first_name: 'S',
        last_name: 'S'
      }
    });
    const student = await prisma.student.create({
      data: {
        id: generateId(),
        user_id: studentUser.id,
        lrn: `LRN-ANALYTICS-${Date.now()}`,
        grade_level: 10
      }
    });
    testStudentId = student.id;

    await prisma.userRole.create({ data: { user_id: studentUser.id, role_id: studentRole.id } });
    
    // Create truly unauthorized user for 403 test
    const unauthUser = await prisma.user.create({
      data: { id: generateId(), email: `unauth-${Date.now()}@test.com`, password_hash: 'hash', first_name: 'U', last_name: 'U' }
    });
    let randomRole = await prisma.role.findFirst({ where: { name: 'Random' } });
    if (!randomRole) randomRole = await prisma.role.create({ data: { id: generateId(), name: 'Random' } });
    await prisma.userRole.create({ data: { user_id: unauthUser.id, role_id: randomRole.id } });
    
    unauthorizedToken = sign({ userId: unauthUser.id }, process.env.JWT_SECRET as string, { expiresIn: '1h' });

    // 3. (No global wipes. We rely on narrow cleanup and fileParallelism to prevent test pollution)
    
    // 4. Setup Clinic Referrals (deterministic, matching trend window)
    // We create:
    // - 2 records 0 days ago (today), diagnosis: "Headache", Time: 09:xx and 09:xx (Peak hour = 09)
    // - 1 record 1 day ago, diagnosis: "Fever", Time: 10:xx
    // - 1 record 3 days ago, diagnosis: "Headache", Time: 09:xx
    // Total 4 records in the 5-day window.
    
    await prisma.clinicReferral.create({
      data: {
        id: generateId(),
        student_id: testStudentId,
        date: getDaysAgo(0),
        time: new Date('1970-01-01T09:15:00.000Z'), // UTC Hour 9
        diagnosis: 'Headache',
        recorded_by: testUserId
      }
    });
    
    await prisma.clinicReferral.create({
      data: {
        id: generateId(),
        student_id: testStudentId,
        date: getDaysAgo(0),
        time: new Date('1970-01-01T09:45:00.000Z'), // UTC Hour 9
        diagnosis: 'Headache',
        recorded_by: testUserId
      }
    });

    await prisma.clinicReferral.create({
      data: {
        id: generateId(),
        student_id: testStudentId,
        date: getDaysAgo(1),
        time: new Date('1970-01-01T10:30:00.000Z'), // UTC Hour 10
        diagnosis: 'Fever',
        recorded_by: testUserId
      }
    });

    await prisma.clinicReferral.create({
      data: {
        id: generateId(),
        student_id: testStudentId,
        date: getDaysAgo(3),
        time: new Date('1970-01-01T09:10:00.000Z'), // UTC Hour 9
        diagnosis: 'Headache',
        recorded_by: testUserId
      }
    });

    // 5. Setup Inventory Items for Warnings
    inventoryItem1 = generateId();
    inventoryItem2 = generateId();

    // Item 1: Low Stock (Stock: 5, Reorder: 10)
    await prisma.inventoryItem.create({
      data: {
        id: inventoryItem1,
        name: 'Paracetamol',
        category: 'Medicine',
        quantity: 5,
        reorder_level: 10,
        unit: 'pcs',
        location: 'Clinic',
        status: 'Good',
        condition: 'Good'
      }
    });

    // Item 2: Healthy Stock (Stock: 20, Reorder: 10)
    await prisma.inventoryItem.create({
      data: {
        id: inventoryItem2,
        name: 'Bandages',
        category: 'Supplies',
        quantity: 20,
        reorder_level: 10,
        unit: 'pcs',
        location: 'Clinic',
        status: 'Good',
        condition: 'Good'
      }
    });
  });

  afterAll(async () => {
    // Cleanup
    await prisma.inventoryUpdate.deleteMany({ where: { item_id: { in: [inventoryItem1, inventoryItem2].filter(Boolean) } } });
    await prisma.inventoryItem.deleteMany({ where: { id: { in: [inventoryItem1, inventoryItem2].filter(Boolean) } } });
    await prisma.clinicReferral.deleteMany({ where: { recorded_by: testUserId } });
    try {
      await prisma.student.deleteMany({ where: { id: testStudentId } });
    } catch(e) {}
    try {
      await prisma.userRole.deleteMany({ where: { user: { email: { contains: 'unauth' } } } });
      await prisma.userRole.deleteMany({ where: { user: { email: { contains: 'analytics' } } } });
    } catch (e) {}
    await prisma.user.deleteMany({ where: { email: { contains: 'analytics' } } });
    await prisma.user.deleteMany({ where: { email: { contains: 'unauth' } } });
  });

  it('should return 401/403 for unauthorized users', async () => {
    const res = await request(app).get('/api/student-services/clinic-analytics');
    expect(res.status).toBe(401); // No token

    const res2 = await request(app)
      .get('/api/student-services/clinic-analytics')
      .set('Authorization', `Bearer ${unauthorizedToken}`);
    expect(res2.status).toBe(403); // Missing clinic:read
  });

  it('should characterize GET /api/student-services/clinic-analytics correctly', async () => {
    const res = await request(app)
      .get('/api/student-services/clinic-analytics')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const data = res.body.data;

    // 1. Characterize Trend
    expect(data.trend).toBeDefined();
    expect(Array.isArray(data.trend)).toBe(true);
    expect(data.trend.length).toBe(5); // 5 days: today, -1, -2, -3, -4
    
    // Verify specific days (order is from i=4 down to 0, so oldest to newest)
    expect(data.trend[0].date).toBe(getDaysAgoStr(4));
    expect(data.trend[1].date).toBe(getDaysAgoStr(3));
    expect(data.trend[1].visits).toBe(1);

    expect(data.trend[3].date).toBe(getDaysAgoStr(1));
    expect(data.trend[3].visits).toBe(1);

    expect(data.trend[4].date).toBe(getDaysAgoStr(0));
    expect(data.trend[4].visits).toBe(2);

    // 2. Characterize Top Diagnosis
    expect(data.topDiagnosis).toBe('Headache');
    expect(data.topDiagPercent).toBe(75); // 3 out of 4 is 75%

    // 3. Characterize Peak Hour
    expect(data.peakHour).toBe('09:00 - 10:00'); // 3 out of 4 occurred in hour 9 (09:10, 09:15, 09:45)

    // 4. Characterize Inventory Warnings
    expect(data.inventoryWarnings).toBeDefined();
    expect(Array.isArray(data.inventoryWarnings)).toBe(true);
    
    // Only Paracetamol should be here (quantity 5 <= reorder 10)
    // Bandages (20 > 10) shouldn't be included.
    const warnings = data.inventoryWarnings;
    const paracetamolWarning = warnings.find((w: any) => w.name === 'Paracetamol');
    expect(paracetamolWarning).toBeDefined();
    expect(paracetamolWarning.stock).toBe(5);
    expect(paracetamolWarning.reorder).toBe(10);
  });

  it('should characterize empty data defaults', async () => {
    // Narrow cleanup to test empty state
    await prisma.clinicReferral.deleteMany({ where: { recorded_by: testUserId } });
    await prisma.inventoryItem.deleteMany({ where: { id: { in: [inventoryItem1, inventoryItem2].filter(Boolean) } } });

    const res = await request(app)
      .get('/api/student-services/clinic-analytics')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const data = res.body.data;

    // Trend should still be 5 items, all 0 visits
    expect(data.trend.length).toBe(5);
    expect(data.trend.every((t: any) => t.visits === 0)).toBe(true);

    // Empty state fallbacks
    expect(data.topDiagnosis).toBe('None');
    expect(data.topDiagPercent).toBe(0);
    expect(data.peakHour).toBe('None');
    expect(data.inventoryWarnings).toEqual([]);
  });
});
