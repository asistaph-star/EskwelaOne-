import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import crypto from 'crypto';
import prisma from '../src/config/database.js';
import { enqueueGateNotification } from '../src/notifications/gateNotificationQueue.service.js';
import { GateNotificationWorker } from '../src/notifications/gateNotificationWorker.js';
import { IEmailProvider, SendEmailOptions, SendEmailResult } from '../src/notifications/email/emailProvider.interface.js';
import { updateLearnerPersonalInfo } from '../src/academic/health/healthMetric.service.js';
import { GuardianAuthorizationService } from '../src/notifications/guardianAuthorization.service.js';
import { generateId } from '../src/common/utils/uuid.js';

class MockEmailProvider implements IEmailProvider {
  public sentMessages: SendEmailOptions[] = [];
  async sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
    this.sentMessages.push(options);
    return {
      success: true,
      statusCode: 200,
      messageId: `mock-safe-p3c10-${Date.now()}-${this.sentMessages.length}`,
    };
  }
  clear() {
    this.sentMessages = [];
  }
}

describe('DIGISKWELA — Phase 3C.10: Final Guardian Authorization Safety Corrections', () => {
  const mockEmail = new MockEmailProvider();
  let worker: GateNotificationWorker;

  const sectionId = generateId();
  const createdStudentIds: string[] = [];
  const createdUserIds: string[] = [];
  const createdAttendanceIds: string[] = [];
  let adviserUserId: string;

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
    return await (prisma as any).gateAttendance.create({
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
    adviserUserId = generateId();
    createdUserIds.push(adviserUserId);

    const adminRole = await prisma.role.findFirst({
      where: { name: 'Admin' },
    });

    await prisma.user.create({
      data: {
        id: adviserUserId,
        school_id: `ADV-${generateId().substring(0, 10)}`,
        email: `adviser.safety.${generateId().substring(0, 6)}@cis.edu.ph`,
        first_name: 'Adviser',
        last_name: 'SafetyOfficer',
        status: 'active',
        must_change_password: false,
        password_hash: 'mock_hash',
      },
    });

    if (adminRole) {
      await prisma.userRole.create({
        data: {
          user_id: adviserUserId,
          role_id: adminRole.id,
        },
      });
    }

    await (prisma as any).section.create({
      data: {
        id: sectionId,
        name: 'G10-Safety3C10',
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
    await (prisma as any).gateAttendanceNotification.deleteMany({
      where: { student_id: { in: createdStudentIds } },
    }).catch(() => {});

    try {
      await (prisma as any).$executeRawUnsafe(
        `DELETE FROM public.guardian_contact_authorizations WHERE student_id = ANY($1::varchar[])`,
        createdStudentIds
      );
    } catch {}

    await (prisma as any).gateAttendance.deleteMany({
      where: { student_id: { in: createdStudentIds } },
    }).catch(() => {});

    await (prisma as any).student.deleteMany({
      where: { id: { in: createdStudentIds } },
    }).catch(() => {});

    await (prisma as any).section.delete({
      where: { id: sectionId },
    }).catch(() => {});

    await (prisma as any).auditLog.deleteMany({
      where: { actor_user_id: adviserUserId },
    }).catch(() => {});

    await (prisma as any).userRole.deleteMany({
      where: { user_id: { in: createdUserIds } },
    }).catch(() => {});

    await (prisma as any).user.deleteMany({
      where: { id: { in: createdUserIds } },
    }).catch(() => {});
  });

  it('1. Fail-closed safety: missing table or unknown authorization record strictly suppresses email dispatches while preserving gate attendance', async () => {
    const student = await createTestStudent({
      lrn: `1001${Math.floor(10000000 + Math.random() * 90000000)}`,
      firstName: 'Marco',
      lastName: 'Guinto',
      guardianEmail: 'unverified.guinto@gmail.com',
    });

    // Verify checkAuthorization returns authorized: false and status: UNKNOWN when no record exists
    const check = await GuardianAuthorizationService.checkAuthorization(
      prisma,
      student.id,
      'unverified.guinto@gmail.com'
    );
    expect(check.authorized).toBe(false);
    expect(check.status).toBe('UNKNOWN');
    expect(check.reason).toContain('no active authorization record');

    // Create gate attendance scan
    const att = await createGateAttendance(student.id);
    expect(att.id).toBeDefined();

    // Enqueue notification in SCHOOL_AUTHORIZED mode
    const notif = await enqueueGateNotification({
      attendanceId: att.id,
      studentId: student.id,
      eventType: 'TIME_IN',
      authorizationMode: 'SCHOOL_AUTHORIZED',
      clientPrisma: prisma,
    });

    expect(notif).not.toBeNull();
    // Notification must be SKIPPED, NOT PENDING!
    expect(notif?.status).toBe('SKIPPED');
    expect(notif?.reason).toMatch(/no active authorization record|Verification required/);

    // Worker process must skip and not send email
    mockEmail.clear();
    const summary = await worker.processBatch();
    expect(summary.sent).toBe(0);
    expect(mockEmail.sentMessages.length).toBe(0);

    // Verify gate attendance scan in database remains intact
    const savedAtt = await (prisma as any).gateAttendance.findUnique({
      where: { id: att.id },
    });
    expect(savedAtt).not.toBeNull();
    expect(savedAtt.status).toBe('PRESENT');
  });

  it('2. Contact classification policy: existing contacts default strictly to PENDING_VERIFICATION (zero automatic authorization)', async () => {
    const student = await createTestStudent({
      lrn: `1002${Math.floor(10000000 + Math.random() * 90000000)}`,
      firstName: 'Mark',
      lastName: 'Mercado',
      guardianEmail: 'sanodummy671@gmail.com',
    });

    // Seed contact into guardian_contact_authorizations as PENDING_VERIFICATION (baseline migration simulation)
    const authId = generateId();
    await (prisma as any).$executeRawUnsafe(
      `INSERT INTO public.guardian_contact_authorizations (
        id, student_id, guardian_email, guardian_name, status,
        failed_attempts, max_attempts, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, 'PENDING_VERIFICATION', 0, 5, NOW(), NOW())`,
      authId,
      student.id,
      'sanodummy671@gmail.com',
      'Mark Guardian'
    );

    // Verify checkAuthorization returns authorized: false and status: PENDING_VERIFICATION
    const check = await GuardianAuthorizationService.checkAuthorization(
      prisma,
      student.id,
      'sanodummy671@gmail.com'
    );
    expect(check.authorized).toBe(false);
    expect(check.status).toBe('PENDING_VERIFICATION');

    // Gate scan occurs
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

    mockEmail.clear();
    const summary = await worker.processBatch();
    expect(summary.sent).toBe(0);
    expect(mockEmail.sentMessages.length).toBe(0);
  });

  it('3. Hardened OTP: uses cryptographic per-record salt and 15-minute expiration', async () => {
    const student = await createTestStudent({
      lrn: `1003${Math.floor(10000000 + Math.random() * 90000000)}`,
      firstName: 'Angelica',
      lastName: 'Perez',
      guardianEmail: 'angelica.guardian@gmail.com',
    });

    const reg = await GuardianAuthorizationService.registerContact({
      studentId: student.id,
      guardianEmail: 'angelica.guardian@gmail.com',
      guardianName: 'Angelica Perez Guardian',
      clientPrisma: prisma,
      autoAuthorizeForTesting: false,
    });

    expect(reg.otp).toMatch(/^\d{6}$/);
    expect(reg.status).toBe('PENDING_VERIFICATION');
    expect(reg.verificationEmail.htmlContent).toContain('valid for 15 minutes');

    // Inspect database record for salt and token_expires_at
    const records: any[] = await (prisma as any).$queryRawUnsafe(
      `SELECT salt, verification_otp_hash, token_expires_at, created_at 
       FROM public.guardian_contact_authorizations 
       WHERE id = $1`,
      reg.authorizationId
    );
    expect(records.length).toBe(1);
    const dbRec = records[0];
    expect(dbRec.salt).toBeDefined();
    expect(dbRec.salt.length).toBe(32); // 16 bytes hex

    // Verify salted HMAC hash integrity (bound to dedicated OTP_HMAC_SECRET)
    const otpSecret = process.env.OTP_HMAC_SECRET || 'test_otp_hmac_secret_min_32_chars_long!';
    const expectedHash = crypto.createHmac('sha256', otpSecret).update(dbRec.salt + ':' + reg.otp).digest('hex');
    expect(dbRec.verification_otp_hash).toBe(expectedHash);

    // Verify expiration is <= 15 minutes from created_at
    const expiresAt = new Date(dbRec.token_expires_at).getTime();
    const createdAt = new Date(dbRec.created_at).getTime();
    const validityMs = expiresAt - createdAt;
    expect(validityMs).toBeLessThanOrEqual(15 * 60 * 1000 + 5000);
    expect(validityMs).toBeGreaterThanOrEqual(15 * 60 * 1000 - 5000);

    // Test expiration failure: set expires_at in the past
    await (prisma as any).$executeRawUnsafe(
      `UPDATE public.guardian_contact_authorizations 
       SET token_expires_at = NOW() - INTERVAL '1 minute' 
       WHERE id = $1`,
      reg.authorizationId
    );

    const expiredVerify = await GuardianAuthorizationService.verifyWithOtp(
      prisma,
      student.id,
      'angelica.guardian@gmail.com',
      reg.otp
    );
    expect(expiredVerify.success).toBe(false);
    expect(expiredVerify.message).toContain('expired');
  });

  it('4. Brute force lockout: locks verification code after 5 failed attempts and clears OTP hash', async () => {
    const student = await createTestStudent({
      lrn: `1004${Math.floor(10000000 + Math.random() * 90000000)}`,
      firstName: 'David',
      lastName: 'Castro',
      guardianEmail: 'david.guardian@gmail.com',
    });

    const reg = await GuardianAuthorizationService.registerContact({
      studentId: student.id,
      guardianEmail: 'david.guardian@gmail.com',
      guardianName: 'David Castro Guardian',
      clientPrisma: prisma,
      autoAuthorizeForTesting: false,
    });

    // Attempt 1: wrong code
    const attempt1 = await GuardianAuthorizationService.verifyWithOtp(prisma, student.id, 'david.guardian@gmail.com', '000000');
    expect(attempt1.success).toBe(false);
    expect(attempt1.message).toContain('4 attempt(s) remaining');

    // Attempt 2: wrong code
    const attempt2 = await GuardianAuthorizationService.verifyWithOtp(prisma, student.id, 'david.guardian@gmail.com', '111111');
    expect(attempt2.success).toBe(false);
    expect(attempt2.message).toContain('3 attempt(s) remaining');

    // Attempt 3: wrong code
    const attempt3 = await GuardianAuthorizationService.verifyWithOtp(prisma, student.id, 'david.guardian@gmail.com', '222222');
    expect(attempt3.success).toBe(false);
    expect(attempt3.message).toContain('2 attempt(s) remaining');

    // Attempt 4: wrong code
    const attempt4 = await GuardianAuthorizationService.verifyWithOtp(prisma, student.id, 'david.guardian@gmail.com', '333333');
    expect(attempt4.success).toBe(false);
    expect(attempt4.message).toContain('1 attempt(s) remaining');

    // Attempt 5: wrong code -> Lockout!
    const attempt5 = await GuardianAuthorizationService.verifyWithOtp(prisma, student.id, 'david.guardian@gmail.com', '444444');
    expect(attempt5.success).toBe(false);
    expect(attempt5.message).toContain('locked due to excessive failed attempts');

    // Verify database state: failed_attempts = 5 and verification_otp_hash = NULL
    const records: any[] = await (prisma as any).$queryRawUnsafe(
      `SELECT failed_attempts, verification_otp_hash FROM public.guardian_contact_authorizations WHERE id = $1`,
      reg.authorizationId
    );
    expect(records[0].failed_attempts).toBe(5);
    expect(records[0].verification_otp_hash).toBeNull();

    // Attempt 6 with the CORRECT code must also be rejected
    const attempt6 = await GuardianAuthorizationService.verifyWithOtp(prisma, student.id, 'david.guardian@gmail.com', reg.otp);
    expect(attempt6.success).toBe(false);
    expect(attempt6.message).toContain('locked');
  });

  it('5. Single-use and replay protection: verified code clears hash and cannot be reused', async () => {
    const student = await createTestStudent({
      lrn: `1005${Math.floor(10000000 + Math.random() * 90000000)}`,
      firstName: 'Bea',
      lastName: 'Alonzo',
      guardianEmail: 'bea.guardian@gmail.com',
    });

    const reg = await GuardianAuthorizationService.registerContact({
      studentId: student.id,
      guardianEmail: 'bea.guardian@gmail.com',
      guardianName: 'Bea Alonzo Guardian',
      clientPrisma: prisma,
      autoAuthorizeForTesting: false,
    });

    // 1st verification with correct OTP: Success!
    const verify1 = await GuardianAuthorizationService.verifyWithOtp(
      prisma,
      student.id,
      'bea.guardian@gmail.com',
      reg.otp
    );
    expect(verify1.success).toBe(true);
    expect(verify1.message).toContain('verified and authorized');

    // Verify database record has status = AUTHORIZED and verification_otp_hash = NULL
    const records: any[] = await (prisma as any).$queryRawUnsafe(
      `SELECT status, verification_otp_hash, verification_method FROM public.guardian_contact_authorizations WHERE id = $1`,
      reg.authorizationId
    );
    expect(records[0].status).toBe('AUTHORIZED');
    expect(records[0].verification_otp_hash).toBeNull();
    expect(records[0].verification_method).toBe('OTP');

    // 2nd verification attempt with the exact same OTP (replay attack): Must return already authorized, never re-execute
    const verify2 = await GuardianAuthorizationService.verifyWithOtp(
      prisma,
      student.id,
      'bea.guardian@gmail.com',
      reg.otp
    );
    expect(verify2.success).toBe(true);
    expect(verify2.message).toContain('already verified and authorized');
  });

  it('6. Rate limiting and resend cooldown: enforces 60-second cooldown between code requests', async () => {
    const student = await createTestStudent({
      lrn: `1006${Math.floor(10000000 + Math.random() * 90000000)}`,
      firstName: 'Carlo',
      lastName: 'Aquino',
      guardianEmail: 'carlo.guardian@gmail.com',
    });

    // Initial registration
    await GuardianAuthorizationService.registerContact({
      studentId: student.id,
      guardianEmail: 'carlo.guardian@gmail.com',
      guardianName: 'Carlo Aquino Guardian',
      clientPrisma: prisma,
      autoAuthorizeForTesting: false,
    });

    // Immediate second registration without cooldown bypass must throw cooldown error
    await expect(
      GuardianAuthorizationService.registerContact({
        studentId: student.id,
        guardianEmail: 'carlo.guardian@gmail.com',
        guardianName: 'Carlo Aquino Guardian',
        clientPrisma: prisma,
        autoAuthorizeForTesting: false,
      })
    ).rejects.toThrow(/Please wait \d+ second\(s\) before requesting a new verification code/);

    // With skipCooldown = true, resend succeeds
    const bypassResend = await GuardianAuthorizationService.registerContact({
      studentId: student.id,
      guardianEmail: 'carlo.guardian@gmail.com',
      guardianName: 'Carlo Aquino Guardian',
      clientPrisma: prisma,
      autoAuthorizeForTesting: false,
      skipCooldown: true,
    });
    expect(bypassResend.otp).toBeDefined();
  });

  it('7. In-person staff authorization: captures authorizedByUserId, verificationMethod, and audit trail', async () => {
    const student = await createTestStudent({
      lrn: `1007${Math.floor(10000000 + Math.random() * 90000000)}`,
      firstName: 'Dennis',
      lastName: 'Trillo',
      guardianEmail: 'dennis.guardian@gmail.com',
    });

    // Initial register in PENDING_VERIFICATION
    await GuardianAuthorizationService.registerContact({
      studentId: student.id,
      guardianEmail: 'dennis.guardian@gmail.com',
      guardianName: 'Dennis Trillo Guardian',
      clientPrisma: prisma,
      autoAuthorizeForTesting: false,
    });

    // Staff authorizes contact in-person after PSA birth certificate check
    const authResult = await GuardianAuthorizationService.authorizeManuallyByStaff(
      prisma,
      student.id,
      'dennis.guardian@gmail.com',
      adviserUserId,
      'DepEd Form 137 and PSA verified by Class Adviser',
      'IN_PERSON_PSA_VERIFICATION'
    );

    expect(authResult.success).toBe(true);

    // Verify contact status is AUTHORIZED with staff user ID and method
    const records: any[] = await (prisma as any).$queryRawUnsafe(
      `SELECT status, authorized_by_user_id, verification_method, revocation_reason 
       FROM public.guardian_contact_authorizations 
       WHERE student_id = $1 AND guardian_email = $2`,
      student.id,
      'dennis.guardian@gmail.com'
    );
    expect(records.length).toBe(1);
    expect(records[0].status).toBe('AUTHORIZED');
    expect(records[0].authorized_by_user_id).toBe(adviserUserId);
    expect(records[0].verification_method).toBe('IN_PERSON_PSA_VERIFICATION');
    expect(records[0].revocation_reason).toContain('DepEd Form 137');

    // Gate scan after authorization must successfully queue notification as PENDING
    const att = await createGateAttendance(student.id);
    const notif = await enqueueGateNotification({
      attendanceId: att.id,
      studentId: student.id,
      eventType: 'TIME_IN',
      authorizationMode: 'SCHOOL_AUTHORIZED',
      clientPrisma: prisma,
    });

    expect(notif?.status).toBe('PENDING');

    // Worker dispatches notification
    mockEmail.clear();
    const summary = await worker.processBatch();
    expect(summary.sent).toBe(1);
    expect(mockEmail.sentMessages.length).toBe(1);
    expect(mockEmail.sentMessages[0].to[0].email).toBe('dennis.guardian@gmail.com');
  });

  it('8. Demographics modification invalidation: updating email replaces previous authorization and blocks notifications until new email is verified', async () => {
    const student = await createTestStudent({
      lrn: `1008${Math.floor(10000000 + Math.random() * 90000000)}`,
      firstName: 'Marian',
      lastName: 'Rivera',
      guardianEmail: 'marian.old@gmail.com',
    });

    // Authorize old email
    await GuardianAuthorizationService.registerContact({
      studentId: student.id,
      guardianEmail: 'marian.old@gmail.com',
      guardianName: 'Marian Rivera Guardian',
      clientPrisma: prisma,
      autoAuthorizeForTesting: true,
      authorizedByUserId: adviserUserId,
    });

    const checkOld = await GuardianAuthorizationService.checkAuthorization(
      prisma,
      student.id,
      'marian.old@gmail.com'
    );
    expect(checkOld.authorized).toBe(true);

    // Adviser updates email in personal info demographics to a new address
    await updateLearnerPersonalInfo(
      student.id,
      {
        guardianEmail: 'marian.new@gmail.com',
        guardianFirstName: 'Marian New Guardian',
      },
      adviserUserId
    );

    // Verify old contact is now REPLACED
    const oldRecs: any[] = await (prisma as any).$queryRawUnsafe(
      `SELECT status FROM public.guardian_contact_authorizations 
       WHERE student_id = $1 AND guardian_email = $2`,
      student.id,
      'marian.old@gmail.com'
    );
    expect(oldRecs[0].status).toBe('REPLACED');

    // Verify new contact is PENDING_VERIFICATION
    const newCheck = await GuardianAuthorizationService.checkAuthorization(
      prisma,
      student.id,
      'marian.new@gmail.com'
    );
    expect(newCheck.authorized).toBe(false);
    expect(newCheck.status).toBe('PENDING_VERIFICATION');

    // Gate scan with new unverified email must be SKIPPED
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

    mockEmail.clear();
    const summary = await worker.processBatch();
    expect(summary.sent).toBe(0);
    expect(mockEmail.sentMessages.length).toBe(0);
  });
});
