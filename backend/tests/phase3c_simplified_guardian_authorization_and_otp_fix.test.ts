import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import prisma from '../src/config/database.js';
import { GuardianAuthorizationService } from '../src/notifications/guardianAuthorization.service.js';
import { updateLearnerPersonalInfo, verifyHealthEncodingPermission } from '../src/academic/health/healthMetric.service.js';
import { enqueueGateNotification } from '../src/notifications/gateNotificationQueue.service.js';
import { GateNotificationWorker } from '../src/notifications/gateNotificationWorker.js';
import { IEmailProvider, SendEmailOptions, SendEmailResult } from '../src/notifications/email/emailProvider.interface.js';
import { generateId } from '../src/common/utils/uuid.js';
import crypto from 'crypto';

class MockEmailProvider implements IEmailProvider {
  public sentMessages: SendEmailOptions[] = [];
  async sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
    this.sentMessages.push(options);
    return {
      success: true,
      statusCode: 200,
      messageId: `mock-simplified-${Date.now()}-${this.sentMessages.length}`,
    };
  }
  clear() {
    this.sentMessages = [];
  }
}

describe('DIGISKWELA — Simplified Guardian Email Authorization & OTP Defect Resolution Test Suite', () => {
  const mockEmail = new MockEmailProvider();
  let worker: GateNotificationWorker;

  const sectionId = generateId();
  const createdStudentIds: string[] = [];
  const createdUserIds: string[] = [];
  const createdAuthIds: string[] = [];
  const createdAttendanceIds: string[] = [];

  let adviserUserId: string;
  let nonAdviserTeacherUserId: string;
  let studentCallerUserId: string;

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
    const uniqueLrn = `${opts.lrn.slice(0, 8)}${Date.now().toString().slice(-4)}`;

    createdUserIds.push(userId);
    createdStudentIds.push(studentId);

    await prisma.user.create({
      data: {
        id: userId,
        school_id: `STU-${uniqueLrn}`,
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
        lrn: uniqueLrn,
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
    // 1. Ensure test section and academic year
    const ay = await prisma.academicYear.findFirst();
    await prisma.section.create({
      data: {
        id: sectionId,
        name: 'G10-SimplifiedSuiteSection',
        grade_level: 10,
        academic_year_id: ay?.id || generateId(),
      },
    }).catch(() => { });

    const runSuffix = Date.now().toString().slice(-6);

    // 2. Create class adviser user
    adviserUserId = generateId();
    createdUserIds.push(adviserUserId);
    await prisma.user.create({
      data: {
        id: adviserUserId,
        school_id: `EMP-TEST-ADV-${runSuffix}`,
        email: `adviser.${runSuffix}@calulut.edu.ph`,
        first_name: 'Adviser',
        last_name: 'Teacher',
        status: 'active',
        must_change_password: false,
        password_hash: 'mock_hash',
      },
    });

    const teacherObj = await prisma.teacher.create({
      data: {
        id: generateId(),
        user_id: adviserUserId,
        employee_id: `EMP-TEST-ADV-${runSuffix}`,
      },
    });

    // Assign adviser to section
    await prisma.section.update({
      where: { id: sectionId },
      data: { adviser_teacher_id: teacherObj.id },
    }).catch(() => { });

    // 3. Create non-adviser teacher
    nonAdviserTeacherUserId = generateId();
    createdUserIds.push(nonAdviserTeacherUserId);
    await prisma.user.create({
      data: {
        id: nonAdviserTeacherUserId,
        school_id: `EMP-TEST-OTH-${runSuffix}`,
        email: `other.${runSuffix}@calulut.edu.ph`,
        first_name: 'Other',
        last_name: 'Teacher',
        status: 'active',
        must_change_password: false,
        password_hash: 'mock_hash',
      },
    });
    await prisma.teacher.create({
      data: {
        id: generateId(),
        user_id: nonAdviserTeacherUserId,
        employee_id: `EMP-TEST-OTH-${runSuffix}`,
      },
    });

    // 4. Create student caller
    studentCallerUserId = generateId();
    createdUserIds.push(studentCallerUserId);
    await prisma.user.create({
      data: {
        id: studentCallerUserId,
        school_id: `STU-CALLER-${runSuffix}`,
        email: `student.${runSuffix}@calulut.edu.ph`,
        first_name: 'Student',
        last_name: 'Caller',
        status: 'active',
        must_change_password: false,
        password_hash: 'mock_hash',
      },
    });

    worker = new GateNotificationWorker({
      emailProvider: mockEmail,
      clientPrisma: prisma,
      pollIntervalMs: 50,
      batchSize: 10,
      authorizationMode: 'PILOT_WHITELIST',
      authorizedRecipients: ['approved.pilot@calulut.edu.ph'],
    });
  });

  afterAll(async () => {
    // Clean up notifications
    if (createdStudentIds.length > 0) {
      await prisma.gateAttendanceNotification.deleteMany({
        where: { student_id: { in: createdStudentIds } },
      }).catch(() => { });

      await prisma.gateAttendance.deleteMany({
        where: { student_id: { in: createdStudentIds } },
      }).catch(() => { });

      await (prisma as any).$executeRawUnsafe(
        `DELETE FROM public.guardian_contact_authorizations WHERE student_id = ANY($1::text[])`,
        createdStudentIds
      ).catch(() => { });

      await prisma.student.deleteMany({
        where: { id: { in: createdStudentIds } },
      }).catch(() => { });
    }

    await prisma.section.update({
      where: { id: sectionId },
      data: { adviser_teacher_id: null },
    }).catch(() => { });

    await prisma.section.delete({
      where: { id: sectionId },
    }).catch(() => { });

    if (createdUserIds.length > 0) {
      await prisma.auditLog.deleteMany({
        where: { actor_user_id: { in: createdUserIds } },
      }).catch(() => { });

      await prisma.teacher.deleteMany({
        where: { user_id: { in: createdUserIds } },
      }).catch(() => { });

      await prisma.user.deleteMany({
        where: { id: { in: createdUserIds } },
      }).catch(() => { });
    }
  });

  // Scenario 1: School-confirmed guardian contact becomes AUTHORIZED through an auditable staff action
  it('Scenario 1: School-confirmed contact becomes AUTHORIZED through an auditable staff action', async () => {
    const student = await createTestStudent({
      lrn: '999026000101',
      firstName: 'Althea',
      lastName: 'Dizon',
      guardianFirst: 'Corazon',
      guardianLast: 'Dizon',
      guardianEmail: 'corazon.dizon@example.ph',
    });

    // Staff confirms through DepEd SF1 enrollment record
    const result = await GuardianAuthorizationService.authorizeManuallyByStaff(
      prisma,
      student.id,
      student.guardian_email!,
      adviserUserId,
      'DepEd SF1 Official Enrollment Verification',
      'SCHOOL_ENROLLMENT_CONFIRMED'
    );

    expect(result.success).toBe(true);
    expect(result.message).toContain('authorized by school personnel');

    // Verify record in database
    const records: any[] = await (prisma as any).$queryRawUnsafe(
      `SELECT status, verification_method, authorized_by_user_id, verified_at, authorized_at, revocation_reason 
       FROM public.guardian_contact_authorizations 
       WHERE student_id = $1 AND guardian_email = $2`,
      student.id,
      'corazon.dizon@example.ph'
    );

    expect(records.length).toBe(1);
    expect(records[0].status).toBe('AUTHORIZED');
    expect(records[0].verification_method).toBe('SCHOOL_ENROLLMENT_CONFIRMED');
    expect(records[0].authorized_by_user_id).toBe(adviserUserId);
    expect(records[0].revocation_reason).toBe('DepEd SF1 Official Enrollment Verification');
    expect(records[0].verified_at).not.toBeNull();
  });

  // Scenario 2: Valid OTP successfully authorizes the correct contact
  it('Scenario 2: Valid OTP successfully authorizes the correct contact', async () => {
    const student = await createTestStudent({
      lrn: '999026000102',
      firstName: 'Bea',
      lastName: 'Santos',
      guardianFirst: 'Danilo',
      guardianLast: 'Santos',
      guardianEmail: 'danilo.santos@example.ph',
    });

    const reg = await GuardianAuthorizationService.registerContact({
      studentId: student.id,
      guardianEmail: student.guardian_email!,
      guardianName: 'Danilo Santos',
      clientPrisma: prisma,
      autoAuthorizeForTesting: false,
    });

    expect(reg.status).toBe('PENDING_VERIFICATION');
    expect(reg.otp).toHaveLength(6);

    const verifyRes = await GuardianAuthorizationService.verifyWithOtp(
      prisma,
      student.id,
      student.guardian_email!,
      reg.otp
    );

    expect(verifyRes.success).toBe(true);
    expect(verifyRes.message).toContain('verified and authorized');

    const authCheck = await GuardianAuthorizationService.checkAuthorization(
      prisma,
      student.id,
      student.guardian_email!
    );
    expect(authCheck.authorized).toBe(true);
    expect(authCheck.status).toBe('AUTHORIZED');
  });

  // Scenario 3: Wrong OTP is rejected with remaining attempts counter
  it('Scenario 3: Wrong OTP is rejected with remaining attempts counter', async () => {
    const student = await createTestStudent({
      lrn: '999026000103',
      firstName: 'Carlo',
      lastName: 'Reyes',
      guardianFirst: 'Elena',
      guardianLast: 'Reyes',
      guardianEmail: 'elena.reyes@example.ph',
    });

    await GuardianAuthorizationService.registerContact({
      studentId: student.id,
      guardianEmail: student.guardian_email!,
      guardianName: 'Elena Reyes',
      clientPrisma: prisma,
      autoAuthorizeForTesting: false,
    });

    const wrongRes = await GuardianAuthorizationService.verifyWithOtp(
      prisma,
      student.id,
      student.guardian_email!,
      '999999'
    );

    expect(wrongRes.success).toBe(false);
    expect(wrongRes.message).toContain('Invalid or incorrect verification code');
    expect(wrongRes.attemptsRemaining).toBe(4);
  });

  // Scenario 4: Expired OTP is rejected
  it('Scenario 4: Expired OTP is rejected', async () => {
    const student = await createTestStudent({
      lrn: '999026000104',
      firstName: 'Dindo',
      lastName: 'Garcia',
      guardianFirst: 'Fely',
      guardianLast: 'Garcia',
      guardianEmail: 'fely.garcia@example.ph',
    });

    const reg = await GuardianAuthorizationService.registerContact({
      studentId: student.id,
      guardianEmail: student.guardian_email!,
      guardianName: 'Fely Garcia',
      clientPrisma: prisma,
      autoAuthorizeForTesting: false,
    });

    // Manually expire token in database
    await (prisma as any).$executeRawUnsafe(
      `UPDATE public.guardian_contact_authorizations 
       SET token_expires_at = NOW() - INTERVAL '1 minute' 
       WHERE student_id = $1`,
      student.id
    );

    const expiredRes = await GuardianAuthorizationService.verifyWithOtp(
      prisma,
      student.id,
      student.guardian_email!,
      reg.otp
    );

    expect(expiredRes.success).toBe(false);
    expect(expiredRes.message).toContain('expired');
  });

  // Scenario 5: OTP containing leading zeroes works properly
  it('Scenario 5: OTP containing leading zeroes works properly', async () => {
    const student = await createTestStudent({
      lrn: '999026000105',
      firstName: 'Eduardo',
      lastName: 'Cruz',
      guardianFirst: 'Gloria',
      guardianLast: 'Cruz',
      guardianEmail: 'gloria.cruz@example.ph',
    });

    await GuardianAuthorizationService.registerContact({
      studentId: student.id,
      guardianEmail: student.guardian_email!,
      guardianName: 'Gloria Cruz',
      clientPrisma: prisma,
      autoAuthorizeForTesting: false,
    });

    // Inject an OTP challenge with leading zeroes: "012345"
    const secret = process.env.OTP_HMAC_SECRET!;
    const salt = 'testsalt01234567';
    const otpWithLeadingZero = '012345';
    const hash = crypto.createHmac('sha256', secret).update(`${salt}:${otpWithLeadingZero}`).digest('hex');

    await (prisma as any).$executeRawUnsafe(
      `UPDATE public.guardian_contact_authorizations 
       SET salt = $1, verification_otp_hash = $2 
       WHERE student_id = $3`,
      salt,
      hash,
      student.id
    );

    const leadingZeroRes = await GuardianAuthorizationService.verifyWithOtp(
      prisma,
      student.id,
      student.guardian_email!,
      otpWithLeadingZero
    );

    expect(leadingZeroRes.success).toBe(true);
    expect(leadingZeroRes.message).toContain('verified and authorized');
  });

  // Scenario 6: Five failed attempts trigger lockout
  it('Scenario 6: Five failed attempts trigger lockout', async () => {
    const student = await createTestStudent({
      lrn: '999026000106',
      firstName: 'Francis',
      lastName: 'Navarro',
      guardianFirst: 'Hilda',
      guardianLast: 'Navarro',
      guardianEmail: 'hilda.navarro@example.ph',
    });

    await GuardianAuthorizationService.registerContact({
      studentId: student.id,
      guardianEmail: student.guardian_email!,
      guardianName: 'Hilda Navarro',
      clientPrisma: prisma,
      autoAuthorizeForTesting: false,
    });

    // Submit 5 wrong OTPs
    for (let i = 1; i <= 5; i++) {
      await GuardianAuthorizationService.verifyWithOtp(
        prisma,
        student.id,
        student.guardian_email!,
        `11111${i}`
      );
    }

    // 6th attempt should return lockout message
    const lockedRes = await GuardianAuthorizationService.verifyWithOtp(
      prisma,
      student.id,
      student.guardian_email!,
      '123456'
    );

    expect(lockedRes.success).toBe(false);
    expect(lockedRes.message).toContain('locked due to excessive failed attempts');

    // Verification OTP hash should be NULL
    const record: any[] = await (prisma as any).$queryRawUnsafe(
      `SELECT verification_otp_hash, failed_attempts 
       FROM public.guardian_contact_authorizations 
       WHERE student_id = $1`,
      student.id
    );
    expect(record[0].verification_otp_hash).toBeNull();
    expect(record[0].failed_attempts).toBeGreaterThanOrEqual(5);
  });

  // Scenario 7: Reused OTP is rejected
  it('Scenario 7: Reused OTP is rejected (single-use replay protection)', async () => {
    const student = await createTestStudent({
      lrn: '999026000107',
      firstName: 'Gerald',
      lastName: 'Aquino',
      guardianFirst: 'Imelda',
      guardianLast: 'Aquino',
      guardianEmail: 'imelda.aquino@example.ph',
    });

    const reg = await GuardianAuthorizationService.registerContact({
      studentId: student.id,
      guardianEmail: student.guardian_email!,
      guardianName: 'Imelda Aquino',
      clientPrisma: prisma,
      autoAuthorizeForTesting: false,
    });

    // First use
    const firstUse = await GuardianAuthorizationService.verifyWithOtp(
      prisma,
      student.id,
      student.guardian_email!,
      reg.otp
    );
    expect(firstUse.success).toBe(true);

    // Second use of same code
    const secondUse = await GuardianAuthorizationService.verifyWithOtp(
      prisma,
      student.id,
      student.guardian_email!,
      reg.otp
    );
    expect(secondUse.message).toContain('already verified and authorized');
  });

  // Scenario 8: Guardian email change invalidates previous address
  it('Scenario 8: Guardian email change invalidates previous address', async () => {
    const student = await createTestStudent({
      lrn: '999026000108',
      firstName: 'Hannah',
      lastName: 'Tolentino',
      guardianFirst: 'Jose',
      guardianLast: 'Tolentino',
      guardianEmail: 'jose.old@example.ph',
    });

    // Authorize initial address
    await GuardianAuthorizationService.authorizeManuallyByStaff(
      prisma,
      student.id,
      'jose.old@example.ph',
      adviserUserId,
      'Initial SF1',
      'SCHOOL_ENROLLMENT_CONFIRMED'
    );

    // Change email via updateLearnerPersonalInfo
    await updateLearnerPersonalInfo(
      student.id,
      { guardianEmail: 'jose.new@example.ph' },
      adviserUserId
    );

    // Verify old address is now REPLACED
    const oldRecords: any[] = await (prisma as any).$queryRawUnsafe(
      `SELECT status FROM public.guardian_contact_authorizations 
       WHERE student_id = $1 AND guardian_email = $2`,
      student.id,
      'jose.old@example.ph'
    );
    expect(oldRecords[0].status).toBe('REPLACED');

    // Verify new address is PENDING_VERIFICATION
    const newRecords: any[] = await (prisma as any).$queryRawUnsafe(
      `SELECT status FROM public.guardian_contact_authorizations 
       WHERE student_id = $1 AND guardian_email = $2`,
      student.id,
      'jose.new@example.ph'
    );
    expect(newRecords[0].status).toBe('PENDING_VERIFICATION');

    // Old address check fails closed
    const oldCheck = await GuardianAuthorizationService.checkAuthorization(
      prisma,
      student.id,
      'jose.old@example.ph'
    );
    expect(oldCheck.authorized).toBe(false);
  });

  // Scenario 9: Unrelated student profile update preserves existing authorization
  it('Scenario 9: Unrelated student profile update preserves existing authorization', async () => {
    const student = await createTestStudent({
      lrn: '999026000109',
      firstName: 'Ian',
      lastName: 'Villanueva',
      guardianFirst: 'Karla',
      guardianLast: 'Villanueva',
      guardianEmail: 'karla.villanueva@example.ph',
    });

    // Authorize contact
    await GuardianAuthorizationService.authorizeManuallyByStaff(
      prisma,
      student.id,
      'karla.villanueva@example.ph',
      adviserUserId,
      'DepEd SF1 Enrollment',
      'SCHOOL_ENROLLMENT_CONFIRMED'
    );

    // Update non-email demographics (allergies, blood type, street)
    await updateLearnerPersonalInfo(
      student.id,
      {
        bloodType: 'O+',
        allergies: 'Peanuts',
        street: '123 Macabulos St.',
      },
      adviserUserId
    );

    // Check authorization is still AUTHORIZED
    const authCheck = await GuardianAuthorizationService.checkAuthorization(
      prisma,
      student.id,
      'karla.villanueva@example.ph'
    );
    expect(authCheck.authorized).toBe(true);
    expect(authCheck.status).toBe('AUTHORIZED');
  });

  // Scenario 10: Unauthorized staff role or student cannot authorize contacts
  it('Scenario 10: Unauthorized staff role or student cannot authorize contacts', async () => {
    const student = await createTestStudent({
      lrn: '999026000110',
      firstName: 'Jenny',
      lastName: 'Manalo',
      guardianFirst: 'Luis',
      guardianLast: 'Manalo',
      guardianEmail: 'luis.manalo@example.ph',
    });

    // Test permission check with non-adviser teacher (must be rejected)
    await expect(verifyHealthEncodingPermission(student.id, nonAdviserTeacherUserId)).rejects.toThrow();

    // Test permission check with student (must be rejected)
    await expect(verifyHealthEncodingPermission(student.id, studentCallerUserId)).rejects.toThrow();
  });

  // Scenario 11: Pending guardian emails cannot receive attendance information (fail-closed)
  it('Scenario 11: Pending guardian emails cannot receive attendance information', async () => {
    mockEmail.clear();
    const student = await createTestStudent({
      lrn: '999026000111',
      firstName: 'Kevin',
      lastName: 'Mendoza',
      guardianFirst: 'Maria',
      guardianLast: 'Mendoza',
      guardianEmail: 'approved.pilot@calulut.edu.ph', // Whitelisted email, but UNVERIFIED in DB
    });

    // Register contact without authorizing (PENDING_VERIFICATION)
    await GuardianAuthorizationService.registerContact({
      studentId: student.id,
      guardianEmail: student.guardian_email!,
      guardianName: 'Maria Mendoza',
      clientPrisma: prisma,
      autoAuthorizeForTesting: false,
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

    await enqueueGateNotification({
      studentId: student.id,
      attendanceId: attId,
      eventType: 'TIME_IN',
      punctualityStatus: 'ON_TIME',
      clientPrisma: prisma,
      recipientMode: 'GUARDIAN_ONLY',
      authorizationMode: 'PILOT_WHITELIST',
      authorizedRecipients: ['approved.pilot@calulut.edu.ph'],
    });

    await worker.processBatch();

    // Outbox notification must be SKIPPED due to non-authorized status
    const notif = await prisma.gateAttendanceNotification.findFirst({
      where: { student_id: student.id },
    });
    expect(notif?.status).toBe('SKIPPED');
    expect(notif?.error_message).toContain('PENDING_VERIFICATION');
    expect(mockEmail.sentMessages.length).toBe(0);
  });

  // Scenario 12: School-confirmed and email-verified contacts are both eligible for notifications
  it('Scenario 12: School-confirmed and email-verified contacts are both eligible for notifications', async () => {
    mockEmail.clear();
    const student = await createTestStudent({
      lrn: '999026000112',
      firstName: 'Leo',
      lastName: 'Pangilinan',
      guardianFirst: 'Noel',
      guardianLast: 'Pangilinan',
      guardianEmail: 'approved.pilot@calulut.edu.ph',
    });

    // School confirm
    await GuardianAuthorizationService.authorizeManuallyByStaff(
      prisma,
      student.id,
      student.guardian_email!,
      adviserUserId,
      'DepEd SF1 Enrollment Record',
      'SCHOOL_ENROLLMENT_CONFIRMED'
    );

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

    await enqueueGateNotification({
      studentId: student.id,
      attendanceId: attId,
      eventType: 'TIME_IN',
      punctualityStatus: 'ON_TIME',
      clientPrisma: prisma,
      recipientMode: 'GUARDIAN_ONLY',
      authorizationMode: 'PILOT_WHITELIST',
      authorizedRecipients: ['approved.pilot@calulut.edu.ph'],
    });

    await worker.processBatch();

    const notif = await prisma.gateAttendanceNotification.findFirst({
      where: { student_id: student.id },
    });
    expect(['ACCEPTED', 'SENT']).toContain(notif?.status);
    expect(mockEmail.sentMessages.length).toBe(1);
  });

  // Scenario 13: Siblings retain independent student-specific authorization records
  it('Scenario 13: Siblings retain independent student-specific authorization records', async () => {
    const sharedGuardianEmail = 'shared.parent@example.ph';

    const siblingA = await createTestStudent({
      lrn: '999026000113',
      firstName: 'Maya',
      lastName: 'Castro',
      guardianFirst: 'Oscar',
      guardianLast: 'Castro',
      guardianEmail: sharedGuardianEmail,
    });

    const siblingB = await createTestStudent({
      lrn: '999026000114',
      firstName: 'Nico',
      lastName: 'Castro',
      guardianFirst: 'Oscar',
      guardianLast: 'Castro',
      guardianEmail: sharedGuardianEmail,
    });

    // Authorize sibling A only
    await GuardianAuthorizationService.authorizeManuallyByStaff(
      prisma,
      siblingA.id,
      sharedGuardianEmail,
      adviserUserId,
      'DepEd SF1 Enrollment',
      'SCHOOL_ENROLLMENT_CONFIRMED'
    );

    // Register sibling B without authorizing
    await GuardianAuthorizationService.registerContact({
      studentId: siblingB.id,
      guardianEmail: sharedGuardianEmail,
      guardianName: 'Oscar Castro',
      clientPrisma: prisma,
      autoAuthorizeForTesting: false,
    });

    const checkA = await GuardianAuthorizationService.checkAuthorization(prisma, siblingA.id, sharedGuardianEmail);
    const checkB = await GuardianAuthorizationService.checkAuthorization(prisma, siblingB.id, sharedGuardianEmail);

    expect(checkA.authorized).toBe(true);
    expect(checkA.status).toBe('AUTHORIZED');

    expect(checkB.authorized).toBe(false);
    expect(checkB.status).toBe('PENDING_VERIFICATION');
  });

  // Scenario 14: Direct email verification link (verifyWithToken) works and authorizes contact
  it('Scenario 14: Direct email verification link (verifyWithToken) works and authorizes contact', async () => {
    const student = await createTestStudent({
      lrn: '999026000115',
      firstName: 'Paula',
      lastName: 'David',
      guardianFirst: 'Quirino',
      guardianLast: 'David',
      guardianEmail: 'quirino.david@example.ph',
    });

    const reg = await GuardianAuthorizationService.registerContact({
      studentId: student.id,
      guardianEmail: student.guardian_email!,
      guardianName: 'Quirino David',
      clientPrisma: prisma,
      autoAuthorizeForTesting: false,
    });

    expect(reg.token).toBeDefined();

    // Simulate clicking email direct verification link
    const linkRes = await GuardianAuthorizationService.verifyWithToken(
      prisma,
      student.id,
      reg.token
    );

    expect(linkRes.success).toBe(true);
    expect(linkRes.message).toContain('verified and authorized');

    const check = await GuardianAuthorizationService.checkAuthorization(prisma, student.id, student.guardian_email!);
    expect(check.authorized).toBe(true);
    expect(check.status).toBe('AUTHORIZED');

    // Token should now be single-use and rejected on replay
    const replayRes = await GuardianAuthorizationService.verifyWithToken(
      prisma,
      student.id,
      reg.token
    );
    expect(replayRes.message).toContain('already verified and authorized');
  });

  // Scenario 15: updateLearnerPersonalInfo with confirmGuardianContact confirms and authorizes in one step
  it('Scenario 15: updateLearnerPersonalInfo with confirmGuardianContact confirms and authorizes in one step', async () => {
    const student = await createTestStudent({
      lrn: '999026000116',
      firstName: 'Ramon',
      lastName: 'Estrada',
      guardianFirst: 'Sonia',
      guardianLast: 'Estrada',
      guardianEmail: 'sonia.estrada@example.ph',
    });

    // Update with confirmGuardianContact = true
    await updateLearnerPersonalInfo(
      student.id,
      {
        guardianEmail: 'sonia.confirmed@example.ph',
        confirmGuardianContact: true,
        guardianConfirmationMethod: 'SCHOOL_ENROLLMENT_CONFIRMED',
        guardianConfirmationSource: 'DepEd SF1 Verified during registration',
      },
      adviserUserId
    );

    const check = await GuardianAuthorizationService.checkAuthorization(
      prisma,
      student.id,
      'sonia.confirmed@example.ph'
    );
    expect(check.authorized).toBe(true);
    expect(check.status).toBe('AUTHORIZED');

    const records: any[] = await (prisma as any).$queryRawUnsafe(
      `SELECT verification_method, revocation_reason FROM public.guardian_contact_authorizations 
       WHERE student_id = $1 AND guardian_email = $2`,
      student.id,
      'sonia.confirmed@example.ph'
    );
    expect(records[0].verification_method).toBe('SCHOOL_ENROLLMENT_CONFIRMED');
    expect(records[0].revocation_reason).toBe('DepEd SF1 Verified during registration');
  });
});
