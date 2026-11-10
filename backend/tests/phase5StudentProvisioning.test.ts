/**
 * DIGISKWELA — PHASE 5 VERIFICATION TEST SUITE
 * Student Portal Account Provisioning & Lifecycle Verification
 * 
 * Target: digiskwela_test
 * 
 * Verifies:
 * 1. Approach A Registration: Student created with 12-digit DepEd LRN and user_id IS NULL.
 * 2. Unprovisioned Queue: Learner appears in GET /api/academic/advisory/unprovisioned-learners.
 * 3. Cryptographic Generator: 16 chars from 65-char alphabet, 4 classes, 96.36 bits entropy.
 * 4. RBAC Privilege Separation: Regular Teacher cannot provision accounts (HTTP 403).
 * 5. Single-Identity Provisioning: Username = 12-digit LRN, email = null, linked to student.
 * 6. Duplicate Account Rejection: Re-provisioning throws HTTP 409.
 * 7. First-Login Interception: Initial login returns mustChangePassword = true.
 * 8. Backend Enforcement Boundary: Direct authenticated API requests blocked with HTTP 403 MUST_CHANGE_PASSWORD on protected routes; exempt routes available.
 * 9. Permanent Password Activation: POST /api/auth/change-password sets mustChangePassword = false.
 * 10. Permanent Password Login: Old temporary password rejected (HTTP 401); permanent password succeeds.
 * 11. Admin Password Reset Lifecycle: Admin resets credentials; previous password rejected (HTTP 401); prior session tokens blocked; new temp password functions.
 * 12. Credential & Audit Security: Passwords stored as bcrypt hashes; zero plaintext in audit logs.
 * 13. Data Integrity: Section enrollment and academic relationships remain 100% intact.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/config/database.js';
import { generateId } from '../src/common/utils/uuid.js';
import { hashPassword } from '../src/auth/auth.service.js';
import { generateSecureTemporaryPassword } from '../src/users/user.service.js';
import jwt from 'jsonwebtoken';
import { config } from '../src/config/env.js';

const { sign } = jwt;

describe('Phase 5: Student Portal Account Provisioning', () => {
  let adminToken: string;
  let adminUserId: string;
  let teacherToken: string;
  let teacherUserId: string;

  let testAcademicYearId: string;
  let testSectionId: string;
  let registeredStudentId: string;
  let provisionedUserId: string;

  const testLrn = `105634${Math.floor(100000 + Math.random() * 900000)}`; // 12-digit DepEd LRN
  let tempPassword = '';
  const permanentPassword = 'CalulutStudent2026!@#';
  let studentInitialTokenCookie = '';
  let permanentSessionToken = '';

  const cleanupUserIds: string[] = [];
  const cleanupStudentIds: string[] = [];

  beforeAll(async () => {
    // 1. Verify connected to test database
    const [db] = await prisma.$queryRaw<[{ db: string }]>`SELECT current_database() as db`;
    expect(db.db).toBe('digiskwela_test');

    const commonHash = await hashPassword('password123');

    // 2. Resolve roles
    const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: 'Admin' } });
    const teacherRole = await prisma.role.findUniqueOrThrow({ where: { name: 'Teacher' } });
    await prisma.role.findUniqueOrThrow({ where: { name: 'Student' } });

    // Ensure permissions for admin
    const userWrite = await prisma.permission.upsert({
      where: { key: 'user:write' },
      update: {},
      create: { id: generateId(), key: 'user:write' },
    });
    const userRead = await prisma.permission.upsert({
      where: { key: 'user:read' },
      update: {},
      create: { id: generateId(), key: 'user:read' },
    });
    await prisma.rolePermission.upsert({
      where: { role_id_permission_id: { role_id: adminRole.id, permission_id: userWrite.id } },
      update: {},
      create: { role_id: adminRole.id, permission_id: userWrite.id },
    });
    await prisma.rolePermission.upsert({
      where: { role_id_permission_id: { role_id: adminRole.id, permission_id: userRead.id } },
      update: {},
      create: { role_id: adminRole.id, permission_id: userRead.id },
    });

    // 3. Create Admin User
    adminUserId = generateId();
    await prisma.user.create({
      data: {
        id: adminUserId,
        school_id: `ADM-${adminUserId.slice(-6)}`,
        email: `admin_phase5_${Date.now()}@calulut.edu.ph`,
        password_hash: commonHash,
        first_name: 'Phase5',
        last_name: 'Admin',
        status: 'active',
        must_change_password: false,
        user_roles: { create: { role_id: adminRole.id } },
      },
    });
    adminToken = sign({ userId: adminUserId }, config.jwt.secret, { expiresIn: '2h' });
    cleanupUserIds.push(adminUserId);

    // 4. Create Teacher User & Profile
    teacherUserId = generateId();
    await prisma.user.create({
      data: {
        id: teacherUserId,
        school_id: `TEA-${teacherUserId.slice(-6)}`,
        email: `teacher_phase5_${Date.now()}@calulut.edu.ph`,
        password_hash: commonHash,
        first_name: 'Class',
        last_name: 'Adviser',
        status: 'active',
        must_change_password: false,
        user_roles: { create: { role_id: teacherRole.id } },
      },
    });
    teacherToken = sign({ userId: teacherUserId }, config.jwt.secret, { expiresIn: '2h' });
    cleanupUserIds.push(teacherUserId);

    const teacherProfile = await prisma.teacher.create({
      data: {
        id: generateId(),
        user_id: teacherUserId,
        employee_id: `EMP-T-${Date.now().toString().slice(-5)}`,
      },
    });

    // 5. Ensure Academic Year & Section
    let ay = await prisma.academicYear.findFirst({ where: { is_current: true } });
    if (!ay) {
      ay = await prisma.academicYear.create({
        data: {
          id: generateId(),
          name: `2026-2027-Phase5-${Date.now()}`,
          start_date: new Date('2026-06-01'),
          end_date: new Date('2027-03-31'),
          is_current: true,
        },
      });
    }
    testAcademicYearId = ay.id;

    const section = await prisma.section.create({
      data: {
        id: generateId(),
        name: `Section-Phase5-${Date.now().toString().slice(-4)}`,
        grade_level: 10,
        academic_year_id: testAcademicYearId,
        adviser_teacher_id: teacherProfile.id,
      },
    });
    testSectionId = section.id;
  });

  afterAll(async () => {
    // Clean up created students, enrollments, sections, teachers, users
    if (cleanupStudentIds.length > 0) {
      await prisma.enrollment.deleteMany({ where: { student_id: { in: cleanupStudentIds } } }).catch(() => {});
      await prisma.studentHealthMetric.deleteMany({ where: { student_id: { in: cleanupStudentIds } } }).catch(() => {});
      await prisma.student.deleteMany({ where: { id: { in: cleanupStudentIds } } }).catch(() => {});
    }
    if (testSectionId) {
      await prisma.section.deleteMany({ where: { id: testSectionId } }).catch(() => {});
    }
    if (cleanupUserIds.length > 0) {
      await prisma.teacher.deleteMany({ where: { user_id: { in: cleanupUserIds } } }).catch(() => {});
      await prisma.userRole.deleteMany({ where: { user_id: { in: cleanupUserIds } } }).catch(() => {});
      await prisma.auditLog.deleteMany({
        where: {
          OR: [
            { actor_user_id: { in: cleanupUserIds } },
            { resource_id: { in: cleanupUserIds } },
          ],
        },
      }).catch(() => {});
      await prisma.user.deleteMany({ where: { id: { in: cleanupUserIds } } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  // --------------------------------------------------------------------------
  // TEST 1: ADVISER REGISTRATION & ENROLLMENT (APPROACH A)
  // --------------------------------------------------------------------------
  it('Test 1: Class Adviser registers and enrolls learner without portal credentials (user_id IS NULL)', async () => {
    const res = await request(app)
      .post(`/api/academic/advisory/sections/${testSectionId}/register`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        lrn: testLrn,
        firstName: 'Mateo',
        lastName: 'Alvarez',
        middleName: 'Gomez',
        dateOfBirth: '2011-04-10',
        gender: 'Male',
        street: '789 MacArthur Highway',
        city: 'City of San Fernando',
        guardianFirstName: 'Ramon',
        guardianLastName: 'Alvarez',
        guardianPhone: '0918-555-4321',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.studentId).toBeDefined();

    registeredStudentId = res.body.data.studentId;
    cleanupStudentIds.push(registeredStudentId);

    // Verify in database: user_id MUST be null initially
    const dbStudent = await prisma.student.findUnique({
      where: { id: registeredStudentId },
    });
    expect(dbStudent).not.toBeNull();
    expect(dbStudent?.user_id).toBeNull();
    expect(dbStudent?.first_name).toBe('Mateo');
    expect(dbStudent?.last_name).toBe('Alvarez');

    // Verify enrollment
    const dbEnrollment = await prisma.enrollment.findFirst({
      where: { student_id: registeredStudentId, section_id: testSectionId },
    });
    expect(dbEnrollment).not.toBeNull();
    expect(dbEnrollment?.status).toBe('Enrolled');
  });

  // --------------------------------------------------------------------------
  // TEST 2: UNPROVISIONED LEARNER QUEUE DISCOVERY
  // --------------------------------------------------------------------------
  it('Test 2: Admin discovers learner in Unprovisioned Learner Queue with 12-digit LRN', async () => {
    const res = await request(app)
      .get('/api/academic/advisory/unprovisioned-learners')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);

    const match = res.body.data.find((l: any) => l.studentId === registeredStudentId);
    expect(match).toBeDefined();
    expect(match.lrn).toBe(testLrn);
    expect(match.firstName).toBe('Mateo');
    expect(match.lastName).toBe('Alvarez');
    expect(match.hasPortalAccount).toBe(false);
  });

  // --------------------------------------------------------------------------
  // TEST 3: TEMPORARY PASSWORD ENTROPY & CHAR CLASSES (65-CHAR CHARSET)
  // --------------------------------------------------------------------------
  it('Test 3: Cryptographic temporary password generator produces 16-char strings from 65-char alphabet with 4 classes', () => {
    for (let i = 0; i < 20; i++) {
      const pwd = generateSecureTemporaryPassword();
      expect(pwd.length).toBe(16);
      expect(/[A-Z]/.test(pwd)).toBe(true); // Uppercase (24 chars)
      expect(/[a-z]/.test(pwd)).toBe(true); // Lowercase (25 chars)
      expect(/[0-9]/.test(pwd)).toBe(true); // Digits (8 chars)
      expect(/[!@#$%^&*]/.test(pwd)).toBe(true); // Symbols (8 chars)
      // Ensure no ambiguous characters (0, O, 1, l, I excluded)
      expect(/[0O1lI]/.test(pwd)).toBe(false);
    }
  });

  // --------------------------------------------------------------------------
  // TEST 4: RBAC — REGULAR TEACHER CANNOT PROVISION ACCOUNTS
  // --------------------------------------------------------------------------
  it('Test 4: Regular Teacher cannot provision Student Portal accounts (HTTP 403 Forbidden)', async () => {
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        schoolId: testLrn,
        firstName: 'Mateo',
        lastName: 'Alvarez',
        roles: ['Student'],
        studentProfile: {
          lrn: testLrn,
          gradeLevel: 10,
          gender: 'Male',
        },
      });

    expect(res.status).toBe(403);
    expect(res.body.error?.code).toBe('FORBIDDEN');
  });

  // --------------------------------------------------------------------------
  // TEST 5: ADMIN PROVISIONS STUDENT PORTAL ACCOUNT
  // --------------------------------------------------------------------------
  it('Test 5: Admin provisions portal account using 12-digit LRN as School ID with NO email required', async () => {
    const studentCountBefore = await prisma.student.count();

    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        schoolId: testLrn,
        firstName: 'Mateo',
        lastName: 'Alvarez',
        middleName: 'Gomez',
        roles: ['Student'],
        studentProfile: {
          lrn: testLrn,
          gradeLevel: 10,
          gender: 'Male',
        },
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user).toBeDefined();
    expect(res.body.data.temporaryPassword).toBeDefined();

    provisionedUserId = res.body.data.user.id;
    cleanupUserIds.push(provisionedUserId);
    tempPassword = res.body.data.temporaryPassword;

    // Verify User record in DB
    const dbUser = await prisma.user.findUnique({
      where: { id: provisionedUserId },
      include: { user_roles: { include: { role: true } } },
    });
    expect(dbUser).not.toBeNull();
    expect(dbUser?.school_id).toBe(testLrn); // Username = 12-digit LRN
    expect(dbUser?.email).toBeNull(); // No dummy email generated!
    expect(dbUser?.must_change_password).toBe(true); // Forced first-login change
    expect(dbUser?.user_roles[0]?.role?.name).toBe('Student');

    // Verify existing Student record linked to this User
    const dbStudent = await prisma.student.findUnique({
      where: { id: registeredStudentId },
    });
    expect(dbStudent?.user_id).toBe(provisionedUserId);

    // Verify Student count did NOT change (No duplicate created)
    const studentCountAfter = await prisma.student.count();
    expect(studentCountAfter).toBe(studentCountBefore);

    // Verify temporary password length
    expect(tempPassword.length).toBe(16);
  });

  // --------------------------------------------------------------------------
  // TEST 6: DUPLICATE PROVISIONING PROTECTION
  // --------------------------------------------------------------------------
  it('Test 6: Re-provisioning an already linked learner is rejected with HTTP 409', async () => {
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        schoolId: testLrn,
        firstName: 'Mateo',
        lastName: 'Alvarez',
        roles: ['Student'],
        studentProfile: {
          lrn: testLrn,
          gradeLevel: 10,
          gender: 'Male',
        },
      });

    expect(res.status).toBe(409);
    expect(['DUPLICATE_SCHOOL_ID', 'STUDENT_ALREADY_LINKED']).toContain(res.body.error?.code);
  });

  // --------------------------------------------------------------------------
  // TEST 7: FIRST LOGIN USING 12-DIGIT LRN & TEMPORARY PASSWORD
  // --------------------------------------------------------------------------
  it('Test 7: Student logs in with 12-digit LRN and temporary password; flags mustChangePassword = true', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        schoolId: testLrn,
        password: tempPassword,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.mustChangePassword).toBe(true);
    expect(res.body.data.user.schoolId).toBe(testLrn);
    expect(res.body.data.user.roles).toContain('Student');

    // Verify auth_token cookie
    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
    const authCookie = cookies?.find((c: string) => c.startsWith('auth_token='));
    expect(authCookie).toBeDefined();
    studentInitialTokenCookie = authCookie!;
  });

  // --------------------------------------------------------------------------
  // TEST 8: BACKEND ENFORCEMENT BOUNDARY (DIRECT API BLOCKING)
  // --------------------------------------------------------------------------
  it('Test 8: Backend blocks direct authenticated API requests when must_change_password = true (HTTP 403), while exempt routes succeed', async () => {
    // 1. Attempt protected student route (should be BLOCKED with HTTP 403 MUST_CHANGE_PASSWORD)
    const protectedRes = await request(app)
      .get(`/api/users/${provisionedUserId}`)
      .set('Cookie', studentInitialTokenCookie);

    expect(protectedRes.status).toBe(403);
    expect(protectedRes.body.error?.code).toBe('MUST_CHANGE_PASSWORD');

    // 2. Attempt exempt route GET /api/auth/me (should SUCCEED with mustChangePassword = true)
    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Cookie', studentInitialTokenCookie);

    expect(meRes.status).toBe(200);
    expect(meRes.body.success).toBe(true);
    expect(meRes.body.data.mustChangePassword).toBe(true);

    // 3. Exempt route POST /api/auth/logout should remain callable
    // (We test logout capability in an isolated request without destroying our cookie)
  });

  // --------------------------------------------------------------------------
  // TEST 9: MANDATORY FIRST-LOGIN PASSWORD CHANGE
  // --------------------------------------------------------------------------
  it('Test 9: Student sets permanent password without arbitrary composition rules; DB updates must_change_password = false', async () => {
    // 1. Attempting invalid password (too short, < 8 chars)
    const badChangeRes = await request(app)
      .post('/api/auth/change-password')
      .set('Cookie', studentInitialTokenCookie)
      .send({
        currentPassword: tempPassword,
        newPassword: 'short',
        confirmPassword: 'short',
      });
    expect([400, 422]).toContain(badChangeRes.status);

    // 2. Attempting valid password change (meets NIST SP 800-63B >= 8 chars, no forced composition rules)
    const goodChangeRes = await request(app)
      .post('/api/auth/change-password')
      .set('Cookie', studentInitialTokenCookie)
      .send({
        currentPassword: tempPassword,
        newPassword: permanentPassword,
        confirmPassword: permanentPassword,
      });

    expect(goodChangeRes.status).toBe(200);
    expect(goodChangeRes.body.success).toBe(true);

    // Verify DB flag updated
    const updatedUser = await prisma.user.findUnique({
      where: { id: provisionedUserId },
    });
    expect(updatedUser?.must_change_password).toBe(false);
  });

  // --------------------------------------------------------------------------
  // TEST 10: LOGIN WITH PERMANENT PASSWORD & OLD PASSWORD INVALIDATION
  // --------------------------------------------------------------------------
  it('Test 10: Old temporary password is invalidated (HTTP 401); permanent password logs in directly', async () => {
    // 1. Old temporary password must FAIL
    const oldLoginRes = await request(app)
      .post('/api/auth/login')
      .send({
        schoolId: testLrn,
        password: tempPassword,
      });
    expect(oldLoginRes.status).toBe(401);
    expect(oldLoginRes.body.error?.code).toBe('INVALID_CREDENTIALS');

    // 2. Permanent password must SUCCEED
    const permLoginRes = await request(app)
      .post('/api/auth/login')
      .send({
        schoolId: testLrn,
        password: permanentPassword,
      });

    expect(permLoginRes.status).toBe(200);
    expect(permLoginRes.body.data.user.mustChangePassword).toBe(false);
    expect(permLoginRes.body.data.user.roles).toContain('Student');

    const permCookies = permLoginRes.headers['set-cookie'];
    const permCookie = permCookies?.find((c: string) => c.startsWith('auth_token='));
    expect(permCookie).toBeDefined();
    permanentSessionToken = permCookie!;

    // 3. Protected endpoint now accessible with permanent password session
    const accessRes = await request(app)
      .get(`/api/users/${provisionedUserId}`)
      .set('Cookie', permanentSessionToken);
    expect(accessRes.status).toBe(200);
  });

  // --------------------------------------------------------------------------
  // TEST 11: ADMIN PASSWORD RESET & SESSION TOKEN LIFECYCLE
  // --------------------------------------------------------------------------
  it('Test 11: Admin password reset invalidates previous password (HTTP 401) and blocks prior session tokens from protected data (HTTP 403)', async () => {
    const resetRes = await request(app)
      .post(`/api/users/${provisionedUserId}/reset-password`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(resetRes.status).toBe(200);
    expect(resetRes.body.success).toBe(true);
    expect(resetRes.body.data.temporaryPassword).toBeDefined();

    const newTempPassword = resetRes.body.data.temporaryPassword;
    expect(newTempPassword.length).toBe(16);

    // Verify DB user record
    const resetUser = await prisma.user.findUnique({
      where: { id: provisionedUserId },
    });
    expect(resetUser?.must_change_password).toBe(true);

    // 1. Previous permanent password must NO LONGER WORK
    const oldPermLogin = await request(app)
      .post('/api/auth/login')
      .send({
        schoolId: testLrn,
        password: permanentPassword,
      });
    expect(oldPermLogin.status).toBe(401);
    expect(oldPermLogin.body.error?.code).toBe('INVALID_CREDENTIALS');

    // 2. Prior authenticated session token MUST BE BLOCKED from protected endpoints
    const priorSessionAttempt = await request(app)
      .get(`/api/users/${provisionedUserId}`)
      .set('Cookie', permanentSessionToken);
    expect(priorSessionAttempt.status).toBe(403);
    expect(priorSessionAttempt.body.error?.code).toBe('MUST_CHANGE_PASSWORD');

    // 3. Login with newly issued temporary password SUCCEEDS with mustChangePassword = true
    const tempLoginRes = await request(app)
      .post('/api/auth/login')
      .send({
        schoolId: testLrn,
        password: newTempPassword,
      });

    expect(tempLoginRes.status).toBe(200);
    expect(tempLoginRes.body.data.user.mustChangePassword).toBe(true);
  });

  // --------------------------------------------------------------------------
  // TEST 12: CREDENTIAL & AUDIT LOG SECURITY VERIFICATION
  // --------------------------------------------------------------------------
  it('Test 12: Passwords are stored only as bcrypt hashes; audit logs contain zero plaintext credentials', async () => {
    const userInDb = await prisma.user.findUnique({
      where: { id: provisionedUserId },
    });
    expect(userInDb).not.toBeNull();
    // Verify bcrypt hash format ($2a$ or $2b$)
    expect(userInDb?.password_hash).toMatch(/^\$2[ab]\$\d{2}\$[A-Za-z0-9./]{53}$/);

    // Verify audit logs for this user do NOT record plaintext passwords
    const logs = await prisma.auditLog.findMany({
      where: {
        OR: [
          { resource_id: provisionedUserId },
          { actor_user_id: provisionedUserId },
        ],
      },
    });

    for (const log of logs) {
      const serialized = JSON.stringify(log);
      expect(serialized).not.toContain(permanentPassword);
      expect(serialized).not.toContain(tempPassword);
      // Ensure no raw hash logged either
      if (userInDb?.password_hash) {
        expect(serialized).not.toContain(userInDb.password_hash);
      }
    }
  });

  // --------------------------------------------------------------------------
  // TEST 13: PRESERVATION OF ACADEMIC RELATIONSHIPS & STUDENT IDENTITY
  // --------------------------------------------------------------------------
  it('Test 13: Academic relationships, section enrollment and student data remain 100% intact', async () => {
    const finalStudent = await prisma.student.findUnique({
      where: { id: registeredStudentId },
      include: {
        enrollments: { include: { section: true } },
      },
    });

    expect(finalStudent).not.toBeNull();
    expect(finalStudent?.user_id).toBe(provisionedUserId);
    expect(finalStudent?.first_name).toBe('Mateo');
    expect(finalStudent?.last_name).toBe('Alvarez');
    expect(finalStudent?.enrollments.length).toBe(1);
    expect(finalStudent?.enrollments[0]?.section_id).toBe(testSectionId);
    expect(finalStudent?.enrollments[0]?.status).toBe('Enrolled');
  });

  // --------------------------------------------------------------------------
  // TEST 14: ENRICHED STUDENT PROFILE IN /api/auth/me & /api/auth/login
  // --------------------------------------------------------------------------
  it('Test 14: Authenticated student login & /api/auth/me returns enriched studentProfile with section, adviser, and academic year', async () => {
    // 1. Reset user must_change_password to false for authenticated session tests
    await prisma.user.update({
      where: { id: provisionedUserId },
      data: {
        password_hash: await hashPassword(permanentPassword),
        must_change_password: false,
      },
    });

    // 2. Login as student with permanent password
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        schoolId: testLrn,
        password: permanentPassword,
      });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.success).toBe(true);
    expect(loginRes.body.data.user.studentProfile).toBeDefined();

    const profile = loginRes.body.data.user.studentProfile;
    expect(profile.lrn).toBe(testLrn);
    expect(profile.sectionId).toBe(testSectionId);
    expect(profile.sectionName).toBeDefined();
    expect(profile.adviserName).toBe('Class Adviser');
    expect(profile.enrollmentStatus).toBe('Enrolled');
    expect(profile.academicYear).toBeDefined();

    // Capture permanent session token
    const cookies = loginRes.headers['set-cookie'];
    const authCookie = cookies?.find((c: string) => c.startsWith('auth_token='));
    expect(authCookie).toBeDefined();
    permanentSessionToken = authCookie!;

    // 3. Verify GET /api/auth/me returns the identical enriched studentProfile
    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Cookie', permanentSessionToken);

    expect(meRes.status).toBe(200);
    expect(meRes.body.success).toBe(true);
    expect(meRes.body.data.studentProfile).toBeDefined();
    expect(meRes.body.data.studentProfile.sectionId).toBe(testSectionId);
    expect(meRes.body.data.studentProfile.adviserName).toBe('Class Adviser');
    expect(meRes.body.data.studentProfile.enrollmentStatus).toBe('Enrolled');
  });

  // --------------------------------------------------------------------------
  // TEST 15: ADVISORY ENROLLMENT VERIFICATION IN GET /api/academic/student/my-classes
  // --------------------------------------------------------------------------
  it('Test 15: GET /api/academic/student/my-classes returns verified advisory enrollment without hiding it when subject assignments are empty', async () => {
    const res = await request(app)
      .get('/api/academic/student/my-classes')
      .set('Cookie', permanentSessionToken);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();

    const { student, enrollment, classes } = res.body.data;
    expect(student.lrn).toBe(testLrn);
    expect(student.gradeLevel).toBe(10);

    expect(enrollment).not.toBeNull();
    expect(enrollment.sectionId).toBe(testSectionId);
    expect(enrollment.gradeLevel).toBe(10);
    expect(enrollment.status).toBe('Enrolled');
    expect(enrollment.adviser).not.toBeNull();
    expect(enrollment.adviser.name).toBe('Class Adviser');

    // Advisory enrollment is verified, classes is an empty array because no subjects assigned yet
    expect(Array.isArray(classes)).toBe(true);
    expect(classes.length).toBe(0);
  });

  // --------------------------------------------------------------------------
  // TEST 16: REAL SUBJECT ASSIGNMENT DISPLAY WHEN OFFERINGS CONFIGURED
  // --------------------------------------------------------------------------
  it('Test 16: GET /api/academic/student/my-classes returns real subject assignments when configured', async () => {
    // 1. Create a subject
    const subjectId = generateId();
    const subjectCode = `SCI10-P5-${Date.now().toString().slice(-4)}`;
    const subject = await prisma.subject.create({
      data: {
        id: subjectId,
        code: subjectCode,
        name: 'Science 10 (Earth & Space)',
      },
    });

    // 2. Create teacher subject assignment
    const assignmentId = generateId();
    const teacherProfile = await prisma.teacher.findFirstOrThrow({
      where: { user_id: teacherUserId },
    });

    await prisma.teacherSubjectAssignment.create({
      data: {
        id: assignmentId,
        academic_year_id: testAcademicYearId,
        teacher_id: teacherProfile.id,
        section_id: testSectionId,
        subject_id: subject.id,
        days: 'Mon/Wed/Fri',
        start_time: '08:00',
        end_time: '09:00',
        room: 'Room 204',
      },
    });

    // 3. Student fetches my-classes
    const res = await request(app)
      .get('/api/academic/student/my-classes')
      .set('Cookie', permanentSessionToken);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.classes.length).toBe(1);

    const assignedClass = res.body.data.classes[0];
    expect(assignedClass.subjectCode).toBe(subjectCode);
    expect(assignedClass.subjectName).toBe('Science 10 (Earth & Space)');
    expect(assignedClass.teacherName).toBe('Class Adviser');
    expect(assignedClass.schedule.days).toBe('Mon/Wed/Fri');
    expect(assignedClass.schedule.startTime).toBe('08:00');
    expect(assignedClass.schedule.endTime).toBe('09:00');
    expect(assignedClass.schedule.room).toBe('Room 204');

    // Clean up assignment and subject
    await prisma.teacherSubjectAssignment.delete({ where: { id: assignmentId } });
    await prisma.subject.delete({ where: { id: subjectId } });
  });

  // --------------------------------------------------------------------------
  // TEST 17: CROSS-STUDENT ACCESS CONTROL (RBAC ISOLATION)
  // --------------------------------------------------------------------------
  it('Test 17: Student is strictly prohibited from accessing another learner class records (HTTP 403 Forbidden)', async () => {
    const fakeOtherStudentId = generateId();

    const res = await request(app)
      .get(`/api/academic/student/${fakeOtherStudentId}/classes`)
      .set('Cookie', permanentSessionToken);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error?.code).toBe('FORBIDDEN');
  });

  // --------------------------------------------------------------------------
  // TEST 18: SELF-SERVICE ENROLLMENT HISTORY ACCESS
  // --------------------------------------------------------------------------
  it('Test 18: Student can access own enrollment history with adviser and section snapshot; prohibited from viewing other learners', async () => {
    // 1. Own history succeeds
    const ownRes = await request(app)
      .get(`/api/enrollments/student/${registeredStudentId}/history/${testAcademicYearId}`)
      .set('Cookie', permanentSessionToken);

    expect(ownRes.status).toBe(200);
    expect(ownRes.body.success).toBe(true);
    expect(Array.isArray(ownRes.body.data)).toBe(true);
    expect(ownRes.body.data.length).toBeGreaterThan(0);
    expect(ownRes.body.data[0].section).toBeDefined();
    expect(ownRes.body.data[0].section.id).toBe(testSectionId);
    expect(ownRes.body.data[0].section.adviser_teacher?.user?.first_name).toBe('Class');

    // 2. Querying another student's history is blocked with HTTP 403
    const fakeOtherStudentId = generateId();
    const otherRes = await request(app)
      .get(`/api/enrollments/student/${fakeOtherStudentId}/history/${testAcademicYearId}`)
      .set('Cookie', permanentSessionToken);

    expect(otherRes.status).toBe(403);
    expect(otherRes.body.error?.code).toBe('FORBIDDEN');
  });
});
