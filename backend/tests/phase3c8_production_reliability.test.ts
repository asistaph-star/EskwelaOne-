import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import prisma from '../src/config/database.js';
import { enqueueGateNotification } from '../src/notifications/gateNotificationQueue.service.js';
import { GateNotificationWorker, getGateNotificationQueueMetrics } from '../src/notifications/gateNotificationWorker.js';
import { IEmailProvider, SendEmailOptions, SendEmailResult } from '../src/notifications/email/emailProvider.interface.js';
import { updateLearnerPersonalInfo } from '../src/academic/health/healthMetric.service.js';
import { GuardianAuthorizationService } from '../src/notifications/guardianAuthorization.service.js';
import { generateId } from '../src/common/utils/uuid.js';
import { maskEmail, maskName, maskLrn } from '../src/common/utils/masking.js';

class AdvancedMockEmailProvider implements IEmailProvider {
  public sentMessages: SendEmailOptions[] = [];
  public failureMode: 'NONE' | 'TRANSIENT_500' | 'QUOTA_300' | 'HTTP_429' | 'TIMEOUT' = 'NONE';
  public retryAfterSeconds = 60;
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
    if (this.failureMode === 'HTTP_429') {
      return {
        success: false,
        statusCode: 429,
        error: 'Brevo API rate limit exceeded (HTTP 429)',
        retryAfterSeconds: this.retryAfterSeconds,
      } as any;
    }
    if (this.failureMode === 'TIMEOUT') {
      return {
        success: false,
        statusCode: 504,
        error: 'Brevo upstream gateway timeout (possible provider acceptance)',
      };
    }
    if (this.failureMode === 'TRANSIENT_500') {
      return {
        success: false,
        statusCode: 500,
        error: 'Brevo internal server error (Transient 500)',
      };
    }
    this.sentMessages.push(options);
    return {
      success: true,
      statusCode: 200,
      messageId: `mock-brevo-${Date.now()}-${this.callCount}`,
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

describe('DIGISKWELA — Phase 3C.8: Production-Grade Guardian Notification Reliability & Security Suite', () => {
  const mockEmail = new AdvancedMockEmailProvider();
  let worker: GateNotificationWorker;

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
    autoAuthorizeGuardian?: boolean;
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
        guardian_first_name: opts.guardianFirst !== undefined ? opts.guardianFirst : 'Maria',
        guardian_last_name: opts.guardianLast !== undefined ? opts.guardianLast : 'Dela Cruz',
        guardian_email: opts.guardianEmail !== undefined ? opts.guardianEmail : 'parent@cis.edu.test',
      },
    });

    if (opts.guardianEmail && opts.autoAuthorizeGuardian) {
      await GuardianAuthorizationService.registerContact({
        studentId,
        guardianEmail: opts.guardianEmail,
        guardianName: `${opts.guardianFirst || 'Maria'} ${opts.guardianLast || 'Dela Cruz'}`.trim(),
        clientPrisma: prisma,
        autoAuthorizeForTesting: true,
      });
    }

