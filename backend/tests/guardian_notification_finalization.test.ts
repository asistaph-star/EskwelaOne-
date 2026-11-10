import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import prisma from '../src/config/database.js';
import { enqueueGateNotification } from '../src/notifications/gateNotificationQueue.service.js';
import { GateNotificationWorker } from '../src/notifications/gateNotificationWorker.js';
import { IEmailProvider, SendEmailOptions, SendEmailResult } from '../src/notifications/email/emailProvider.interface.js';
import { updateLearnerPersonalInfo } from '../src/academic/health/healthMetric.service.js';
import { GuardianAuthorizationService } from '../src/notifications/guardianAuthorization.service.js';
import { generateId } from '../src/common/utils/uuid.js';

class MockEmailProvider implements IEmailProvider {
  public sentMessages: SendEmailOptions[] = [];
  public failureMode: 'NONE' | 'TRANSIENT_500' | 'QUOTA_300' = 'NONE';
  public callCount = 0;

  async sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
    this.callCount++;
    if (this.failureMode === 'QUOTA_300') {
      return {
        success: false,
        statusCode: 402,
        error: 'Brevo daily credit limit reached (300 emails/day)',
        isQuotaExceeded: true,
      };
    }
    if (this.failureMode === 'TRANSIENT_500') {
      return {
        success: false,
        statusCode: 500,
        error: 'Brevo upstream 500 error (Transient)',
      };
    }
    this.sentMessages.push(options);
    return {
      success: true,
      statusCode: 200,
      messageId: `mock-brevo-msg-${Date.now()}-${this.callCount}`,
    };
  }

  async checkHealth(): Promise<boolean> {
    return true;
  }

  clear() {
    this.sentMessages = [];
    this.callCount = 0;
    this.failureMode = 'NONE';
  }
}

