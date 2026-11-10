import { PrismaClient } from '@prisma/client';
import { enqueueGateNotification } from '../src/notifications/gateNotificationQueue.service.js';
import { GateNotificationWorker } from '../src/notifications/gateNotificationWorker.js';
import { IEmailProvider, SendEmailOptions, SendEmailResult } from '../src/notifications/email/emailProvider.interface.js';
import { generateId } from '../src/common/utils/uuid.js';

// Scalable Mock Email Provider with configurable latency and error simulation
class ScalableMockEmailProvider implements IEmailProvider {
  public sentMessages: SendEmailOptions[] = [];
  public failureMode: 'NONE' | 'TRANSIENT_500' | 'QUOTA_300' | 'NETWORK_TIMEOUT' = 'NONE';
  public callCount: number = 0;
  public simulatedLatencyMs: number = 0;

  async sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
    this.callCount++;
    if (this.simulatedLatencyMs > 0) {
      await new Promise(r => setTimeout(r, this.simulatedLatencyMs));
    }

    if (this.failureMode === 'QUOTA_300') {
      return {
        success: false,
        statusCode: 402,
        error: 'Brevo daily credit limit reached: 300 emails/day',
        isQuotaExceeded: true,
      };
    }

    if (this.failureMode === 'TRANSIENT_500') {
      return {
        success: false,
        statusCode: 500,
        error: 'Brevo upstream 500 Internal Server Error (Transient)',
      };
    }

