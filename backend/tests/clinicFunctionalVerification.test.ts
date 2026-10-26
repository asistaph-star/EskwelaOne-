import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/config/database.js';
import bcrypt from 'bcrypt';
import { generateId } from '../src/common/utils/uuid.js';
import { sign } from 'jsonwebtoken';

const TEST_PASSWORD = 'Password123!';

describe('DIGISKWELA — CLINIC / NURSE PORTAL COMPLETE FUNCTIONAL & INTEGRATION SUITE', () => {
  let nurseUserId: string;
  let nurseToken: string;

  let student1UserId: string;
  let student1Id: string;
  let student1Token: string;

  let student2UserId: string;
  let student2Id: string;
  let student2Token: string;

  let teacherUserId: string;
  let teacherToken: string;

  let principalUserId: string;
  let principalToken: string;

  let guidanceUserId: string;
  let guidanceToken: string;

  let createdClinicRecordId: string;
  let createdInventoryItemId: string;
  let nonClinicInventoryItemId: string;

  beforeAll(async () => {
    const password_hash = await bcrypt.hash(TEST_PASSWORD, 10);

    // 1. Roles & Permissions setup
    let clinicRole = await prisma.role.findFirst({ where: { name: 'Nurse' } });
    if (!clinicRole) clinicRole = await prisma.role.create({ data: { id: generateId(), name: 'Nurse' } });

    let studentRole = await prisma.role.findFirst({ where: { name: 'Student' } });
    if (!studentRole) studentRole = await prisma.role.create({ data: { id: generateId(), name: 'Student' } });

    let teacherRole = await prisma.role.findFirst({ where: { name: 'Teacher' } });
    if (!teacherRole) teacherRole = await prisma.role.create({ data: { id: generateId(), name: 'Teacher' } });

    let principalRole = await prisma.role.findFirst({ where: { name: 'Principal' } });
    if (!principalRole) principalRole = await prisma.role.create({ data: { id: generateId(), name: 'Principal' } });

    let guidanceRole = await prisma.role.findFirst({ where: { name: 'Guidance' } });
    if (!guidanceRole) guidanceRole = await prisma.role.create({ data: { id: generateId(), name: 'Guidance' } });

    let permClinicRead = await prisma.permission.findFirst({ where: { key: 'clinic:read' } });
    if (!permClinicRead) permClinicRead = await prisma.permission.create({ data: { id: generateId(), key: 'clinic:read' } });

    let permClinicWrite = await prisma.permission.findFirst({ where: { key: 'clinic:write' } });
    if (!permClinicWrite) permClinicWrite = await prisma.permission.create({ data: { id: generateId(), key: 'clinic:write' } });

    let permUserRead = await prisma.permission.findFirst({ where: { key: 'user:read' } });
    if (!permUserRead) permUserRead = await prisma.permission.create({ data: { id: generateId(), key: 'user:read' } });

    await prisma.rolePermission.createMany({
      data: [
        { role_id: clinicRole.id, permission_id: permClinicRead.id },
        { role_id: clinicRole.id, permission_id: permClinicWrite.id },
        { role_id: clinicRole.id, permission_id: permUserRead.id },
        { role_id: teacherRole.id, permission_id: permUserRead.id },
      ],
      skipDuplicates: true
    });

    // 2. Synthetic Nurse
    nurseUserId = generateId();
    await prisma.user.create({
      data: {
        id: nurseUserId,
        school_id: `NURSE-${Date.now()}`,
        email: `nurse_verif_${Date.now()}@test.com`,
        password_hash,
        first_name: 'Florence',
        last_name: 'Nightingale',
        status: 'active',
        must_change_password: false,
        user_roles: { create: { role_id: clinicRole.id } },
        staff: { create: { id: generateId(), employee_id: `N-${Date.now()}`, department: 'Clinic', position: 'School Nurse' } }
      }
    });
    nurseToken = sign({ userId: nurseUserId }, process.env.JWT_SECRET as string, { expiresIn: '1h' });

    // 3. Synthetic Student 1
    student1UserId = generateId();
    student1Id = generateId();
    await prisma.user.create({
      data: {
        id: student1UserId,
        school_id: `STU1-${Date.now()}`,
        email: `student1_verif_${Date.now()}@test.com`,
        password_hash,
        first_name: 'Juan',
        last_name: 'Dela Cruz',
        status: 'active',
        must_change_password: false,
        user_roles: { create: { role_id: studentRole.id } },
        student: {
          create: {
            id: student1Id,
            lrn: `LRN1-${Date.now()}`,
            grade_level: 10,
            blood_type: 'O+',
            allergies: 'Penicillin, Dust',
            medical_conditions: 'Mild Asthma',
            guardian_first_name: 'Pedro',
            guardian_last_name: 'Dela Cruz',
            guardian_phone: '09171234567'
          }
        }
      }
    });
    student1Token = sign({ userId: student1UserId }, process.env.JWT_SECRET as string, { expiresIn: '1h' });

    // 4. Synthetic Student 2
    student2UserId = generateId();
    student2Id = generateId();
    await prisma.user.create({
      data: {
        id: student2UserId,
        school_id: `STU2-${Date.now()}`,
        email: `student2_verif_${Date.now()}@test.com`,
        password_hash,
        first_name: 'Maria',
        last_name: 'Santos',
        status: 'active',
        must_change_password: false,
        user_roles: { create: { role_id: studentRole.id } },
        student: {
          create: {
            id: student2Id,
            lrn: `LRN2-${Date.now()}`,
            grade_level: 9,
            blood_type: 'A+',
            allergies: 'None',
            medical_conditions: 'None',
            guardian_first_name: 'Juana',
            guardian_last_name: 'Santos',
            guardian_phone: '09187654321'
          }
        }
      }
    });
    student2Token = sign({ userId: student2UserId }, process.env.JWT_SECRET as string, { expiresIn: '1h' });

    // 5. Synthetic Teacher (lacks clinic:read, clinic:write)
    teacherUserId = generateId();
    await prisma.user.create({
      data: {
        id: teacherUserId,
        school_id: `TEA-${Date.now()}`,
        email: `teacher_verif_${Date.now()}@test.com`,
        password_hash,
        first_name: 'Leonor',
        last_name: 'Rivera',
        status: 'active',
        must_change_password: false,
        user_roles: { create: { role_id: teacherRole.id } },
        teacher: { create: { id: generateId(), employee_id: `T-${Date.now()}`, department: 'Science', position: 'Teacher I' } }
      }
    });
    teacherToken = sign({ userId: teacherUserId }, process.env.JWT_SECRET as string, { expiresIn: '1h' });

    // 6. Synthetic Principal (lacks clinic:read, clinic:write)
    principalUserId = generateId();
    await prisma.user.create({
      data: {
        id: principalUserId,
        school_id: `PRIN-${Date.now()}`,
        email: `principal_verif_${Date.now()}@test.com`,
        password_hash,
        first_name: 'Jose',
        last_name: 'Rizal',
        status: 'active',
        must_change_password: false,
        user_roles: { create: { role_id: principalRole.id } },
        staff: { create: { id: generateId(), employee_id: `P-${Date.now()}`, department: 'Administration', position: 'Principal IV' } }
      }
    });
    principalToken = sign({ userId: principalUserId }, process.env.JWT_SECRET as string, { expiresIn: '1h' });

    // 7. Synthetic Guidance (lacks clinic:read, clinic:write)
    guidanceUserId = generateId();
    await prisma.user.create({
      data: {
        id: guidanceUserId,
        school_id: `GUID-${Date.now()}`,
        email: `guidance_verif_${Date.now()}@test.com`,
        password_hash,
        first_name: 'Sigmund',
        last_name: 'Freud',
        status: 'active',
        must_change_password: false,
        user_roles: { create: { role_id: guidanceRole.id } },
        staff: { create: { id: generateId(), employee_id: `G-${Date.now()}`, department: 'Guidance', position: 'Guidance Counselor' } }
      }
    });
    guidanceToken = sign({ userId: guidanceUserId }, process.env.JWT_SECRET as string, { expiresIn: '1h' });

    // 8. Non-clinic inventory item (to test scope boundary)
    nonClinicInventoryItemId = generateId();
    await prisma.inventoryItem.create({
      data: {
        id: nonClinicInventoryItemId,
        name: 'Science Microscope',
        category: 'Equipment',
        quantity: 10,
        unit: 'units',
        condition: 'Good',
        location: 'Science Lab',
        status: 'Good'
      }
    });
  });

  afterAll(async () => {
    try {
      // 1. Clean up created clinic records
      if (createdClinicRecordId) {
        await prisma.clinicReferral.deleteMany({ where: { id: createdClinicRecordId } });
      }
      await prisma.clinicReferral.deleteMany({ where: { recorded_by: nurseUserId } });

      // 2. Clean up inventory items & updates
      if (createdInventoryItemId) {
        await prisma.inventoryUpdate.deleteMany({ where: { item_id: createdInventoryItemId } });
        await prisma.inventoryItem.deleteMany({ where: { id: createdInventoryItemId } });
      }
      if (nonClinicInventoryItemId) {
        await prisma.inventoryItem.deleteMany({ where: { id: nonClinicInventoryItemId } });
      }
      await prisma.inventoryUpdate.deleteMany({ where: { user_id: nurseUserId } });

      // 3. Clean up synthetic audit logs
      await prisma.auditLog.deleteMany({
        where: { actor_user_id: { in: [nurseUserId, student1UserId, student2UserId, teacherUserId, principalUserId, guidanceUserId] } }
      });

      // 4. Clean up profiles & users
      await prisma.student.deleteMany({ where: { id: { in: [student1Id, student2Id] } } });
      await prisma.teacher.deleteMany({ where: { user_id: teacherUserId } });
      await prisma.staff.deleteMany({ where: { user_id: { in: [nurseUserId, principalUserId, guidanceUserId] } } });

      const allUserIds = [nurseUserId, student1UserId, student2UserId, teacherUserId, principalUserId, guidanceUserId];
      await prisma.userRole.deleteMany({ where: { user_id: { in: allUserIds } } });
      await prisma.user.deleteMany({ where: { id: { in: allUserIds } } });
    } finally {
      await prisma.$disconnect();
    }
  });

  // ══════════════════════════════════════════════════════════════════
  // SECTION 1: STUDENT / PATIENT RECORDS WORKFLOW
  // ══════════════════════════════════════════════════════════════════
  describe('Phase 1A: Student / Patient Records & Search', () => {
    it('allows authorized Nurse to search students via GET /api/users?role=Student', async () => {
      const res = await request(app)
        .get('/api/users?role=Student')
        .set('Authorization', `Bearer ${nurseToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);

      const student1Record = res.body.data.find((u: any) => u.id === student1UserId);
      expect(student1Record).toBeTruthy();
      expect(student1Record.first_name).toBe('Juan');
      expect(student1Record.last_name).toBe('Dela Cruz');
      expect(student1Record.student).toBeDefined();
      expect(student1Record.student.id).toBe(student1Id);
      expect(student1Record.student.grade_level).toBe(10);
      expect(student1Record.student.blood_type).toBe('O+');
      expect(student1Record.student.allergies).toBe('Penicillin, Dust');
      expect(student1Record.student.medical_conditions).toBe('Mild Asthma');
    });

    it('blocks unauthenticated requests to student user directory', async () => {
      const res = await request(app).get('/api/users?role=Student');
      expect(res.status).toBe(401);
    });
  });

  // ══════════════════════════════════════════════════════════════════
  // SECTION 2: CLINIC VISITS & RECORDING WORKFLOW
  // ══════════════════════════════════════════════════════════════════
  describe('Phase 1B & 1C: Clinic Visits & Referrals Management', () => {
    it('creates a complete clinic visit record with vitals and encrypted clinical data', async () => {
      const payload = {
        studentId: student1Id,
        date: '2026-10-26',
        time: '10:30',
        temperature: 37.8,
        bloodPressure: '115/75',
        heartRate: '82 bpm',
        symptoms: 'Fever, sore throat, and mild headache',
        diagnosis: 'Acute Viral Pharyngitis',
        medications: 'Paracetamol 500mg, Lozenges',
        treatments: 'Oral hydration advised; rested in clinic bed for 30 minutes',
        notes: 'Advised guardian; student cleared to return to class after rest'
      };

      const res = await request(app)
        .post('/api/student-services/clinic')
        .set('Authorization', `Bearer ${nurseToken}`)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.student_id).toBe(student1Id);
      expect(res.body.data.temperature).toBe(37.8);
      expect(res.body.data.blood_pressure).toBe('115/75');
      expect(res.body.data.heart_rate).toBe('82 bpm');
      expect(res.body.data.symptoms).toBe(payload.symptoms);
      expect(res.body.data.diagnosis).toBe(payload.diagnosis);
      expect(res.body.data.medications).toBe(payload.medications);
      expect(res.body.data.treatments).toBe(payload.treatments);
      expect(res.body.data.notes).toBe(payload.notes);
      expect(res.body.data.recorded_by).toBe(nurseUserId);

      createdClinicRecordId = res.body.data.id;

      // Verify PostgreSQL database persistence directly
      const dbRecord = await prisma.clinicReferral.findUnique({
        where: { id: createdClinicRecordId }
      });
      expect(dbRecord).toBeTruthy();
      expect(dbRecord?.student_id).toBe(student1Id);
      expect(dbRecord?.recorded_by).toBe(nurseUserId);
      expect(dbRecord?.temperature).toBe(37.8);
      expect(dbRecord?.diagnosis).toBe(payload.diagnosis);

      // Verify Audit Log generation with data minimization
      const auditLog = await prisma.auditLog.findFirst({
        where: { resource_id: createdClinicRecordId, action: 'CLINIC_RECORD_CREATED' }
      });
      expect(auditLog).toBeTruthy();
      expect(auditLog?.actor_user_id).toBe(nurseUserId);
      expect(auditLog?.new_state).toHaveProperty('studentId', student1Id);
      // Symptoms, vitals, medications, and treatments MUST be omitted from audit log for medical data minimization
      expect(auditLog?.new_state).not.toHaveProperty('symptoms');
      expect(auditLog?.new_state).not.toHaveProperty('temperature');
      expect(auditLog?.new_state).not.toHaveProperty('bloodPressure');
      expect(auditLog?.new_state).not.toHaveProperty('medications');
      expect(auditLog?.new_state).not.toHaveProperty('notes');
    });

    it('rejects clinic record creation with invalid date format', async () => {
      const res = await request(app)
        .post('/api/student-services/clinic')
        .set('Authorization', `Bearer ${nurseToken}`)
        .send({
          studentId: student1Id,
          date: '10/26/2026', // invalid (requires YYYY-MM-DD)
          symptoms: 'Headache'
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
    });

    it('rejects clinic record creation with invalid time format', async () => {
      const res = await request(app)
        .post('/api/student-services/clinic')
        .set('Authorization', `Bearer ${nurseToken}`)
        .send({
          studentId: student1Id,
          date: '2026-10-26',
          time: '25:99', // invalid hours and minutes
          symptoms: 'Dizziness'
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
    });

    it('rejects non-existent student ID (relational integrity constraint)', async () => {
      const nonExistentStudentId = generateId();
      const res = await request(app)
        .post('/api/student-services/clinic')
        .set('Authorization', `Bearer ${nurseToken}`)
        .send({
          studentId: nonExistentStudentId,
          date: '2026-10-26',
          symptoms: 'Cough'
        });

      // Prisma foreign key violation returns 500 internal database error
      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('returns recent 100 clinic visits via GET /api/student-services/clinic with formatted dates and recorder name', async () => {
      const res = await request(app)
        .get('/api/student-services/clinic')
        .set('Authorization', `Bearer ${nurseToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);

      const found = res.body.data.find((r: any) => r.id === createdClinicRecordId);
      expect(found).toBeTruthy();
      expect(found.studentId).toBe(student1Id);
      expect(found.date).toBe('2026-10-26');
      expect(found.time).toBe('10:30');
      expect(found.recorded_by).toBe('Florence Nightingale');
    });

    it('returns student-scoped clinic history via GET /api/student-services/clinic/:studentId', async () => {
      const res = await request(app)
        .get(`/api/student-services/clinic/${student1Id}`)
        .set('Authorization', `Bearer ${nurseToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.every((r: any) => r.studentId === student1Id)).toBe(true);
    });
  });

  // ══════════════════════════════════════════════════════════════════
  // SECTION 3: PRIVACY & ROLE-BASED ACCESS CONTROL (RBAC)
  // ══════════════════════════════════════════════════════════════════
  describe('Phase 2: Authentication, RBAC & Medical Data Privacy', () => {
    it('allows a Student to view ONLY their own clinic visit records', async () => {
      const res = await request(app)
        .get(`/api/student-services/clinic/${student1Id}`)
        .set('Authorization', `Bearer ${student1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('strictly blocks a Student from viewing another student clinic records (403 ID-Tampering)', async () => {
      const res = await request(app)
        .get(`/api/student-services/clinic/${student2Id}`)
        .set('Authorization', `Bearer ${student1Token}`);

      expect(res.status).toBe(403);
      expect(res.body.error.message).toMatch(/only view your own/i);
    });

    it('blocks Student from creating clinic records (lacks clinic:write)', async () => {
      const res = await request(app)
        .post('/api/student-services/clinic')
        .set('Authorization', `Bearer ${student1Token}`)
        .send({
          studentId: student1Id,
          date: '2026-10-26',
          symptoms: 'Fake symptom'
        });

      expect(res.status).toBe(403);
    });

    it('blocks Teacher from viewing general clinic records (lacks clinic:read)', async () => {
      const res = await request(app)
        .get('/api/student-services/clinic')
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(res.status).toBe(403);
    });

    it('blocks Guidance from viewing clinic records (lacks clinic:read)', async () => {
      const res = await request(app)
        .get('/api/student-services/clinic')
        .set('Authorization', `Bearer ${guidanceToken}`);

      expect(res.status).toBe(403);
    });

    it('blocks Principal from direct clinic record access without explicit clinic:read permission', async () => {
      const res = await request(app)
        .get('/api/student-services/clinic')
        .set('Authorization', `Bearer ${principalToken}`);

      expect(res.status).toBe(403);
    });
  });

  // ══════════════════════════════════════════════════════════════════
  // SECTION 4: MEDICINE & SUPPLY INVENTORY WORKFLOW & DISPENSING
  // ══════════════════════════════════════════════════════════════════
  describe('Phase 1D: Medicine & Supply Inventory and Dispensing Integrity', () => {
    it('retrieves inventory strictly scoped to location: Clinic', async () => {
      const res = await request(app)
        .get('/api/student-services/clinic/inventory')
        .set('Authorization', `Bearer ${nurseToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);

      // Verify that non-clinic items (e.g. Science Lab microscope) are completely excluded
      const foundNonClinic = res.body.data.find((i: any) => i.id === nonClinicInventoryItemId);
      expect(foundNonClinic).toBeUndefined();
    });

    it('creates a new clinic medicine inventory item with initial stock audit update', async () => {
      const res = await request(app)
        .post('/api/student-services/clinic/inventory')
        .set('Authorization', `Bearer ${nurseToken}`)
        .send({
          name: 'Amoxicillin 500mg',
          category: 'Medicine',
          quantity: 50,
          unit: 'capsules',
          reorder_level: 10,
          description: 'Antibiotic for clinic dispensation'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Amoxicillin 500mg');
      expect(res.body.data.category).toBe('Medicine');
      expect(res.body.data.quantity).toBe(50);
      expect(res.body.data.unit).toBe('capsules');
      expect(res.body.data.location).toBe('Clinic'); // Server forced

      createdInventoryItemId = res.body.data.id;

      // Verify initial audit update in database
      const initialUpdate = await prisma.inventoryUpdate.findFirst({
        where: { item_id: createdInventoryItemId, action: 'Added' }
      });
      expect(initialUpdate).toBeTruthy();
      expect(initialUpdate?.user_id).toBe(nurseUserId);
      expect(initialUpdate?.details).toContain('Initial stock: 50 capsules');
    });

    it('rejects inventory creation with invalid clinic category', async () => {
      const res = await request(app)
        .post('/api/student-services/clinic/inventory')
        .set('Authorization', `Bearer ${nurseToken}`)
        .send({
          name: 'Sports Basketball',
          category: 'Sports', // Invalid clinic category
          quantity: 5,
          unit: 'pcs'
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/invalid clinic category/i);
    });

    it('dispenses / consumes stock with atomic reduction and audit logging', async () => {
      const res = await request(app)
        .post(`/api/student-services/clinic/inventory/${createdInventoryItemId}/use`)
        .set('Authorization', `Bearer ${nurseToken}`)
        .send({
          quantity: 5,
          reason: 'Dispensed 5 capsules to student Juan Dela Cruz for bacterial infection'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.quantity).toBe(45); // 50 - 5 = 45

      // Verify PostgreSQL state
      const dbItem = await prisma.inventoryItem.findUnique({
        where: { id: createdInventoryItemId }
      });
      expect(dbItem?.quantity).toBe(45);

      // Verify Stock Consumed update
      const consumeUpdate = await prisma.inventoryUpdate.findFirst({
        where: { item_id: createdInventoryItemId, action: 'Stock Consumed' }
      });
      expect(consumeUpdate).toBeTruthy();
      expect(consumeUpdate?.user_id).toBe(nurseUserId);
      expect(consumeUpdate?.details).toContain('Used 5 capsules');
      expect(consumeUpdate?.details).toContain('bacterial infection');
    });

    it('rejects dispensing when requested quantity exceeds available stock', async () => {
      const res = await request(app)
        .post(`/api/student-services/clinic/inventory/${createdInventoryItemId}/use`)
        .set('Authorization', `Bearer ${nurseToken}`)
        .send({
          quantity: 50, // Only 45 available
          reason: 'Excessive request'
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/insufficient stock/i);

      // Verify stock was NOT modified
      const dbItem = await prisma.inventoryItem.findUnique({
        where: { id: createdInventoryItemId }
      });
      expect(dbItem?.quantity).toBe(45);
    });

    it('rejects dispensing from non-clinic inventory item (scope isolation)', async () => {
      const res = await request(app)
        .post(`/api/student-services/clinic/inventory/${nonClinicInventoryItemId}/use`)
        .set('Authorization', `Bearer ${nurseToken}`)
        .send({
          quantity: 1,
          reason: 'Tampered item ID'
        });

      expect(res.status).toBe(403);
      expect(res.body.error.message).toMatch(/access denied to non-clinic inventory/i);
    });
  });

  // ══════════════════════════════════════════════════════════════════
  // SECTION 5: CLINIC ANALYTICS & DASHBOARD
  // ══════════════════════════════════════════════════════════════════
  describe('Phase 1E: Clinic Analytics & Dashboard Integration', () => {
    it('returns structured clinic analytics including trend, diagnosis, and inventory warnings', async () => {
      const res = await request(app)
        .get('/api/student-services/clinic-analytics')
        .set('Authorization', `Bearer ${nurseToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const analytics = res.body.data;
      expect(analytics.trend).toBeDefined();
      expect(Array.isArray(analytics.trend)).toBe(true);
      expect(analytics.trend.length).toBe(5);

      expect(analytics.topDiagnosis).toBeDefined();
      expect(typeof analytics.topDiagPercent).toBe('number');
      expect(analytics.peakHour).toBeDefined();
      expect(Array.isArray(analytics.inventoryWarnings)).toBe(true);
    });

    it('blocks unauthorized users without clinic:read from clinic analytics', async () => {
      const res = await request(app)
        .get('/api/student-services/clinic-analytics')
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(res.status).toBe(403);
    });
  });
});
