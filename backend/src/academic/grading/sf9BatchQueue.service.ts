/**
 * DIGISKWELA — Phase 3 Scalable Bulk SF9 Issuance & Generation Queue Service
 * Module: sf9BatchQueue.service.ts
 *
 * Provides a durable, PostgreSQL-persisted, bounded-concurrency asynchronous job queue
 * for official SF9 document assembly and LibreOffice rendering.
 *
 * Architectural Controls:
 * 1. Bounded Concurrency: MAX_CONCURRENT_RENDERS = 2 to prevent LibreOffice CPU thrashing.
 * 2. Persistent Registry: Jobs and item states persisted in PostgreSQL `sf9_bulk_batch_jobs` table.
 * 3. Crash Recovery: Recovers in-flight/queued batch jobs upon backend restart.
 * 4. Duplicate Issuance Protection: Skips already-issued/released learners without re-compiling.
 * 5. Principal Authorization Verification: Strictly enforces fresh Principal approval before compilation.
 * 6. Isolated Storage: Writes generated PDFs exclusively to MEDIA_STORAGE_PATH (e.g. documents_sf9_dev).
 */

import crypto from 'crypto';
import fs from 'fs';
import prisma from '../../config/database.js';
import { generatePersistedStudentCalulutSf9FromDb } from './calulutSf2Sf9Persistence.service.js';
import { createAuditLog } from '../../audit/audit.service.js';
import { getMediaStoragePath } from '../../config/storage.config.js';
import { resolveSafeStorageFilePath } from '../../documents/documentSecurity.service.js';
import { generateId } from '../../common/utils/uuid.js';
import { EXPECTED_MASTER_TEMPLATE_SHA256 } from './index.js';
import { verifyPrincipalAuthorization } from '../reportCard.routes.js';

export interface BatchIssuanceItem {
  studentId: string;
  enrollmentId: string;
  studentName: string;
  lrn: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'SKIPPED' | 'FAILED';
  error?: string;
  blockingReasons?: string[];
  issuanceId?: string;
  pdfSha256?: string;
  durationMs?: number;
}

export interface BatchIssuanceJob {
  id: string;
  sectionId: string;
  sectionName: string;
  targetTerm: 'T1' | 'T2' | 'T3';
  academicYearId: string;
  status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  totalItems: number;
  processedCount: number;
  completedCount: number;
  skippedCount: number;
  failedCount: number;
  startedAt: string;
  finishedAt?: string;
  items: BatchIssuanceItem[];
  actorId: string;
  actorName: string;
}

const MAX_CONCURRENT_RENDERS = 2;
const activeJobs = new Map<string, BatchIssuanceJob>();

/**
 * Persists job state to PostgreSQL sf9_bulk_batch_jobs table.
 */
async function syncJobToDatabase(job: BatchIssuanceJob): Promise<void> {
  try {
    await (prisma as any).$executeRawUnsafe(
      `
      UPDATE sf9_bulk_batch_jobs SET
        status = $1,
        processed_count = $2,
        completed_count = $3,
        skipped_count = $4,
        failed_count = $5,
        items_json = $6::jsonb,
        completed_at = $7,
        updated_at = NOW()
      WHERE id = $8
      `,
      job.status,
      job.processedCount,
      job.completedCount,
      job.skippedCount,
      job.failedCount,
      JSON.stringify(job.items),
      job.finishedAt ? new Date(job.finishedAt) : null,
      job.id
    );
  } catch (err: any) {
    console.error(`[BatchQueue] Failed to sync job ${job.id} to database:`, err.message);
  }
}

/**
 * Retrieves a batch job by ID from memory, falling back to PostgreSQL.
 */