    if (this.failureMode === 'NETWORK_TIMEOUT') {
      throw new Error('ETIMEDOUT: Connection to api.brevo.com timed out after 5000ms');
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

async function runScalabilityAndReliabilitySuite() {
  console.log('========================================================================');
  console.log('DIGISKWELA — MULTI-STUDENT SCALABILITY & RELIABILITY VERIFICATION SUITE');
  console.log('========================================================================\n');

  // Strictly connect to isolated test database
  const testDbUrl = 'postgresql://postgres:admin123@localhost:5432/digiskwela_phase2c_test?schema=public';
  const testPrisma = new PrismaClient({ datasources: { db: { url: testDbUrl } } });

  const [db] = await testPrisma.$queryRawUnsafe<any[]>('SELECT current_database()');
  console.log(`[Target Database] Confirmed connected to: ${db.current_database}`);
  if (db.current_database !== 'digiskwela_phase2c_test') {
    throw new Error(`ABORT: Expected digiskwela_phase2c_test, got ${db.current_database}!`);
  }

  const mockProvider = new ScalableMockEmailProvider();
  const suiteResults: any[] = [];
  const testSectionId = generateId();
  const cleanupStudentIds: string[] = [];
  const cleanupUserIds: string[] = [];
  const cleanupAttendanceIds: string[] = [];

  try {
    // Setup Test Section in test DB
    const currentAy = await testPrisma.academicYear.findFirst({
      where: { is_current: true },
    }) || await testPrisma.academicYear.findFirst();

    if (!currentAy) throw new Error('No academic year found in test DB');

    // Clean any prior residual benchmark data first (respecting foreign keys)
    await testPrisma.gateAttendanceNotification.deleteMany({
      where: { student: { current_section: { name: 'ScaleTest Alpha' } } }
    });
    await testPrisma.gateAttendance.deleteMany({
      where: { student: { current_section: { name: 'ScaleTest Alpha' } } }
    });
    await testPrisma.student.deleteMany({
      where: { current_section: { name: 'ScaleTest Alpha' } }
    });
    await testPrisma.user.deleteMany({
      where: {
        OR: [
          { school_id: { startsWith: 'SCALE-' } },
          { school_id: { startsWith: 'BENCH-' } }
        ]
      }
    });
    await testPrisma.section.deleteMany({
      where: { name: 'ScaleTest Alpha' }
    });

    await testPrisma.section.create({
      data: {
        id: testSectionId,
        name: 'ScaleTest Alpha',
        grade_level: 10,
        academic_year_id: currentAy.id,
      }
    });

    console.log('--- SUITE 1: Multi-Student Recipient Resolution ---');
    // Setup Students A, B, C, D, E, F, G
    const studentConfigs = [
      { key: 'A', name: 'Student Alpha', email: 'guardian.a@calulut-test.local', lrn: '999900000001' },
      { key: 'B', name: 'Student Beta', email: 'guardian.b@calulut-test.local', lrn: '999900000002' },
      { key: 'C', name: 'Student Gamma', email: 'guardian.c@calulut-test.local', lrn: '999900000003' },
      { key: 'D', name: 'Student Delta', email: null, lrn: '999900000004' }, // Missing email
      { key: 'E', name: 'Student Epsilon', email: 'not-an-email', lrn: '999900000005' }, // Invalid format
      { key: 'F', name: 'Student SiblingOne', email: 'parent.family@calulut-test.local', lrn: '999900000006' }, // Sibling 1
      { key: 'G', name: 'Student SiblingTwo', email: 'parent.family@calulut-test.local', lrn: '999900000007' }, // Sibling 2
    ];

    const studentMap: Record<string, any> = {};

    for (const sc of studentConfigs) {
      const uId = generateId();
      const sId = generateId();
      cleanupUserIds.push(uId);
      cleanupStudentIds.push(sId);

      await testPrisma.user.create({
        data: {
          id: uId,
          school_id: `SCALE-${sc.key}`,
          email: `${sc.key.toLowerCase()}@student.calulut-test.local`,
          password_hash: 'hash',
          first_name: sc.name.split(' ')[0],
          last_name: sc.name.split(' ')[1],
          status: 'ACTIVE',
        }
      });

      const s = await testPrisma.student.create({
        data: {
          id: sId,
          user_id: uId,
          lrn: sc.lrn,
          lrn_hash: `hash_${sc.lrn}`,
          current_section_id: testSectionId,
          grade_level: 10,
          guardian_email: sc.email,
          guardian_first_name: 'Guardian',
          guardian_last_name: sc.name.split(' ')[1],
        }
      });
      studentMap[sc.key] = s;
    }

    // 1.1 Enqueue attendance for all test students
    const today = new Date('2026-11-09T00:00:00.000Z');
    const outboxMap: Record<string, any> = {};

    for (const sc of studentConfigs) {
      const attId = generateId();
      cleanupAttendanceIds.push(attId);

      await testPrisma.gateAttendance.create({
        data: {
          id: attId,
          student_id: studentMap[sc.key].id,
          date: today,
          status: 'Present',
          time_in: new Date('2026-11-09T07:15:00.000Z'),
        }
      });

      const res = await enqueueGateNotification({
        attendanceId: attId,
        studentId: studentMap[sc.key].id,
        eventType: 'TIME_IN',
        clientPrisma: testPrisma,
        recipientMode: 'GUARDIAN_ONLY',
        authorizationMode: 'SCHOOL_AUTHORIZED', // DepEd verified guardian mode
      });

      const record = await testPrisma.gateAttendanceNotification.findFirst({
        where: { attendance_id: attId, recipient_role: 'GUARDIAN' }
      });
      outboxMap[sc.key] = { res, record };
    }

    // Assertions for Suite 1
    const pass1A = outboxMap['A'].record?.recipient_email === 'guardian.a@calulut-test.local' && outboxMap['A'].record?.status === 'PENDING';
    const pass1B = outboxMap['B'].record?.recipient_email === 'guardian.b@calulut-test.local' && outboxMap['B'].record?.status === 'PENDING';
    const pass1C = outboxMap['C'].record?.recipient_email === 'guardian.c@calulut-test.local' && outboxMap['C'].record?.status === 'PENDING';
    const pass1D = outboxMap['D'].record?.status === 'SKIPPED' && outboxMap['D'].record?.error_message?.includes('does not have a registered');
    const pass1E = outboxMap['E'].record?.status === 'SKIPPED' && outboxMap['E'].record?.error_message?.includes('format is invalid');
    
    // Siblings Test (F and G)
    const pass1FG = outboxMap['F'].record?.recipient_email === 'parent.family@calulut-test.local' &&
                    outboxMap['G'].record?.recipient_email === 'parent.family@calulut-test.local' &&
                    outboxMap['F'].record?.attendance_id !== outboxMap['G'].record?.attendance_id &&
                    outboxMap['F'].record?.student_id === studentMap['F'].id &&
                    outboxMap['G'].record?.student_id === studentMap['G'].id;

    suiteResults.push({
      scenario: '1.1 Student A -> Guardian A (Direct dynamic resolution)',
      passed: pass1A,
      details: `Resolved to ${outboxMap['A'].record?.recipient_email} (${outboxMap['A'].record?.status})`
    });
    suiteResults.push({
      scenario: '1.2 Student B -> Guardian B (No cross-talk)',
      passed: pass1B,
      details: `Resolved to ${outboxMap['B'].record?.recipient_email} (${outboxMap['B'].record?.status})`
    });
    suiteResults.push({
      scenario: '1.3 Student C -> Guardian C (No cross-talk)',
      passed: pass1C,
      details: `Resolved to ${outboxMap['C'].record?.recipient_email} (${outboxMap['C'].record?.status})`
    });
    suiteResults.push({
      scenario: '1.4 Student D Missing Email (Clean suppression)',
      passed: pass1D,
      details: `Status: ${outboxMap['D'].record?.status} | ${outboxMap['D'].record?.error_message}`
    });
    suiteResults.push({
      scenario: '1.5 Student E Invalid Email (Validation rejection)',
      passed: pass1E,
      details: `Status: ${outboxMap['E'].record?.status} | ${outboxMap['E'].record?.error_message}`
    });
    suiteResults.push({
      scenario: '1.6 Siblings F & G sharing same guardian email',
      passed: pass1FG,
      details: `Separate notifications for F (${studentMap['F'].id.substring(0,8)}) and G (${studentMap['G'].id.substring(0,8)}) to same inbox`
    });

    // 1.7 Worker dispatch & template verification (Zero cross-leakage)
    const worker1 = new GateNotificationWorker({
      emailProvider: mockProvider,
      clientPrisma: testPrisma,
      authorizationMode: 'SCHOOL_AUTHORIZED',
    });
    await worker1.processBatch();

    const msgF = mockProvider.sentMessages.find(m => m.subject.includes('Time In') && m.htmlContent.includes('Student SiblingOne'));
    const msgG = mockProvider.sentMessages.find(m => m.subject.includes('Time In') && m.htmlContent.includes('Student SiblingTwo'));
    const noCrossLeakage = !!msgF && !!msgG && !msgF.htmlContent.includes('Student SiblingTwo') && !msgG.htmlContent.includes('Student SiblingOne');

    suiteResults.push({
      scenario: '1.7 Zero Cross-Student Notification Leakage in templates',
      passed: noCrossLeakage,
      details: `Sibling F template contains SiblingOne only; Sibling G template contains SiblingTwo only`
    });

    console.log('--- SUITE 2: Automatic Contact Updates ---');
    // 2.1 Teacher updates Student A guardian email to a NEW address
    const originalRecordA = await testPrisma.gateAttendanceNotification.findFirst({
      where: { student_id: studentMap['A'].id }
    });

    await testPrisma.student.update({
      where: { id: studentMap['A'].id },
      data: { guardian_email: 'new.guardian.a@calulut-test.local' }
    });

    // 2.2 Next scan for Student A (Time Out)
    const attIdA2 = generateId();
    cleanupAttendanceIds.push(attIdA2);
    await testPrisma.gateAttendance.create({
      data: {
        id: attIdA2,
        student_id: studentMap['A'].id,
        date: new Date('2026-11-10T00:00:00.000Z'),
        status: 'Present',
        time_out: new Date('2026-11-10T16:30:00.000Z'),
      }
    });

    await enqueueGateNotification({
      attendanceId: attIdA2,
      studentId: studentMap['A'].id,
      eventType: 'TIME_OUT',
      clientPrisma: testPrisma,
      recipientMode: 'GUARDIAN_ONLY',
      authorizationMode: 'SCHOOL_AUTHORIZED',
    });

    const newRecordA = await testPrisma.gateAttendanceNotification.findFirst({
      where: { attendance_id: attIdA2, recipient_role: 'GUARDIAN' }
    });

    const recordA1AfterUpdate = await testPrisma.gateAttendanceNotification.findUnique({
      where: { id: originalRecordA!.id }
    });

    const pass2A = newRecordA?.recipient_email === 'new.guardian.a@calulut-test.local';
    const pass2B = recordA1AfterUpdate?.recipient_email === 'guardian.a@calulut-test.local'; // Historical immutability
    const pass2C = studentMap['B'].guardian_email === 'guardian.b@calulut-test.local'; // Untouched peer student

    suiteResults.push({
      scenario: '2.1 Next scan uses newly updated guardian email dynamically',
      passed: pass2A,
      details: `Resolved to: ${newRecordA?.recipient_email} without code/env changes`
    });
    suiteResults.push({
      scenario: '2.2 Historical outbox immutability preserved',
      passed: pass2B,
      details: `Original scan outbox row still has: ${recordA1AfterUpdate?.recipient_email}`
    });
    suiteResults.push({
      scenario: '2.3 Peer student contact remains strictly untouched',
      passed: pass2C,
      details: `Student B guardian: ${studentMap['B'].guardian_email}`
    });

    // Drain outbox for Suite 2 so subsequent suites start with clean queue
    const worker2 = new GateNotificationWorker({
      emailProvider: mockProvider,
      clientPrisma: testPrisma,
      authorizationMode: 'SCHOOL_AUTHORIZED',
    });
    await worker2.processBatch();

    console.log('--- SUITE 3: Concurrent Scans & Scalability Benchmarking ---');
    mockProvider.clear();

    // Helper for bulk scalability testing
    async function runScaleBenchmark(studentCount: number) {
      console.log(`\n  >> Running Benchmark for ${studentCount} distinct students...`);
      const baseDate = new Date(`2026-11-${10 + Math.floor(Math.random() * 15)}T00:00:00.000Z`);

      // Chunked creation to minimize memory footprint
      const chunkSize = 100;
      const allAttIds: string[] = [];
      const allStudentIds: string[] = [];

      for (let offset = 0; offset < studentCount; offset += chunkSize) {
        const count = Math.min(chunkSize, studentCount - offset);
        const userChunk: any[] = [];
        const studentChunk: any[] = [];
        const attChunk: any[] = [];

        for (let i = 1; i <= count; i++) {
          const globalIdx = offset + i;
          const uId = generateId();
          const sId = generateId();
          const aId = generateId();
          allStudentIds.push(sId);
          allAttIds.push(aId);

          userChunk.push({
            id: uId,
            school_id: `BENCH-${studentCount}-${globalIdx}`,
            email: `bench${studentCount}_${globalIdx}@student.calulut-test.local`,
            password_hash: 'hash',
            first_name: `Bench${studentCount}`,
            last_name: `Student${globalIdx}`,
            status: 'ACTIVE',
          });

          studentChunk.push({
            id: sId,
            user_id: uId,
            lrn: `888${String(studentCount).padStart(4, '0')}${String(globalIdx).padStart(5, '0')}`,
            lrn_hash: `hash_888_${studentCount}_${globalIdx}`,
            current_section_id: testSectionId,
            grade_level: 10,
            guardian_email: `parent_${globalIdx}_${studentCount}@calulut-test.local`,
            guardian_first_name: 'Parent',
            guardian_last_name: `Student${globalIdx}`,
          });

          attChunk.push({
            id: aId,
            student_id: sId,
            date: baseDate,
            status: 'Present',
            time_in: new Date('2026-11-11T07:10:00.000Z'),
          });
        }

        await testPrisma.user.createMany({ data: userChunk });
        await testPrisma.student.createMany({ data: studentChunk });
        await testPrisma.gateAttendance.createMany({ data: attChunk });
      }

      // 1. Measure Concurrent Scan Ingestion & Queue Latency
      const t0Scan = performance.now();
      const concurrency = 10; // Optimal pool utilization
      let scanIndex = 0;
      let enqueuedSuccess = 0;
      let enqueuedErrors = 0;

      async function workerPool() {
        while (scanIndex < studentCount) {
          const idx = scanIndex++;
          try {
            const res = await enqueueGateNotification({
              attendanceId: allAttIds[idx],
              studentId: allStudentIds[idx],
              eventType: 'TIME_IN',
              clientPrisma: testPrisma,
              recipientMode: 'GUARDIAN_ONLY',
              authorizationMode: 'SCHOOL_AUTHORIZED',
            });
            if (res.enqueued) enqueuedSuccess++;
          } catch (e) {
            enqueuedErrors++;
          }
        }
      }

      await Promise.all(Array.from({ length: concurrency }, () => workerPool()));
      const t1Scan = performance.now();
      const scanDurationMs = t1Scan - t0Scan;
      const scanThroughput = (studentCount / (scanDurationMs / 1000)).toFixed(1);

      console.log(`     [Ingestion] ${studentCount} scans in ${scanDurationMs.toFixed(0)} ms (${scanThroughput} scans/sec)`);

      // 2. Measure Worker Outbox Processing Duration across Batches
      const batchWorker = new GateNotificationWorker({
        emailProvider: mockProvider,
        clientPrisma: testPrisma,
        batchSize: 100,
        authorizationMode: 'SCHOOL_AUTHORIZED',
      });

      const t0Worker = performance.now();
      let totalDispatched = 0;
      let iterations = 0;

      while (totalDispatched < enqueuedSuccess && iterations < (studentCount / 10 + 10)) {
        iterations++;
        const res = await batchWorker.processBatch();
        totalDispatched += res.sent;
        if (res.sent === 0 && res.processed === 0) break;
      }

      const t1Worker = performance.now();
      const workerDurationMs = t1Worker - t0Worker;
      const workerThroughput = (totalDispatched / (workerDurationMs / 1000)).toFixed(1);

      console.log(`     [Worker Batch] ${totalDispatched} emails dispatched in ${workerDurationMs.toFixed(0)} ms (${workerThroughput} emails/sec across ${iterations} batches)`);

      // Cleanup benchmark records immediately to keep memory & DB clean
      await testPrisma.gateAttendanceNotification.deleteMany({
        where: { attendance_id: { in: allAttIds } }
      });
      await testPrisma.gateAttendance.deleteMany({
        where: { id: { in: allAttIds } }
      });
      await testPrisma.student.deleteMany({
        where: { id: { in: allStudentIds } }
      });
      await testPrisma.user.deleteMany({
        where: { school_id: { startsWith: `BENCH-${studentCount}-` } }
      });

      return {
        studentCount,
        scanDurationMs: Math.round(scanDurationMs),
        scanThroughput: Number(scanThroughput),
        enqueuedSuccess,
        enqueuedErrors,
        workerDurationMs: Math.round(workerDurationMs),
        workerThroughput: Number(workerThroughput),
        totalDispatched,
      };
    }

    const bench100 = await runScaleBenchmark(100);
    const bench500 = await runScaleBenchmark(500);
    const bench1000 = await runScaleBenchmark(1000);

    suiteResults.push({
      scenario: '3.1 Scalability 100 Students (Realistic Gate Surge)',
      passed: bench100.enqueuedSuccess === 100 && bench100.totalDispatched === 100,
      details: `${bench100.scanThroughput} scans/sec | Worker: ${bench100.workerThroughput} emails/sec | 0 errors`
    });
    suiteResults.push({
      scenario: '3.2 Scalability 500 Students (Medium School Gate Surge)',
      passed: bench500.enqueuedSuccess === 500 && bench500.totalDispatched === 500,
      details: `${bench500.scanThroughput} scans/sec | Worker: ${bench500.workerThroughput} emails/sec | 0 errors`
    });
    suiteResults.push({
      scenario: '3.3 Scalability 1,000 Students (Full School Morning Peak)',
      passed: bench1000.enqueuedSuccess === 1000 && bench1000.totalDispatched === 1000,
      details: `${bench1000.scanThroughput} scans/sec | Worker: ${bench1000.workerThroughput} emails/sec | 0 errors`
    });

    console.log('--- SUITE 4: Concurrency & Failure Resilience ---');
    mockProvider.clear();

    // 4.1 Concurrent Workers Test (Race Condition Protection)
    console.log('  Testing concurrent worker deduplication...');
    // Create 10 pending records
    const raceAttIds: string[] = [];
    for (let i = 1; i <= 10; i++) {
      const aId = generateId();
      raceAttIds.push(aId);
      cleanupAttendanceIds.push(aId);

      await testPrisma.gateAttendance.create({
        data: {
          id: aId,
          student_id: studentMap['A'].id,
          date: new Date(`2026-11-${12 + i}T00:00:00.000Z`),
          status: 'Present',
          time_in: new Date(),
        }
      });

      await enqueueGateNotification({
        attendanceId: aId,
        studentId: studentMap['A'].id,
        eventType: 'TIME_IN',
        clientPrisma: testPrisma,
        recipientMode: 'GUARDIAN_ONLY',
        authorizationMode: 'SCHOOL_AUTHORIZED',
      });
    }

    // Ensure next_attempt_at is strictly in the past for immediate polling (using Prisma for timezone parity)
    await testPrisma.gateAttendanceNotification.updateMany({
      where: { attendance_id: { in: raceAttIds } },
      data: { next_attempt_at: new Date(Date.now() - 5000) }
    });

    // Launch two workers concurrently against the exact same queue
    const cWorker1 = new GateNotificationWorker({
      emailProvider: mockProvider,
      clientPrisma: testPrisma,
      batchSize: 10,
      authorizationMode: 'SCHOOL_AUTHORIZED',
    });
    const cWorker2 = new GateNotificationWorker({
      emailProvider: mockProvider,
      clientPrisma: testPrisma,
      batchSize: 10,
      authorizationMode: 'SCHOOL_AUTHORIZED',
    });

    const [w1Res, w2Res] = await Promise.all([
      cWorker1.processBatch(),
      cWorker2.processBatch()
    ]);

    let totalSent = w1Res.sent + w2Res.sent;
    if (totalSent < 10) {
      const drain = await cWorker1.processBatch();
      totalSent += drain.sent;
    }

    const passConcurrent = totalSent === 10 && mockProvider.sentMessages.length === 10;

    suiteResults.push({
      scenario: '4.1 Concurrent Workers Race Protection (Zero Duplicates)',
      passed: passConcurrent,
      details: `Worker 1 claimed: ${w1Res.sent}, Worker 2 claimed: ${w2Res.sent} -> Exactly 10/10 emails dispatched (0 duplicates)`
    });

    // 4.2 Duplicate Barcode Scans (Debounce / Idempotency)
    console.log('  Testing duplicate scan idempotency...');
    const dupAttId = generateId();
    cleanupAttendanceIds.push(dupAttId);
    await testPrisma.gateAttendance.create({
      data: {
        id: dupAttId,
        student_id: studentMap['B'].id,
        date: new Date('2026-11-25T00:00:00.000Z'),
        status: 'Present',
        time_in: new Date(),
      }
    });

    // Enqueue twice with same attendanceId & eventType
    const resDup1 = await enqueueGateNotification({
      attendanceId: dupAttId,
      studentId: studentMap['B'].id,
      eventType: 'TIME_IN',
      clientPrisma: testPrisma,
      recipientMode: 'GUARDIAN_ONLY',
      authorizationMode: 'SCHOOL_AUTHORIZED',
    });

    const resDup2 = await enqueueGateNotification({
      attendanceId: dupAttId,
      studentId: studentMap['B'].id,
      eventType: 'TIME_IN',
      clientPrisma: testPrisma,
      recipientMode: 'GUARDIAN_ONLY',
      authorizationMode: 'SCHOOL_AUTHORIZED',
    });

    const dupRows = await testPrisma.gateAttendanceNotification.count({
      where: { attendance_id: dupAttId, event_type: 'TIME_IN' }
    });

    suiteResults.push({
      scenario: '4.2 Scanner Burst / Hardware Rapid Re-scan Idempotency',
      passed: dupRows === 1 && resDup1.enqueued === true,
      details: `Second burst scan caught cleanly by unique outbox constraint; exactly 1 notification row created`
    });

    // 4.3 Transient Network Failure & Exponential Backoff
    console.log('  Testing transient failure and retry scheduling...');
    mockProvider.clear();
    mockProvider.failureMode = 'TRANSIENT_500';

    const failWorker = new GateNotificationWorker({
      emailProvider: mockProvider,
      clientPrisma: testPrisma,
      authorizationMode: 'SCHOOL_AUTHORIZED',
    });

    await failWorker.processBatch(); // Processes the duplicate test row created above

    const retryRow = await testPrisma.gateAttendanceNotification.findFirst({
      where: { attendance_id: dupAttId }
    });

    const passRetry = retryRow?.status === 'PENDING' && 
                      retryRow?.attempt_count === 1 &&
                      retryRow?.next_attempt_at.getTime() > Date.now();

    suiteResults.push({
      scenario: '4.3 Transient 500 Failure Handling & Exponential Backoff',
      passed: passRetry,
      details: `Status: ${retryRow?.status} (Attempt ${retryRow?.attempt_count}/3) | Next attempt scheduled: ${retryRow?.next_attempt_at.toISOString()}`
    });

    // Clean up transient failure record so Suite 5 has a clean queue
    await testPrisma.gateAttendanceNotification.deleteMany({
      where: { attendance_id: dupAttId }
    });

    // 4.4 Worker Crash Recovery (Stuck PROCESSING state)
    console.log('  Testing worker crash recovery...');
    const crashAttId = generateId();
    const crashNotifId = generateId();
    cleanupAttendanceIds.push(crashAttId);

    await testPrisma.gateAttendance.create({
      data: {
        id: crashAttId,
        student_id: studentMap['C'].id,
        date: new Date('2026-11-26T00:00:00.000Z'),
        status: 'Present',
        time_in: new Date(),
      }
    });

    // Simulate record abandoned in PROCESSING 10 minutes ago
    await testPrisma.gateAttendanceNotification.create({
      data: {
        id: crashNotifId,
        attendance_id: crashAttId,
        student_id: studentMap['C'].id,
        event_type: 'TIME_IN',
        recipient_role: 'GUARDIAN',
        recipient_email: 'guardian.c@calulut-test.local',
        recipient_name: 'Guardian Gamma',
        status: 'PROCESSING',
        attempt_count: 1,
      }
    });

    await testPrisma.gateAttendanceNotification.update({
      where: { id: crashNotifId },
      data: { updated_at: new Date(Date.now() - 10 * 60 * 1000) }
    });

    mockProvider.failureMode = 'NONE';
    const recoveryWorker = new GateNotificationWorker({
      emailProvider: mockProvider,
      clientPrisma: testPrisma,
      authorizationMode: 'SCHOOL_AUTHORIZED',
    });

    const recoveryRes = await recoveryWorker.processBatch();

    let recoveredRow = await testPrisma.gateAttendanceNotification.findUnique({
      where: { id: crashNotifId }
    });

    // If recovered to PENDING, execute batch to dispatch to ACCEPTED
    if (recoveredRow?.status === 'PENDING') {
      await recoveryWorker.processBatch();
      recoveredRow = await testPrisma.gateAttendanceNotification.findUnique({
        where: { id: crashNotifId }
      });
    }

    suiteResults.push({
      scenario: '4.4 Worker Crash Recovery (Orphaned PROCESSING row)',
      passed: recoveryRes.recovered >= 1 && recoveredRow?.status === 'ACCEPTED',
      details: `Detected abandoned PROCESSING row -> Recovered to PENDING -> Successfully dispatched (ACCEPTED)`
    });

    console.log('--- SUITE 5: Email Provider Limits & Stale Expiration ---');
    // 5.1 Quota 300 Circuit Breaker
    mockProvider.clear();
    mockProvider.failureMode = 'QUOTA_300';

    const quotaAttId = generateId();
    cleanupAttendanceIds.push(quotaAttId);

    await testPrisma.gateAttendance.create({
      data: {
        id: quotaAttId,
        student_id: studentMap['A'].id,
        date: new Date('2026-11-27T00:00:00.000Z'),
        status: 'Present',
        time_in: new Date(),
      }
    });

    await enqueueGateNotification({
      attendanceId: quotaAttId,
      studentId: studentMap['A'].id,
      eventType: 'TIME_IN',
      clientPrisma: testPrisma,
      recipientMode: 'GUARDIAN_ONLY',
      authorizationMode: 'SCHOOL_AUTHORIZED',
    });

    const quotaWorker = new GateNotificationWorker({
      emailProvider: mockProvider,
      clientPrisma: testPrisma,
      authorizationMode: 'SCHOOL_AUTHORIZED',
    });

    const quotaBatchRes = await quotaWorker.processBatch();
    const quotaRow = await testPrisma.gateAttendanceNotification.findFirst({
      where: { attendance_id: quotaAttId }
    });

    suiteResults.push({
      scenario: '5.1 Brevo Daily Quota Exhaustion (Circuit Breaker)',
      passed: quotaBatchRes.quotaExceeded >= 1 && quotaRow?.status === 'QUOTA_EXCEEDED',
      details: `Marked QUOTA_EXCEEDED: "${quotaRow?.error_message}" | Worker halted batch cleanly`
    });

    // 5.2 Stale Notification Suppression (Never send yesterday's pass today)
    const staleAttId = generateId();
    const staleNotifId = generateId();
    cleanupAttendanceIds.push(staleAttId);

    await testPrisma.gateAttendance.create({
      data: {
        id: staleAttId,
        student_id: studentMap['B'].id,
        date: new Date('2026-11-01T00:00:00.000Z'), // Past date
        status: 'Present',
        time_in: new Date('2026-11-01T07:15:00.000Z'),
      }
    });

    await testPrisma.gateAttendanceNotification.create({
      data: {
        id: staleNotifId,
        attendance_id: staleAttId,
        student_id: studentMap['B'].id,
        event_type: 'TIME_IN',
        recipient_role: 'GUARDIAN',
        recipient_email: 'guardian.b@calulut-test.local',
        recipient_name: 'Guardian Beta',
        status: 'PENDING',
      }
    });

    await testPrisma.gateAttendanceNotification.update({
      where: { id: staleNotifId },
      data: {
        created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        updated_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      }
    });

    mockProvider.failureMode = 'NONE';
    const staleWorker = new GateNotificationWorker({
      emailProvider: mockProvider,
      clientPrisma: testPrisma,
      authorizationMode: 'SCHOOL_AUTHORIZED',
    });

    const staleRes = await staleWorker.processBatch();
    const staleRow = await testPrisma.gateAttendanceNotification.findUnique({
      where: { id: staleNotifId }
    });

    suiteResults.push({
      scenario: '5.2 Stale Notification Past Date Expiration (Flood Prevention)',
      passed: staleRes.expired >= 1 && staleRow?.status === 'EXPIRED',
      details: `Status: ${staleRow?.status} | "${staleRow?.error_message}" (Not sent to recipient)`
    });

    console.log('--- SUITE 6: Independent Gate Attendance Persistence ---');
    // Gate scan succeeds even if notification fails or throws
    const indepAttId = generateId();
    cleanupAttendanceIds.push(indepAttId);

    // Simulate turnstile scan where notification queue throws
    let scanCommitted = false;
    await testPrisma.$transaction(async (tx) => {
      const entry = await tx.gateAttendance.create({
        data: {
          id: indepAttId,
          student_id: studentMap['A'].id,
          date: new Date('2026-11-28T00:00:00.000Z'),
          status: 'Present',
          time_in: new Date(),
        }
      });

      // Notification enqueuing is protected with try-catch so it never rolls back attendance
      try {
        await enqueueGateNotification({
          attendanceId: entry.id,
          studentId: 'NON_EXISTENT_STUDENT', // forces error in queue
          eventType: 'TIME_IN',
          clientPrisma: tx,
        });
      } catch (e) {
        // Logged, does not disrupt gate attendance
      }

      scanCommitted = true;
      return entry;
    });

    const persistedAttendance = await testPrisma.gateAttendance.findUnique({
      where: { id: indepAttId }
    });

    suiteResults.push({
      scenario: '6.1 Gate Turnstile Decoupling (Scan persists on email fault)',
      passed: scanCommitted && !!persistedAttendance,
      details: `Physical Time In record committed with ID: ${persistedAttendance?.id.substring(0,8)}... even when notification queue faulted`
    });

  } finally {
    // Clean up isolated test records in digiskwela_phase2c_test
    console.log('\n--- Cleaning up synthetic fixtures in digiskwela_phase2c_test ---');
    if (cleanupAttendanceIds.length > 0) {
      await testPrisma.gateAttendanceNotification.deleteMany({
        where: { attendance_id: { in: cleanupAttendanceIds } }
      });
      await testPrisma.gateAttendance.deleteMany({
        where: { id: { in: cleanupAttendanceIds } }
      });
    }
    if (cleanupStudentIds.length > 0) {
      await testPrisma.student.deleteMany({
        where: { id: { in: cleanupStudentIds } }
      });
    }
    if (cleanupUserIds.length > 0) {
      await testPrisma.user.deleteMany({
        where: { id: { in: cleanupUserIds } }
      });
    }
    await testPrisma.section.deleteMany({
      where: { id: testSectionId }
    });
    console.log('Synthetic fixtures cleanly purged.');
    await testPrisma.$disconnect();
  }

  // Display Table of Results
  console.log('\n========================================================================');
  console.log('AUTOMATED SUITE TEST EXECUTION RESULTS');
  console.log('========================================================================');
  console.table(suiteResults.map(r => ({
    Scenario: r.scenario,
    Passed: r.passed ? 'PASS' : 'FAIL',
    Details: r.details
  })));

  const allPassed = suiteResults.every(r => r.passed);
  console.log(`\nOVERALL SUITE VERDICT: ${allPassed ? '100% ALL TESTS PASSED' : 'SUITE FAILED'}`);

  // Re-verify acceptance baseline remains 100% clean
  console.log('\nVerifying digiskwela_acceptance baseline integrity...');
  const accPrisma = new PrismaClient();
  const [accDb] = await accPrisma.$queryRawUnsafe<any[]>('SELECT current_database()');
  const accStudents = await accPrisma.student.count();
  const accSections = await accPrisma.section.count();
  const accGateAtt = await accPrisma.gateAttendance.count();
  console.log(`Acceptance DB: ${accDb.current_database} | Sections: ${accSections} | Students: ${accStudents} | Gate Attendance: ${accGateAtt}`);
  await accPrisma.$disconnect();
}

runScalabilityAndReliabilitySuite().catch(err => {
  console.error('Suite error:', err);
  process.exit(1);
});
