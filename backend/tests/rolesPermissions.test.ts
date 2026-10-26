import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { getRolesPermissionsMatrix, SYSTEM_ROLES, MODULE_GROUPS } from '../src/security/rolesPermissions.service.js';

describe('DIGISKWELA — Roles & Permissions Matrix Test Suite', () => {
  let itAdminCookie: string;
  let adminCookie: string;
  let teacherCookie: string;
  let studentCookie: string;
  let principalCookie: string;
  let registrarCookie: string;
  let guidanceCookie: string;
  let nurseCookie: string;
  let gateOperatorCookie: string;

  beforeAll(async () => {
    // 1. ITAdmin
    const itRes = await request(app).post('/api/auth/login').send({ schoolId: 'IT-001', password: 'password123' });
    expect(itRes.status).toBe(200);
    itAdminCookie = (itRes.headers['set-cookie'] as string[]).find(c => c.startsWith('auth_token='))!;

    // 2. Admin
    const adminRes = await request(app).post('/api/auth/login').send({ schoolId: 'ADM-001', password: 'password123' });
    expect(adminRes.status).toBe(200);
    adminCookie = (adminRes.headers['set-cookie'] as string[]).find(c => c.startsWith('auth_token='))!;

    // 3. Teacher
    const teacherRes = await request(app).post('/api/auth/login').send({ schoolId: 'EMP-T-001', password: 'password123' });
    expect(teacherRes.status).toBe(200);
    teacherCookie = (teacherRes.headers['set-cookie'] as string[]).find(c => c.startsWith('auth_token='))!;

    // 4. Student
    const studentRes = await request(app).post('/api/auth/login').send({ schoolId: '2026-00001', password: 'password123' });
    expect(studentRes.status).toBe(200);
    studentCookie = (studentRes.headers['set-cookie'] as string[]).find(c => c.startsWith('auth_token='))!;

    // 5. Principal
    const principalRes = await request(app).post('/api/auth/login').send({ schoolId: 'EMP-P-001', password: 'password123' });
    expect(principalRes.status).toBe(200);
    principalCookie = (principalRes.headers['set-cookie'] as string[]).find(c => c.startsWith('auth_token='))!;

    // 6. Registrar
    const regRes = await request(app).post('/api/auth/login').send({ schoolId: 'EMP-R-001', password: 'password123' });
    expect(regRes.status).toBe(200);
    registrarCookie = (regRes.headers['set-cookie'] as string[]).find(c => c.startsWith('auth_token='))!;

    // 7. Guidance
    const guidRes = await request(app).post('/api/auth/login').send({ schoolId: 'EMP-G-001', password: 'password123' });
    expect(guidRes.status).toBe(200);
    guidanceCookie = (guidRes.headers['set-cookie'] as string[]).find(c => c.startsWith('auth_token='))!;

    // 8. Nurse
    const nurseRes = await request(app).post('/api/auth/login').send({ schoolId: 'EMP-N-001', password: 'password123' });
    expect(nurseRes.status).toBe(200);
    nurseCookie = (nurseRes.headers['set-cookie'] as string[]).find(c => c.startsWith('auth_token='))!;

    // 9. GateOperator
    const gateRes = await request(app).post('/api/auth/login').send({ schoolId: 'GATE-001', password: 'password123' });
    expect(gateRes.status).toBe(200);
    gateOperatorCookie = (gateRes.headers['set-cookie'] as string[]).find(c => c.startsWith('auth_token='))!;
  });

  // ─── 1. ACCESS CONTROL & RBAC POLICY ──────────────────────────────────────────
  describe('1. Access Control & RBAC Policy', () => {
    it('allows ITAdmin full visibility of the Roles & Permissions Matrix', async () => {
      const res = await request(app)
        .get('/api/admin/roles-permissions')
        .set('Cookie', [itAdminCookie]);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.meta.viewerRole).toBe('ITAdmin');
      expect(res.body.data.roles).toHaveLength(9);
      expect(res.body.data.modules.length).toBeGreaterThanOrEqual(10);
    });

    it('allows Standard Admin visibility with Admin viewerRole', async () => {
      const res = await request(app)
        .get('/api/admin/roles-permissions')
        .set('Cookie', [adminCookie]);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.meta.viewerRole).toBe('Admin');
      expect(res.body.data.roles).toHaveLength(9);
    });

    it('blocks Teacher with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/admin/roles-permissions')
        .set('Cookie', [teacherCookie]);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('blocks Student with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/admin/roles-permissions')
        .set('Cookie', [studentCookie]);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('blocks Principal with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/admin/roles-permissions')
        .set('Cookie', [principalCookie]);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('blocks Registrar with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/admin/roles-permissions')
        .set('Cookie', [registrarCookie]);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('blocks Guidance with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/admin/roles-permissions')
        .set('Cookie', [guidanceCookie]);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('blocks Nurse with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/admin/roles-permissions')
        .set('Cookie', [nurseCookie]);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('blocks GateOperator with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/admin/roles-permissions')
        .set('Cookie', [gateOperatorCookie]);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('blocks unauthenticated requests with 401 Unauthorized', async () => {
      const res = await request(app).get('/api/admin/roles-permissions');

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  // ─── 2. VERIFIED SYSTEM ROLE INVENTORY ────────────────────────────────────────
  describe('2. Verified System Role Inventory', () => {
    it('returns all 9 canonical Calulut INHS system roles', async () => {
      const res = await request(app)
        .get('/api/admin/roles-permissions')
        .set('Cookie', [itAdminCookie]);

      const expectedRoles = [
        'ITAdmin',
        'Admin',
        'Principal',
        'Registrar',
        'Teacher',
        'Student',
        'Guidance',
        'Nurse',
        'GateOperator',
      ];

      const roles = res.body.data.roles;
      expect(roles).toHaveLength(9);
      expect(roles.map((r: any) => r.id)).toEqual(expectedRoles);

      for (const role of roles) {
        expect(role.id).toBeDefined();
        expect(role.name).toBeDefined();
        expect(role.description).toBeDefined();
        expect(typeof role.isAdministrative).toBe('boolean');
      }
    });

    it('correctly marks administrative roles', () => {
      const itAdmin = SYSTEM_ROLES.find(r => r.id === 'ITAdmin')!;
      const admin = SYSTEM_ROLES.find(r => r.id === 'Admin')!;
      const principal = SYSTEM_ROLES.find(r => r.id === 'Principal')!;
      const teacher = SYSTEM_ROLES.find(r => r.id === 'Teacher')!;
      const student = SYSTEM_ROLES.find(r => r.id === 'Student')!;

      expect(itAdmin.isAdministrative).toBe(true);
      expect(admin.isAdministrative).toBe(true);
      expect(principal.isAdministrative).toBe(true);
      expect(teacher.isAdministrative).toBe(false);
      expect(student.isAdministrative).toBe(false);
    });
  });

  // ─── 3. VERIFIED MODULES & CAPABILITIES ───────────────────────────────────────
  describe('3. Verified Modules & Capabilities', () => {
    it('returns comprehensive module groupings covering DigiSkwela operations', async () => {
      const res = await request(app)
        .get('/api/admin/roles-permissions')
        .set('Cookie', [itAdminCookie]);

      const modules = res.body.data.modules;
      expect(modules.length).toBeGreaterThanOrEqual(10);

      const moduleIds = modules.map((m: any) => m.id);
      expect(moduleIds).toContain('system-administration');
      expect(moduleIds).toContain('user-management');
      expect(moduleIds).toContain('academic-management');
      expect(moduleIds).toContain('enrollment-management');
      expect(moduleIds).toContain('gradebook');
      expect(moduleIds).toContain('attendance-gate');
      expect(moduleIds).toContain('student-services');
      expect(moduleIds).toContain('document-lifecycle');
      expect(moduleIds).toContain('administrative-operations');
      expect(moduleIds).toContain('ai-and-analytics');
    });

    it('ensures every capability contains valid actions and role access entries for all 9 roles', () => {
      const validActions = ['READ', 'CREATE', 'UPDATE', 'DELETE', 'APPROVE', 'EXPORT', 'MANAGE', 'SPECIAL'];
      const validAccess = ['ALLOWED', 'DENIED', 'CONDITIONAL'];

      for (const moduleGroup of MODULE_GROUPS) {
        expect(moduleGroup.capabilities.length).toBeGreaterThan(0);
        for (const cap of moduleGroup.capabilities) {
          expect(validActions).toContain(cap.action);
          expect(cap.id).toBeDefined();
          expect(cap.name).toBeDefined();
          expect(cap.description).toBeDefined();

          // Every capability must define access for all 9 roles
          for (const role of SYSTEM_ROLES) {
            const entry = cap.roleAccess[role.id];
            expect(entry).toBeDefined();
            expect(validAccess).toContain(entry.access);
            if (entry.access === 'CONDITIONAL') {
              expect(entry.condition).toBeDefined();
              expect(entry.condition!.length).toBeGreaterThan(0);
            }
          }
        }
      }
    });
  });

  // ─── 4. DETERMINISTIC ENFORCEMENT & CONTEXTUAL DISTINCTION ───────────────────
  describe('4. Deterministic Enforcement & Contextual Accuracy', () => {
    it('accurately represents Admin vs ITAdmin operational disparities', async () => {
      const res = await request(app)
        .get('/api/admin/roles-permissions')
        .set('Cookie', [itAdminCookie]);

      const allCaps = res.body.data.modules.flatMap((m: any) => m.capabilities);

      // 1. School Customization Write: ITAdmin allowed, Admin denied
      const customWrite = allCaps.find((c: any) => c.id === 'sys:school-customization-write');
      expect(customWrite.roleAccess.ITAdmin.access).toBe('ALLOWED');
      expect(customWrite.roleAccess.Admin.access).toBe('DENIED');

      // 2. Inventory Void: ITAdmin allowed, Admin denied
      const invVoid = allCaps.find((c: any) => c.id === 'ops:inventory-void');
      expect(invVoid.roleAccess.ITAdmin.access).toBe('ALLOWED');
      expect(invVoid.roleAccess.Admin.access).toBe('DENIED');

      // 3. Security Audit Logs: ITAdmin allowed, Admin denied
      const secLogs = allCaps.find((c: any) => c.id === 'sys:audit-logs-security');
      expect(secLogs.roleAccess.ITAdmin.access).toBe('ALLOWED');
      expect(secLogs.roleAccess.Admin.access).toBe('DENIED');
    });

    it('accurately flags contextual and ownership-scoped access', async () => {
      const res = await request(app)
        .get('/api/admin/roles-permissions')
        .set('Cookie', [itAdminCookie]);

      const allCaps = res.body.data.modules.flatMap((m: any) => m.capabilities);

      // Teacher Gradebook Write is Conditional (assigned section & subject only)
      const gradeWrite = allCaps.find((c: any) => c.id === 'grade:write');
      expect(gradeWrite.roleAccess.Teacher.access).toBe('CONDITIONAL');
      expect(gradeWrite.roleAccess.Teacher.condition).toContain('assigned');

      // Student Enrollment History is Conditional (own records only)
      const enrollHistory = allCaps.find((c: any) => c.id === 'enroll:history-read');
      expect(enrollHistory.roleAccess.Student.access).toBe('CONDITIONAL');
      expect(enrollHistory.roleAccess.Student.condition).toContain('own');

      // GateOperator has gate scan capability but is denied gradebook and clinic
      const gateScan = allCaps.find((c: any) => c.id === 'att:gate-scan');
      expect(gateScan.roleAccess.GateOperator.access).toBe('ALLOWED');
      expect(gradeWrite.roleAccess.GateOperator.access).toBe('DENIED');
    });
  });

  // ─── 5. READ-ONLY ENFORCEMENT (405 METHOD NOT ALLOWED) ────────────────────────
  describe('5. Read-Only Enforcement', () => {
    it('rejects POST with 405 Method Not Allowed', async () => {
      const res = await request(app)
        .post('/api/admin/roles-permissions')
        .set('Cookie', [itAdminCookie])
        .send({ role: 'SuperUser', permissions: ['*'] });

      expect(res.status).toBe(405);
      expect(res.body.error.code).toBe('METHOD_NOT_ALLOWED');
    });

    it('rejects PUT with 405 Method Not Allowed', async () => {
      const res = await request(app)
        .put('/api/admin/roles-permissions')
        .set('Cookie', [itAdminCookie])
        .send({});

      expect(res.status).toBe(405);
      expect(res.body.error.code).toBe('METHOD_NOT_ALLOWED');
    });

    it('rejects PATCH with 405 Method Not Allowed', async () => {
      const res = await request(app)
        .patch('/api/admin/roles-permissions')
        .set('Cookie', [itAdminCookie])
        .send({});

      expect(res.status).toBe(405);
      expect(res.body.error.code).toBe('METHOD_NOT_ALLOWED');
    });

    it('rejects DELETE with 405 Method Not Allowed', async () => {
      const res = await request(app)
        .delete('/api/admin/roles-permissions')
        .set('Cookie', [itAdminCookie]);

      expect(res.status).toBe(405);
      expect(res.body.error.code).toBe('METHOD_NOT_ALLOWED');
    });
  });

  // ─── 6. SENSITIVE INFORMATION EXCLUSION ───────────────────────────────────────
  describe('6. Sensitive Information Exclusion & Privacy', () => {
    it('does not expose secrets, credentials, password hashes, or student PII', async () => {
      const res = await request(app)
        .get('/api/admin/roles-permissions')
        .set('Cookie', [itAdminCookie]);

      const jsonStr = JSON.stringify(res.body).toLowerCase();
      expect(jsonStr).not.toContain('password_hash');
      expect(jsonStr).not.toContain('passwordhash');
      expect(jsonStr).not.toContain('auth_token');
      expect(jsonStr).not.toContain('jwt_secret');
      expect(jsonStr).not.toContain('database_url');
      expect(jsonStr).not.toContain('refreshtoken');
      expect(jsonStr).not.toContain('guardian_phone');
      expect(jsonStr).not.toContain('student_number');
    });
  });

  // ─── 7. DIRECT SERVICE UNIT VERIFICATION ──────────────────────────────────────
  describe('7. Direct Service Unit Verification', () => {
    it('returns consistent metadata totals from direct service execution', () => {
      const itAdminMatrix = getRolesPermissionsMatrix(true);
      const adminMatrix = getRolesPermissionsMatrix(false);

      expect(itAdminMatrix.meta.viewerRole).toBe('ITAdmin');
      expect(adminMatrix.meta.viewerRole).toBe('Admin');
      expect(itAdminMatrix.meta.totalRoles).toBe(9);
      expect(itAdminMatrix.meta.totalModules).toBe(MODULE_GROUPS.length);
      expect(itAdminMatrix.meta.totalCapabilities).toBeGreaterThan(30);
      expect(itAdminMatrix.roles).toHaveLength(9);
      expect(itAdminMatrix.modules).toHaveLength(MODULE_GROUPS.length);
    });
  });
});