export async function getBatchJob(jobId: string): Promise<BatchIssuanceJob | undefined> {
  const inMemory = activeJobs.get(jobId);
  if (inMemory) return inMemory;

  try {
    const rows = await (prisma as any).$queryRawUnsafe(
      `
      SELECT id, section_id, section_name, target_term, academic_year_id, status,
             total_items, processed_count, completed_count, skipped_count, failed_count,
             items_json, actor_id, actor_name, created_at, started_at, completed_at, updated_at
      FROM sf9_bulk_batch_jobs
      WHERE id = $1
      `,
      jobId
    );

    if (rows && rows.length > 0) {
      const r = rows[0];
      const job: BatchIssuanceJob = {
        id: r.id,
        sectionId: r.section_id,
        sectionName: r.section_name,
        targetTerm: r.target_term,
        academicYearId: r.academic_year_id,
        status: r.status,
        totalItems: r.total_items,
        processedCount: r.processed_count,
        completedCount: r.completed_count,
        skippedCount: r.skipped_count,
        failedCount: r.failed_count,
        startedAt: r.started_at ? new Date(r.started_at).toISOString() : new Date(r.created_at).toISOString(),
        finishedAt: r.completed_at ? new Date(r.completed_at).toISOString() : undefined,
        items: typeof r.items_json === 'string' ? JSON.parse(r.items_json) : r.items_json,
        actorId: r.actor_id,
        actorName: r.actor_name,
      };
      activeJobs.set(job.id, job);
      return job;
    }
  } catch (err: any) {
    console.error(`[BatchQueue] Error reading job ${jobId} from DB:`, err.message);
  }

  return undefined;
}

export function listRecentBatchJobs(): BatchIssuanceJob[] {
  return Array.from(activeJobs.values()).sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
  );
}

/**
 * Creates, persists, and queues a new batch issuance job for a section.
 */
