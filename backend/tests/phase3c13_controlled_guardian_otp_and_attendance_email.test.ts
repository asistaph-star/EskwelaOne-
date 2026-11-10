import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import prisma from '../src/config/database.js';
import { enqueueGateNotification } from '../src/notifications/gateNotificationQueue.service.js';
import { GateNotificationWorker } from '../src/notifications/gateNotificationWorker.js';
import { IEmailProvider, SendEmailOptions, SendEmailResult } from '../src/notifications/email/emailProvider.interface.js';
import { GuardianAuthorizationService } from '../src/notifications/guardianAuthorization.service.js';
import { generateId } from '../src/common/utils/uuid.js';

class MockEmailProvider implements IEmailProvider {
  public sentMessages: SendEmailOptions[] = [];
  async sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
    this.sentMessages.push(options);
    return {
      success: true,
      statusCode: 200,
      messageId: `mock-p3c13-${Date.now()}-${this.sentMessages.length}`,
    };
  }
  clear() {
    this.sentMessages = [];
  }
}

describe('DIGISKWELA — Phase 3C.13: Controlled Guardian OTP & Dual-Layer Acceptance Suite', () => {
  const mockEmail = new MockEmailProvider();
  let worker: GateNotificationWorker;

  const sectionId = generateId();
  const createdStudentIds: string[] = [];
  const createdUserIds: string[] = [];
  const createdAttendanceIds: string[] = [];

  const testTesterEmail = 'sanodummy671@gmail.com';

  async function createTestStudent(opts: {
    lrn: string;
    firstName: string;
    lastName: string;
    guardianFirst: string;
    guardianLast: string;
    guardianEmail: string;
  }) {
    const userId = generateId();
    const studentId = generateId();

    createdUserIds.push(userId);
    createdStudentIds.push(studentId);

    await prisma.user.create({
      data: {
        id: userId,
        school_id: `STU-P3C13-${opts.lrn}`,
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
        guardian_first_name: opts.guardianFirst,
        guardian_last_name: opts.guardianLast,
        guardian_email: opts.guardianEmail,
      },
    });

    return student;
  }

  beforeAll(async () => {
    const ay = await prisma.academicYear.findFirst();
    await prisma.section.create({
      data: {
        id: sectionId,
        name: 'G10-AcceptanceP3C13',
        grade_level: 10,
        academic_year_id: ay?.id || generateId(),
      },
    }).catch(() => {});

    worker = new GateNotificationWorker({
      emailProvider: mockEmail,
      clientPrisma: prisma,
      pollIntervalMs: 50,
      batchSize: 10,
      authorizationMode: 'PILOT_WHITELIST',
      authorizedRecipients: [testTesterEmail],
    });
  });

  afterAll(async () => {
    worker.stop();
    for (const aId of createdAttendanceIds) {
      await prisma.gateAttendanceNotification.deleteMany({ where: { attendance_id: aId } }).catch(() => {});
      await prisma.gateAttendance.delete({ where: { id: aId } }).catch(() => {});
    }
    for (const sId of createdStudentIds) {
      await prisma.$executeRawUnsafe('DELETE FROM public.guardian_contact_authorizations WHERE student_id = $1', sId).catch(() => {});
      await prisma.student.delete({ where: { id: sId } }).catch(() => {});
    }
    for (const uId of createdUserIds) {
      await prisma.user.delete({ where: { id: uId } }).catch(() => {});
    }
    await prisma.section.delete({ where: { id: sectionId } }).catch(() => {});
  });

  it('1. Dual-Layer Protection: A whitelisted email address in PENDING_VERIFICATION is strictly suppressed (SKIPPED)', async () => {
    const student = await createTestStudent({
      lrn: '999026130001',
      firstName: 'Mark',
      lastName: 'Mercado',
      guardianFirst: 'Benjamin',
      guardianLast: 'Mercado',
      guardianEmail: testTesterEmail,
    });

    // Register contact in PENDING_VERIFICATION
    const regResult = await GuardianAuthorizationService.registerContact({
      studentId: student.id,
      guardianEmail: testTesterEmail,
      guardianName: 'Benjamin Mercado',
      clientPrisma: prisma,
      autoAuthorizeForTesting: false,
    });
    expect(regResult.status).toBe('PENDING_VERIFICATION');

    // Create gate attendance
    const attId = generateId();
    createdAttendanceIds.push(attId);
    await prisma.gateAttendance.create({
      data: {
        id: attId,
        student_id: student.id,
        date: new Date(),
        status: 'Present',
        time_in: new Date(),
      },
    });

    // Enqueue in PILOT_WHITELIST mode with testTesterEmail on whitelist
    const enqueueRes = await enqueueGateNotification({
      attendanceId: attId,
      studentId: student.id,
      eventType: 'TIME_IN',
      clientPrisma: prisma,
      recipientMode: 'GUARDIAN_ONLY',
      authorizationMode: 'PILOT_WHITELIST',
      authorizedRecipients: [testTesterEmail],
    });

    // Must be suppressed (SKIPPED) because contact is still PENDING_VERIFICATION!
    expect(enqueueRes.status).toBe('SKIPPED');
    expect(enqueueRes.reason).toContain('PENDING_VERIFICATION');

    // Verify outbox record status in DB
    const outbox = await prisma.gateAttendanceNotification.findFirst({
      where: { attendance_id: attId },
    });
    expect(outbox?.status).toBe('SKIPPED');

    // Worker processing batch should not send any email
    mockEmail.clear();
    await worker.processBatch();
    expect(mockEmail.sentMessages.length).toBe(0);
  });

  it('2. OTP Delivery Path: OTP verification message contains zero attendance information', async () => {
    const student = await createTestStudent({
      lrn: '999026130002',
      firstName: 'Test',
      lastName: 'Learner',
      guardianFirst: 'Test',
      guardianLast: 'Guardian',
      guardianEmail: testTesterEmail,
    });

    const regResult = await GuardianAuthorizationService.registerContact({
      studentId: student.id,
      guardianEmail: testTesterEmail,
      guardianName: 'Test Guardian',
      clientPrisma: prisma,
      autoAuthorizeForTesting: false,
      skipCooldown: true,
    });

    // Verify OTP email payload
    const email = regResult.verificationEmail;
    expect(email.to).toBe(testTesterEmail);
    expect(email.subject).toContain('Verify Guardian Email Address');
    expect(email.htmlContent).toContain(regResult.otp);
    expect(email.htmlContent).toContain('15 minutes');
    expect(email.htmlContent).not.toContain('Time In');
    expect(email.htmlContent).not.toContain('Time Out');
    expect(email.htmlContent).not.toContain('attendance recorded');
  });

  it('3. Verification Flow: Entering correct OTP transitions contact to AUTHORIZED and clears OTP hash (single-use)', async () => {
    const student = await createTestStudent({
      lrn: '999026130003',
      firstName: 'Verified',
      lastName: 'Student',
      guardianFirst: 'Verified',
      guardianLast: 'Parent',
      guardianEmail: testTesterEmail,
    });

    const reg = await GuardianAuthorizationService.registerContact({
      studentId: student.id,
      guardianEmail: testTesterEmail,
      guardianName: 'Verified Parent',
      clientPrisma: prisma,
      autoAuthorizeForTesting: false,
      skipCooldown: true,
    });

    // Verify with correct OTP
    const verifyRes = await GuardianAuthorizationService.verifyWithOtp(
      prisma,
      student.id,
      testTesterEmail,
      reg.otp
    );
    expect(verifyRes.success).toBe(true);

    // Inspect database record
    const [authDb] = await prisma.$queryRawUnsafe<any[]>(
      'SELECT status, verification_otp_hash, verified_at, verification_method FROM public.guardian_contact_authorizations WHERE student_id = $1',
      student.id
    );
    expect(authDb.status).toBe('AUTHORIZED');
    expect(authDb.verification_otp_hash).toBeNull(); // Single-use replay protection
    expect(authDb.verification_method).toBe('OTP');
    expect(authDb.verified_at).not.toBeNull();

    // Already authorized idempotency check
    const repeatRes = await GuardianAuthorizationService.verifyWithOtp(
      prisma,
      student.id,
      testTesterEmail,
      reg.otp
    );
    expect(repeatRes.success).toBe(true);
    expect(repeatRes.message).toContain('already verified and authorized');
  });

  it('4. Dual-Layer Delivery: Once AUTHORIZED, gate attendance notification successfully dispatches to whitelisted test recipient', async () => {
    const student = await createTestStudent({
      lrn: '999026130004',
      firstName: 'ScanReady',
      lastName: 'Mercado',
      guardianFirst: 'Benjamin',
      guardianLast: 'Mercado',
      guardianEmail: testTesterEmail,
    });

    // 1. Authorize via OTP
    const reg = await GuardianAuthorizationService.registerContact({
      studentId: student.id,
      guardianEmail: testTesterEmail,
      guardianName: 'Benjamin Mercado',
      clientPrisma: prisma,
      autoAuthorizeForTesting: false,
      skipCooldown: true,
    });
    await GuardianAuthorizationService.verifyWithOtp(prisma, student.id, testTesterEmail, reg.otp);

    // 2. Student scans at gate
    const attId = generateId();
    createdAttendanceIds.push(attId);
    await prisma.gateAttendance.create({
      data: {
        id: attId,
        student_id: student.id,
        date: new Date(),
        status: 'Present',
        time_in: new Date(),
      },
    });

    // 3. Enqueue notification
    const enqueueRes = await enqueueGateNotification({
      attendanceId: attId,
      studentId: student.id,
      eventType: 'TIME_IN',
      clientPrisma: prisma,
      recipientMode: 'GUARDIAN_ONLY',
      authorizationMode: 'PILOT_WHITELIST',
      authorizedRecipients: [testTesterEmail],
    });
    expect(enqueueRes.status).toBe('PENDING');

    // 4. Process with worker
    mockEmail.clear();
    const summary = await worker.processBatch();
    expect(summary.sent).toBe(1);
    expect(mockEmail.sentMessages.length).toBe(1);

    const sent = mockEmail.sentMessages[0];
    expect(sent.to[0].email).toBe(testTesterEmail);
    expect(sent.subject).toContain('Attendance');
    expect(sent.htmlContent).toContain('Calulut Integrated School');
    expect(sent.htmlContent).toContain('ScanReady');
    expect(sent.htmlContent).toContain('Time In');
  });

  it('5. Fail-Closed Whitelist Isolation: A non-whitelisted email is blocked even if authorized in school', async () => {
    const nonWhitelistedEmail = 'unauthorized.stranger@example.com';
    const student = await createTestStudent({
      lrn: '999026130005',
      firstName: 'Outsider',
      lastName: 'Student',
      guardianFirst: 'Outsider',
      guardianLast: 'Parent',
      guardianEmail: nonWhitelistedEmail,
    });

    // Authorized in school table
    await GuardianAuthorizationService.registerContact({
      studentId: student.id,
      guardianEmail: nonWhitelistedEmail,
      guardianName: 'Outsider Parent',
      clientPrisma: prisma,
      autoAuthorizeForTesting: true,
      skipCooldown: true,
    });

    const attId = generateId();
    createdAttendanceIds.push(attId);
    await prisma.gateAttendance.create({
      data: {
        id: attId,
        student_id: student.id,
        date: new Date(),
        status: 'Present',
        time_in: new Date(),
      },
    });

    // Enqueue with pilot whitelist that ONLY includes testTesterEmail
    const enqueueRes = await enqueueGateNotification({
      attendanceId: attId,
      studentId: student.id,
      eventType: 'TIME_IN',
      clientPrisma: prisma,
      recipientMode: 'GUARDIAN_ONLY',
      authorizationMode: 'PILOT_WHITELIST',
      authorizedRecipients: [testTesterEmail], // nonWhitelistedEmail is NOT here
    });

    expect(enqueueRes.status).toBe('SKIPPED');
    expect(enqueueRes.reason).toContain('not on the authorized whitelist');
  });
});