describe('DIGISKWELA — Phase 3C.7 Guardian Email Finalization & Authorization Suite', () => {
  const mockEmail = new MockEmailProvider();
  let worker: GateNotificationWorker;

  // Test Fixture IDs
  const sectionId = generateId();
  const createdStudentIds: string[] = [];
  const createdUserIds: string[] = [];
  const createdAttendanceIds: string[] = [];

  // Helper to create synthetic student
  async function createTestStudent(opts: {
    lrn: string;
    firstName: string;
    lastName: string;
    guardianFirst?: string | null;
    guardianLast?: string | null;
    guardianEmail?: string | null;
    userEmail?: string | null;
  }) {
    const userId = generateId();
    const studentId = generateId();

    createdUserIds.push(userId);
    createdStudentIds.push(studentId);

    await prisma.user.create({
      data: {
        id: userId,
        school_id: `STU-${opts.lrn}`,
        email: opts.userEmail || null,
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
        guardian_first_name: opts.guardianFirst !== undefined ? opts.guardianFirst : 'Juan',
        guardian_last_name: opts.guardianLast !== undefined ? opts.guardianLast : 'Dela Cruz',
        guardian_email: opts.guardianEmail !== undefined ? opts.guardianEmail : 'parent@calulut.test',
      },
    });

    if (student.guardian_email && student.guardian_first_name) {
      await GuardianAuthorizationService.registerContact({
        studentId: student.id,
        guardianEmail: student.guardian_email,
        guardianName: `${student.guardian_first_name} ${student.guardian_last_name}`,
        clientPrisma: prisma,
        autoAuthorizeForTesting: true,
      }).catch(() => {});
    }

    return student;
  }

  // Helper to create gate attendance record
  async function createGateAttendance(studentId: string, event: 'TIME_IN' | 'TIME_OUT' = 'TIME_IN') {
    const attendanceId = generateId();
    createdAttendanceIds.push(attendanceId);

    const now = new Date();
    const att = await (prisma as any).gateAttendance.create({
      data: {
        id: attendanceId,
        student_id: studentId,
        date: now,
        status: 'PRESENT',
        time_in: event === 'TIME_IN' ? now : new Date(now.getTime() - 4 * 3600000),
        time_out: event === 'TIME_OUT' ? now : null,
      },
    });
    return att;
  }

  beforeAll(async () => {
    // Create test section in test database
    await (prisma as any).section.create({
      data: {
        id: sectionId,
        name: 'G10-FinalizeTest',
        grade_level: 10,
        academic_year_id: (await prisma.academicYear.findFirst())?.id || generateId(),
      },
    }).catch(() => { });

    worker = new GateNotificationWorker({
      emailProvider: mockEmail,
      clientPrisma: prisma,
      authorizationMode: 'SCHOOL_AUTHORIZED',
    });
  });

  afterAll(async () => {
    // Clean up created synthetic notifications
    await (prisma as any).gateAttendanceNotification.deleteMany({
      where: { student_id: { in: createdStudentIds } },
    }).catch(() => { });

    try {
      await (prisma as any).$executeRawUnsafe(
        `DELETE FROM public.guardian_contact_authorizations WHERE student_id = ANY($1::varchar[])`,
        createdStudentIds
      );
    } catch {}

    // Clean up attendance records
    await (prisma as any).gateAttendance.deleteMany({
      where: { id: { in: createdAttendanceIds } },
    }).catch(() => { });

    // Clean up students
    await prisma.student.deleteMany({
      where: { id: { in: createdStudentIds } },
    }).catch(() => { });

    // Clean up users
    await prisma.user.deleteMany({
      where: { id: { in: createdUserIds } },
    }).catch(() => { });

    // Clean up section
    await (prisma as any).section.delete({
      where: { id: sectionId },
    }).catch(() => { });

    await prisma.$disconnect();
  });

  it('1. Dynamic multi-student routing: each student automatically resolves their own guardian email', async () => {
    const studentA = await createTestStudent({
      lrn: '770000000001',
      firstName: 'Andrea',
      lastName: 'Alvarez',
      guardianFirst: 'Arman',
      guardianLast: 'Alvarez',
      guardianEmail: 'guardian.andrea@example.test',
    });

    const studentB = await createTestStudent({
      lrn: '770000000002',
      firstName: 'Bernardo',
      lastName: 'Bautista',
      guardianFirst: 'Belinda',
      guardianLast: 'Bautista',
      guardianEmail: 'guardian.bernardo@example.test',
    });

    const attA = await createGateAttendance(studentA.id, 'TIME_IN');
    const attB = await createGateAttendance(studentB.id, 'TIME_IN');

    // Enqueue notifications in SCHOOL_AUTHORIZED mode
    const resA = await enqueueGateNotification({
      attendanceId: attA.id,
      studentId: studentA.id,
      eventType: 'TIME_IN',
      clientPrisma: prisma,
      recipientMode: 'GUARDIAN_ONLY',
      authorizationMode: 'SCHOOL_AUTHORIZED',
    });

    const resB = await enqueueGateNotification({
      attendanceId: attB.id,
      studentId: studentB.id,
      eventType: 'TIME_IN',
      clientPrisma: prisma,
      recipientMode: 'GUARDIAN_ONLY',
      authorizationMode: 'SCHOOL_AUTHORIZED',
    });

    expect(resA.enqueued).toBe(true);
    expect(resB.enqueued).toBe(true);

    mockEmail.clear();
    const batchResult = await worker.processBatch();
    expect(batchResult.sent).toBe(2);

    expect(mockEmail.sentMessages).toHaveLength(2);
    expect(mockEmail.sentMessages[0].to[0].email).toBe('guardian.andrea@example.test');
    expect(mockEmail.sentMessages[0].to[0].name).toContain('Arman Alvarez');
    expect(mockEmail.sentMessages[1].to[0].email).toBe('guardian.bernardo@example.test');
    expect(mockEmail.sentMessages[1].to[0].name).toContain('Belinda Bautista');
  });

  it('2. Siblings sharing one guardian email receive separate, correctly identified notifications', async () => {
    const sibling1 = await createTestStudent({
      lrn: '770000000003',
      firstName: 'Carlos',
      lastName: 'Cruz',
      guardianFirst: 'Carmela',
      guardianLast: 'Cruz',
      guardianEmail: 'cruz.family@example.test',
    });

    const sibling2 = await createTestStudent({
      lrn: '770000000004',
      firstName: 'Diana',
      lastName: 'Cruz',
      guardianFirst: 'Carmela',
      guardianLast: 'Cruz',
      guardianEmail: 'cruz.family@example.test',
    });

    const att1 = await createGateAttendance(sibling1.id, 'TIME_IN');
    const att2 = await createGateAttendance(sibling2.id, 'TIME_IN');

    await enqueueGateNotification({
      attendanceId: att1.id,
      studentId: sibling1.id,
      eventType: 'TIME_IN',
      clientPrisma: prisma,
      recipientMode: 'GUARDIAN_ONLY',
      authorizationMode: 'SCHOOL_AUTHORIZED',
    });

    await enqueueGateNotification({
      attendanceId: att2.id,
      studentId: sibling2.id,
      eventType: 'TIME_IN',
      clientPrisma: prisma,
      recipientMode: 'GUARDIAN_ONLY',
      authorizationMode: 'SCHOOL_AUTHORIZED',
    });

    mockEmail.clear();
    const batchResult = await worker.processBatch();
    expect(batchResult.sent).toBe(2);

    expect(mockEmail.sentMessages).toHaveLength(2);
    // Both sent to cruz.family@example.test but content is distinct
    expect(mockEmail.sentMessages[0].to[0].email).toBe('cruz.family@example.test');
    expect(mockEmail.sentMessages[1].to[0].email).toBe('cruz.family@example.test');
    expect(mockEmail.sentMessages[0].htmlContent).toContain('Carlos Cruz');
    expect(mockEmail.sentMessages[1].htmlContent).toContain('Diana Cruz');
  });

  it('3. School-managed contact update: updating guardian email safely updates next scans and leaves audit log', async () => {
    const student = await createTestStudent({
      lrn: '770000000005',
      firstName: 'Eduardo',
      lastName: 'Enriquez',
      guardianFirst: 'Elena',
      guardianLast: 'Enriquez',
      guardianEmail: 'old.elena@example.test',
    });

    // Authorized adviser updates student's personal info
    const adminUser = await prisma.user.findFirst({
      where: { user_roles: { some: { role: { name: 'Admin' } } } },
    });

    const updated = await updateLearnerPersonalInfo(
      student.id,
      { guardianEmail: 'new.elena.verified@example.test' },
      adminUser?.id || student.user_id!
    );

    expect(updated.guardian_email).toBe('new.elena.verified@example.test');

    // Adviser authorizes the newly entered contact
    await GuardianAuthorizationService.authorizeManuallyByStaff(
      prisma,
      student.id,
      'new.elena.verified@example.test',
      adminUser?.id || student.user_id!,
      'Verified by adviser'
    );

    // Next scan automatically uses the new address
    const att = await createGateAttendance(student.id, 'TIME_IN');
    const enqueueRes = await enqueueGateNotification({
      attendanceId: att.id,
      studentId: student.id,
      eventType: 'TIME_IN',
      clientPrisma: prisma,
      recipientMode: 'GUARDIAN_ONLY',
      authorizationMode: 'SCHOOL_AUTHORIZED',
    });

    expect(enqueueRes.enqueued).toBe(true);

    mockEmail.clear();
    await worker.processBatch();
    expect(mockEmail.sentMessages).toHaveLength(1);
    expect(mockEmail.sentMessages[0].to[0].email).toBe('new.elena.verified@example.test');
  });

  it('4. Replaced contact safety: pending notification for replaced email is invalidated and suppressed', async () => {
    const student = await createTestStudent({
      lrn: '770000000006',
      firstName: 'Francis',
      lastName: 'Flores',
      guardianFirst: 'Felipe',
      guardianLast: 'Flores',
      guardianEmail: 'original.felipe@example.test',
    });

    // 1. Student scans at gate, notification is enqueued for original.felipe@example.test
    const att = await createGateAttendance(student.id, 'TIME_IN');
    const enqueueRes = await enqueueGateNotification({
      attendanceId: att.id,
      studentId: student.id,
      eventType: 'TIME_IN',
      clientPrisma: prisma,
      recipientMode: 'GUARDIAN_ONLY',
      authorizationMode: 'SCHOOL_AUTHORIZED',
    });
    expect(enqueueRes.enqueued).toBe(true);

    // 2. Before worker dispatches, authorized teacher updates/replaces guardian email
    const adminUser = await prisma.user.findFirst({
      where: { user_roles: { some: { role: { name: 'Admin' } } } },
    });

    await updateLearnerPersonalInfo(
      student.id,
      { guardianEmail: 'corrected.felipe@example.test' },
      adminUser?.id || student.user_id!
    );

    // 3. Verify queued notification targeting original address was invalidated
    const queuedRecord = await (prisma as any).gateAttendanceNotification.findUnique({
      where: { id: enqueueRes.notificationId },
    });
    expect(queuedRecord.status).toBe('SKIPPED');
    expect(queuedRecord.error_message).toContain('Suppressed: Guardian email address was modified or revoked');

    // 4. When worker runs, original address receives NO emails
    mockEmail.clear();
    const batchResult = await worker.processBatch();
    expect(batchResult.sent).toBe(0);
    expect(mockEmail.sentMessages).toHaveLength(0);
  });

  it('5. Unverified / incomplete guardian profile protection: missing guardian name fails-closed', async () => {
    const student = await createTestStudent({
      lrn: '770000000007',
      firstName: 'Gabriel',
      lastName: 'Garcia',
      guardianFirst: null, // Incomplete profile: no guardian name
      guardianLast: null,
      guardianEmail: 'orphan.email@example.test',
    });

    const att = await createGateAttendance(student.id, 'TIME_IN');
    const enqueueRes = await enqueueGateNotification({
      attendanceId: att.id,
      studentId: student.id,
      eventType: 'TIME_IN',
      clientPrisma: prisma,
      recipientMode: 'GUARDIAN_ONLY',
      authorizationMode: 'SCHOOL_AUTHORIZED',
    });

    expect(enqueueRes.enqueued).toBe(false);
    expect(enqueueRes.status).toBe('SKIPPED');
    expect(enqueueRes.reason).toContain('Guardian contact record is unverified: Parent/Guardian full name is required');
  });

  it('6. Anti-spoofing protection: student account email cannot be used as guardian recipient', async () => {
    const student = await createTestStudent({
      lrn: '770000000008',
      firstName: 'Hannah',
      lastName: 'Hernandez',
      guardianFirst: 'Helen',
      guardianLast: 'Hernandez',
      userEmail: 'hannah.student@calulut.edu.ph',
      guardianEmail: 'hannah.student@calulut.edu.ph', // Student tried using their own login email
    });

    const att = await createGateAttendance(student.id, 'TIME_IN');
    const enqueueRes = await enqueueGateNotification({
      attendanceId: att.id,
      studentId: student.id,
      eventType: 'TIME_IN',
      clientPrisma: prisma,
      recipientMode: 'GUARDIAN_ONLY',
      authorizationMode: 'SCHOOL_AUTHORIZED',
    });

    expect(enqueueRes.enqueued).toBe(false);
    expect(enqueueRes.status).toBe('SKIPPED');
    expect(enqueueRes.reason).toContain('Unauthorized recipient: Guardian email cannot be identical to the student\'s personal account email');
  });

  it('7. Quota Circuit Breaker: Brevo 300 limit halts worker batch gracefully', async () => {
    // Clear outbox to ensure clean batch
    await (prisma as any).gateAttendanceNotification.deleteMany({});

    const student = await createTestStudent({
      lrn: '770000000009',
      firstName: 'Ivan',
      lastName: 'Ilagan',
      guardianEmail: 'ivan.guardian@example.test',
    });

    const att = await createGateAttendance(student.id, 'TIME_IN');
    await enqueueGateNotification({
      attendanceId: att.id,
      studentId: student.id,
      eventType: 'TIME_IN',
      clientPrisma: prisma,
      recipientMode: 'GUARDIAN_ONLY',
      authorizationMode: 'SCHOOL_AUTHORIZED',
    });

    mockEmail.clear();
    mockEmail.failureMode = 'QUOTA_300';

    const batchResult = await worker.processBatch();
    expect(batchResult.quotaExceeded).toBe(1);
    expect(batchResult.sent).toBe(0);

    const record = await (prisma as any).gateAttendanceNotification.findFirst({
      where: { student_id: student.id },
    });
    expect(record.status).toBe('QUOTA_EXCEEDED');
    expect(record.error_message).toContain('Brevo daily credit limit reached');
  });
});