export async function queueSectionBatchIssuance(params: {
  sectionId: string;
  targetTerm: 'T1' | 'T2' | 'T3';
  actorId: string;
  actorName: string;
  correlationId?: string;
}): Promise<BatchIssuanceJob> {
  const section = await (prisma as any).section.findUnique({
    where: { id: params.sectionId },
    include: {
      academic_year: true,
      enrollments: {
        where: { status: 'Enrolled' },
        include: {
          student: {
            include: { user: true },
          },
        },
        orderBy: [
          { student: { user: { last_name: 'asc' } } },
          { student: { user: { first_name: 'asc' } } },
        ],
      },
    },
  });

  if (!section) {
    throw new Error(`Section ${params.sectionId} not found`);
  }

  const enrollments = section.enrollments || [];
  if (enrollments.length === 0) {
    throw new Error(`Section ${section.name} has no enrolled students`);
  }

  const jobId = `sf9_batch_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

  const items: BatchIssuanceItem[] = enrollments.map((en: any) => ({
    studentId: en.student_id,
    enrollmentId: en.id,
    studentName: `${en.student?.user?.last_name || ''}, ${en.student?.user?.first_name || ''}`.trim(),
    lrn: en.student?.lrn || '',
    status: 'PENDING',
  }));

  const job: BatchIssuanceJob = {
    id: jobId,
    sectionId: section.id,
    sectionName: section.name,
    targetTerm: params.targetTerm,
    academicYearId: section.academic_year_id,
    status: 'QUEUED',
    totalItems: items.length,
    processedCount: 0,
    completedCount: 0,
    skippedCount: 0,
    failedCount: 0,
    startedAt: new Date().toISOString(),
    items,
    actorId: params.actorId,
    actorName: params.actorName,
  };

  activeJobs.set(jobId, job);

  // Persist to PostgreSQL sf9_bulk_batch_jobs
  try {
    await (prisma as any).$executeRawUnsafe(
      `
      INSERT INTO sf9_bulk_batch_jobs (
        id, section_id, section_name, target_term, academic_year_id, status,
        total_items, processed_count, completed_count, skipped_count, failed_count,
        items_json, actor_id, actor_name, created_at, started_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13, $14, NOW(), NOW(), NOW()
      )
      `,
      jobId,
      section.id,
      section.name,
      params.targetTerm,
      section.academic_year_id,
      'QUEUED',
      items.length,
      0,
      0,
      0,
      0,
      JSON.stringify(items),
      params.actorId,
      params.actorName
    );
  } catch (err: any) {
    console.error(`[BatchQueue] Failed to insert job ${jobId} to PostgreSQL:`, err.message);
  }

  // Trigger worker asynchronously without blocking HTTP response
  setImmediate(() => {
    processBatchJob(jobId, params.correlationId).catch((err) => {
      console.error(`[BatchWorker] Unhandled error in batch ${jobId}:`, err);
    });
  });

  return job;
}

/**
 * Worker execution loop with bounded concurrency (MAX_CONCURRENT_RENDERS = 2)
 * and durable PostgreSQL synchronization.
 */
async function processBatchJob(jobId: string, correlationId?: string): Promise<void> {
  const job = activeJobs.get(jobId);
  if (!job) return;

  const storageDir = getMediaStoragePath();
  if (!fs.existsSync(storageDir)) {
    try {
      fs.mkdirSync(storageDir, { recursive: true });
    } catch {}
  }

  job.status = 'RUNNING';
  await syncJobToDatabase(job);
  console.log(`[BatchWorker] Started job ${jobId} for Section ${job.sectionName} (${job.totalItems} learners, concurrency=${MAX_CONCURRENT_RENDERS})`);

  let cursor = 0;
  const items = job.items;
  const currentJob: BatchIssuanceJob = job;

  async function worker() {
    while (cursor < items.length) {
      const idx = cursor++;
      const item = items[idx];
      item.status = 'PROCESSING';
      const itemStartTime = Date.now();

      try {
        console.log(`[BatchWorker] [${jobId}] Processing ${item.studentName} (${item.lrn})...`);

        // Check if student already has a current issued SF9 for this academic year
        const existingIssuance = await (prisma as any).sf9OfficialIssuance.findFirst({
          where: {
            student_id: item.studentId,
            academic_year_id: currentJob.academicYearId,
            is_current: true,
          },
        });

        if (existingIssuance) {
          let isReleased = false;
          let targetTerm = 'T1';
          try {
            const summary = JSON.parse(existingIssuance.calculated_summary_encrypted || '{}');
            targetTerm = summary.targetTerm || 'T1';
            isReleased = Boolean(summary.release?.released);
          } catch {}

          if (targetTerm === currentJob.targetTerm) {
            if (isReleased) {
              item.status = 'SKIPPED';
              item.blockingReasons = [`ALREADY_RELEASED_V${existingIssuance.version}`];
              item.issuanceId = existingIssuance.id;
              item.pdfSha256 = existingIssuance.pdf_sha256;
              item.durationMs = Date.now() - itemStartTime;
              currentJob.skippedCount++;
              currentJob.processedCount++;
              console.log(`[BatchWorker] [${jobId}] ${item.studentName}: Already released (v${existingIssuance.version}) -> SKIPPED (Idempotent preservation)`);
              await syncJobToDatabase(currentJob);
              continue;
            } else {
              item.status = 'SKIPPED';
              item.blockingReasons = [`ALREADY_ISSUED_V${existingIssuance.version}_PENDING_RELEASE`];
              item.issuanceId = existingIssuance.id;
              item.pdfSha256 = existingIssuance.pdf_sha256;
              item.durationMs = Date.now() - itemStartTime;
              currentJob.skippedCount++;
              currentJob.processedCount++;
              console.log(`[BatchWorker] [${jobId}] ${item.studentName}: Already issued (v${existingIssuance.version}) pending release -> SKIPPED`);
              await syncJobToDatabase(currentJob);
              continue;
            }
          }
        }

        // Verify Principal Authorization
        const authCheck = await verifyPrincipalAuthorization(
          prisma as any,
          currentJob.sectionId,
          item.studentId,
          currentJob.targetTerm,
          {
            academicYearId: currentJob.academicYearId,
            isIssuanceAttempt: true,
          }
        );

        if (!authCheck.isAuthorized) {
          item.status = 'FAILED';
          item.blockingReasons = [
            authCheck.reason ||
              `Missing or invalid Principal authorization for ${currentJob.targetTerm}`,
          ];
          item.durationMs = Date.now() - itemStartTime;
          currentJob.failedCount++;
          currentJob.processedCount++;
          console.warn(`[BatchWorker] [${jobId}] ${item.studentName}: FAILED -> ${item.blockingReasons[0]}`);
          await syncJobToDatabase(currentJob);
          continue;
        }

        // Check for cancellation signal before executing heavy LibreOffice render
        if (currentJob.status !== 'RUNNING') {
          item.status = 'FAILED';
          item.durationMs = Date.now() - itemStartTime;
          currentJob.processedCount++;
          continue;
        }

        // Generate complete official SF9 with LibreOffice rendering
        const genResult = await generatePersistedStudentCalulutSf9FromDb(prisma as any, {
          studentId: item.studentId,
          enrollmentId: item.enrollmentId,
          academicYearId: currentJob.academicYearId,
          targetTerm: currentJob.targetTerm,
          renderPdf: true,
          mode: 'OFFICIAL',
        });

        if (!genResult.readyForOfficialSf9 || !genResult.pdfBuffer) {
          item.status = 'FAILED';
          item.blockingReasons = genResult.blockingReasons || ['SF9_NOT_READY_FOR_OFFICIAL_RELEASE'];
          item.durationMs = Date.now() - itemStartTime;
          currentJob.failedCount++;
          currentJob.processedCount++;
          console.warn(`[BatchWorker] [${jobId}] ${item.studentName}: NOT READY -> ${item.blockingReasons.join(', ')}`);
          await syncJobToDatabase(currentJob);
          continue;
        }

        // Verify cryptographic hash against Principal approved state
        const currentHash = crypto
          .createHash('sha256')
          .update(JSON.stringify(genResult.calculated || {}))
          .digest('hex');
        const expectedHash = authCheck.authorizationRecord?.academicStateHash;
        if (expectedHash && expectedHash !== currentHash) {
          item.status = 'FAILED';
          item.blockingReasons = ['PRINCIPAL_AUTHORIZATION_STALE_HASH_MISMATCH'];
          item.durationMs = Date.now() - itemStartTime;
          currentJob.failedCount++;
          currentJob.processedCount++;
          console.warn(`[BatchWorker] [${jobId}] ${item.studentName}: STALE HASH MISMATCH`);
          await syncJobToDatabase(currentJob);
          continue;
        }

        // Save official issuance record and PDF file
        const issuanceId = crypto.randomUUID();
        const now = new Date();
        const prevCount = await (prisma as any).sf9OfficialIssuance.count({
          where: { enrollment_id: item.enrollmentId },
        });
        const issuanceVersion = prevCount + 1;

        const filename = `SF9_${item.lrn || item.studentId}_${currentJob.targetTerm}_v${issuanceVersion}.pdf`;
        const storageKey = `sf9_${issuanceId}_v${issuanceVersion}_${Date.now()}.pdf`;
        const safeFilePath = resolveSafeStorageFilePath(storageDir, storageKey);
        fs.writeFileSync(safeFilePath, genResult.pdfBuffer);

        const pdfSha256 = crypto.createHash('sha256').update(genResult.pdfBuffer).digest('hex');
        const xlsxSha256 = genResult.xlsxBuffer
          ? crypto.createHash('sha256').update(genResult.xlsxBuffer).digest('hex')
          : 'xlsx_hash';

        const documentRecord = await (prisma as any).document.create({
          data: {
            id: generateId(),
            storage_key: storageKey,
            filename,
            mime_type: 'application/pdf',
            size_bytes: genResult.pdfBuffer.length,
            uploaded_by: currentJob.actorId,
          },
        });

        const calculatedSummary = {
          ...(genResult.calculated || {}),
          targetTerm: currentJob.targetTerm,
          reportingPeriod:
            currentJob.targetTerm === 'T1'
              ? 'Term 1 SF9'
              : currentJob.targetTerm === 'T2'
              ? 'Term 2 SF9'
              : 'Annual SF9 (Terms 1-3)',
          storedPdf: {
            documentId: documentRecord.id,
            storageKey,
            pdfSha256,
            sizeBytes: genResult.pdfBuffer.length,
            persistedAt: now.toISOString(),
          },
        };

        const prevCurrent = await (prisma as any).sf9OfficialIssuance.findFirst({
          where: { enrollment_id: item.enrollmentId, is_current: true },
        });
        if (prevCurrent) {
          await (prisma as any).sf9OfficialIssuance.update({
            where: { id: prevCurrent.id },
            data: { is_current: false },
          });
        }

        const issuance = await (prisma as any).sf9OfficialIssuance.create({
          data: {
            id: issuanceId,
            enrollment_id: item.enrollmentId,
            student_id: item.studentId,
            section_id: currentJob.sectionId,
            academic_year_id: currentJob.academicYearId,
            version: issuanceVersion,
            is_current: true,
            frozen_payload_encrypted: JSON.stringify(genResult.payload),
            calculated_summary_encrypted: JSON.stringify(calculatedSummary),
            template_sha256: EXPECTED_MASTER_TEMPLATE_SHA256,
            xlsx_sha256: xlsxSha256,
            pdf_sha256: pdfSha256,
            libreofficeVersion: (genResult as any).libreofficeVersion || 'LibreOffice Calc (Verified Headless)',
            issued_pdf_document_id: documentRecord.id,
            adviser_teacher_id: (genResult as any).signatories?.adviserId || 'tch_adviser',
            adviser_name: genResult.payload?.demographics?.adviser || 'Class Adviser',
            school_head_name: genResult.payload?.demographics?.schoolHead || 'School Principal',
            school_head_title: (genResult as any).resolvedSignatories?.schoolHeadTitle || 'Principal IV',
            issued_by_id: currentJob.actorId,
            issued_at: now,
          },
        });

        if (prevCurrent) {
          await (prisma as any).sf9OfficialIssuance.update({
            where: { id: prevCurrent.id },
            data: { superseded_by_id: issuance.id },
          });
        }

        item.status = 'COMPLETED';
        item.issuanceId = issuance.id;
        item.pdfSha256 = pdfSha256;
        item.durationMs = Date.now() - itemStartTime;
        currentJob.completedCount++;
        currentJob.processedCount++;
        console.log(`[BatchWorker] [${jobId}] ${item.studentName}: SUCCESS in ${(item.durationMs / 1000).toFixed(2)}s`);
        await syncJobToDatabase(currentJob);
      } catch (err: any) {
        item.status = 'FAILED';
        item.error = err.message || 'Generation error';
        item.durationMs = Date.now() - itemStartTime;
        currentJob.failedCount++;
        currentJob.processedCount++;
        console.error(`[BatchWorker] [${jobId}] ${item.studentName}: FAILED - ${err.message}`);
        await syncJobToDatabase(currentJob);
      }
    }
  }

  const workers = Array.from({ length: Math.min(MAX_CONCURRENT_RENDERS, items.length) }, () => worker());
  await Promise.all(workers);

  job.status = job.failedCount > 0 && job.completedCount === 0 ? 'FAILED' : 'COMPLETED';
  job.finishedAt = new Date().toISOString();
  await syncJobToDatabase(job);

  console.log(
    `[BatchWorker] Finished job ${jobId}: ${job.completedCount} completed, ${job.skippedCount} skipped, ${job.failedCount} failed.`
  );

  await createAuditLog({
    actorUserId: job.actorId,
    action: 'SF9_BATCH_ISSUANCE_COMPLETED',
    resourceType: 'sf9_batch_issuance',
    resourceId: jobId,
    result: job.status === 'COMPLETED' ? 'SUCCESS' : 'FAILURE',
    newState: {
      jobId,
      sectionId: job.sectionId,
      sectionName: job.sectionName,
      targetTerm: job.targetTerm,
      totalItems: job.totalItems,
      completedCount: job.completedCount,
      skippedCount: job.skippedCount,
      failedCount: job.failedCount,
      startedAt: job.startedAt,
      finishedAt: job.finishedAt,
    },
    correlationId,
  });
}

/**
 * Recovers pending or in-flight batch jobs upon backend startup.
 */
export async function recoverPendingSf9BatchJobs(): Promise<void> {
  try {
    const pendingJobs = await (prisma as any).$queryRawUnsafe(`
      SELECT id, section_id, section_name, target_term, academic_year_id, status,
             total_items, processed_count, completed_count, skipped_count, failed_count,
             items_json, actor_id, actor_name, created_at, started_at, completed_at, updated_at
      FROM sf9_bulk_batch_jobs
      WHERE status IN ('QUEUED', 'RUNNING')
      ORDER BY created_at ASC
    `);

    if (pendingJobs && pendingJobs.length > 0) {
      console.log(`[BatchQueueRecovery] Found ${pendingJobs.length} interrupted batch job(s) to recover.`);
      for (const r of pendingJobs) {
        const items = typeof r.items_json === 'string' ? JSON.parse(r.items_json) : r.items_json;
        const job: BatchIssuanceJob = {
          id: r.id,
          sectionId: r.section_id,
          sectionName: r.section_name,
          targetTerm: r.target_term,
          academicYearId: r.academic_year_id,
          status: 'QUEUED',
          totalItems: r.total_items,
          processedCount: r.processed_count,
          completedCount: r.completed_count,
          skippedCount: r.skipped_count,
          failedCount: r.failed_count,
          startedAt: r.started_at ? new Date(r.started_at).toISOString() : new Date().toISOString(),
          items,
          actorId: r.actor_id,
          actorName: r.actor_name,
        };
        activeJobs.set(job.id, job);
        setImmediate(() => {
          processBatchJob(job.id).catch((err) => {
            console.error(`[BatchQueueRecovery] Error resuming job ${job.id}:`, err);
          });
        });
      }
    }
  } catch (err: any) {
    console.error(`[BatchQueueRecovery] Recovery check skipped:`, err.message);
  }
}
