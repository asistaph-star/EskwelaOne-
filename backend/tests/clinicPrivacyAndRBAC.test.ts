import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/config/database.js';
import { generateId } from '../src/common/utils/uuid.js';
import { sign } from 'jsonwebtoken';
import { config } from '../src/config/env.js';
import bcrypt from 'bcrypt';
import { sanitizeMetadata, createAuditLog } from '../src/audit/audit.service.js';

describe('DIGISKWELA — Clinic Privacy, RBAC & Data Integrity Verification', () => {
  const TEST_PASSWORD = 'Password123!';
  let password_hash: string;

  // Synthetic Users & Tokens
  let nurseUserId: string;
  let nurseToken: string;

  let itAdminUserId: string;
  let itAdminToken: string;

  let studentAUserId: string;
  let studentAStudentId: string;
  let studentAToken: string;

  let studentBUserId: string;
  let studentBStudentId: string;
  let studentBToken: string;

  let teacherUserId: string;
  let teacherToken: string;

  let principalUserId: string;
  let principalToken: string;

  let guidanceUserId: string;
  let guidanceToken: string;

  let testInventoryItemId: string;
  let createdClinicRecordId: string;

  beforeAll(async () => {
    password_hash = await bcrypt.hash(TEST_PASSWORD, 10);

    // Ensure Roles exist
    let nurseRole = await prisma.role.findFirst({ where: { name: 'Nurse' } });
    if (!nurseRole) nurseRole = await prisma.role.create({ data: { id: generateId(), name: 'Nurse' } });

    let itAdminRole = await prisma.role.findFirst({ where: { name: 'ITAdmin' } });
    if (!itAdminRole) itAdminRole = await prisma.role.create({ data: { id: generateId(), name: 'ITAdmin' } });

    let studentRole = await prisma.role.findFirst({ where: { name: 'Student' } });
    if (!studentRole) studentRole = await prisma.role.create({ data: { id: generateId(), name: 'Student' } });

    let teacherRole = await prisma.role.findFirst({ where: { name: 'Teacher' } });
    if (!teacherRole) teacherRole = await prisma.role.create({ data: { id: generateId(), name: 'Teacher' } });

    let principalRole = await prisma.role.findFirst({ where: { name: 'Principal' } });
    if (!principalRole) principalRole = await prisma.role.create({ data: { id: generateId(), name: 'Principal' } });

    let guidanceRole = await prisma.role.findFirst({ where: { name: 'Guidance' } });
    if (!guidanceRole) guidanceRole = await prisma.role.create({ data: { id: generateId(), name: 'Guidance' } });

    // Permissions
    let permClinicRead = await prisma.permission.findFirst({ where: { key: 'clinic:read' } });
    if (!permClinicRead) permClinicRead = await prisma.permission.create({ data: { id: generateId(), key: 'clinic:read' } });

    let permClinicWrite = await prisma.permission.findFirst({ where: { key: 'clinic:write' } });
    if (!permClinicWrite) permClinicWrite = await prisma.permission.create({ data: { id: generateId(), key: 'clinic:write' } });

    let permUserRead = await prisma.permission.findFirst({ where: { key: 'user:read' } });
    if (!permUserRead) permUserRead = await prisma.permission.create({ data: { id: generateId(), key: 'user:read' } });

    let permAcademicRead = await prisma.permission.findFirst({ where: { key: 'academic:read' } });
    if (!permAcademicRead) permAcademicRead = await prisma.permission.create({ data: { id: generateId(), key: 'academic:read' } });

    // Map role permissions cleanly
    await prisma.rolePermission.createMany({
      data: [
        { role_id: nurseRole.id, permission_id: permClinicRead.id },
        { role_id: nurseRole.id, permission_id: permClinicWrite.id },
        { role_id: nurseRole.id, permission_id: permUserRead.id },
        { role_id: itAdminRole.id, permission_id: permClinicRead.id },
        { role_id: itAdminRole.id, permission_id: permClinicWrite.id },
        { role_id: teacherRole.id, permission_id: permUserRead.id },
        { role_id: principalRole.id, permission_id: permUserRead.id },
        { role_id: guidanceRole.id, permission_id: permUserRead.id },
        { role_id: studentRole.id, permission_id: permAcademicRead.id },
      ],
      skipDuplicates: true,
    });

    // 1. Synthetic Nurse
    nurseUserId = generateId();
    await prisma.user.create({
      data: {
        id: nurseUserId,
        school_id: `NURSE_SEC_${Date.now()}`,
        email: `nurse_sec_${Date.now()}@calulut.edu.ph`,
        password_hash,
        first_name: 'Nightingale',
        last_name: 'Clinic',
        status: 'active',
        must_change_password: false,
        user_roles: { create: { role_id: nurseRole.id } },
        staff: { create: { id: generateId(), employee_id: `EMP_N_${Date.now()}`, department: 'Clinic', position: 'Nurse' } }
      }
    });
    nurseToken = sign({ userId: nurseUserId }, config.jwt.secret, { expiresIn: '1h' });

    // 2. Synthetic IT Admin
    itAdminUserId = generateId();
    await prisma.user.create({
      data: {
        id: itAdminUserId,
        school_id: `IT_SEC_${Date.now()}`,
        email: `itadmin_sec_${Date.now()}@calulut.edu.ph`,
        password_hash,
        first_name: 'Sys',
        last_name: 'Admin',
        status: 'active',
        must_change_password: false,
        user_roles: { create: { role_id: itAdminRole.id } }
      }
    });
    itAdminToken = sign({ userId: itAdminUserId }, config.jwt.secret, { expiresIn: '1h' });

    // 3. Synthetic Student A
    studentAUserId = generateId();
    studentAStudentId = generateId();
    await prisma.user.create({
      data: {
        id: studentAUserId,
        school_id: `STUA_SEC_${Date.now()}`,
        email: `studentA_sec_${Date.now()}@calulut.edu.ph`,
        password_hash,
        first_name: 'Student',
        last_name: 'Alpha',
        status: 'active',
        must_change_password: false,
        user_roles: { create: { role_id: studentRole.id } },
        student: { create: { id: studentAStudentId, lrn: `LRN_A_${Date.now()}`, grade_level: 10 } }
      }
    });
    studentAToken = sign({ userId: studentAUserId }, config.jwt.secret, { expiresIn: '1h' });

    // 4. Synthetic Student B
    studentBUserId = generateId();
    studentBStudentId = generateId();
    await prisma.user.create({
      data: {
        id: studentBUserId,
        school_id: `STUB_SEC_${Date.now()}`,
        email: `studentB_sec_${Date.now()}@calulut.edu.ph`,
        password_hash,
        first_name: 'Student',
        last_name: 'Beta',
        status: 'active',
        must_change_password: false,
        user_roles: { create: { role_id: studentRole.id } },
        student: { create: { id: studentBStudentId, lrn: `LRN_B_${Date.now()}`, grade_level: 10 } }
      }
    });
    studentBToken = sign({ userId: studentBUserId }, config.jwt.secret, { expiresIn: '1h' });

    // 5. Synthetic Teacher
    teacherUserId = generateId();
    await prisma.user.create({
      data: {
        id: teacherUserId,
        school_id: `TEA_SEC_${Date.now()}`,
        email: `teacher_sec_${Date.now()}@calulut.edu.ph`,
        password_hash,
        first_name: 'Teacher',
        last_name: 'Staff',
        status: 'active',
        must_change_password: false,
        user_roles: { create: { role_id: teacherRole.id } }
      }
    });
    teacherToken = sign({ userId: teacherUserId }, config.jwt.secret, { expiresIn: '1h' });

    // 6. Synthetic Principal
    principalUserId = generateId();
    await prisma.user.create({
      data: {
        id: principalUserId,
        school_id: `PRI_SEC_${Date.now()}`,
        email: `principal_sec_${Date.now()}@calulut.edu.ph`,
        password_hash,
        first_name: 'Principal',
        last_name: 'Head',
        status: 'active',
        must_change_password: false,
        user_roles: { create: { role_id: principalRole.id } }
      }
    });
    principalToken = sign({ userId: principalUserId }, config.jwt.secret, { expiresIn: '1h' });

    // 7. Synthetic Guidance
    guidanceUserId = generateId();
    await prisma.user.create({
      data: {
        id: guidanceUserId,
        school_id: `GUI_SEC_${Date.now()}`,
        email: `guidance_sec_${Date.now()}@calulut.edu.ph`,
        password_hash,
        first_name: 'Counselor',
        last_name: 'Guidance',
        status: 'active',
        must_change_password: false,
        user_roles: { create: { role_id: guidanceRole.id } }
      }
    });
    guidanceToken = sign({ userId: guidanceUserId }, config.jwt.secret, { expiresIn: '1h' });

    // Create a Clinic Inventory Item for Dispensing tests
    testInventoryItemId = generateId();
    await prisma.inventoryItem.create({
      data: {
        id: testInventoryItemId,
        name: 'Mefenamic Acid 500mg (Privacy Test)',
        category: 'Medicine',
        quantity: 20,
        unit: 'capsules',
        condition: 'Good',
        location: 'Clinic',
        status: 'Good',
      }
    });
  });

  afterAll(async () => {
    try {
      if (testInventoryItemId) {
        await prisma.inventoryUpdate.deleteMany({ where: { item_id: testInventoryItemId } });
        await prisma.inventoryItem.deleteMany({ where: { id: testInventoryItemId } });
      }
      if (createdClinicRecordId) {
        await prisma.clinicReferral.deleteMany({ where: { id: createdClinicRecordId } });
      }
      const testStudentIds = [studentAStudentId, studentBStudentId].filter(Boolean);
      if (testStudentIds.length > 0) {
        await prisma.clinicReferral.deleteMany({ where: { student_id: { in: testStudentIds } } });
      }
      const uids = [
        nurseUserId, itAdminUserId, studentAUserId, studentBUserId,
        teacherUserId, principalUserId, guidanceUserId
      ].filter(Boolean);
      if (uids.length > 0) {
        await prisma.auditLog.deleteMany({ where: { actor_user_id: { in: uids } } });
        await prisma.staff.deleteMany({ where: { user_id: { in: uids } } });
        await prisma.student.deleteMany({ where: { user_id: { in: uids } } });
        await prisma.userRole.deleteMany({ where: { user_id: { in: uids } } });
        await prisma.user.deleteMany({ where: { id: { in: uids } } });
      }
    } finally {
      await prisma.$disconnect();
    }
  });

  // ══════════════════════════════════════════════════════════════════
  // SECTION 1: AUDIT LOG MEDICAL DATA PRIVACY VERIFICATION
  // ══════════════════════════════════════════════════════════════════
  describe('Phase 1: Audit Log Medical Data Privacy & Sanitization', () => {
    const SYNTHETIC_SYMPTOMS = 'SYNTHETIC_PERSISTENT_FEVER_AND_COUGH_123';
    const SYNTHETIC_DIAGNOSIS = 'SYNTHETIC_ACUTE_BRONCHITIS_456';
    const SYNTHETIC_TREATMENT = 'SYNTHETIC_NEBULIZATION_789';

    it('creates a clinic visit and persists clinical details encrypted/in clinic_referrals', async () => {
      const res = await request(app)
        .post('/api/student-services/clinic')
        .set('Authorization', `Bearer ${nurseToken}`)
        .send({
          studentId: studentAStudentId,
          date: '2026-10-26',
          time: '09:30',
          symptoms: SYNTHETIC_SYMPTOMS,
          diagnosis: SYNTHETIC_DIAGNOSIS,
          treatments: SYNTHETIC_TREATMENT,
          temperature: 38.5,
          bloodPressure: '120/80',
          heartRate: '88'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.student_id).toBe(studentAStudentId);
      createdClinicRecordId = res.body.data.id;
    });

    it('verifies PostgreSQL audit_logs does NOT persist raw symptoms or medical values', async () => {
      const audit = await prisma.auditLog.findFirst({
        where: { resource_id: createdClinicRecordId, action: 'CLINIC_RECORD_CREATED' }
      });

      expect(audit).toBeTruthy();
      expect(audit?.actor_user_id).toBe(nurseUserId);
      expect(audit?.category).toBe('STUDENT_SERVICES');
      expect(audit?.result).toBe('SUCCESS');

      // Verify that newState contains the reference studentId but NO clinical information
      const newState = audit?.new_state as Record<string, any>;
      expect(newState).toBeDefined();
      expect(newState).toHaveProperty('studentId', studentAStudentId);
      expect(newState).not.toHaveProperty('symptoms');
      expect(newState).not.toHaveProperty('diagnosis');
      expect(newState).not.toHaveProperty('treatments');
      expect(newState).not.toHaveProperty('temperature');
      expect(newState).not.toHaveProperty('bloodPressure');
      expect(newState).not.toHaveProperty('heartRate');

      // Verify serialized JSON string in database contains zero occurrence of synthetic medical text
      const rawSerialized = JSON.stringify(newState);
      expect(rawSerialized).not.toContain(SYNTHETIC_SYMPTOMS);
      expect(rawSerialized).not.toContain(SYNTHETIC_DIAGNOSIS);
      expect(rawSerialized).not.toContain(SYNTHETIC_TREATMENT);
    });

    it('verifies central recursive sanitizer strips symptoms and clinical fields if passed in metadata', () => {
      const dirtyMetadata = {
        studentId: 'STU-123',
        symptoms: 'Fever and chills',
        diagnosis: 'Influenza',
        treatment: 'Rest and hydration',
        medications: 'Paracetamol',
        vital_signs: '120/80 mmHg',
        temperature: 38.2,
        blood_pressure: '120/80',
        heart_rate: 90,
        clinical_notes: 'Private doctor observations',
        nestedRecord: {
          symptomDetails: 'Headache',
          medicalConditionStatus: 'Active',
          unrelatedField: 'Safe metadata value'
        }
      };

      const cleaned = sanitizeMetadata(dirtyMetadata);

      expect(cleaned.studentId).toBe('STU-123');
      expect(cleaned.symptoms).toBe('[REDACTED]');
      expect(cleaned.diagnosis).toBe('[REDACTED]');
      expect(cleaned.treatment).toBe('[REDACTED]');
      expect(cleaned.medications).toBe('[REDACTED]');
      expect(cleaned.vital_signs).toBe('[REDACTED]');
      expect(cleaned.temperature).toBe('[REDACTED]');
      expect(cleaned.blood_pressure).toBe('[REDACTED]');
      expect(cleaned.heart_rate).toBe('[REDACTED]');
      expect(cleaned.clinical_notes).toBe('[REDACTED]');
      expect(cleaned.nestedRecord.symptomDetails).toBe('[REDACTED]');
      expect(cleaned.nestedRecord.medicalConditionStatus).toBe('[REDACTED]');
      expect(cleaned.nestedRecord.unrelatedField).toBe('Safe metadata value');
    });

    it('verifies Audit Logs API does NOT disclose clinical symptoms to authorized admins', async () => {
      const audit = await prisma.auditLog.findFirst({
        where: { resource_id: createdClinicRecordId, action: 'CLINIC_RECORD_CREATED' }
      });
      expect(audit).toBeTruthy();

      const res = await request(app)
        .get(`/api/admin/audit-logs/${audit!.id}`)
        .set('Authorization', `Bearer ${itAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const apiLog = res.body.data;
      expect(apiLog.action).toBe('CLINIC_RECORD_CREATED');
      const returnedNewState = apiLog.new_state;
      expect(returnedNewState).not.toHaveProperty('symptoms');
      expect(JSON.stringify(returnedNewState)).not.toContain(SYNTHETIC_SYMPTOMS);
    });

    it('verifies Audit CSV Export does NOT expose sensitive medical columns', async () => {
      const res = await request(app)
        .get('/api/admin/audit-logs/export/csv')
        .set('Authorization', `Bearer ${itAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.text).not.toContain(SYNTHETIC_SYMPTOMS);
      expect(res.text).not.toContain(SYNTHETIC_DIAGNOSIS);
      // Header check: CSV must not output medical columns
      const firstLine = res.text.split('\n')[0];
      expect(firstLine).not.toContain('symptoms');
      expect(firstLine).not.toContain('diagnosis');
      expect(firstLine).not.toContain('temperature');
    });
  });

  // ══════════════════════════════════════════════════════════════════
  // SECTION 2: STUDENT OWNERSHIP & CLINIC RBAC VERIFICATION
  // ══════════════════════════════════════════════════════════════════
  describe('Phase 2: Student Ownership & Clinic RBAC Security', () => {
    it('Test A: allows Student A to view their own clinic records (200 OK)', async () => {
      const res = await request(app)
        .get(`/api/student-services/clinic/${studentAStudentId}`)
        .set('Authorization', `Bearer ${studentAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.every((r: any) => r.studentId === studentAStudentId)).toBe(true);
    });

    it('Test B: strictly blocks Student A from viewing Student B clinic records (403 ID Tampering)', async () => {
      const res = await request(app)
        .get(`/api/student-services/clinic/${studentBStudentId}`)
        .set('Authorization', `Bearer ${studentAToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(res.body.error.message).toMatch(/only view your own/i);
    });

    it('Test C: strictly blocks Student from accessing Nurse Clinic Overview (403 FORBIDDEN)', async () => {
      const res = await request(app)
        .get('/api/student-services/clinic')
        .set('Authorization', `Bearer ${studentAToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('Test D: strictly blocks Student from creating clinic records (403 FORBIDDEN)', async () => {
      const res = await request(app)
        .post('/api/student-services/clinic')
        .set('Authorization', `Bearer ${studentAToken}`)
        .send({
          studentId: studentAStudentId,
          date: '2026-10-26',
          symptoms: 'Unauthorized attempt'
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('Test E: strictly blocks Student from accessing Medicine Inventory (403 FORBIDDEN)', async () => {
      const res = await request(app)
        .get('/api/student-services/clinic/inventory')
        .set('Authorization', `Bearer ${studentAToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('Test F1: strictly blocks Student from adding new medicine inventory (403 FORBIDDEN)', async () => {
      const res = await request(app)
        .post('/api/student-services/clinic/inventory')
        .set('Authorization', `Bearer ${studentAToken}`)
        .send({
          name: 'Illegal Medicine Addition',
          category: 'Medicine',
          quantity: 100,
          unit: 'tablets'
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('Test F2: strictly blocks Student from consuming medicine inventory (403 FORBIDDEN)', async () => {
      const res = await request(app)
        .post(`/api/student-services/clinic/inventory/${testInventoryItemId}/use`)
        .set('Authorization', `Bearer ${studentAToken}`)
        .send({
          quantity: 5,
          reason: 'Unauthorized student consumption attempt'
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);

      // Verify stock did not change in database
      const item = await prisma.inventoryItem.findUnique({ where: { id: testInventoryItemId } });
      expect(item?.quantity).toBe(20);
    });

    it('Test F3: strictly blocks Student from viewing Clinic Analytics (403 FORBIDDEN)', async () => {
      const res = await request(app)
        .get('/api/student-services/clinic-analytics')
        .set('Authorization', `Bearer ${studentAToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });

  // ══════════════════════════════════════════════════════════════════
  // SECTION 3: NURSE AUTHORIZATION & PRESERVATION
  // ══════════════════════════════════════════════════════════════════
  describe('Phase 3: Nurse Authorized Clinic Workflows Preservation', () => {
    it('allows Nurse to view global clinic overview (200 OK)', async () => {
      const res = await request(app)
        .get('/api/student-services/clinic')
        .set('Authorization', `Bearer ${nurseToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.some((r: any) => r.id === createdClinicRecordId)).toBe(true);
    });

    it('allows Nurse to view any student clinic history (200 OK)', async () => {
      const res = await request(app)
        .get(`/api/student-services/clinic/${studentAStudentId}`)
        .set('Authorization', `Bearer ${nurseToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('allows Nurse to retrieve clinic inventory (200 OK)', async () => {
      const res = await request(app)
        .get('/api/student-services/clinic/inventory')
        .set('Authorization', `Bearer ${nurseToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.some((i: any) => i.id === testInventoryItemId)).toBe(true);
    });

    it('allows Nurse to consume/dispense clinic inventory stock (200 OK)', async () => {
      const res = await request(app)
        .post(`/api/student-services/clinic/inventory/${testInventoryItemId}/use`)
        .set('Authorization', `Bearer ${nurseToken}`)
        .send({
          quantity: 2,
          reason: 'Dispensed to student for headache'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.quantity).toBe(18); // 20 - 2
    });

    it('allows Nurse to view clinic analytics (200 OK)', async () => {
      const res = await request(app)
        .get('/api/student-services/clinic-analytics')
        .set('Authorization', `Bearer ${nurseToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('trend');
      expect(res.body.data).toHaveProperty('topDiagnosis');
      expect(res.body.data).toHaveProperty('peakHour');
    });
  });

  // ══════════════════════════════════════════════════════════════════
  // SECTION 4: OTHER ROLES & BOUNDARY ENFORCEMENT
  // ══════════════════════════════════════════════════════════════════
  describe('Phase 4: Non-Clinic Roles Strict Access Denial', () => {
    it('blocks Teacher from general clinic records (403 FORBIDDEN)', async () => {
      const res = await request(app)
        .get('/api/student-services/clinic')
        .set('Authorization', `Bearer ${teacherToken}`);
      expect(res.status).toBe(403);
    });

    it('blocks Teacher from student clinic history (403 FORBIDDEN)', async () => {
      const res = await request(app)
        .get(`/api/student-services/clinic/${studentAStudentId}`)
        .set('Authorization', `Bearer ${teacherToken}`);
      expect(res.status).toBe(403);
    });

    it('blocks Teacher from clinic inventory (403 FORBIDDEN)', async () => {
      const res = await request(app)
        .get('/api/student-services/clinic/inventory')
        .set('Authorization', `Bearer ${teacherToken}`);
      expect(res.status).toBe(403);
    });

    it('blocks Principal from clinic records without explicit clinic:read (403 FORBIDDEN)', async () => {
      const res = await request(app)
        .get('/api/student-services/clinic')
        .set('Authorization', `Bearer ${principalToken}`);
      expect(res.status).toBe(403);
    });

    it('blocks Guidance Counselor from clinic records (403 FORBIDDEN)', async () => {
      const res = await request(app)
        .get('/api/student-services/clinic')
        .set('Authorization', `Bearer ${guidanceToken}`);
      expect(res.status).toBe(403);
    });

    it('blocks unauthenticated requests with 401 UNAUTHORIZED', async () => {
      const res1 = await request(app).get('/api/student-services/clinic');
      expect(res1.status).toBe(401);

      const res2 = await request(app).get(`/api/student-services/clinic/${studentAStudentId}`);
      expect(res2.status).toBe(401);

      const res3 = await request(app).get('/api/student-services/clinic/inventory');
      expect(res3.status).toBe(401);

      const res4 = await request(app).get('/api/student-services/clinic-analytics');
      expect(res4.status).toBe(401);
    });
  });
});
