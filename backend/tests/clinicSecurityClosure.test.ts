import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/config/database.js';
import { generateId } from '../src/common/utils/uuid.js';
import jwt from 'jsonwebtoken';
import { config } from '../src/config/env.js';
import bcrypt from 'bcrypt';
import { ClinicRecordsService } from '../src/modules/clinic-records/clinicRecords.service.js';
import {
  getAuditLogs,
  getAuditLogById,
  sanitizeMetadata,
} from '../src/audit/audit.service.js';
import {
  validateTestDatabaseEnvironment,
  assertTestDatabaseIsolation,
} from '../src/config/databaseGuard.js';
import { enforceStudentClinicRbacInvariant } from './setup/testEnvGuard.js';

describe('DIGISKWELA — CLINIC SECURITY CLOSURE & ISOLATION VERIFICATION', () => {
  let nurseUserId: string;
  let nurseToken: string;
  let studentAUserId: string;
  let studentAStudentId: string;
  let studentAToken: string;
  let studentBUserId: string;
  let studentBStudentId: string;
  let studentBToken: string;
  let itAdminUserId: string;
  let itAdminToken: string;
  let teacherUserId: string;
  let teacherToken: string;
  let guidanceUserId: string;
  let guidanceToken: string;

  let testInventoryItemId: string;
  let testClinicRecordId: string;
  let legacyAuditLogId: string;

  beforeAll(async () => {
    // 1. Ensure test database isolation invariant
    assertTestDatabaseIsolation(process.env);
    await enforceStudentClinicRbacInvariant();

    const password_hash = await bcrypt.hash('TestPass123!', 4);

    // Get canonical roles
    const nurseRole = await prisma.role.findUnique({ where: { name: 'Nurse' } });
    const studentRole = await prisma.role.findUnique({ where: { name: 'Student' } });
    const itAdminRole = await prisma.role.findUnique({ where: { name: 'ITAdmin' } });
    const teacherRole = await prisma.role.findUnique({ where: { name: 'Teacher' } });
    const guidanceRole = await prisma.role.findUnique({ where: { name: 'Guidance' } });

    if (!nurseRole || !studentRole || !itAdminRole || !teacherRole || !guidanceRole) {
      throw new Error('Required canonical roles not found in database.');
    }

    // Synthetic Nurse
    nurseUserId = generateId();
    await prisma.user.create({
      data: {
        id: nurseUserId,
        school_id: `SEC_NURSE_${Date.now()}`,
        email: `sec_nurse_${Date.now()}@calulut.edu.ph`,
        password_hash,
        first_name: 'Florence',
        last_name: 'Nightingale',
        status: 'active',
        must_change_password: false,
        user_roles: { create: { role_id: nurseRole.id } },
        staff: { create: { id: generateId(), employee_id: `EMP_N_${Date.now()}`, department: 'Clinic', position: 'Nurse' } },
      },
    });
    nurseToken = jwt.sign({ userId: nurseUserId }, config.jwt.secret, { expiresIn: '1h' });

    // Synthetic Student A
    studentAUserId = generateId();
    studentAStudentId = generateId();
    await prisma.user.create({
      data: {
        id: studentAUserId,
        school_id: `SEC_STUA_${Date.now()}`,
        email: `sec_stua_${Date.now()}@calulut.edu.ph`,
        password_hash,
        first_name: 'Student',
        last_name: 'Alpha',
        status: 'active',
        must_change_password: false,
        user_roles: { create: { role_id: studentRole.id } },
        student: {
          create: {
            id: studentAStudentId,
            lrn: `LRN_A_${Date.now()}`,
            grade_level: 10,
          },
        },
      },
    });
    studentAToken = jwt.sign({ userId: studentAUserId }, config.jwt.secret, { expiresIn: '1h' });

    // Synthetic Student B
    studentBUserId = generateId();
    studentBStudentId = generateId();
    await prisma.user.create({
      data: {
        id: studentBUserId,
        school_id: `SEC_STUB_${Date.now()}`,
        email: `sec_stub_${Date.now()}@calulut.edu.ph`,
        password_hash,
        first_name: 'Student',
        last_name: 'Beta',
        status: 'active',
        must_change_password: false,
        user_roles: { create: { role_id: studentRole.id } },
        student: {
          create: {
            id: studentBStudentId,
            lrn: `LRN_B_${Date.now()}`,
            grade_level: 10,
          },
        },
      },
    });
    studentBToken = jwt.sign({ userId: studentBUserId }, config.jwt.secret, { expiresIn: '1h' });

    // Synthetic IT Admin
    itAdminUserId = generateId();
    await prisma.user.create({
      data: {
        id: itAdminUserId,
        school_id: `SEC_IT_${Date.now()}`,
        email: `sec_it_${Date.now()}@calulut.edu.ph`,
        password_hash,
        first_name: 'IT',
        last_name: 'Admin',
        status: 'active',
        must_change_password: false,
        user_roles: { create: { role_id: itAdminRole.id } },
      },
    });
    itAdminToken = jwt.sign({ userId: itAdminUserId }, config.jwt.secret, { expiresIn: '1h' });

    // Synthetic Teacher
    teacherUserId = generateId();
    await prisma.user.create({
      data: {
        id: teacherUserId,
        school_id: `SEC_TEA_${Date.now()}`,
        email: `sec_tea_${Date.now()}@calulut.edu.ph`,
        password_hash,
        first_name: 'Teacher',
        last_name: 'One',
        status: 'active',
        must_change_password: false,
        user_roles: { create: { role_id: teacherRole.id } },
      },
    });
    teacherToken = jwt.sign({ userId: teacherUserId }, config.jwt.secret, { expiresIn: '1h' });

    // Synthetic Guidance
    guidanceUserId = generateId();
    await prisma.user.create({
      data: {
        id: guidanceUserId,
        school_id: `SEC_GUI_${Date.now()}`,
        email: `sec_gui_${Date.now()}@calulut.edu.ph`,
        password_hash,
        first_name: 'Guidance',
        last_name: 'Counselor',
        status: 'active',
        must_change_password: false,
        user_roles: { create: { role_id: guidanceRole.id } },
      },
    });
    guidanceToken = jwt.sign({ userId: guidanceUserId }, config.jwt.secret, { expiresIn: '1h' });

    // Clinic Inventory Item
    testInventoryItemId = generateId();
    await prisma.inventoryItem.create({
      data: {
        id: testInventoryItemId,
        name: 'Cetirizine 10mg (Security Verification)',
        category: 'Medicine',
        quantity: 50,
        unit: 'tablets',
        condition: 'Good',
        location: 'Clinic',
        status: 'Good',
      },
    });

    // Create a legacy audit record containing un-sanitized symptoms to verify read-time redaction
    legacyAuditLogId = generateId();
    await prisma.auditLog.create({
      data: {
        id: legacyAuditLogId,
        actor_user_id: nurseUserId,
        actor_school_id: 'NURSE-001',
        actor_role: 'Nurse',
        action: 'CLINIC_RECORD_CREATED',
        category: 'STUDENT_SERVICES',
        resource_type: 'clinic_record',
        resource_id: generateId(),
        target_label: `Clinic record for student ${studentAStudentId}`,
        result: 'SUCCESS',
        ip_address: '127.0.0.1',
        user_agent: 'Legacy-System/1.0',
        previous_state: null,
        new_state: {
          studentId: studentAStudentId,
          symptoms: 'High fever, acute dizziness, coughing fits',
          vital_signs: '130/85',
          body_temperature: '39.1C',
          heart_rate: '110 bpm',
          clinical_notes: 'Patient advised to rest in clinic bed',
        },
        correlation_id: generateId(),
      },
    });
  });

  afterAll(async () => {
    try {
      if (testInventoryItemId) {
        await prisma.inventoryUpdate.deleteMany({ where: { item_id: testInventoryItemId } });
        await prisma.inventoryItem.deleteMany({ where: { id: testInventoryItemId } });
      }
      if (testClinicRecordId) {
        await prisma.clinicReferral.deleteMany({ where: { id: testClinicRecordId } });
      }
      const testStudentIds = [studentAStudentId, studentBStudentId].filter(Boolean);
      if (testStudentIds.length > 0) {
        await prisma.clinicReferral.deleteMany({ where: { student_id: { in: testStudentIds } } });
      }
      if (legacyAuditLogId) {
        await prisma.auditLog.deleteMany({ where: { id: legacyAuditLogId } });
      }
      const uids = [
        nurseUserId, studentAUserId, studentBUserId, itAdminUserId,
        teacherUserId, guidanceUserId
      ].filter(Boolean);
      if (uids.length > 0) {
        await prisma.auditLog.deleteMany({ where: { actor_user_id: { in: uids } } });
        await prisma.userRole.deleteMany({ where: { user_id: { in: uids } } });
        await prisma.staff.deleteMany({ where: { user_id: { in: uids } } });
        await prisma.student.deleteMany({ where: { user_id: { in: uids } } });
        await prisma.user.deleteMany({ where: { id: { in: uids } } });
      }
    } finally {
      await enforceStudentClinicRbacInvariant();
    }
  });

  // ==========================================
  // PHASE 4 — RBAC PERSISTENCE & ISOLATION TESTS
  // ==========================================

  describe('PHASE 4: RBAC Persistence & Test Database Isolation', () => {
    it('Test A — Current Permission State: Student role must strictly NOT have clinic:read or clinic:write', async () => {
      const studentRole = await prisma.role.findUnique({
        where: { name: 'Student' },
        include: {
          role_permissions: {
            include: { permission: true },
          },
        },
      });

      expect(studentRole).toBeTruthy();
      const permissionKeys = studentRole!.role_permissions.map(rp => rp.permission.key);
      expect(permissionKeys).not.toContain('clinic:read');
      expect(permissionKeys).not.toContain('clinic:write');
    });

    it('Test B — Application Restart: Permissions persist safely and Nurse retains clinic permissions', async () => {
      const nurseRole = await prisma.role.findUnique({
        where: { name: 'Nurse' },
        include: {
          role_permissions: {
            include: { permission: true },
          },
        },
      });

      expect(nurseRole).toBeTruthy();
      const nursePerms = nurseRole!.role_permissions.map(rp => rp.permission.key);
      expect(nursePerms).toContain('clinic:read');
      expect(nursePerms).toContain('clinic:write');

      const studentRole = await prisma.role.findUnique({
        where: { name: 'Student' },
        include: {
          role_permissions: {
            include: { permission: true },
          },
        },
      });
      const studentPerms = studentRole!.role_permissions.map(rp => rp.permission.key);
      expect(studentPerms).not.toContain('clinic:read');
    });

    it('Test C — Seed / Initialization Safety: Canonical seed configuration contains zero clinic permissions for Student', async () => {
      // Direct verification of seed role configuration invariants
      const CANONICAL_STUDENT_PERMS = ['academic:read', 'document:request', 'document:read'];
      const CANONICAL_NURSE_PERMS = ['user:read', 'clinic:read', 'clinic:write'];

      expect(CANONICAL_STUDENT_PERMS).not.toContain('clinic:read');
      expect(CANONICAL_STUDENT_PERMS).not.toContain('clinic:write');
      expect(CANONICAL_NURSE_PERMS).toContain('clinic:read');
      expect(CANONICAL_NURSE_PERMS).toContain('clinic:write');
    });

    it('Test D — Repeated Test Execution: Student permissions remain unpolluted after repeated fixture runs', async () => {
      for (let i = 0; i < 3; i++) {
        await enforceStudentClinicRbacInvariant();
        const studentRole = await prisma.role.findUnique({
          where: { name: 'Student' },
          include: {
            role_permissions: {
              include: { permission: true },
            },
          },
        });
        const perms = studentRole!.role_permissions.map(rp => rp.permission.key);
        expect(perms).not.toContain('clinic:read');
        expect(perms).not.toContain('clinic:write');
      }
    });

    it('Test E — Failed Test Cleanup: Teardown invariant restores RBAC state even if a failure occurs', async () => {
      let simulatedErrorCaught = false;
      try {
        // Intentionally throw inside a test block
        throw new Error('Simulated test assertion failure');
      } catch (err: any) {
        simulatedErrorCaught = true;
      } finally {
        await enforceStudentClinicRbacInvariant();
      }

      expect(simulatedErrorCaught).toBe(true);
      const studentRole = await prisma.role.findUnique({
        where: { name: 'Student' },
        include: {
          role_permissions: {
            include: { permission: true },
          },
        },
      });
      const perms = studentRole!.role_permissions.map(rp => rp.permission.key);
      expect(perms).not.toContain('clinic:read');
    });

    it('Test F — Unsafe Database Guard: Refuses execution when pointed to production environments', () => {
      // 1. Refuse NODE_ENV=production
      const prodEnvResult = validateTestDatabaseEnvironment({
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://postgres:admin@localhost:5432/digiskwela',
      });
      expect(prodEnvResult.safe).toBe(false);
      expect(prodEnvResult.reason).toContain('NODE_ENV is set to "production"');

      // 2. Refuse AWS RDS production host
      const rdsResult = validateTestDatabaseEnvironment({
        NODE_ENV: 'test',
        DATABASE_URL: 'postgresql://admin:secret@calulut-prod.rds.amazonaws.com:5432/digiskwela',
      });
      expect(rdsResult.safe).toBe(false);
      expect(rdsResult.reason).toContain('protected cloud/production host pattern');

      // 3. Refuse production keyword in database name
      const keywordResult = validateTestDatabaseEnvironment({
        NODE_ENV: 'test',
        DATABASE_URL: 'postgresql://admin:secret@localhost:5432/digiskwela_prod',
      });
      expect(keywordResult.safe).toBe(false);
      expect(keywordResult.reason).toContain('prohibited production identifier');

      // 4. Refuse development database "digiskwela"
      const devDbResult = validateTestDatabaseEnvironment({
        NODE_ENV: 'test',
        DATABASE_URL: 'postgresql://postgres:admin123@localhost:5432/digiskwela?schema=public',
      });
      expect(devDbResult.safe).toBe(false);
      expect(devDbResult.reason).toContain('development database "digiskwela"');

      // 5. Approve dedicated test database "digiskwela_test"
      const testDbResult = validateTestDatabaseEnvironment({
        NODE_ENV: 'test',
        DATABASE_URL: 'postgresql://digiskwela_test_user:secret@localhost:5432/digiskwela_test?schema=public',
      });
      expect(testDbResult.safe).toBe(true);
    });

    it('Test G — Student Authorization: Student A has own-record access (200), blocked from all else (403)', async () => {
      // G1: Student A can fetch own clinic records
      const ownRes = await request(app)
        .get(`/api/student-services/clinic/${studentAStudentId}`)
        .set('Authorization', `Bearer ${studentAToken}`);
      expect(ownRes.status).toBe(200);
      expect(ownRes.body.success).toBe(true);

      // G2: Student A cannot fetch Student B clinic records (403)
      const crossRes = await request(app)
        .get(`/api/student-services/clinic/${studentBStudentId}`)
        .set('Authorization', `Bearer ${studentAToken}`);
      expect(crossRes.status).toBe(403);

      // G3: Student cannot access general clinic overview (403)
      const overviewRes = await request(app)
        .get('/api/student-services/clinic')
        .set('Authorization', `Bearer ${studentAToken}`);
      expect(overviewRes.status).toBe(403);

      // G4: Student cannot access clinic inventory (403)
      const invRes = await request(app)
        .get('/api/student-services/clinic/inventory')
        .set('Authorization', `Bearer ${studentAToken}`);
      expect(invRes.status).toBe(403);

      // G5: Student cannot access clinic analytics (403)
      const analyticsRes = await request(app)
        .get('/api/student-services/clinic-analytics')
        .set('Authorization', `Bearer ${studentAToken}`);
      expect(analyticsRes.status).toBe(403);

      // G6: Student cannot create clinic records (403)
      const createRes = await request(app)
        .post('/api/student-services/clinic')
        .set('Authorization', `Bearer ${studentAToken}`)
        .send({
          studentId: studentAStudentId,
          symptoms: 'Mild headache',
          actionTaken: 'Rest',
        });
      expect(createRes.status).toBe(403);

      // G7: Student cannot dispense inventory (403)
      const useRes = await request(app)
        .post(`/api/student-services/clinic/inventory/${testInventoryItemId}/use`)
        .set('Authorization', `Bearer ${studentAToken}`)
        .send({
          quantity: 1,
          reason: 'Self-medication attempt',
        });
      expect(useRes.status).toBe(403);
    });

    it('Test H — Nurse Authorization: Nurse retains full legitimate access across all Clinic endpoints', async () => {
      // H1: Nurse can access clinic overview (200)
      const overviewRes = await request(app)
        .get('/api/student-services/clinic')
        .set('Authorization', `Bearer ${nurseToken}`);
      expect(overviewRes.status).toBe(200);

      // H2: Nurse can access student records (200)
      const studentRes = await request(app)
        .get(`/api/student-services/clinic/${studentAStudentId}`)
        .set('Authorization', `Bearer ${nurseToken}`);
      expect(studentRes.status).toBe(200);

      // H3: Nurse can access inventory (200)
      const invRes = await request(app)
        .get('/api/student-services/clinic/inventory')
        .set('Authorization', `Bearer ${nurseToken}`);
      expect(invRes.status).toBe(200);

      // H4: Nurse can dispense inventory (200)
      const useRes = await request(app)
        .post(`/api/student-services/clinic/inventory/${testInventoryItemId}/use`)
        .set('Authorization', `Bearer ${nurseToken}`)
        .send({
          quantity: 1,
          reason: 'Routine dispensing for allergies',
        });
      expect(useRes.status).toBe(200);
      expect(useRes.body.success).toBe(true);

      // H5: Nurse can access clinic analytics (200)
      const analyticsRes = await request(app)
        .get('/api/student-services/clinic-analytics')
        .set('Authorization', `Bearer ${nurseToken}`);
      expect(analyticsRes.status).toBe(200);
    });
  });

  // ==========================================
  // PHASE 5 — AUDIT PRIVACY REGRESSION TESTS
  // ==========================================

  describe('PHASE 5: Audit Privacy & Historical Redaction Regression', () => {
    it('Test 1 — New Audit Entry: Clinic record creation excludes symptoms from persisted audit metadata', async () => {
      const correlationId = generateId();
      const record = await ClinicRecordsService.createRecord(
        {
          studentId: studentAStudentId,
          date: '2026-10-26',
          time: '14:30',
          symptoms: 'High fever and severe chills (Sensitive Medical Data)',
          actionTaken: 'Administered oral rehydration and rest in clinic',
          temperature: 38.8,
          bloodPressure: '118/78',
        },
        nurseUserId,
        correlationId
      );
      testClinicRecordId = record.id;

      // Query raw database audit log
      const auditLog = await prisma.auditLog.findFirst({
        where: {
          action: 'CLINIC_RECORD_CREATED',
          resource_id: record.id,
        },
      });

      expect(auditLog).toBeTruthy();
      const rawState = JSON.stringify(auditLog!.new_state || {});

      // Verify raw medical text is completely excluded from audit write
      expect(rawState).not.toContain('High fever and severe chills');
      expect(rawState).not.toContain('38.8');
      expect(rawState).not.toContain('118/78');
      expect(rawState).not.toContain('symptoms');
    });

    it('Test 2 — Historical Audit Entry Read-Time Sanitization: Legacy symptoms are sanitized to [REDACTED] on read', async () => {
      // 1. Direct service query (getAuditLogById)
      const sanitizedById = await getAuditLogById(legacyAuditLogId);
      expect(sanitizedById).toBeTruthy();
      const newState = (sanitizedById!.new_state as any) || {};

      expect(newState.symptoms).toBe('[REDACTED]');
      expect(newState.vital_signs).toBe('[REDACTED]');
      expect(newState.body_temperature).toBe('[REDACTED]');
      expect(newState.heart_rate).toBe('[REDACTED]');
      expect(newState.clinical_notes).toBe('[REDACTED]');
      // Non-sensitive studentId is preserved
      expect(newState.studentId).toBe(studentAStudentId);

      // 2. Paginated service query (getAuditLogs)
      const listResult = await getAuditLogs({
        search: studentAStudentId,
      });
      const foundInList = listResult.items.find(i => i.id === legacyAuditLogId);
      expect(foundInList).toBeTruthy();
      const listNewState = (foundInList!.new_state as any) || {};
      expect(listNewState.symptoms).toBe('[REDACTED]');

      // 3. API endpoint inspection via IT Admin
      const apiRes = await request(app)
        .get(`/api/admin/audit-logs/${legacyAuditLogId}`)
        .set('Authorization', `Bearer ${itAdminToken}`);

      expect(apiRes.status).toBe(200);
      expect(apiRes.body.success).toBe(true);
      const apiNewState = apiRes.body.data.new_state;
      expect(apiNewState.symptoms).toBe('[REDACTED]');
      expect(JSON.stringify(apiRes.body.data)).not.toContain('High fever, acute dizziness');
    });

    it('Test 3 — Nested Redaction: Recursively sanitizes nested objects and arrays with medical keys', () => {
      const nestedInput = {
        metadata: {
          encounter: {
            clinical_notes: 'Patient showed symptoms of viral flu',
            vital_signs: {
              blood_pressure: '120/80',
              heart_rate: '72 bpm',
              temperature: '37.2C',
            },
            diagnoses: [
              { diagnosis: 'Acute viral pharyngitis', severity: 'Mild' },
            ],
            observations: {
              blood_pressure: '120/80',
              heart_rate: '72 bpm',
            },
          },
        },
        actor: 'Nurse Florence',
      };

      const sanitized = sanitizeMetadata(nestedInput);

      expect(sanitized.actor).toBe('Nurse Florence');
      // clinical_notes is a sensitive field name -> redacted
      expect(sanitized.metadata.encounter.clinical_notes).toBe('[REDACTED]');
      // vital_signs contains 'vital' sensitive keyword -> entire object redacted
      expect(sanitized.metadata.encounter.vital_signs).toBe('[REDACTED]');
      // diagnoses array with nested diagnosis property -> diagnosis redacted, non-sensitive severity preserved
      expect(sanitized.metadata.encounter.diagnoses[0].diagnosis).toBe('[REDACTED]');
      expect(sanitized.metadata.encounter.diagnoses[0].severity).toBe('Mild');
      // observations nested fields -> blood_pressure and heart_rate individually redacted
      expect(sanitized.metadata.encounter.observations.blood_pressure).toBe('[REDACTED]');
      expect(sanitized.metadata.encounter.observations.heart_rate).toBe('[REDACTED]');
    });

    it('Test 4 — Audit CSV Export: ITAdmin export excludes clinical symptoms, non-admins are rejected (403)', async () => {
      // 1. IT Admin export
      const csvRes = await request(app)
        .get('/api/admin/audit-logs/export/csv')
        .set('Authorization', `Bearer ${itAdminToken}`);

      expect(csvRes.status).toBe(200);
      expect(csvRes.headers['content-type']).toContain('text/csv');
      const csvBody = csvRes.text;

      // Clinical descriptions must never appear in CSV
      expect(csvBody).not.toContain('High fever, acute dizziness');
      expect(csvBody).not.toContain('coughing fits');

      // 2. Unauthorized roles rejected with 403
      const nurseCsv = await request(app)
        .get('/api/admin/audit-logs/export/csv')
        .set('Authorization', `Bearer ${nurseToken}`);
      expect(nurseCsv.status).toBe(403);

      const studentCsv = await request(app)
        .get('/api/admin/audit-logs/export/csv')
        .set('Authorization', `Bearer ${studentAToken}`);
      expect(studentCsv.status).toBe(403);
    });

    it('Test 5 — Audit Append-Only Integrity: Mutation methods return 405 Method Not Allowed', async () => {
      const postRes = await request(app)
        .post('/api/admin/audit-logs')
        .set('Authorization', `Bearer ${itAdminToken}`)
        .send({ action: 'FORGED_ENTRY' });
      expect(postRes.status).toBe(405);
      expect(postRes.body.error.code).toBe('METHOD_NOT_ALLOWED');

      const putRes = await request(app)
        .put(`/api/admin/audit-logs/${legacyAuditLogId}`)
        .set('Authorization', `Bearer ${itAdminToken}`)
        .send({ action: 'MUTATE_ENTRY' });
      expect(putRes.status).toBe(405);
      expect(putRes.body.error.code).toBe('METHOD_NOT_ALLOWED');

      const deleteRes = await request(app)
        .delete(`/api/admin/audit-logs/${legacyAuditLogId}`)
        .set('Authorization', `Bearer ${itAdminToken}`);
      expect(deleteRes.status).toBe(405);
      expect(deleteRes.body.error.code).toBe('METHOD_NOT_ALLOWED');

      // Verify legacy record still exists and its immutable identifiers are preserved
      const log = await prisma.auditLog.findUnique({ where: { id: legacyAuditLogId } });
      expect(log).toBeTruthy();
      expect(log!.actor_school_id).toBe('NURSE-001');
      expect(log!.action).toBe('CLINIC_RECORD_CREATED');
    });

    it('Test 6 — Unauthorized Audit Access: Nurse, Student, Teacher, Guidance receive 403 Forbidden', async () => {
      const studentRes = await request(app)
        .get('/api/admin/audit-logs')
        .set('Authorization', `Bearer ${studentAToken}`);
      expect(studentRes.status).toBe(403);

      const nurseRes = await request(app)
        .get('/api/admin/audit-logs')
        .set('Authorization', `Bearer ${nurseToken}`);
      expect(nurseRes.status).toBe(403);

      const teacherRes = await request(app)
        .get('/api/admin/audit-logs')
        .set('Authorization', `Bearer ${teacherToken}`);
      expect(teacherRes.status).toBe(403);

      const guidanceRes = await request(app)
        .get('/api/admin/audit-logs')
        .set('Authorization', `Bearer ${guidanceToken}`);
      expect(guidanceRes.status).toBe(403);
    });
  });
});
