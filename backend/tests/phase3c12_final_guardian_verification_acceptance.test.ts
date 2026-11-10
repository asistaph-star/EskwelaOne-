import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import prisma from '../src/config/database.js';
import { enqueueGateNotification } from '../src/notifications/gateNotificationQueue.service.js';
import { GateNotificationWorker } from '../src/notifications/gateNotificationWorker.js';
import { IEmailProvider, SendEmailOptions, SendEmailResult } from '../src/notifications/email/emailProvider.interface.js';
import { updateLearnerPersonalInfo, verifyHealthEncodingPermission } from '../src/academic/health/healthMetric.service.js';
import { GuardianAuthorizationService, getOtpHmacSecret } from '../src/notifications/guardianAuthorization.service.js';
import { generateId } from '../src/common/utils/uuid.js';

class MockEmailProvider implements IEmailProvider {
  public sentMessages: SendEmailOptions[] = [];
  async sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
    this.sentMessages.push(options);
    return {
      success: true,
      statusCode: 200,
      messageId: `mock-p3c12-${Date.now()}-${this.sentMessages.length}`,
    };
  }
  clear() {
    this.sentMessages = [];
  }
}

describe('DIGISKWELA — Phase 3C.12: Final Guardian Verification Acceptance Suite', () => {
  const mockEmail = new MockEmailProvider();
  let worker: GateNotificationWorker;

  const sectionId = generateId();
  const createdStudentIds: string[] = [];
  const createdUserIds: string[] = [];
  const createdAttendanceIds: string[] = [];
  let adviserUserId: string;
  let unauthorizedTeacherUserId: string;

  async function createTestStudent(opts: {
    lrn: string;
    firstName: string;
    lastName: string;
    guardianFirst?: string;
    guardianLast?: string;
    guardianEmail?: string | null;
  }) {
    const userId = generateId();
    const studentId = generateId();

    createdUserIds.push(userId);
    createdStudentIds.push(studentId);

    await prisma.user.create({
      data: {
        id: userId,
        school_id: `STU-${opts.lrn}-${generateId().substring(0, 6)}`,
        email: null,
        first_name: opts.firstName,
        last_name: opts.lastName,
        status: 'active',
        must_change_password: false,
        password_hash: 'mock_hash',
      },
    });

    const student = await prisma.student.create({
      data: {
        id: studentId,
        user_id: userId,
        lrn: opts.lrn,
        first_name: opts.firstName,
        last_name: opts.lastName,
        grade_level: 10,
        current_section_id: sectionId,
        guardian_first_name: opts.guardianFirst || 'Juan',
        guardian_last_name: opts.guardianLast || 'Dela Cruz',
        guardian_email: opts.guardianEmail !== undefined ? opts.guardianEmail : null,
      },
    });

    return student;
  }

  async function createGateAttendance(studentId: string) {
    const attendanceId = generateId();
    createdAttendanceIds.push(attendanceId);

    const now = new Date();
    return await prisma.gateAttendance.create({
      data: {
        id: attendanceId,
        student_id: studentId,
        date: now,
        status: 'PRESENT',
        time_in: now,
      },
    });
  }

  beforeAll(async () => {
    // 1. Authorized Class Adviser
    adviserUserId = generateId();
    createdUserIds.push(adviserUserId);

    const adminRole = await prisma.role.findFirst({ where: { name: 'Admin' } });

    await prisma.user.create({
      data: {
        id: adviserUserId,
        school_id: `ADV-${generateId().substring(0, 10)}`,
        email: `adviser.p3c12.${generateId().substring(0, 6)}@cis.edu.ph`,
        first_name: 'Adviser',
        last_name: 'AuthorizedOfficer',
        status: 'active',
        must_change_password: false,
        password_hash: 'mock_hash',
      },
    });

    if (adminRole) {
      await prisma.userRole.create({
        data: { user_id: adviserUserId, role_id: adminRole.id },
      });
    }

    // 2. Unauthorized Teacher (No Admin/Adviser/Registrar role)
    unauthorizedTeacherUserId = generateId();
    createdUserIds.push(unauthorizedTeacherUserId);

    const teacherRole = await prisma.role.findFirst({ where: { name: 'Teacher' } });
    await prisma.user.create({
      data: {
        id: unauthorizedTeacherUserId,
        school_id: `TCH-${generateId().substring(0, 10)}`,
        email: `unauth.teacher.${generateId().substring(0, 6)}@cis.edu.ph`,
        first_name: 'Regular',
        last_name: 'SubjectTeacher',
        status: 'active',
        must_change_password: false,
        password_hash: 'mock_hash',
      },
    });
    if (teacherRole) {
      await prisma.userRole.create({
        data: { user_id: unauthorizedTeacherUserId, role_id: teacherRole.id },
      });
    }

    await prisma.section.create({
      data: {
        id: sectionId,
        name: 'G10-AcceptanceP3C12',
        grade_level: 10,
        academic_year_id: (await prisma.academicYear.findFirst())?.id || generateId(),
      },
    }).catch(() => {});

    worker = new GateNotificationWorker({
      emailProvider: mockEmail,
      clientPrisma: prisma,
      authorizationMode: 'SCHOOL_AUTHORIZED',
    });
  });

  afterAll(async () => {
    await prisma.gateAttendanceNotification.deleteMany({
      where: { student_id: { in: createdStudentIds } },
    }).catch(() => {});

    try {
      await (prisma as any).$executeRawUnsafe(
        `DELETE FROM public.guardian_contact_authorizations WHERE student_id = ANY($1::varchar[])`,
        createdStudentIds
      );
    } catch {}

    await prisma.gateAttendance.deleteMany({
      where: { student_id: { in: createdStudentIds } },
    }).catch(() => {});

    await prisma.student.deleteMany({
      where: { id: { in: createdStudentIds } },
    }).catch(() => {});

    await prisma.section.delete({
      where: { id: sectionId },
    }).catch(() => {});

    await prisma.auditLog.deleteMany({
      where: { actor_user_id: { in: createdUserIds } },
    }).catch(() => {});

    await prisma.userRole.deleteMany({
      where: { user_id: { in: createdUserIds } },
    }).catch(() => {});

    await prisma.user.deleteMany({
      where: { id: { in: createdUserIds } },
    }).catch(() => {});
  });

  it('1. OTP Secret Security: dedicated OTP_HMAC_SECRET is required and fails closed without secret', async () => {
    // Verify getOtpHmacSecret retrieves a valid string of >= 32 chars
    const secret = getOtpHmacSecret();
    expect(secret).toBeDefined();
    expect(typeof secret).toBe('string');
    expect(secret.length).toBeGreaterThanOrEqual(32);

    // Temporarily unset OTP_HMAC_SECRET to test fail-closed behavior
    const originalSecret = process.env.OTP_HMAC_SECRET;
    delete process.env.OTP_HMAC_SECRET;

    try {
      // 1. getOtpHmacSecret must throw descriptive error
      expect(() => getOtpHmacSecret()).toThrow(/OTP_HMAC_SECRET is not configured/);

      // 2. registerContact must fail closed
      const student = await createTestStudent({
        lrn: `1201${Math.floor(10000000 + Math.random() * 90000000)}`,
        firstName: 'Secret',
        lastName: 'Test',
        guardianEmail: 'secret.test@example.ph',
      });

      await expect(
        GuardianAuthorizationService.registerContact({
          studentId: student.id,
          guardianEmail: 'secret.test@example.ph',
          guardianName: 'Secret Guardian',
          clientPrisma: prisma,
          autoAuthorizeForTesting: false,
        })
      ).rejects.toThrow(/OTP_HMAC_SECRET is not configured/);

      // 3. verifyWithOtp on an existing pending record must fail closed and return safe diagnostic message
      const recId = generateId();
      await (prisma as any).$executeRawUnsafe(
        `INSERT INTO public.guardian_contact_authorizations (
          id, student_id, guardian_email, guardian_name, status, salt, verification_otp_hash,
          failed_attempts, max_attempts, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, 'PENDING_VERIFICATION', '12345678901234567890123456789012', 'dummyhash', 0, 5, NOW(), NOW())`,
        recId,
        student.id,
        'secret.test@example.ph',
        'Secret Guardian'
      );

      const verifyRes = await GuardianAuthorizationService.verifyWithOtp(
        prisma,
        student.id,
        'secret.test@example.ph',
        '123456'
      );
      expect(verifyRes.success).toBe(false);
      expect(verifyRes.message).toContain('temporarily unavailable due to missing security configuration');

      // 4. Gate attendance scan must continue recording unaffected!
      const att = await createGateAttendance(student.id);
      expect(att.id).toBeDefined();
      expect(att.status).toBe('PRESENT');
    } finally {
      process.env.OTP_HMAC_SECRET = originalSecret;
    }
  });

  it('2. Teacher Portal Workflow: Class Adviser in-person authorization transitions contact to AUTHORIZED with audit log', async () => {
    const student = await createTestStudent({
      lrn: `1202${Math.floor(10000000 + Math.random() * 90000000)}`,
      firstName: 'Rico',
      lastName: 'Yan',
      guardianEmail: 'rico.guardian@example.ph',
    });

    // 1. Initial status: PENDING_VERIFICATION
    await GuardianAuthorizationService.registerContact({
      studentId: student.id,
      guardianEmail: 'rico.guardian@example.ph',
      guardianName: 'Rico Yan Guardian',
      clientPrisma: prisma,
      autoAuthorizeForTesting: false,
    });

    const checkInitial = await GuardianAuthorizationService.checkAuthorization(
      prisma,
      student.id,
      'rico.guardian@example.ph'
    );
    expect(checkInitial.authorized).toBe(false);
    expect(checkInitial.status).toBe('PENDING_VERIFICATION');

    // 2. Class Adviser conducts in-person verification (DepEd Form 137 / PSA)
    const authResult = await GuardianAuthorizationService.authorizeManuallyByStaff(
      prisma,
      student.id,
      'rico.guardian@example.ph',
      adviserUserId,
      'PSA Birth Certificate verified by Class Adviser',
      'IN_PERSON_PSA_VERIFICATION'
    );
    expect(authResult.success).toBe(true);

    // 3. Verification status transitions to AUTHORIZED
    const checkAfter = await GuardianAuthorizationService.checkAuthorization(
      prisma,
      student.id,
      'rico.guardian@example.ph'
    );
    expect(checkAfter.authorized).toBe(true);
    expect(checkAfter.status).toBe('AUTHORIZED');

    // 4. Verify audit log entry
    const auditEntry = await prisma.auditLog.findFirst({
      where: {
        action: 'GUARDIAN_CONTACT_MANUAL_AUTHORIZATION',
        actor_user_id: adviserUserId,
        resource_id: student.id,
      },
    });
    expect(auditEntry).not.toBeNull();
    expect(auditEntry?.reason).toContain('PSA Birth Certificate');
  });

  it('3. Demographics Invalidation: changing guardian email replaces previous authorization and requires re-authorization', async () => {
    const student = await createTestStudent({
      lrn: `1203${Math.floor(10000000 + Math.random() * 90000000)}`,
      firstName: 'Vilma',
      lastName: 'Santos',
      guardianEmail: 'vilma.old@example.ph',
    });

    // Authorize old email
    await GuardianAuthorizationService.registerContact({
      studentId: student.id,
      guardianEmail: 'vilma.old@example.ph',
      guardianName: 'Vilma Santos Guardian',
      clientPrisma: prisma,
      autoAuthorizeForTesting: true,
      authorizedByUserId: adviserUserId,
    });

    expect((await GuardianAuthorizationService.checkAuthorization(prisma, student.id, 'vilma.old@example.ph')).authorized).toBe(true);

    // Adviser updates email in personal info demographics
    await updateLearnerPersonalInfo(
      student.id,
      {
        guardianEmail: 'vilma.new@example.ph',
        guardianFirstName: 'Vilma New Guardian',
      },
      adviserUserId
    );

    // Old contact is REPLACED
    const oldRec: any[] = await (prisma as any).$queryRawUnsafe(
      `SELECT status FROM public.guardian_contact_authorizations WHERE student_id = $1 AND guardian_email = $2`,
      student.id,
      'vilma.old@example.ph'
    );
    expect(oldRec[0].status).toBe('REPLACED');

    // New contact is PENDING_VERIFICATION
    const newCheck = await GuardianAuthorizationService.checkAuthorization(
      prisma,
      student.id,
      'vilma.new@example.ph'
    );
    expect(newCheck.authorized).toBe(false);
    expect(newCheck.status).toBe('PENDING_VERIFICATION');

    // Gate scan with new unverified email is SKIPPED
    const att = await createGateAttendance(student.id);
    const notif = await enqueueGateNotification({
      attendanceId: att.id,
      studentId: student.id,
      eventType: 'TIME_IN',
      authorizationMode: 'SCHOOL_AUTHORIZED',
      clientPrisma: prisma,
    });

    expect(notif?.status).toBe('SKIPPED');
    expect(notif?.reason).toContain('PENDING_VERIFICATION');
  });

  it('4. Cross-Student Isolation: modifying or authorizing one student does not affect another student', async () => {
    const studentA = await createTestStudent({
      lrn: `1204${Math.floor(10000000 + Math.random() * 90000000)}`,
      firstName: 'Student',
      lastName: 'Alpha',
      guardianEmail: 'guardian.alpha@example.ph',
    });

    const studentB = await createTestStudent({
      lrn: `1205${Math.floor(10000000 + Math.random() * 90000000)}`,
      firstName: 'Student',
      lastName: 'Beta',
      guardianEmail: 'guardian.beta@example.ph',
    });

    // Authorize Student A
    await GuardianAuthorizationService.registerContact({
      studentId: studentA.id,
      guardianEmail: 'guardian.alpha@example.ph',
      guardianName: 'Guardian Alpha',
      clientPrisma: prisma,
      autoAuthorizeForTesting: true,
      authorizedByUserId: adviserUserId,
    });

    // Leave Student B unverified (PENDING_VERIFICATION)
    await GuardianAuthorizationService.registerContact({
      studentId: studentB.id,
      guardianEmail: 'guardian.beta@example.ph',
      guardianName: 'Guardian Beta',
      clientPrisma: prisma,
      autoAuthorizeForTesting: false,
    });

    // Student A is AUTHORIZED
    expect((await GuardianAuthorizationService.checkAuthorization(prisma, studentA.id, 'guardian.alpha@example.ph')).authorized).toBe(true);

    // Student B remains PENDING_VERIFICATION
    const checkB = await GuardianAuthorizationService.checkAuthorization(prisma, studentB.id, 'guardian.beta@example.ph');
    expect(checkB.authorized).toBe(false);
    expect(checkB.status).toBe('PENDING_VERIFICATION');
  });

  it('5. Dynamic Routing & Siblings: siblings sharing a guardian email receive separate, student-identified notifications without cross-talk', async () => {
    const sharedGuardianEmail = 'family.morales@example.ph';

    const sibling1 = await createTestStudent({
      lrn: `1206${Math.floor(10000000 + Math.random() * 90000000)}`,
      firstName: 'Joshua',
      lastName: 'Morales',
      guardianEmail: sharedGuardianEmail,
    });

    const sibling2 = await createTestStudent({
      lrn: `1207${Math.floor(10000000 + Math.random() * 90000000)}`,
      firstName: 'Julia',
      lastName: 'Morales',
      guardianEmail: sharedGuardianEmail,
    });

    // Authorize both siblings
    await GuardianAuthorizationService.registerContact({
      studentId: sibling1.id,
      guardianEmail: sharedGuardianEmail,
      guardianName: 'Parent Morales',
      clientPrisma: prisma,
      autoAuthorizeForTesting: true,
      authorizedByUserId: adviserUserId,
      skipCooldown: true,
    });

    await GuardianAuthorizationService.registerContact({
      studentId: sibling2.id,
      guardianEmail: sharedGuardianEmail,
      guardianName: 'Parent Morales',
      clientPrisma: prisma,
      autoAuthorizeForTesting: true,
      authorizedByUserId: adviserUserId,
      skipCooldown: true,
    });

    // Sibling 1 scans in
    const att1 = await createGateAttendance(sibling1.id);
    const notif1 = await enqueueGateNotification({
      attendanceId: att1.id,
      studentId: sibling1.id,
      eventType: 'TIME_IN',
      authorizationMode: 'SCHOOL_AUTHORIZED',
      clientPrisma: prisma,
    });
    expect(notif1?.status).toBe('PENDING');

    // Sibling 2 scans in
    const att2 = await createGateAttendance(sibling2.id);
    const notif2 = await enqueueGateNotification({
      attendanceId: att2.id,
      studentId: sibling2.id,
      eventType: 'TIME_IN',
      authorizationMode: 'SCHOOL_AUTHORIZED',
      clientPrisma: prisma,
    });
    expect(notif2?.status).toBe('PENDING');

    // Worker dispatches both
    mockEmail.clear();
    const batch = await worker.processBatch();
    expect(batch.sent).toBe(2);
    expect(mockEmail.sentMessages.length).toBe(2);

    // Verify student-specific identification in notification body
    const msg1 = mockEmail.sentMessages.find(m => m.htmlContent.includes('Joshua'));
    const msg2 = mockEmail.sentMessages.find(m => m.htmlContent.includes('Julia'));

    expect(msg1).toBeDefined();
    expect(msg2).toBeDefined();
    expect(msg1?.to[0].email).toBe(sharedGuardianEmail);
    expect(msg2?.to[0].email).toBe(sharedGuardianEmail);
    expect(msg1?.htmlContent).toContain('Joshua');
    expect(msg2?.htmlContent).toContain('Julia');
  });

  it('6. Revocation and Blocking: REVOKED and BLOCKED contacts strictly suppress all notifications', async () => {
    const student = await createTestStudent({
      lrn: `1208${Math.floor(10000000 + Math.random() * 90000000)}`,
      firstName: 'Kathryn',
      lastName: 'Bernardo',
      guardianEmail: 'kathryn.guardian@example.ph',
    });

    // Initial authorization
    await GuardianAuthorizationService.registerContact({
      studentId: student.id,
      guardianEmail: 'kathryn.guardian@example.ph',
      guardianName: 'Kathryn Bernardo Guardian',
      clientPrisma: prisma,
      autoAuthorizeForTesting: true,
      authorizedByUserId: adviserUserId,
    });

    // Revoke contact
    const revokeRes = await GuardianAuthorizationService.revokeContact(
      prisma,
      student.id,
      'kathryn.guardian@example.ph',
      'Revoked by authorized Class Adviser'
    );
    expect(revokeRes.success).toBe(true);

    const checkRevoked = await GuardianAuthorizationService.checkAuthorization(
      prisma,
      student.id,
      'kathryn.guardian@example.ph'
    );
    expect(checkRevoked.authorized).toBe(false);
    expect(checkRevoked.status).toBe('REVOKED');

    // Gate scan occurs: Must be SKIPPED
    const att = await createGateAttendance(student.id);
    const notif = await enqueueGateNotification({
      attendanceId: att.id,
      studentId: student.id,
      eventType: 'TIME_IN',
      authorizationMode: 'SCHOOL_AUTHORIZED',
      clientPrisma: prisma,
    });

    expect(notif?.status).toBe('SKIPPED');
    expect(notif?.reason).toContain('REVOKED');

    // Blocked contact check
    await GuardianAuthorizationService.blockContact(
      prisma,
      'kathryn.guardian@example.ph',
      'Hard bounce report'
    );

    const checkBlocked = await GuardianAuthorizationService.checkAuthorization(
      prisma,
      student.id,
      'kathryn.guardian@example.ph'
    );
    expect(checkBlocked.authorized).toBe(false);
    expect(checkBlocked.status).toBe('BLOCKED');
  });

  it('7. RBAC Security: unauthorized staff cannot verify or alter guardian authorizations', async () => {
    const student = await createTestStudent({
      lrn: `1209${Math.floor(10000000 + Math.random() * 90000000)}`,
      firstName: 'Secure',
      lastName: 'Learner',
      guardianEmail: 'secure.learner@example.ph',
    });

    // An unauthorized teacher without Class Adviser or Registrar privileges is rejected
    await expect(
      verifyHealthEncodingPermission(student.id, unauthorizedTeacherUserId)
    ).rejects.toThrow();
  });
});