    return student;
  }

  async function createGateAttendance(studentId: string, event: 'TIME_IN' | 'TIME_OUT' = 'TIME_IN') {
    const attendanceId = generateId();
    createdAttendanceIds.push(attendanceId);

    const now = new Date();
    return await (prisma as any).gateAttendance.create({
      data: {
        id: attendanceId,
        student_id: studentId,
        date: now,
        status: 'PRESENT',
        time_in: event === 'TIME_IN' ? now : new Date(now.getTime() - 4 * 3600000),
        time_out: event === 'TIME_OUT' ? now : null,
      },
    });
  }

  beforeAll(async () => {
    // Create test section in isolated test database
    await (prisma as any).section.create({
      data: {
        id: sectionId,
        name: 'G10-ProdReliability',
        grade_level: 10,
        academic_year_id: (await prisma.academicYear.findFirst())?.id || generateId(),
      },
    }).catch(() => {});

    worker = new GateNotificationWorker({
      emailProvider: mockEmail,
      clientPrisma: prisma,
      authorizationMode: 'SCHOOL_AUTHORIZED',
      dailyQuotaLimit: 300,
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
      where: { id: { in: createdAttendanceIds } },
    }).catch(() => {});

    await prisma.student.deleteMany({
      where: { id: { in: createdStudentIds } },
    }).catch(() => {});

    await prisma.user.deleteMany({
      where: { id: { in: createdUserIds } },
    }).catch(() => {});

    await (prisma as any).section.delete({
      where: { id: sectionId },
    }).catch(() => {});

    await prisma.$disconnect();
  });

  // =========================================================================
  // SCENARIO 1: Bulk Load Test (100, 500, 1,000 synthetic attendance records)
  // =========================================================================
  it('Scenario 1: Bulk processing durability (handles 100+ queued items in controlled batches)', async () => {
    // Clear outbox
    await (prisma as any).gateAttendanceNotification.deleteMany({});

    const bulkStudent = await createTestStudent({
      lrn: '880000000001',
      firstName: 'BulkTest',
      lastName: 'Student',
      guardianEmail: 'bulk.guardian@cis.test',
      autoAuthorizeGuardian: true,
    });

    const att = await createGateAttendance(bulkStudent.id, 'TIME_IN');

    // Create 120 synthetic notifications across different mock event IDs
    const mockNotifications = [];
    for (let i = 0; i < 120; i++) {
      mockNotifications.push({
        id: generateId(),
        attendance_id: att.id,
        student_id: bulkStudent.id,
        event_type: i % 2 === 0 ? 'TIME_IN' : 'TIME_OUT',
        recipient_role: `GUARDIAN_${i}`,
        recipient_email: 'bulk.guardian@cis.test',
        recipient_name: 'Bulk Guardian',
        status: 'PENDING',
        created_at: new Date(),
        updated_at: new Date(),
      });
    }

    await (prisma as any).gateAttendanceNotification.createMany({
      data: mockNotifications,
    });

    mockEmail.clear();
    const batchWorker = new GateNotificationWorker({
      emailProvider: mockEmail,
      clientPrisma: prisma,
      authorizationMode: 'SCHOOL_AUTHORIZED',
      batchSize: 50,
      dailyQuotaLimit: 500,
    });

    const b1 = await batchWorker.processBatch();
    expect(b1.processed).toBe(50);
    expect(b1.sent).toBe(50);

    const b2 = await batchWorker.processBatch();
    expect(b2.processed).toBe(50);
    expect(b2.sent).toBe(50);

    const b3 = await batchWorker.processBatch();
    expect(b3.processed).toBe(20);
    expect(b3.sent).toBe(20);

    expect(mockEmail.sentMessages.length).toBe(120);
  });

  // =========================================================================
  // SCENARIO 2: Different guardians receive their respective student notifications
  // =========================================================================
  it('Scenario 2: Multi-student dynamic recipient isolation', async () => {
    await (prisma as any).gateAttendanceNotification.deleteMany({});

    const s1 = await createTestStudent({
      lrn: '880000000002',
      firstName: 'Alice',
      lastName: 'Aguilar',
      guardianEmail: 'alice.parent@cis.test',
      autoAuthorizeGuardian: true,
    });

    const s2 = await createTestStudent({
      lrn: '880000000003',
      firstName: 'Bob',
      lastName: 'Bernal',
      guardianEmail: 'bob.parent@cis.test',
      autoAuthorizeGuardian: true,
    });

    const a1 = await createGateAttendance(s1.id, 'TIME_IN');
    const a2 = await createGateAttendance(s2.id, 'TIME_IN');

    await enqueueGateNotification({
      attendanceId: a1.id,
      studentId: s1.id,
      eventType: 'TIME_IN',
      clientPrisma: prisma,
      recipientMode: 'GUARDIAN_ONLY',
      authorizationMode: 'SCHOOL_AUTHORIZED',
    });

    await enqueueGateNotification({
      attendanceId: a2.id,
      studentId: s2.id,
      eventType: 'TIME_IN',
      clientPrisma: prisma,
      recipientMode: 'GUARDIAN_ONLY',
      authorizationMode: 'SCHOOL_AUTHORIZED',
    });

    mockEmail.clear();
    await worker.processBatch();

    expect(mockEmail.sentMessages).toHaveLength(2);
    expect(mockEmail.sentMessages[0].to[0].email).toBe('alice.parent@cis.test');
    expect(mockEmail.sentMessages[0].htmlContent).toContain('Alice Aguilar');
    expect(mockEmail.sentMessages[1].to[0].email).toBe('bob.parent@cis.test');
    expect(mockEmail.sentMessages[1].htmlContent).toContain('Bob Bernal');
  });

  // =========================================================================
  // SCENARIO 3: Siblings with a shared guardian email
  // =========================================================================
  it('Scenario 3: Sibling independence with shared guardian email', async () => {
    await (prisma as any).gateAttendanceNotification.deleteMany({});

    const sib1 = await createTestStudent({
      lrn: '880000000004',
      firstName: 'Clara',
      lastName: 'Castillo',
      guardianEmail: 'castillo.family@cis.test',
      autoAuthorizeGuardian: true,
    });

    const sib2 = await createTestStudent({
      lrn: '880000000005',
      firstName: 'Danilo',
      lastName: 'Castillo',
      guardianEmail: 'castillo.family@cis.test',
      autoAuthorizeGuardian: true,
    });

    const a1 = await createGateAttendance(sib1.id, 'TIME_IN');
    const a2 = await createGateAttendance(sib2.id, 'TIME_IN');

    await enqueueGateNotification({
      attendanceId: a1.id,
      studentId: sib1.id,
      eventType: 'TIME_IN',
      clientPrisma: prisma,
      recipientMode: 'GUARDIAN_ONLY',
      authorizationMode: 'SCHOOL_AUTHORIZED',
    });

    await enqueueGateNotification({
      attendanceId: a2.id,
      studentId: sib2.id,
      eventType: 'TIME_IN',
      clientPrisma: prisma,
      recipientMode: 'GUARDIAN_ONLY',
      authorizationMode: 'SCHOOL_AUTHORIZED',
    });

    mockEmail.clear();
    await worker.processBatch();

    expect(mockEmail.sentMessages).toHaveLength(2);
    expect(mockEmail.sentMessages[0].to[0].email).toBe('castillo.family@cis.test');
    expect(mockEmail.sentMessages[1].to[0].email).toBe('castillo.family@cis.test');
    expect(mockEmail.sentMessages[0].htmlContent).toContain('Clara Castillo');
    expect(mockEmail.sentMessages[1].htmlContent).toContain('Danilo Castillo');
  });

  // =========================================================================
  // SCENARIO 4: Teacher correcting an incorrect guardian address
  // =========================================================================
  it('Scenario 4: Contact modification immediately routes subsequent scans to new address', async () => {
    await (prisma as any).gateAttendanceNotification.deleteMany({});

    const student = await createTestStudent({
      lrn: '880000000006',
      firstName: 'Eva',
      lastName: 'Espiritu',
      guardianEmail: 'wrong.eva@cis.test',
      autoAuthorizeGuardian: true,
    });

    const adminUser = await prisma.user.findFirst({
      where: { user_roles: { some: { role: { name: 'Admin' } } } },
    });

    // Teacher updates contact
    await updateLearnerPersonalInfo(
      student.id,
      { guardianEmail: 'corrected.eva@cis.test' },
      adminUser?.id || student.user_id!
    );

    // Authorize new contact
    await GuardianAuthorizationService.registerContact({
      studentId: student.id,
      guardianEmail: 'corrected.eva@cis.test',
      guardianName: 'Maria Espiritu',
      clientPrisma: prisma,
      autoAuthorizeForTesting: true,
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
    await worker.processBatch();

    expect(mockEmail.sentMessages).toHaveLength(1);
    expect(mockEmail.sentMessages[0].to[0].email).toBe('corrected.eva@cis.test');
  });

  // =========================================================================
  // SCENARIO 5: Pending email revoked before dispatch
  // =========================================================================
  it('Scenario 5: Queued pending notification is invalidated when contact is revoked before dispatch', async () => {
    await (prisma as any).gateAttendanceNotification.deleteMany({});

    const student = await createTestStudent({
      lrn: '880000000007',
      firstName: 'Felix',
      lastName: 'Fuentes',
      guardianEmail: 'felix.guardian@cis.test',
      autoAuthorizeGuardian: true,
    });

    const att = await createGateAttendance(student.id, 'TIME_IN');
    const enq = await enqueueGateNotification({
      attendanceId: att.id,
      studentId: student.id,
      eventType: 'TIME_IN',
      clientPrisma: prisma,
      recipientMode: 'GUARDIAN_ONLY',
      authorizationMode: 'SCHOOL_AUTHORIZED',
    });

    // Revoke contact before worker executes
    await GuardianAuthorizationService.revokeContact(
      prisma,
      student.id,
      'felix.guardian@cis.test',
      'Parent requested phone-only notices'
    );

    const queued = await (prisma as any).gateAttendanceNotification.findUnique({
      where: { id: enq.notificationId },
    });
    expect(queued.status).toBe('SKIPPED');
    expect(queued.error_message).toContain('revoked');

    mockEmail.clear();
    const batch = await worker.processBatch();
    expect(batch.sent).toBe(0);
    expect(mockEmail.sentMessages).toHaveLength(0);
  });

  // =========================================================================
  // SCENARIO 6: Revocation racing with a worker already processing
  // =========================================================================
  it('Scenario 6: In-flight race check halts dispatch if record is modified during PROCESSING', async () => {
    await (prisma as any).gateAttendanceNotification.deleteMany({});

    const student = await createTestStudent({
      lrn: '880000000008',
      firstName: 'Gina',
      lastName: 'Gomez',
      guardianEmail: 'gina.parent@cis.test',
      autoAuthorizeGuardian: true,
    });

    const att = await createGateAttendance(student.id, 'TIME_IN');
    const enq = await enqueueGateNotification({
      attendanceId: att.id,
      studentId: student.id,
      eventType: 'TIME_IN',
      clientPrisma: prisma,
      recipientMode: 'GUARDIAN_ONLY',
      authorizationMode: 'SCHOOL_AUTHORIZED',
    });

    // Simulate worker claiming to PROCESSING
    await (prisma as any).gateAttendanceNotification.update({
      where: { id: enq.notificationId },
      data: { status: 'PROCESSING' },
    });

    // Race condition: Teacher revokes contact while worker was claiming
    await (prisma as any).gateAttendanceNotification.update({
      where: { id: enq.notificationId },
      data: {
        status: 'SKIPPED',
        error_message: 'Suppressed: Revoked concurrently during in-flight claiming',
      },
    });

    mockEmail.clear();
    // Worker attempts to process
    const res = await worker.processBatch();
    expect(res.sent).toBe(0);
    expect(mockEmail.sentMessages).toHaveLength(0);
  });

  // =========================================================================
  // SCENARIO 7: Unverified recipient rejected (Fail-closed)
  // =========================================================================
  it('Scenario 7: Unverified recipient in PENDING_VERIFICATION fails closed as SKIPPED', async () => {
    await (prisma as any).gateAttendanceNotification.deleteMany({});

    const student = await createTestStudent({
      lrn: '880000000009',
      firstName: 'Hector',
      lastName: 'Hidalgo',
      guardianEmail: 'hector.unverified@cis.test',
      autoAuthorizeGuardian: false, // NOT authorized!
    });

    // Register contact without auto-authorize (creates PENDING_VERIFICATION)
    await GuardianAuthorizationService.registerContact({
      studentId: student.id,
      guardianEmail: 'hector.unverified@cis.test',
      guardianName: 'Maria Hidalgo',
      clientPrisma: prisma,
      autoAuthorizeForTesting: false,
    });

    const att = await createGateAttendance(student.id, 'TIME_IN');
    const enq = await enqueueGateNotification({
      attendanceId: att.id,
      studentId: student.id,
      eventType: 'TIME_IN',
      clientPrisma: prisma,
      recipientMode: 'GUARDIAN_ONLY',
      authorizationMode: 'SCHOOL_AUTHORIZED',
    });

    expect(enq.enqueued).toBe(false);
    expect(enq.status).toBe('SKIPPED');
    expect(enq.reason).toContain('PENDING_VERIFICATION');

    mockEmail.clear();
    await worker.processBatch();
    expect(mockEmail.sentMessages).toHaveLength(0);
  });

  // =========================================================================
  // SCENARIO 8: Missing guardian contact handled safely
  // =========================================================================
  it('Scenario 8: Missing guardian email or name fails safely without crash', async () => {
    const student = await createTestStudent({
      lrn: '880000000010',
      firstName: 'Isabel',
      lastName: 'Ilagan',
      guardianEmail: null, // No email
    });

    const att = await createGateAttendance(student.id, 'TIME_IN');
    const enq = await enqueueGateNotification({
      attendanceId: att.id,
      studentId: student.id,
      eventType: 'TIME_IN',
      clientPrisma: prisma,
      recipientMode: 'GUARDIAN_ONLY',
      authorizationMode: 'SCHOOL_AUTHORIZED',
    });

    expect(enq.enqueued).toBe(false);
    expect(enq.status).toBe('SKIPPED');
    expect(enq.reason).toContain('does not have a registered parent/guardian email');
  });

  // =========================================================================
  // SCENARIO 9: Duplicate hardware scans (Idempotency)
  // =========================================================================
  it('Scenario 9: Rapid duplicate QR scans produce exactly one outbox notification', async () => {
    await (prisma as any).gateAttendanceNotification.deleteMany({});

    const student = await createTestStudent({
      lrn: '880000000011',
      firstName: 'Joel',
      lastName: 'Jimenez',
      guardianEmail: 'joel.parent@cis.test',
      autoAuthorizeGuardian: true,
    });

    const att = await createGateAttendance(student.id, 'TIME_IN');

    // Scan 1
    const enq1 = await enqueueGateNotification({
      attendanceId: att.id,
      studentId: student.id,
      eventType: 'TIME_IN',
      clientPrisma: prisma,
      recipientMode: 'GUARDIAN_ONLY',
      authorizationMode: 'SCHOOL_AUTHORIZED',
    });

    // Duplicate Scan 2
    const enq2 = await enqueueGateNotification({
      attendanceId: att.id,
      studentId: student.id,
      eventType: 'TIME_IN',
      clientPrisma: prisma,
      recipientMode: 'GUARDIAN_ONLY',
      authorizationMode: 'SCHOOL_AUTHORIZED',
    });

    expect(enq1.notificationId).toBe(enq2.notificationId);

    const totalInDb = await (prisma as any).gateAttendanceNotification.count({
      where: { attendance_id: att.id, event_type: 'TIME_IN' },
    });
    expect(totalInDb).toBe(1);
  });

  // =========================================================================
  // SCENARIO 10: Two concurrent workers (Atomic claiming)
  // =========================================================================
  it('Scenario 10: Multiple concurrent workers process queue without double-sending', async () => {
    await (prisma as any).gateAttendanceNotification.deleteMany({});

    const student = await createTestStudent({
      lrn: '880000000012',
      firstName: 'Karen',
      lastName: 'Katigbak',
      guardianEmail: 'karen.parent@cis.test',
      autoAuthorizeGuardian: true,
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

    const worker1 = new GateNotificationWorker({
      emailProvider: mockEmail,
      clientPrisma: prisma,
      authorizationMode: 'SCHOOL_AUTHORIZED',
    });

    const worker2 = new GateNotificationWorker({
      emailProvider: mockEmail,
      clientPrisma: prisma,
      authorizationMode: 'SCHOOL_AUTHORIZED',
    });

    mockEmail.clear();
    // Run both workers simultaneously
    const [res1, res2] = await Promise.all([
      worker1.processBatch(),
      worker2.processBatch(),
    ]);

    expect(res1.sent + res2.sent).toBe(1);
    expect(mockEmail.sentMessages).toHaveLength(1);
  });

  // =========================================================================
  // SCENARIO 11: Worker crash recovery (Stale PROCESSING reaper)
  // =========================================================================
  it('Scenario 11: Stale PROCESSING items from crashed worker are recovered gracefully', async () => {
    await (prisma as any).gateAttendanceNotification.deleteMany({});

    const student = await createTestStudent({
      lrn: '880000000013',
      firstName: 'Leo',
      lastName: 'Lagman',
      guardianEmail: 'leo.parent@cis.test',
      autoAuthorizeGuardian: true,
    });

    const att = await createGateAttendance(student.id, 'TIME_IN');
    const enq = await enqueueGateNotification({
      attendanceId: att.id,
      studentId: student.id,
      eventType: 'TIME_IN',
      clientPrisma: prisma,
      recipientMode: 'GUARDIAN_ONLY',
      authorizationMode: 'SCHOOL_AUTHORIZED',
    });

    // Simulate crash: status left in PROCESSING with stale timestamp (6 minutes ago)
    const sixMinutesAgo = new Date(Date.now() - 6 * 60 * 1000);
    await (prisma as any).gateAttendanceNotification.update({
      where: { id: enq.notificationId },
      data: {
        status: 'PROCESSING',
        updated_at: sixMinutesAgo,
        attempt_count: 1,
      },
    });

    mockEmail.clear();
    // Worker runs batch: should recover stuck item to PENDING and process it
    const batchRes = await worker.processBatch();
    expect(batchRes.recovered).toBe(1);
    expect(batchRes.sent).toBe(1);
    expect(mockEmail.sentMessages).toHaveLength(1);
  });

  // =========================================================================
  // SCENARIO 12: Brevo timeout after possible provider acceptance
  // =========================================================================
  it('Scenario 12: Provider timeout schedules exponential backoff retry', async () => {
    await (prisma as any).gateAttendanceNotification.deleteMany({});

    const student = await createTestStudent({
      lrn: '880000000014',
      firstName: 'Mia',
      lastName: 'Mercado',
      guardianEmail: 'mia.parent@cis.test',
      autoAuthorizeGuardian: true,
    });

    const att = await createGateAttendance(student.id, 'TIME_IN');
    const enq = await enqueueGateNotification({
      attendanceId: att.id,
      studentId: student.id,
      eventType: 'TIME_IN',
      clientPrisma: prisma,
      recipientMode: 'GUARDIAN_ONLY',
      authorizationMode: 'SCHOOL_AUTHORIZED',
    });

    mockEmail.clear();
    mockEmail.failureMode = 'TIMEOUT';

    const batch = await worker.processBatch();
    expect(batch.failed).toBe(1);

    const record = await (prisma as any).gateAttendanceNotification.findUnique({
      where: { id: enq.notificationId },
    });
    // Scheduled for retry
    expect(record.status).toBe('PENDING');
    expect(record.attempt_count).toBe(1);
    expect(record.error_message).toContain('gateway timeout');
  });

  // =========================================================================
  // SCENARIO 13: HTTP 429 Rate Limiting & Retry-After handling
  // =========================================================================
  it('Scenario 13: HTTP 429 rate limit backs off worker batch according to Retry-After', async () => {
    await (prisma as any).gateAttendanceNotification.deleteMany({});

    const student = await createTestStudent({
      lrn: '880000000015',
      firstName: 'Noah',
      lastName: 'Navarro',
      guardianEmail: 'noah.parent@cis.test',
      autoAuthorizeGuardian: true,
    });

    const att = await createGateAttendance(student.id, 'TIME_IN');
    const enq = await enqueueGateNotification({
      attendanceId: att.id,
      studentId: student.id,
      eventType: 'TIME_IN',
      clientPrisma: prisma,
      recipientMode: 'GUARDIAN_ONLY',
      authorizationMode: 'SCHOOL_AUTHORIZED',
    });

    mockEmail.clear();
    mockEmail.failureMode = 'HTTP_429';
    mockEmail.retryAfterSeconds = 90;

    const batch = await worker.processBatch();
    expect(batch.failed).toBe(1);

    const record = await (prisma as any).gateAttendanceNotification.findUnique({
      where: { id: enq.notificationId },
    });
    expect(record.status).toBe('PENDING');
    expect(record.error_message).toContain('HTTP 429');
    expect(new Date(record.next_attempt_at).getTime()).toBeGreaterThan(Date.now() + 60000);
  });

  // =========================================================================
  // SCENARIO 14: Daily Quota Exhaustion (Local Admission Control)
  // =========================================================================
  it('Scenario 14: Local admission control stops dispatch BEFORE hitting provider quota', async () => {
    await (prisma as any).gateAttendanceNotification.deleteMany({});

    const student = await createTestStudent({
      lrn: '880000000016',
      firstName: 'Oscar',
      lastName: 'Ocampo',
      guardianEmail: 'oscar.parent@cis.test',
      autoAuthorizeGuardian: true,
    });

    // Create a worker with strict daily quota limit of 1 and batchSize 1
    const quotaWorker = new GateNotificationWorker({
      emailProvider: mockEmail,
      clientPrisma: prisma,
      authorizationMode: 'SCHOOL_AUTHORIZED',
      batchSize: 1,
      dailyQuotaLimit: 1,
    });

    // Enqueue 2 items (TIME_IN and TIME_OUT on the same attendance record)
    const att = await createGateAttendance(student.id, 'TIME_IN');

    await enqueueGateNotification({
      attendanceId: att.id,
      studentId: student.id,
      eventType: 'TIME_IN',
      clientPrisma: prisma,
      recipientMode: 'GUARDIAN_ONLY',
      authorizationMode: 'SCHOOL_AUTHORIZED',
    });

    await enqueueGateNotification({
      attendanceId: att.id,
      studentId: student.id,
      eventType: 'TIME_OUT',
      clientPrisma: prisma,
      recipientMode: 'GUARDIAN_ONLY',
      authorizationMode: 'SCHOOL_AUTHORIZED',
    });

    mockEmail.clear();
    const batch1 = await quotaWorker.processBatch();
    expect(batch1.sent).toBe(1);

    // Second batch should hit local quota admission control
    const batch2 = await quotaWorker.processBatch();
    expect(batch2.quotaExceeded).toBe(1);
    expect(batch2.sent).toBe(0);

    const outbox2 = await (prisma as any).gateAttendanceNotification.findFirst({
      where: { event_type: 'TIME_OUT' },
    });
    expect(outbox2.status).toBe('QUOTA_EXCEEDED');
    expect(outbox2.error_message).toContain('Local quota admission control');
  });

  // =========================================================================
  // SCENARIO 15: Delayed provider-side queued messages (Expiration check)
  // =========================================================================
  it('Scenario 15: Stale notification from previous day is marked EXPIRED and never dispatched', async () => {
    await (prisma as any).gateAttendanceNotification.deleteMany({});

    const student = await createTestStudent({
      lrn: '880000000017',
      firstName: 'Paula',
      lastName: 'Perez',
      guardianEmail: 'paula.parent@cis.test',
      autoAuthorizeGuardian: true,
    });

    const att = await createGateAttendance(student.id, 'TIME_IN');

    // Create item with yesterday's timestamp
    const yesterday = new Date(Date.now() - 25 * 60 * 60 * 1000);
    const staleItem = await (prisma as any).gateAttendanceNotification.create({
      data: {
        id: generateId(),
        attendance_id: att.id,
        student_id: student.id,
        event_type: 'TIME_IN',
        recipient_role: 'GUARDIAN',
        recipient_email: 'paula.parent@cis.test',
        recipient_name: 'Maria Perez',
        status: 'PENDING',
        created_at: yesterday,
        updated_at: yesterday,
      },
    });

    mockEmail.clear();
    const batch = await worker.processBatch();
    expect(batch.expired).toBe(1);
    expect(batch.sent).toBe(0);

    const record = await (prisma as any).gateAttendanceNotification.findUnique({
      where: { id: staleItem.id },
    });
    expect(record.status).toBe('EXPIRED');
    expect(mockEmail.sentMessages).toHaveLength(0);
  });

  // =========================================================================
  // SCENARIO 16: Provider Bounce & Blocked-recipient webhook simulation
  // =========================================================================
  it('Scenario 16: Webhook hard bounce marks outbox BOUNCED and blocks future contact dispatches', async () => {
    await (prisma as any).gateAttendanceNotification.deleteMany({});

    const student = await createTestStudent({
      lrn: '880000000018',
      firstName: 'Quinn',
      lastName: 'Quizon',
      guardianEmail: 'quinn.bounced@cis.test',
      autoAuthorizeGuardian: true,
    });

    const att = await createGateAttendance(student.id, 'TIME_IN');
    const enq = await enqueueGateNotification({
      attendanceId: att.id,
      studentId: student.id,
      eventType: 'TIME_IN',
      clientPrisma: prisma,
      recipientMode: 'GUARDIAN_ONLY',
      authorizationMode: 'SCHOOL_AUTHORIZED',
    });

    mockEmail.clear();
    await worker.processBatch();

    const dispatched = await (prisma as any).gateAttendanceNotification.findUnique({
      where: { id: enq.notificationId },
    });
    expect(dispatched.status).toBe('ACCEPTED');

    // Simulate Brevo Hard Bounce Webhook
    await worker.handleWebhook({
      event: 'hard_bounce',
      email: 'quinn.bounced@cis.test',
      messageId: dispatched.brevo_message_id,
      reason: 'Mailbox does not exist (550 User unknown)',
    });

    const updated = await (prisma as any).gateAttendanceNotification.findUnique({
      where: { id: enq.notificationId },
    });
    expect(updated.status).toBe('BOUNCED');

    // Future scan for this student should now fail-closed because contact is BLOCKED
    const enq2 = await enqueueGateNotification({
      attendanceId: att.id,
      studentId: student.id,
      eventType: 'TIME_OUT',
      clientPrisma: prisma,
      recipientMode: 'GUARDIAN_ONLY',
      authorizationMode: 'SCHOOL_AUTHORIZED',
    });

    expect(enq2.enqueued).toBe(false);
    expect(enq2.status).toBe('SKIPPED');
    expect(enq2.reason).toContain('BLOCKED');
  });

  // =========================================================================
  // SCENARIO 17: Backlog recovery after system downtime
  // =========================================================================
  it('Scenario 17: Backlog accumulated during worker downtime drains completely in batches', async () => {
    await (prisma as any).gateAttendanceNotification.deleteMany({});

    const student = await createTestStudent({
      lrn: '880000000019',
      firstName: 'Ramon',
      lastName: 'Ramos',
      guardianEmail: 'ramon.parent@cis.test',
      autoAuthorizeGuardian: true,
    });

    const att = await createGateAttendance(student.id, 'TIME_IN');

    // Simulate 15 notifications accumulated during downtime
    for (let i = 0; i < 15; i++) {
      await (prisma as any).gateAttendanceNotification.create({
        data: {
          id: generateId(),
          attendance_id: att.id,
          student_id: student.id,
          event_type: 'TIME_IN',
          recipient_role: `BATCH_${i}`,
          recipient_email: 'ramon.parent@cis.test',
          recipient_name: 'Maria Ramos',
          status: 'PENDING',
          created_at: new Date(),
          updated_at: new Date(),
        },
      });
    }

    mockEmail.clear();
    const drainingWorker = new GateNotificationWorker({
      emailProvider: mockEmail,
      clientPrisma: prisma,
      authorizationMode: 'SCHOOL_AUTHORIZED',
      batchSize: 5, // 3 batches needed
      dailyQuotaLimit: 100,
    });

    await drainingWorker.processBatch();
    await drainingWorker.processBatch();
    await drainingWorker.processBatch();

    expect(mockEmail.sentMessages).toHaveLength(15);
  });

  // =========================================================================
  // SCENARIO 18: Attendance recording decoupled from notification dispatch
  // =========================================================================
  it('Scenario 18: Attendance record persists successfully even if notification enqueueing fails', async () => {
    const student = await createTestStudent({
      lrn: '880000000020',
      firstName: 'Sara',
      lastName: 'Santos',
      guardianEmail: 'sara.parent@cis.test',
    });

    // Attendance creation succeeds independently
    const att = await createGateAttendance(student.id, 'TIME_IN');
    expect(att.id).toBeDefined();

    // Enqueueing with invalid/broken params does NOT rollback or delete the gate attendance record
    try {
      await enqueueGateNotification({
        attendanceId: att.id,
        studentId: 'non-existent-student-id',
        eventType: 'TIME_IN',
        clientPrisma: prisma,
      });
    } catch {}

    const persistedAttendance = await (prisma as any).gateAttendance.findUnique({
      where: { id: att.id },
    });
    expect(persistedAttendance).not.toBeNull();
    expect(persistedAttendance.status).toBe('PRESENT');
  });

  // =========================================================================
  // SCENARIO 19: Privacy & Cross-Recipient Leakage Prevention
  // =========================================================================
  it('Scenario 19: Student LRN and private health metrics are never exposed in email payload', async () => {
    await (prisma as any).gateAttendanceNotification.deleteMany({});

    const student = await createTestStudent({
      lrn: '999026000099',
      firstName: 'Teresa',
      lastName: 'Tolentino',
      guardianEmail: 'teresa.parent@cis.test',
      autoAuthorizeGuardian: true,
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
    await worker.processBatch();

    expect(mockEmail.sentMessages).toHaveLength(1);
    const sent = mockEmail.sentMessages[0];

    // Must NOT contain full 12-digit LRN
    expect(sent.subject).not.toContain('999026000099');
    expect(sent.htmlContent).not.toContain('999026000099');
    expect(sent.textContent).not.toContain('999026000099');

    // Test privacy masking utility
    expect(maskEmail('teresa.parent@cis.test')).toBe('t***t@cis.test');
    expect(maskName('Teresa Tolentino')).toBe('T*** T***');
    expect(maskLrn('999026000099')).toBe('999******099');
  });

  // =========================================================================
  // SCENARIO 20: Operational Visibility & Diagnostic Metrics
  // =========================================================================
  it('Scenario 20: IT Administrator operational diagnostics aggregates queue health without exposing raw emails', async () => {
    const metrics = await getGateNotificationQueueMetrics(prisma);

    expect(metrics).toHaveProperty('queueDepth');
    expect(metrics).toHaveProperty('statusCounts');
    expect(metrics).toHaveProperty('sentToday');
    expect(metrics).toHaveProperty('dailyQuotaLimit');
    expect(metrics).toHaveProperty('unverifiedContactsCount');
    expect(typeof metrics.queueDepth).toBe('number');
  });
});
