import { describe, it, expect, beforeAll, afterAll } from 'vitest';
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
      messageId: `mock-brevo-int-${Date.now()}-${this.sentMessages.length}`,
    };
  }
  clear() {
    this.sentMessages = [];
  }
}

describe('DIGISKWELA — Phase 3C.9: Guardian Authorization End-to-End Workflow Integration', () => {
  const mockEmail = new MockEmailProvider();
  let worker: GateNotificationWorker;

  const sectionId = generateId();
  const createdStudentIds: string[] = [];
  const createdUserIds: string[] = [];
  const createdAttendanceIds: string[] = [];
  let adviserUserId: string;
  let student1: any;

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
    // Create an Admin user for simulating adviser/registrar updates
    adviserUserId = generateId();
    createdUserIds.push(adviserUserId);

    const adminRole = await prisma.role.findFirst({
      where: { name: 'Admin' },
    });

    await prisma.user.create({
      data: {
        id: adviserUserId,
        school_id: `ADV-${generateId().substring(0, 10)}`,
        email: `adviser.${generateId().substring(0, 6)}@cis.edu.ph`,
        first_name: 'Adviser',
        last_name: 'Teacher',
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
        name: 'G10-Phase3C9',
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

    await (prisma as any).gateAttendanceNotification.deleteMany({
      where: { student_id: { in: createdStudentIds } },
    }).catch(() => {});

    await (prisma as any).gateAttendance.deleteMany({
      where: { id: { in: createdAttendanceIds } },
    }).catch(() => {});

    await prisma.student.deleteMany({
      where: { id: { in: createdStudentIds } },
    }).catch(() => {});

    await (prisma as any).auditLog.deleteMany({
      where: { actor_user_id: adviserUserId },
    }).catch(() => {});

    await prisma.userRole.deleteMany({
      where: { user_id: adviserUserId },
    }).catch(() => {});

    await prisma.user.deleteMany({
      where: { id: { in: createdUserIds } },
    }).catch(() => {});

    await (prisma as any).section.delete({
      where: { id: sectionId },
    }).catch(() => {});

    await prisma.$disconnect();
  });

  it('Step 1 & 2: Adviser updates guardian email -> contact enters PENDING_VERIFICATION', async () => {
    student1 = await createTestStudent({
      lrn: `9900000000${Math.floor(Math.random() * 90 + 10)}`,
      firstName: 'Mateo',
      lastName: 'Montenegro',
    });

    // 1. Authorized adviser updates student personal info
    const updated = await updateLearnerPersonalInfo(
      student1.id,
      {
        guardianFirstName: 'Mercedes',
        guardianLastName: 'Montenegro',
        guardianEmail: 'mercedes.montenegro@calulut.test',
      },
      adviserUserId
    );

    expect(updated.guardian_email).toBe('mercedes.montenegro@calulut.test');

    // 2. Check that contact record was registered in PENDING_VERIFICATION
    const authStatus = await GuardianAuthorizationService.checkAuthorization(
      prisma,
      student1.id,
      'mercedes.montenegro@calulut.test'
    );

    expect(authStatus.authorized).toBe(false);
    expect(authStatus.status).toBe('PENDING_VERIFICATION');
  });

  it('Step 3: Gate scan occurs while PENDING_VERIFICATION -> fails closed as SKIPPED', async () => {
    const att = await createGateAttendance(student1.id);

    // Enqueue in SCHOOL_AUTHORIZED mode
    const enqResult = await enqueueGateNotification({
      attendanceId: att.id,
      studentId: student1.id,
      eventType: 'TIME_IN',
      clientPrisma: prisma,
      recipientMode: 'GUARDIAN_ONLY',
      authorizationMode: 'SCHOOL_AUTHORIZED',
    });

    expect(enqResult.enqueued).toBe(false);
    expect(enqResult.status).toBe('SKIPPED');
    expect(enqResult.reason).toContain('PENDING_VERIFICATION');

    // Worker dispatches 0 messages
    mockEmail.clear();
    const batch = await worker.processBatch();
    expect(batch.sent).toBe(0);
    expect(mockEmail.sentMessages).toHaveLength(0);
  });

  it('Step 4 & 5: Guardian verifies via OTP -> status transitions to AUTHORIZED', async () => {
    // Re-register or retrieve OTP challenge
    const challenge = await GuardianAuthorizationService.registerContact({
      studentId: student1.id,
      guardianEmail: 'mercedes.montenegro@calulut.test',
      guardianName: 'Mercedes Montenegro',
      clientPrisma: prisma,
      autoAuthorizeForTesting: false,
      skipCooldown: true,
    });

    expect(challenge.otp).toHaveLength(6);
    expect(challenge.verificationEmail.htmlContent).not.toContain('TIME_IN');
    expect(challenge.verificationEmail.htmlContent).not.toContain('PRESENT');
    expect(challenge.verificationEmail.htmlContent).not.toContain('timed in');

    // Guardian submits OTP
    const verifyResult = await GuardianAuthorizationService.verifyWithOtp(
      prisma,
      student1.id,
      'mercedes.montenegro@calulut.test',
      challenge.otp
    );

    expect(verifyResult.success).toBe(true);

    const check = await GuardianAuthorizationService.checkAuthorization(
      prisma,
      student1.id,
      'mercedes.montenegro@calulut.test'
    );
    expect(check.authorized).toBe(true);
    expect(check.status).toBe('AUTHORIZED');
  });

  it('Step 6: Subsequent scan after authorization -> automatically dispatches to guardian', async () => {
    // Clear previous attendance records and outbox for this student
    await (prisma as any).gateAttendanceNotification.deleteMany({
      where: { student_id: student1.id },
    });
    await (prisma as any).gateAttendance.deleteMany({
      where: { student_id: student1.id },
    });

    const att = await createGateAttendance(student1.id);

    const enqResult = await enqueueGateNotification({
      attendanceId: att.id,
      studentId: student1.id,
      eventType: 'TIME_IN',
      clientPrisma: prisma,
      recipientMode: 'GUARDIAN_ONLY',
      authorizationMode: 'SCHOOL_AUTHORIZED',
    });

    expect(enqResult.enqueued).toBe(true);
    expect(enqResult.status).toBe('PENDING');

    mockEmail.clear();
    const batch = await worker.processBatch();
    expect(batch.sent).toBe(1);
    expect(mockEmail.sentMessages).toHaveLength(1);
    expect(mockEmail.sentMessages[0].to[0].email).toBe('mercedes.montenegro@calulut.test');
    expect(mockEmail.sentMessages[0].htmlContent).toContain('Mateo Montenegro');
  });

  it('In-Person Authorization: Class Adviser authorizes guardian in-person', async () => {
    const student2 = await createTestStudent({
      lrn: `9900000000${Math.floor(Math.random() * 90 + 10)}`,
      firstName: 'Nina',
      lastName: 'Naval',
    });

    // Adviser updates contact
    await updateLearnerPersonalInfo(
      student2.id,
      {
        guardianFirstName: 'Nestor',
        guardianLastName: 'Naval',
        guardianEmail: 'nestor.naval@calulut.test',
      },
      adviserUserId
    );

    // Adviser performs in-person authorization
    const authResult = await GuardianAuthorizationService.authorizeManuallyByStaff(
      prisma,
      student2.id,
      'nestor.naval@calulut.test',
      adviserUserId,
      'Parent verified in-person with PSA birth certificate'
    );

    expect(authResult.success).toBe(true);

    const check = await GuardianAuthorizationService.checkAuthorization(
      prisma,
      student2.id,
      'nestor.naval@calulut.test'
    );
    expect(check.authorized).toBe(true);
    expect(check.status).toBe('AUTHORIZED');

    // Next scan succeeds immediately
    const att = await createGateAttendance(student2.id);
    const enq = await enqueueGateNotification({
      attendanceId: att.id,
      studentId: student2.id,
      eventType: 'TIME_IN',
      clientPrisma: prisma,
      recipientMode: 'GUARDIAN_ONLY',
      authorizationMode: 'SCHOOL_AUTHORIZED',
    });

    expect(enq.enqueued).toBe(true);

    mockEmail.clear();
    const batch = await worker.processBatch();
    expect(batch.sent).toBe(1);
    expect(mockEmail.sentMessages[0].to[0].email).toBe('nestor.naval@calulut.test');
  });
});
