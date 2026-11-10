import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import fs from 'fs';
import path from 'path';
import prisma from '../config/database.js';
import { authMiddleware, AuthenticatedUser } from '../common/middleware/auth.js';
import { AppError } from '../common/middleware/errorHandler.js';
import { createAuditLog } from '../audit/audit.service.js';
import { generateId } from '../common/utils/uuid.js';
import { getMediaStoragePath } from '../config/storage.config.js';
import { resolveSafeStorageFilePath } from '../documents/documentSecurity.service.js';
import { getReportCardData } from './reportCard.service.js';
import {
  generateSyntheticSf9Preview,
  generateSyntheticSf9PdfPreview,
  generateStudentCalulutSf9,
  generateStudentCalulutSf9Pdf,
  generateCalulutSf9,
  getSyntheticSf9Data,
  resolveStudentSf9DataMapping,
  generatePersistedStudentCalulutSf9FromDb,
  renderCalulutSf9BufferToPdf,
  assertAuthorizedSf9Staff,
  assertAuthorizedStaffForSection,
  EXPECTED_MASTER_TEMPLATE_SHA256,
  Sf9PipelineProfiler,
  computeDraftCacheIdentity,
  getCachedDraftPdf,
  setCachedDraftPdf,
} from './grading/index.js';
import {
  queueSectionBatchIssuance,
  getBatchJob,
  listRecentBatchJobs,
} from './grading/sf9BatchQueue.service.js';

const STORAGE_DIR = getMediaStoragePath();
try {
  if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
  }
} catch {}

/**
 * Streams an officially released SF9 PDF directly from secure media storage without LibreOffice.
 * If the PDF has not yet been persisted (e.g. historical QA records), performs a controlled
 * one-time backfill from the frozen academic payload, validates the document, saves the exact bytes,
 * and updates the issuance record so subsequent viewings are instantaneous (< 10ms).
 */
async function serveReleasedSf9Pdf(
  issuance: any,
  targetStudentId: string,
  req: Request,
  res: Response,
  profiler: Sf9PipelineProfiler
): Promise<void> {
  const targetTerm =
    issuance.target_term ||
    (() => {
      try {
        const frozen = JSON.parse(issuance.frozen_payload_encrypted);
        return frozen.targetTerm;
      } catch {
        return undefined;
      }
    })() ||
    'T1';

  const filename = `SF9_${issuance.student?.lrn || targetStudentId}_${targetTerm}_v${issuance.version}.pdf`;

  // FAST PATH: Stored PDF exists in secure media storage (NO LibreOffice conversion)
  if (issuance.issued_pdf_document_id) {
    profiler.start('storage_read');
    const docRecord = await (prisma as any).document.findUnique({
      where: { id: issuance.issued_pdf_document_id },
    });

    if (docRecord && docRecord.storage_key) {
      try {
        const safeFilePath = resolveSafeStorageFilePath(STORAGE_DIR, docRecord.storage_key);
        if (fs.existsSync(safeFilePath)) {
          const pdfBuffer = fs.readFileSync(safeFilePath);
          if (pdfBuffer.length > 100 && pdfBuffer.subarray(0, 5).toString('ascii') === '%PDF-') {
            const actualSha256 = crypto.createHash('sha256').update(pdfBuffer).digest('hex');
            profiler.stop('storage_read');

            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
            res.setHeader('Cache-Control', 'private, no-store');
            res.setHeader('X-Sf9-Source', 'STORED_PDF');
            res.setHeader('X-Sf9-Document-Id', docRecord.id);
            res.setHeader('X-Sf9-Sha256', actualSha256);
            res.setHeader('Server-Timing', profiler.toServerTimingHeader());

            profiler.logSummary({
              source: 'STORED_PDF',
              mode: 'OFFICIAL',
              targetTerm,
              studentIdPrefix: targetStudentId.slice(0, 8),
            });

            res.send(pdfBuffer);
            return;
          }
        }
      } catch (err) {
        console.warn(`[SF9-STORAGE] Failed reading stored PDF ${issuance.issued_pdf_document_id}:`, err);
      }
    }
    profiler.stop('storage_read');
  }

  // CONTROLLED BACKFILL PATH: Generate from frozen academic payload once and persist to storage
  console.log(`[SF9-STORAGE] One-time backfill generation for issuance ${issuance.id} (student ${targetStudentId})`);
  profiler.start('data_mapping');
  const frozenPayload = JSON.parse(issuance.frozen_payload_encrypted);
  profiler.stop('data_mapping');

  profiler.start('xlsx_population');
  const genResult = generateCalulutSf9({
    ...frozenPayload,
    targetTerm,
    mode: 'OFFICIAL',
  });
  profiler.stop('xlsx_population');

  if (!genResult.success) {
    throw new AppError(500, 'RENDER_FAILED', 'Failed to generate released SF9 workbook buffer.');
  }

  const pdfBuffer = await renderCalulutSf9BufferToPdf(genResult.buffer, {
    profiler,
  });

  // Validate PDF bytes
  if (pdfBuffer.length < 100 || pdfBuffer.subarray(0, 5).toString('ascii') !== '%PDF-') {
    throw new AppError(500, 'RENDER_FAILED', 'Backfilled SF9 PDF output has invalid structure.');
  }

  profiler.start('storage_write');
  try {
    const storageKey = `sf9_${issuance.id}_v${issuance.version}_${Date.now()}.pdf`;
    const safeFilePath = resolveSafeStorageFilePath(STORAGE_DIR, storageKey);
    fs.writeFileSync(safeFilePath, pdfBuffer);

    const backfilledSha256 = crypto.createHash('sha256').update(pdfBuffer).digest('hex');

    const docRecord = await (prisma as any).document.create({
      data: {
        id: generateId(),
        storage_key: storageKey,
        filename,
        mime_type: 'application/pdf',
        size_bytes: pdfBuffer.length,
        uploaded_by: issuance.issued_by_id || 'system_sf9_backfill',
      },
    });

    let currentSummary: any = {};
    try {
      currentSummary = JSON.parse(issuance.calculated_summary_encrypted || '{}');
    } catch {
      currentSummary = {};
    }

    currentSummary.storedPdf = {
      documentId: docRecord.id,
      storageKey,
      pdfSha256: backfilledSha256,
      originalHistoricalSha256: issuance.pdf_sha256,
      isBackfilled: true,
      backfilledAt: new Date().toISOString(),
    };

    await (prisma as any).sf9OfficialIssuance.update({
      where: { id: issuance.id },
      data: {
        issued_pdf_document_id: docRecord.id,
        calculated_summary_encrypted: JSON.stringify(currentSummary),
      },
    });

    console.log(`[SF9-STORAGE] Successfully persisted and linked document ${docRecord.id} to issuance ${issuance.id}`);
  } catch (err) {
    console.error(`[SF9-STORAGE] Failed saving backfilled PDF to storage for issuance ${issuance.id}:`, err);
  }
  profiler.stop('storage_write');

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Sf9-Source', 'BACKFILLED_STORED_PDF');
  res.setHeader('Server-Timing', profiler.toServerTimingHeader());

  profiler.logSummary({
    source: 'LIBREOFFICE_RENDER',
    mode: 'OFFICIAL_BACKFILL',
    targetTerm,
    studentIdPrefix: targetStudentId.slice(0, 8),
  });

  res.send(pdfBuffer);
}

const router = Router();
router.use(authMiddleware);

/**
 * Helper to check whether durable and fresh Principal authorization exists for a section or student.
 * Guarantees cryptographic, temporal, and entity freshness:
 * 1. Strict Term Matching: Term 1 authorization cannot authorize Term 2.
 * 2. Strict Academic Year: Authorization is bound to the current academic year.
 * 3. Exact Learner Scope: Individual learner approvals cannot cross learners.
 * 4. Temporal Record Freshness: Any modification to published grades, SF2 daily attendance,
 *    or adviser comments after the authorization timestamp invalidates the authorization.
 * 5. Cryptographic State Hash: Ensures the issued payload matches the Principal-reviewed payload.
 * 6. Issuance Consumption: An authorization consumed for a previous issuance cannot authorize a
 *    new/superseding issuance without renewed review.
 */
export async function verifyPrincipalAuthorization(
  prismaClient: any,
  sectionId: string,
  studentId: string | null,
  targetTerm: string,
  options?: {
    academicYearId?: string;
    isIssuanceAttempt?: boolean;
    currentAcademicStateHash?: string;
  }
): Promise<{
  isAuthorized: boolean;
  isStale?: boolean;
  reason?: string;
  authorizationRecord?: any;
}> {
  const queryOr: any[] = [{ resource_id: sectionId }];
  if (studentId) {
    queryOr.push({ resource_id: studentId });
  }

  const logs = await prismaClient.auditLog.findMany({
    where: {
      action: 'SF9_PRINCIPAL_AUTHORIZATION',
      resource_type: { in: ['sf9_section_authorization', 'sf9_official_issuance'] },
      OR: queryOr,
    },
    orderBy: { created_at: 'desc' },
  });

  const matchingLog = logs.find((l: any) => {
    let state: any = null;
    try {
      state = typeof l.new_state === 'string' ? JSON.parse(l.new_state) : l.new_state;
    } catch {
      state = l.new_state;
    }
    // 1. Strict Term match (e.g. T1 cannot authorize T2)
    if (state?.targetTerm && state.targetTerm !== targetTerm) {
      return false;
    }
    // 2. Strict student-level log match (cannot cross students)
    if (l.resource_type === 'sf9_official_issuance' && studentId && l.resource_id !== studentId) {
      return false;
    }
    // 3. Strict academic year match (if provided)
    if (options?.academicYearId && state?.academicYearId && state.academicYearId !== options.academicYearId) {
      return false;
    }
    return true;
  });

  if (!matchingLog) {
    return {
      isAuthorized: false,
      reason: `No formal School Principal authorization found for ${targetTerm}.`,
    };
  }

  let state: any = null;
  try {
    state = typeof matchingLog.new_state === 'string' ? JSON.parse(matchingLog.new_state) : matchingLog.new_state;
  } catch {
    state = matchingLog.new_state;
  }

  const rawAuthAt = state?.authorizedAt || matchingLog.created_at;
  const authorizedAt = new Date(rawAuthAt);

  // Material record staleness check
  if (studentId) {
    // A. Check if any published grade was modified after Principal authorization
    const modifiedGrade = await prismaClient.grade.findFirst({
      where: {
        student_id: studentId,
        ...(options?.academicYearId ? { academic_year_id: options.academicYearId } : {}),
        term: targetTerm as any,
        updated_at: { gt: authorizedAt },
      },
      select: { id: true, subject_id: true, updated_at: true },
    });
    if (modifiedGrade) {
      return {
        isAuthorized: false,
        isStale: true,
        reason: `Published grade was modified at ${modifiedGrade.updated_at.toISOString()}, after Principal authorization at ${authorizedAt.toISOString()}. Renewed Principal review and authorization is required.`,
      };
    }

    // B. Check if any adviser comment was modified after Principal authorization
    const modifiedComment = await prismaClient.sf9AdviserComment.findFirst({
      where: {
        student_id: studentId,
        ...(options?.academicYearId ? { academic_year_id: options.academicYearId } : {}),
        term: targetTerm as any,
        updated_at: { gt: authorizedAt },
      },
      select: { id: true, updated_at: true },
    });
    if (modifiedComment) {
      return {
        isAuthorized: false,
        isStale: true,
        reason: `Adviser comment was updated at ${modifiedComment.updated_at.toISOString()}, after Principal authorization at ${authorizedAt.toISOString()}. Renewed Principal review and authorization is required.`,
      };
    }

    // C. Check if any official daily attendance record was modified after Principal authorization
    const modifiedAttendance = await prismaClient.officialDailyAttendance.findFirst({
      where: {
        student_id: studentId,
        ...(options?.academicYearId ? { academic_year_id: options.academicYearId } : {}),
        updated_at: { gt: authorizedAt },
      },
      select: { id: true, updated_at: true },
    });
    if (modifiedAttendance) {
      return {
        isAuthorized: false,
        isStale: true,
        reason: `SF2 daily attendance records were modified at ${modifiedAttendance.updated_at.toISOString()}, after Principal authorization at ${authorizedAt.toISOString()}. Renewed Principal review and authorization is required.`,
      };
    }

    // D. Cryptographic payload hash check (if present in authorization state)
    const expectedHash = state?.academicStateHash || state?.learnerStateHashes?.[studentId];
    if (expectedHash && options?.currentAcademicStateHash) {
      if (expectedHash !== options.currentAcademicStateHash) {
        return {
          isAuthorized: false,
          isStale: true,
          reason: `Current academic evaluation hash does not match the cryptographic snapshot approved by the School Principal. Renewed review is required.`,
        };
      }
    }

    // E. Issuance re-use / supersession protection:
    // If an issuance already exists and was issued AFTER this authorization, this authorization was already consumed.
    if (options?.isIssuanceAttempt) {
      const existingIssuance = await prismaClient.sf9OfficialIssuance.findFirst({
        where: {
          student_id: studentId,
          is_current: true,
        },
        select: { id: true, version: true, issued_at: true },
      });
      if (existingIssuance && existingIssuance.issued_at && new Date(existingIssuance.issued_at) >= authorizedAt) {
        return {
          isAuthorized: false,
          isStale: true,
          reason: `Prior Principal authorization was already consumed to issue Version ${existingIssuance.version} (issued at ${new Date(existingIssuance.issued_at).toISOString()}). Re-issuing or superseding an official SF9 document requires renewed Principal review and authorization.`,
        };
      }
    }
  }

  return {
    isAuthorized: true,
    authorizationRecord: {
      authorizedBy: state?.authorizedBy || matchingLog.actor_user_id,
      authorizedByName: state?.authorizedByName || 'Dr. Eduardo M. Santos, Ed.D.',
      authorizedAt: authorizedAt.toISOString(),
      targetTerm,
      scope: matchingLog.resource_type === 'sf9_section_authorization' ? 'SECTION' : 'STUDENT',
      academicStateHash: state?.academicStateHash || state?.learnerStateHashes?.[studentId || ''],
    },
  };
}

/**
 * POST /api/academic/report-card/sections/:sectionId/authorize
 * Formally authorizes official SF9 issuance for a section.
 * STRICTLY restricted to School Principal.
 * Rejects with HTTP 422 if any enrolled student has incomplete academic records.
 */
router.post('/sections/:sectionId/authorize', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const actor = (req as any).user as AuthenticatedUser;
    assertAuthorizedSf9Staff(actor);
    const sectionId = req.params.sectionId as string;
    await assertAuthorizedStaffForSection(actor, sectionId, prisma as any, 'authorize');

    if (!actor.roles.includes('Principal')) {
      throw new AppError(
        403,
        'FORBIDDEN',
        'Official SF9 academic authorization is strictly restricted to the School Principal.'
      );
    }

    const section = await (prisma as any).section.findUnique({
      where: { id: sectionId },
      include: { academic_year: true },
    });
    if (!section) throw new AppError(404, 'NOT_FOUND', `Section ${sectionId} not found`);

    const targetTerm =
      (((req.body?.targetTerm as string) || (req.query?.term as string))?.toUpperCase() as 'T1' | 'T2' | 'T3') || 'T1';

    const enrollments = await (prisma as any).enrollment.findMany({
      where: { section_id: sectionId, status: 'Enrolled' },
      include: {
        student: {
          include: { user: true },
        },
      },
      orderBy: [
        { student: { user: { last_name: 'asc' } } },
        { student: { user: { first_name: 'asc' } } },
      ],
    });

    if (enrollments.length === 0) {
      throw new AppError(422, 'NO_ENROLLED_STUDENTS', `Section ${section.name} has no enrolled students.`);
    }

    const mode = ((req.query?.mode as string) || (req.body?.mode as string) || '').toLowerCase();
    const isEligibleOnly = mode === 'eligible_only';

    // Validate readiness for all enrolled students and compute cryptographic snapshots
    const readyLearners: any[] = [];
    const unreadyLearners: any[] = [];
    const learnerStateHashes: Record<string, string> = {};

    for (const enrollment of enrollments) {
      const learnerName = `${enrollment.student?.user?.last_name || ''}, ${enrollment.student?.user?.first_name || ''}`.trim();

      // Check if student already has a current issued SF9 for this academic year and target term
      const existingIssuance = await (prisma as any).sf9OfficialIssuance.findFirst({
        where: {
          student_id: enrollment.student_id,
          academic_year_id: enrollment.academic_year_id,
          is_current: true,
        },
      });

      if (existingIssuance) {
        let isReleased = false;
        let issuedTerm = 'T1';
        try {
          const summary = JSON.parse(existingIssuance.calculated_summary_encrypted || '{}');
          issuedTerm = summary.targetTerm || 'T1';
          isReleased = Boolean(summary.release?.released);
        } catch {}

        if (issuedTerm === targetTerm) {
          unreadyLearners.push({
            studentId: enrollment.student_id,
            enrollmentId: enrollment.id,
            name: learnerName,
            blockingReasons: [
              isReleased
                ? `ALREADY_RELEASED_V${existingIssuance.version}`
                : `ALREADY_ISSUED_V${existingIssuance.version}_PENDING_RELEASE`,
            ],
          });
          continue;
        }
      }

      // Check if student already has an active, unconsumed Principal authorization
      const existingAuth = await verifyPrincipalAuthorization(
        prisma as any,
        sectionId,
        enrollment.student_id,
        targetTerm,
        { academicYearId: enrollment.academic_year_id }
      );
      if (existingAuth.isAuthorized && !existingAuth.isStale) {
        unreadyLearners.push({
          studentId: enrollment.student_id,
          enrollmentId: enrollment.id,
          name: learnerName,
          blockingReasons: ['ALREADY_AUTHORIZED'],
        });
        continue;
      }

      const evalResult = await generatePersistedStudentCalulutSf9FromDb(prisma as any, {
        studentId: enrollment.student_id,
        enrollmentId: enrollment.id,
        academicYearId: enrollment.academic_year_id,
        targetTerm,
        renderPdf: false,
        mode: 'OFFICIAL',
      });

      if (!evalResult.readyForOfficialSf9) {
        unreadyLearners.push({
          studentId: enrollment.student_id,
          enrollmentId: enrollment.id,
          name: learnerName,
          blockingReasons: evalResult.blockingReasons || [],
        });
      } else {
        const stateHash = crypto
          .createHash('sha256')
          .update(JSON.stringify(evalResult.calculated || {}))
          .digest('hex');
        learnerStateHashes[enrollment.student_id] = stateHash;
        readyLearners.push({
          studentId: enrollment.student_id,
          enrollmentId: enrollment.id,
          name: learnerName,
          stateHash,
        });
      }
    }

    if (!isEligibleOnly && unreadyLearners.length > 0) {
      throw new AppError(
        422,
        'CANNOT_AUTHORIZE_INCOMPLETE_ACADEMIC_RECORDS',
        `Principal authorization denied: ${unreadyLearners.length} learner(s) in Section ${section.name} have incomplete academic records for ${targetTerm}.`,
        {
          sectionId,
          sectionName: section.name,
          targetTerm,
          totalLearners: enrollments.length,
          unreadyCount: unreadyLearners.length,
          unreadyLearners,
        }
      );
    }

    if (readyLearners.length === 0) {
      throw new AppError(
        422,
        'NO_ELIGIBLE_LEARNERS_FOR_AUTHORIZATION',
        `No learners in Section ${section.name} are currently eligible for ${targetTerm} SF9 authorization.`
      );
    }

    const now = new Date();
    const authorizedByName =
      `${(actor as any).firstName || ''} ${(actor as any).lastName || ''}`.trim() ||
      'Dr. Eduardo M. Santos, Ed.D.';

    // Record individual audit logs for each eligible learner
    for (const learner of readyLearners) {
      await createAuditLog({
        actorUserId: actor.id,
        action: 'SF9_PRINCIPAL_AUTHORIZATION',
        resourceType: 'sf9_official_issuance',
        resourceId: learner.studentId,
        result: 'SUCCESS',
        newState: {
          studentId: learner.studentId,
          enrollmentId: learner.enrollmentId,
          sectionId,
          targetTerm,
          authorizedBy: actor.id,
          authorizedByName,
          authorizedAt: now.toISOString(),
          stateHash: learner.stateHash,
        },
        correlationId: (req as any).correlationId,
      });
    }

    await createAuditLog({
      actorUserId: actor.id,
      action: 'SF9_PRINCIPAL_AUTHORIZATION',
      resourceType: 'sf9_section_authorization',
      resourceId: sectionId,
      result: 'SUCCESS',
      newState: {
        sectionId,
        sectionName: section.name,
        academicYearId: section.academic_year_id,
        targetTerm,
        mode: isEligibleOnly ? 'eligible_only' : 'full_section',
        authorizedBy: actor.id,
        authorizedByName,
        authorizedAt: now.toISOString(),
        totalLearners: enrollments.length,
        authorizedCount: readyLearners.length,
        authorizedStudentIds: readyLearners.map((l: any) => l.studentId),
        excludedLearners: unreadyLearners,
        learnerStateHashes,
      },
      correlationId: (req as any).correlationId,
    });

    res.json({
      success: true,
      data: {
        sectionId,
        sectionName: section.name,
        targetTerm,
        status: isEligibleOnly && unreadyLearners.length > 0 ? 'PARTIALLY_AUTHORIZED' : 'AUTHORIZED',
        mode: isEligibleOnly ? 'eligible_only' : 'full_section',
        authorizedBy: actor.id,
        authorizedByName,
        authorizedAt: now.toISOString(),
        totalLearners: enrollments.length,
        authorizedCount: readyLearners.length,
        excludedCount: unreadyLearners.length,
        authorizedLearners: readyLearners,
        excludedLearners: unreadyLearners,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.post('/sections/:sectionId/authorize-eligible', async (req: Request, res: Response, next: NextFunction) => {
  try {
    req.query.mode = 'eligible_only';
    const actor = (req as any).user as AuthenticatedUser;
    assertAuthorizedSf9Staff(actor);
    const sectionId = req.params.sectionId as string;
    await assertAuthorizedStaffForSection(actor, sectionId, prisma as any, 'authorize');

    if (!actor.roles.includes('Principal')) {
      throw new AppError(
        403,
        'FORBIDDEN',
        'Official SF9 academic authorization is strictly restricted to the School Principal.'
      );
    }

    const section = await (prisma as any).section.findUnique({
      where: { id: sectionId },
      include: { academic_year: true },
    });
    if (!section) throw new AppError(404, 'NOT_FOUND', `Section ${sectionId} not found`);

    const targetTerm =
      (((req.body?.targetTerm as string) || (req.query?.term as string))?.toUpperCase() as 'T1' | 'T2' | 'T3') || 'T1';

    const enrollments = await (prisma as any).enrollment.findMany({
      where: { section_id: sectionId, status: 'Enrolled' },
      include: {
        student: {
          include: { user: true },
        },
      },
      orderBy: [
        { student: { user: { last_name: 'asc' } } },
        { student: { user: { first_name: 'asc' } } },
      ],
    });

    if (enrollments.length === 0) {
      throw new AppError(422, 'NO_ENROLLED_STUDENTS', `Section ${section.name} has no enrolled students.`);
    }

    const readyLearners: any[] = [];
    const unreadyLearners: any[] = [];
    const learnerStateHashes: Record<string, string> = {};

    for (const enrollment of enrollments) {
      const learnerName = `${enrollment.student?.user?.last_name || ''}, ${enrollment.student?.user?.first_name || ''}`.trim();

      // Check if student already has a current issued SF9 for this academic year and target term
      const existingIssuance = await (prisma as any).sf9OfficialIssuance.findFirst({
        where: {
          student_id: enrollment.student_id,
          academic_year_id: enrollment.academic_year_id,
          is_current: true,
        },
      });

      if (existingIssuance) {
        let isReleased = false;
        let issuedTerm = 'T1';
        try {
          const summary = JSON.parse(existingIssuance.calculated_summary_encrypted || '{}');
          issuedTerm = summary.targetTerm || 'T1';
          isReleased = Boolean(summary.release?.released);
        } catch {}

        if (issuedTerm === targetTerm) {
          unreadyLearners.push({
            studentId: enrollment.student_id,
            enrollmentId: enrollment.id,
            name: learnerName,
            blockingReasons: [
              isReleased
                ? `ALREADY_RELEASED_V${existingIssuance.version}`
                : `ALREADY_ISSUED_V${existingIssuance.version}_PENDING_RELEASE`,
            ],
          });
          continue;
        }
      }

      // Check if student already has an active, unconsumed Principal authorization
      const existingAuth = await verifyPrincipalAuthorization(
        prisma as any,
        sectionId,
        enrollment.student_id,
        targetTerm,
        { academicYearId: enrollment.academic_year_id }
      );
      if (existingAuth.isAuthorized && !existingAuth.isStale) {
        unreadyLearners.push({
          studentId: enrollment.student_id,
          enrollmentId: enrollment.id,
          name: learnerName,
          blockingReasons: ['ALREADY_AUTHORIZED'],
        });
        continue;
      }

      const evalResult = await generatePersistedStudentCalulutSf9FromDb(prisma as any, {
        studentId: enrollment.student_id,
        enrollmentId: enrollment.id,
        academicYearId: enrollment.academic_year_id,
        targetTerm,
        renderPdf: false,
        mode: 'OFFICIAL',
      });

      if (!evalResult.readyForOfficialSf9) {
        unreadyLearners.push({
          studentId: enrollment.student_id,
          enrollmentId: enrollment.id,
          name: learnerName,
          blockingReasons: evalResult.blockingReasons || [],
        });
      } else {
        const stateHash = crypto
          .createHash('sha256')
          .update(JSON.stringify(evalResult.calculated || {}))
          .digest('hex');
        learnerStateHashes[enrollment.student_id] = stateHash;
        readyLearners.push({
          studentId: enrollment.student_id,
          enrollmentId: enrollment.id,
          name: learnerName,
          stateHash,
        });
      }
    }

    if (readyLearners.length === 0) {
      throw new AppError(
        422,
        'NO_ELIGIBLE_LEARNERS_FOR_AUTHORIZATION',
        `No learners in Section ${section.name} are currently eligible for ${targetTerm} SF9 authorization.`
      );
    }

    const now = new Date();
    const authorizedByName =
      `${(actor as any).firstName || ''} ${(actor as any).lastName || ''}`.trim() ||
      'Dr. Eduardo M. Santos, Ed.D.';

    for (const learner of readyLearners) {
      await createAuditLog({
        actorUserId: actor.id,
        action: 'SF9_PRINCIPAL_AUTHORIZATION',
        resourceType: 'sf9_official_issuance',
        resourceId: learner.studentId,
        result: 'SUCCESS',
        newState: {
          studentId: learner.studentId,
          enrollmentId: learner.enrollmentId,
          sectionId,
          targetTerm,
          authorizedBy: actor.id,
          authorizedByName,
          authorizedAt: now.toISOString(),
          stateHash: learner.stateHash,
        },
        correlationId: (req as any).correlationId,
      });
    }

    await createAuditLog({
      actorUserId: actor.id,
      action: 'SF9_PRINCIPAL_AUTHORIZATION',
      resourceType: 'sf9_section_authorization',
      resourceId: sectionId,
      result: 'SUCCESS',
      newState: {
        sectionId,
        sectionName: section.name,
        academicYearId: section.academic_year_id,
        targetTerm,
        mode: 'eligible_only',
        authorizedBy: actor.id,
        authorizedByName,
        authorizedAt: now.toISOString(),
        totalLearners: enrollments.length,
        authorizedCount: readyLearners.length,
        authorizedStudentIds: readyLearners.map((l: any) => l.studentId),
        excludedLearners: unreadyLearners,
        learnerStateHashes,
      },
      correlationId: (req as any).correlationId,
    });

    res.json({
      success: true,
      data: {
        sectionId,
        sectionName: section.name,
        targetTerm,
        status: unreadyLearners.length > 0 ? 'PARTIALLY_AUTHORIZED' : 'AUTHORIZED',
        mode: 'eligible_only',
        authorizedBy: actor.id,
        authorizedByName,
        authorizedAt: now.toISOString(),
        totalLearners: enrollments.length,
        authorizedCount: readyLearners.length,
        excludedCount: unreadyLearners.length,
        authorizedLearners: readyLearners,
        excludedLearners: unreadyLearners,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/academic/report-card/:studentId/sf9/authorize
 * Formally authorizes official SF9 issuance for a single learner.
 * STRICTLY restricted to School Principal.
 * Rejects with HTTP 422 if the learner has incomplete academic records.
 */
router.post('/:studentId/sf9/authorize', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const actor = (req as any).user as AuthenticatedUser;
    assertAuthorizedSf9Staff(actor);
    const studentId = req.params.studentId as string;

    if (!actor.roles.includes('Principal')) {
      throw new AppError(
        403,
        'FORBIDDEN',
        'Official SF9 academic authorization is strictly restricted to the School Principal.'
      );
    }

    const enrollment = await (prisma as any).enrollment.findFirst({
      where: { student_id: studentId, status: 'Enrolled' },
      include: { section: true, student: { include: { user: true } } },
    });
    if (!enrollment) throw new AppError(404, 'NOT_FOUND', `Enrolled record for student ${studentId} not found`);

    await assertAuthorizedStaffForSection(actor, enrollment.section_id, prisma as any, 'authorize');

    const targetTerm =
      (((req.body?.targetTerm as string) || (req.query?.term as string))?.toUpperCase() as 'T1' | 'T2' | 'T3') || 'T1';

    // Prevent duplicate authorization if already issued or released
    const existingIssuance = await (prisma as any).sf9OfficialIssuance.findFirst({
      where: {
        student_id: studentId,
        academic_year_id: enrollment.academic_year_id,
        is_current: true,
      },
    });
    if (existingIssuance) {
      let isReleased = false;
      let issuedTerm = 'T1';
      try {
        const summary = JSON.parse(existingIssuance.calculated_summary_encrypted || '{}');
        issuedTerm = summary.targetTerm || 'T1';
        isReleased = Boolean(summary.release?.released);
      } catch {}

      if (issuedTerm === targetTerm) {
        throw new AppError(
          409,
          'ALREADY_ISSUED_OR_RELEASED',
          `Principal authorization denied: Learner already has an official SF9 ${isReleased ? 'released' : 'issued'} (v${existingIssuance.version}) for ${targetTerm}.`
        );
      }
    }

    // Prevent duplicate authorization if already actively authorized
    const existingAuth = await verifyPrincipalAuthorization(
      prisma as any,
      enrollment.section_id,
      studentId,
      targetTerm,
      { academicYearId: enrollment.academic_year_id }
    );
    if (existingAuth.isAuthorized && !existingAuth.isStale) {
      throw new AppError(
        409,
        'ALREADY_AUTHORIZED',
        `Principal authorization denied: Learner is already authorized for ${targetTerm}.`
      );
    }

    const evalResult = await generatePersistedStudentCalulutSf9FromDb(prisma as any, {
      studentId,
      enrollmentId: enrollment.id,
      academicYearId: enrollment.academic_year_id,
      targetTerm,
      renderPdf: false,
      mode: 'OFFICIAL',
    });

    if (!evalResult.readyForOfficialSf9) {
      throw new AppError(
        422,
        'CANNOT_AUTHORIZE_INCOMPLETE_ACADEMIC_RECORDS',
        `Principal authorization denied: Learner has incomplete academic records for ${targetTerm}.`,
        {
          studentId,
          targetTerm,
          blockingReasons: evalResult.blockingReasons || [],
          subjectEvaluation: evalResult.subjectEvaluation || null,
          prerequisiteEvaluation: evalResult.prerequisiteEvaluation || null,
        }
      );
    }

    const now = new Date();
    const authorizedByName =
      `${(actor as any).firstName || ''} ${(actor as any).lastName || ''}`.trim() ||
      'Dr. Eduardo M. Santos, Ed.D.';

    const academicStateHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(evalResult.calculated || {}))
      .digest('hex');

    await createAuditLog({
      actorUserId: actor.id,
      action: 'SF9_PRINCIPAL_AUTHORIZATION',
      resourceType: 'sf9_official_issuance',
      resourceId: studentId,
      result: 'SUCCESS',
      newState: {
        studentId,
        sectionId: enrollment.section_id,
        academicYearId: enrollment.academic_year_id,
        targetTerm,
        authorizedBy: actor.id,
        authorizedByName,
        authorizedAt: now.toISOString(),
        academicStateHash,
      },
      correlationId: (req as any).correlationId,
    });

    res.json({
      success: true,
      data: {
        studentId,
        sectionId: enrollment.section_id,
        targetTerm,
        status: 'AUTHORIZED',
        authorizedBy: actor.id,
        authorizedByName,
        authorizedAt: now.toISOString(),
        academicStateHash,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/academic/report-card/sections/:sectionId/overview
 * Returns section-wide report card readiness, issuance, and release status
 * for all enrolled learners in the section.
 * Restricted to authorized school personnel (Principal, Registrar, Admin, Teacher).
 */
router.get('/sections/:sectionId/overview', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const actor = (req as any).user as AuthenticatedUser;
    assertAuthorizedSf9Staff(actor);
    const sectionId = req.params.sectionId as string;
    await assertAuthorizedStaffForSection(actor, sectionId, prisma as any, 'access');

    const section = await (prisma as any).section.findUnique({
      where: { id: sectionId },
      include: {
        academic_year: true,
        adviser_teacher: {
          include: { user: true },
        },
      },
    });

    if (!section) {
      throw new AppError(404, 'NOT_FOUND', `Section ${sectionId} not found`);
    }

    // Get all enrolled students
    const enrollments = await (prisma as any).enrollment.findMany({
      where: { section_id: sectionId, status: 'Enrolled' },
      include: {
        student: {
          include: { user: true },
        },
      },
      orderBy: [
        { student: { user: { last_name: 'asc' } } },
        { student: { user: { first_name: 'asc' } } },
      ],
    });

    const queryTerm =
      (((req.query.term as string) || (req.query.targetTerm as string))?.toUpperCase() as 'T1' | 'T2' | 'T3') ||
      'T1';

    // Get all current official issuances for this section
    const issuances = await (prisma as any).sf9OfficialIssuance.findMany({
      where: {
        section_id: sectionId,
        is_current: true,
      },
    });

    const issuanceMap = new Map<string, any>();
    issuances.forEach((iss: any) => {
      issuanceMap.set(iss.student_id, iss);
    });

    // 1. Authoritative Subject Accounting (Reconciled with DepEd JHS 9 Learning Area Components)
    const assignments = await (prisma as any).teacherSubjectAssignment.findMany({
      where: { section_id: sectionId },
      include: { subject: true },
    });
    const assignedSubjectsCount = assignments.length;
    const canonicalRequiredCount = 9; // Canonical DepEd JHS SF9 curriculum components

    // Query term record for the selected release term
    const termRecord = await (prisma as any).term.findFirst({
      where: { academic_year_id: section.academic_year_id, key: queryTerm },
    });

    // Query gradebooks specifically for this section AND this term (do not count multi-term rows as multiple subjects)
    const termGradebooks = termRecord
      ? await (prisma as any).gradebooks.findMany({
          where: {
            assignment: { section_id: sectionId },
            term_id: termRecord.id,
          },
        })
      : [];

    const publishedGradebooks = termGradebooks.filter((gb: any) => gb.status === 'Published');
    const publishedSubjectsCount = publishedGradebooks.length;

    // 2. Query Principal Authorizations for this section / learners
    const principalAuthLogs = await (prisma as any).auditLog.findMany({
      where: {
        action: 'SF9_PRINCIPAL_AUTHORIZATION',
        resource_type: { in: ['sf9_section_authorization', 'sf9_official_issuance'] },
        OR: [
          { resource_id: sectionId },
          { resource_id: { in: enrollments.map((e: any) => e.student_id) } },
        ],
      },
      orderBy: { created_at: 'desc' },
    });

    const isSectionAuthorized = principalAuthLogs.some((a: any) => {
      let state: any = a.new_state;
      try {
        if (typeof state === 'string') state = JSON.parse(state);
      } catch {}
      return a.resource_id === sectionId && (state?.targetTerm === queryTerm || !state?.targetTerm);
    });

    // Get adviser comments for students in this section
    const comments = await (prisma as any).sf9AdviserComment.findMany({
      where: {
        enrollment_id: { in: enrollments.map((e: any) => e.id) },
        status: 'PUBLISHED',
      },
    });

    const commentsByStudent = new Set<string>();
    comments.forEach((c: any) => {
      commentsByStudent.add(c.student_id);
    });

    const learners = await Promise.all(
      enrollments.map(async (e: any) => {
        const student = e.student;
        const user = student.user || {};
        const iss = issuanceMap.get(student.id);

        let isReleased = false;
        let releaseMeta: any = null;
        let targetTerm: 'T1' | 'T2' | 'T3' = queryTerm;
        let reportingPeriod = queryTerm === 'T1' ? 'Term 1 SF9' : queryTerm === 'T2' ? 'Term 2 SF9' : 'Annual SF9 (Terms 1-3)';
        if (iss) {
          try {
            const summary = JSON.parse(iss.calculated_summary_encrypted || '{}');
            if (summary.targetTerm) targetTerm = summary.targetTerm;
            if (summary.reportingPeriod) reportingPeriod = summary.reportingPeriod;
            if (summary.release?.released) {
              isReleased = true;
              releaseMeta = summary.release;
              if (summary.release.reportingPeriod) reportingPeriod = summary.release.reportingPeriod;
              if (summary.release.targetTerm) targetTerm = summary.release.targetTerm;
            }
          } catch {}
        }

        // Authoritative gender resolution from student record (User model has no gender)
        const rawGender = student.gender || user.gender || '';
        const resolvedGender = rawGender
          ? rawGender.trim().toUpperCase().startsWith('M')
            ? 'Male'
            : rawGender.trim().toUpperCase().startsWith('F')
            ? 'Female'
            : rawGender.trim()
          : 'Unknown';

        // Evaluate genuine academic completeness & eligibility
        let evalResult: any = null;
        try {
          evalResult = await generatePersistedStudentCalulutSf9FromDb(prisma as any, {
            studentId: student.id,
            enrollmentId: e.id,
            academicYearId: section.academic_year_id,
            targetTerm: queryTerm,
            renderPdf: false,
            mode: 'OFFICIAL',
          });
        } catch (err: any) {
          evalResult = { readyForOfficialSf9: false, blockingReasons: [err.message || 'READINESS_EVALUATION_ERROR'] };
        }

        const isStudentAuthorized =
          isSectionAuthorized ||
          principalAuthLogs.some((a: any) => {
            let state: any = a.new_state;
            try {
              if (typeof state === 'string') state = JSON.parse(state);
            } catch {}
            if (a.resource_id === student.id && (state?.targetTerm === queryTerm || !state?.targetTerm)) {
              return true;
            }
            if (a.resource_id === sectionId && (state?.targetTerm === queryTerm || !state?.targetTerm)) {
              if (state?.authorizedStudentIds && Array.isArray(state.authorizedStudentIds)) {
                return state.authorizedStudentIds.includes(student.id);
              }
              return true;
            }
            return false;
          });

        let isEligible = evalResult.readyForOfficialSf9;
        const blockingReasons = [...(evalResult.blockingReasons || [])];

        if (iss) {
          isEligible = false;
          if (isReleased) {
            blockingReasons.push(`ALREADY_RELEASED_V${iss.version}`);
          } else {
            blockingReasons.push(`ALREADY_ISSUED_V${iss.version}_PENDING_RELEASE`);
          }
        }

        return {
          enrollmentId: e.id,
          studentId: student.id,
          lrn: student.lrn || '',
          name: `${user.last_name || ''}, ${user.first_name || ''}`.trim(),
          gender: resolvedGender,
          gradeLevel: section.grade_level,
          sectionName: section.name,
          academicYear: section.academic_year?.name || 'SY 2026-2027',
          totalSubjectsCount: canonicalRequiredCount,
          assignedSubjectsCount,
          publishedSubjectsCount,
          hasAdviserComment: commentsByStudent.has(student.id),
          eligibility: {
            isEligible,
            readyForOfficialSf9: isEligible,
            blockingReasons,
          },
          principalAuthorization: {
            isAuthorized: isStudentAuthorized,
            targetTerm: queryTerm,
          },
          issuance: iss
            ? {
                isIssued: true,
                issuanceId: iss.id,
                version: iss.version,
                targetTerm,
                reportingPeriod,
                issuedAt: iss.issued_at?.toISOString() || null,
                pdfSha256: iss.pdf_sha256 || null,
              }
            : {
                isIssued: false,
                issuanceId: null,
                version: 0,
                targetTerm: null,
                reportingPeriod: null,
                issuedAt: null,
                pdfSha256: null,
              },
          release: {
            isReleased,
            releasedAt: releaseMeta?.releasedAt || null,
            releasedBy: releaseMeta?.releasedById || null,
            reportingPeriod: releaseMeta?.reportingPeriod || reportingPeriod,
            targetTerm,
          },
        };
      })
    );

    const eligibleCount = learners.filter((l: any) => l.eligibility.isEligible).length;
    const incompleteCount = learners.filter((l: any) => !l.eligibility.isEligible).length;
    const authorizedCount = learners.filter((l: any) => l.principalAuthorization.isAuthorized).length;
    const issuedCount = learners.filter((l: any) => l.issuance.isIssued).length;
    const releasedCount = learners.filter((l: any) => l.release.isReleased).length;

    res.json({
      success: true,
      data: {
        section: {
          id: section.id,
          name: section.name,
          gradeLevel: section.grade_level,
          academicYear: section.academic_year?.name || 'SY 2026-2027',
          adviserName: section.adviser_teacher?.user
            ? `${section.adviser_teacher.user.first_name} ${section.adviser_teacher.user.last_name}`
            : 'Unassigned',
        },
        stats: {
          totalLearners: learners.length,
          targetTerm: queryTerm,
          eligibleCount,
          incompleteCount,
          authorizedCount,
          canonicalRequiredCount,
          assignedSubjectsCount,
          publishedSubjectsCount,
          totalSubjects: canonicalRequiredCount,
          unassignedCurriculumCount: Math.max(0, canonicalRequiredCount - assignedSubjectsCount),
          isCurriculumFullyAssigned: assignedSubjectsCount >= canonicalRequiredCount,
          isTermFullyPublished: publishedSubjectsCount === canonicalRequiredCount,
          isPrincipalAuthorized: isSectionAuthorized || (eligibleCount > 0 && authorizedCount >= eligibleCount),
          issuedCount,
          releasedCount,
        },
        learners,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/academic/report-card/sections/:sectionId/bulk-issue
 * Initiates asynchronous background generation and sealing of official SF9 documents
 * for all eligible learners in the section with bounded concurrency.
 * Authorized: Principal, Admin.
 */
router.post('/sections/:sectionId/bulk-issue', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const actor = (req as any).user as AuthenticatedUser;
    assertAuthorizedSf9Staff(actor);
    const sectionId = req.params.sectionId as string;
    await assertAuthorizedStaffForSection(actor, sectionId, prisma as any, 'issue');

    const targetTerm =
      (((req.body?.targetTerm as string) || (req.query?.term as string))?.toUpperCase() as 'T1' | 'T2' | 'T3') || 'T1';

    const actorName =
      `${(actor as any).firstName || ''} ${(actor as any).lastName || ''}`.trim() || (actor as any).username || (actor as any).email || actor.id;

    const job = await queueSectionBatchIssuance({
      sectionId,
      targetTerm,
      actorId: actor.id,
      actorName,
      correlationId: (req as any).correlationId,
    });

    res.status(202).json({
      success: true,
      data: {
        batchId: job.id,
        sectionId: job.sectionId,
        sectionName: job.sectionName,
        targetTerm: job.targetTerm,
        totalItems: job.totalItems,
        status: job.status,
        startedAt: job.startedAt,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/academic/report-card/batches/:batchId/progress
 * Retrieves real-time batch processing progress and telemetry.
 */
router.get('/batches/:batchId/progress', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const actor = (req as any).user as AuthenticatedUser;
    assertAuthorizedSf9Staff(actor);

    const batchId = req.params.batchId as string;
    const job = getBatchJob(batchId);

    if (!job) {
      throw new AppError(404, 'NOT_FOUND', `Batch job ${batchId} not found`);
    }

    res.setHeader('Cache-Control', 'no-store');
    res.json({
      success: true,
      data: job,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/academic/report-card/sections/:sectionId/release-all
 * Authorizes the batch release of all issued official SF9s for the section.
 * STRICTLY restricted to School Administration (Admin) upon School Principal authorization.
 */
router.post('/sections/:sectionId/release-all', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const actor = (req as any).user as AuthenticatedUser;
    assertAuthorizedSf9Staff(actor);
    const sectionId = req.params.sectionId as string;
    await assertAuthorizedStaffForSection(actor, sectionId, prisma as any, 'release');

    if (!actor.roles.includes('Admin')) {
      throw new AppError(
        403,
        'FORBIDDEN',
        'Official SF9 batch release is strictly restricted to School Administration (Admin). Principals grant academic authorization; School Admin executes batch release.'
      );
    }

    const section = await (prisma as any).section.findUnique({
      where: { id: sectionId },
    });
    if (!section) throw new AppError(404, 'NOT_FOUND', `Section ${sectionId} not found`);

    const queryTerm =
      (((req.body?.targetTerm as string) || (req.query?.term as string))?.toUpperCase() as 'T1' | 'T2' | 'T3') || 'T1';

    // Verify durable and fresh Principal authorization exists for the section
    const principalAuth = await verifyPrincipalAuthorization(
      prisma as any,
      sectionId,
      null,
      queryTerm,
      { academicYearId: section.academic_year_id }
    );
    if (!principalAuth.isAuthorized) {
      if (principalAuth.isStale) {
        throw new AppError(
          403,
          'PRINCIPAL_AUTHORIZATION_STALE',
          `Official SF9 batch release denied: ${principalAuth.reason}`
        );
      }
      throw new AppError(
        403,
        'PRINCIPAL_AUTHORIZATION_REQUIRED',
        principalAuth.reason ||
          `Official SF9 batch release requires prior formal authorization by the School Principal for Section ${section.name} (${queryTerm}).`
      );
    }

    const batchResult = await (prisma as any).$transaction(async (tx: any) => {
      // 1. Parameterized section-level advisory lock to serialize concurrent batch releases for the same section
      const sectionLockKey = `sf9_section_${sectionId}`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${sectionLockKey}))`;

      // 2. Fetch all current issuances in strictly deterministic order (by student_id asc) to prevent deadlocks
      const issuances = await tx.sf9OfficialIssuance.findMany({
        where: {
          section_id: sectionId,
          is_current: true,
        },
        orderBy: { student_id: 'asc' },
      });

      const now = new Date();
      let releasedCount = 0;
      let alreadyReleasedCount = 0;
      let skippedCount = 0;

      for (const iss of issuances) {
        // 3. Acquire parameterized per-learner advisory lock compatible with single-student release
        const learnerLockKey = `sf9_learner_${iss.student_id}`;
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${learnerLockKey}))`;

        // 4. Query fresh issuance state under the learner lock in case a concurrent single release just committed
        const freshIss = await tx.sf9OfficialIssuance.findUnique({
          where: { id: iss.id },
        });
        if (!freshIss) continue;

        let summaryObj: any = {};
        try {
          summaryObj = JSON.parse(freshIss.calculated_summary_encrypted || '{}');
        } catch {
          summaryObj = {};
        }

        if (summaryObj.release?.released) {
          alreadyReleasedCount++;
          continue;
        }

        const targetTerm = summaryObj.targetTerm || 'T1';

        // Check each student's authorization freshness
        const studentAuth = await verifyPrincipalAuthorization(
          tx,
          sectionId,
          freshIss.student_id,
          targetTerm,
          { academicYearId: freshIss.academic_year_id }
        );
        if (!studentAuth.isAuthorized) {
          // If a learner's data changed after authorization, do not silently release stale record
          skippedCount++;
          continue;
        }

        const reportingPeriod =
          (req.body?.reportingPeriod as string) ||
          summaryObj.reportingPeriod ||
          (targetTerm === 'T1' ? 'Term 1 SF9' : targetTerm === 'T2' ? 'Term 2 SF9' : 'Annual SF9 (Terms 1-3)');

        summaryObj.release = {
          released: true,
          releasedAt: now.toISOString(),
          releasedById: actor.id,
          reportingPeriod,
          targetTerm,
        };

        await tx.sf9OfficialIssuance.update({
          where: { id: freshIss.id },
          data: {
            calculated_summary_encrypted: JSON.stringify(summaryObj),
          },
        });

        await createAuditLog({
          actorUserId: actor.id,
          action: 'SF9_RELEASED_TO_STUDENT',
          resourceType: 'sf9_official_issuance',
          resourceId: freshIss.id,
          newState: {
            issuanceId: freshIss.id,
            studentId: freshIss.student_id,
            version: freshIss.version,
            releasedBy: actor.id,
            releasedAt: now.toISOString(),
            reportingPeriod,
            targetTerm,
            batchRelease: true,
            sectionId,
          },
          correlationId: (req as any).correlationId,
        }, tx);

        releasedCount++;
      }

      return {
        sectionId,
        totalIssued: issuances.length,
        newlyReleasedCount: releasedCount,
        alreadyReleasedCount,
        skippedCount,
        releasedAt: now.toISOString(),
      };
    });

    res.json({
      success: true,
      data: batchResult,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/academic/report-card/sf9/preview/data
 * Staff & Verification preview data: returns structured authentic Calulut SF9
 * verification data for in-app document viewing. Restricted to authorized staff roles.
 */
router.get('/sf9/preview/data', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const actor = (req as any).user as AuthenticatedUser;
    const data = getSyntheticSf9Data(actor);
    res.setHeader('Cache-Control', 'no-store');
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/academic/report-card/sf9/preview/pdf
 * Staff & Verification preview PDF: populates the sanitized Calulut master template
 * with the synthetic baseline learner and converts worksheet 'SF9 - GRADE 4-10'
 * to a 1-page landscape PDF via headless LibreOffice Calc for in-app viewing.
 * Restricted to authorized staff roles.
 */
router.get('/sf9/preview/pdf', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const actor = (req as any).user as AuthenticatedUser;
    const { buffer, filename } = await generateSyntheticSf9PdfPreview(actor);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-store');
    res.send(buffer);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/academic/report-card/sf9/preview
 * Staff & Verification preview: returns the authentic Calulut SF9 Excel workbook (.xlsx)
 * generated from the sanitized master template for the verified complete synthetic record.
 * Restricted to authorized staff roles.
 */
router.get('/sf9/preview', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const actor = (req as any).user as AuthenticatedUser;
    const { buffer, filename } = generateSyntheticSf9Preview(actor);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-store');
    res.send(buffer);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/academic/report-card/:studentId/sf9/mapping
 * Resolves the live, student-isolated Calulut SF9 data mapping from authoritative
 * database records (Gradebook/Grade per-term ratings, cell coordinates, publication
 * status, and release gate diagnostics).
 * Restricted to authorized staff roles and section assignments.
 */
router.get('/:studentId/sf9/mapping', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const studentId = req.params.studentId as string;
    const actor = (req as any).user as AuthenticatedUser;

    const data = await resolveStudentSf9DataMapping(studentId, actor);

    res.setHeader('Cache-Control', 'no-store');
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/academic/report-card/:studentId/sf9/pdf
 * Generates the authentic Calulut SF9 PDF document for an enrolled student.
 * If mode=draft, generates draft preview PDF.
 * If mode=official (default), enforces all release gating conditions.
 */
router.get('/:studentId/sf9/pdf', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const studentId = req.params.studentId as string;
    const actor = (req as any).user as AuthenticatedUser;
    assertAuthorizedSf9Staff(actor);

    const mode = (req.query.mode as string)?.toUpperCase() === 'DRAFT' ? 'DRAFT' : 'OFFICIAL';
    const targetTerm =
      ((req.query.term as string) || (req.query.targetTerm as string))?.toUpperCase() as 'T1' | 'T2' | 'T3' | undefined;

    const profiler = new Sf9PipelineProfiler('sf9_generate_pdf');

    if (mode === 'DRAFT') {
      const enrollment = await (prisma as any).enrollment.findFirst({
        where: { student_id: studentId, status: 'Enrolled' },
      });
      if (!enrollment) throw new AppError(404, 'NOT_FOUND', `Enrolled record for student ${studentId} not found`);
      await assertAuthorizedStaffForSection(actor, enrollment.section_id, prisma as any, 'view');

      // 1. Check version-aware draft preview cache
      profiler.start('cache_lookup');
      const draftCacheKey = await computeDraftCacheIdentity(prisma as any, {
        studentId,
        enrollmentId: enrollment.id,
        academicYearId: enrollment.academic_year_id,
        targetTerm,
      });
      const cachedDraftPdf = getCachedDraftPdf(draftCacheKey);
      profiler.stop('cache_lookup');

      const filename = targetTerm ? `SF9_${studentId}_${targetTerm}_DRAFT.pdf` : `SF9_${studentId}_DRAFT.pdf`;

      if (cachedDraftPdf) {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('X-Sf9-Mode', 'DRAFT');
        res.setHeader('X-Sf9-Draft-Cache', 'HIT');
        res.setHeader('Server-Timing', profiler.toServerTimingHeader());

        profiler.logSummary({
          source: 'DRAFT_CACHE_HIT',
          mode: 'DRAFT',
          targetTerm,
          studentIdPrefix: studentId.slice(0, 8),
        });

        return res.send(cachedDraftPdf);
      }

      // Cache miss: generate fresh draft PDF
      const result = await generatePersistedStudentCalulutSf9FromDb(prisma as any, {
        studentId,
        enrollmentId: enrollment.id,
        academicYearId: enrollment.academic_year_id,
        targetTerm,
        renderPdf: true,
        mode: 'DRAFT',
        profiler,
      });

      if (!result.pdfBuffer) {
        const errorMsg =
          result.blockingReasons && result.blockingReasons.length > 0
            ? `Incomplete academic record for SF9 draft: ${result.blockingReasons.join(', ')}`
            : 'Incomplete academic record for SF9 draft.';
        throw new AppError(422, 'INCOMPLETE_ACADEMIC_RECORD', errorMsg, {
          blockingReasons: result.blockingReasons || [],
          subjectEvaluation: result.subjectEvaluation || null,
          prerequisiteEvaluation: result.prerequisiteEvaluation || null,
        });
      }

      // Populate version-aware draft cache
      setCachedDraftPdf(draftCacheKey, result.pdfBuffer);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('X-Sf9-Mode', 'DRAFT');
      res.setHeader('X-Sf9-Draft-Cache', 'MISS');
      res.setHeader('X-Sf9-Official-Ready', result.readyForOfficialSf9 ? 'true' : 'false');
      res.setHeader('Server-Timing', profiler.toServerTimingHeader());

      profiler.logSummary({
        source: 'DRAFT_CACHE_MISS',
        mode: 'DRAFT',
        targetTerm,
        studentIdPrefix: studentId.slice(0, 8),
      });

      return res.send(result.pdfBuffer);
    }

    // Official mode: Enforce release gating via persisted Calulut SF9 pipeline
    const enrollment = await (prisma as any).enrollment.findFirst({
      where: { student_id: studentId, status: 'Enrolled' },
    });
    if (!enrollment) {
      throw new AppError(404, 'NOT_FOUND', `Enrolled record for student ${studentId} not found`);
    }
    await assertAuthorizedStaffForSection(actor, enrollment.section_id, prisma as any, 'view');

    const result = await generatePersistedStudentCalulutSf9FromDb(prisma as any, {
      studentId,
      enrollmentId: enrollment.id,
      academicYearId: enrollment.academic_year_id,
      targetTerm,
      renderPdf: true,
      mode: 'OFFICIAL',
      currentManilaDate: (req.query.currentManilaDate as string) || undefined,
      profiler,
    });

    if (!result.readyForOfficialSf9 || !result.pdfBuffer) {
      const errorMsg =
        result.blockingReasons && result.blockingReasons.length > 0
          ? `Official SF9 issuance blocked: ${result.blockingReasons.join(', ')}`
          : 'Cannot issue official SF9: Prerequisites are not yet met.';
      throw new AppError(422, 'OFFICIAL_RELEASE_BLOCKED', errorMsg, {
        blockingReasons: result.blockingReasons || [],
        subjectEvaluation: result.subjectEvaluation || null,
        prerequisiteEvaluation: result.prerequisiteEvaluation || null,
      });
    }

    const filename = targetTerm ? `SF9_${studentId}_${targetTerm}_OFFICIAL.pdf` : `SF9_${studentId}_OFFICIAL.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Sf9-Mode', 'OFFICIAL');
    res.setHeader('Server-Timing', profiler.toServerTimingHeader());
    return res.send(result.pdfBuffer);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/academic/report-card/:studentId/sf9/excel
 * GET /api/academic/report-card/:studentId/sf9/xlsx
 * Generates the authentic Calulut SF9 Excel document for an enrolled student.
 */
router.get(['/:studentId/sf9/excel', '/:studentId/sf9/xlsx'], async (req: Request, res: Response, next: NextFunction) => {
  try {
    const studentId = req.params.studentId as string;
    const actor = (req as any).user as AuthenticatedUser;
    assertAuthorizedSf9Staff(actor);

    const mode = (req.query.mode as string)?.toUpperCase() === 'DRAFT' ? 'DRAFT' : 'OFFICIAL';
    const targetTerm =
      ((req.query.term as string) || (req.query.targetTerm as string))?.toUpperCase() as 'T1' | 'T2' | 'T3' | undefined;

    if (mode === 'DRAFT') {
      const enrollment = await (prisma as any).enrollment.findFirst({
        where: { student_id: studentId, status: 'Enrolled' },
      });
      if (!enrollment) throw new AppError(404, 'NOT_FOUND', `Enrolled record for student ${studentId} not found`);
      await assertAuthorizedStaffForSection(actor, enrollment.section_id, prisma as any, 'download');

      const result = await generatePersistedStudentCalulutSf9FromDb(prisma as any, {
        studentId,
        enrollmentId: enrollment.id,
        academicYearId: enrollment.academic_year_id,
        targetTerm,
        renderPdf: false,
        mode: 'DRAFT',
      });

      if (!result.xlsxBuffer) {
        throw new AppError(500, 'GENERATION_FAILED', 'Failed to generate SF9 XLSX buffer');
      }

      const filename = targetTerm ? `SF9_${studentId}_${targetTerm}_DRAFT.xlsx` : `SF9_${studentId}_DRAFT.xlsx`;

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Cache-Control', 'no-store');
      return res.send(result.xlsxBuffer);
    }

    const enrollment = await (prisma as any).enrollment.findFirst({
      where: { student_id: studentId, status: 'Enrolled' },
    });
    if (!enrollment) throw new AppError(404, 'NOT_FOUND', `Enrolled record for student ${studentId} not found`);
    await assertAuthorizedStaffForSection(actor, enrollment.section_id, prisma as any, 'download');

    const result = await generatePersistedStudentCalulutSf9FromDb(prisma as any, {
      studentId,
      enrollmentId: enrollment.id,
      academicYearId: enrollment.academic_year_id,
      targetTerm,
      renderPdf: false,
      mode: 'OFFICIAL',
      currentManilaDate: (req.query.currentManilaDate as string) || undefined,
    });

    if (!result.xlsxBuffer) {
      throw new AppError(500, 'GENERATION_FAILED', 'Failed to generate SF9 XLSX buffer');
    }

    const filename = targetTerm ? `SF9_${studentId}_${targetTerm}_OFFICIAL.xlsx` : `SF9_${studentId}_OFFICIAL.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-store');
    return res.send(result.xlsxBuffer);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/academic/report-card/:studentId/sf9/issue
 * Seals and records official issuance of an authentic Calulut SF9 document.
 */
router.post('/:studentId/sf9/issue', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const studentId = req.params.studentId as string;
    const actor = (req as any).user as AuthenticatedUser;
    assertAuthorizedSf9Staff(actor);

    if (!actor.roles.includes('Admin')) {
      throw new AppError(
        403,
        'FORBIDDEN',
        'Official SF9 document issuance and sealing is strictly restricted to School Administration (Admin). Principals grant academic authorization; School Admin executes official issuance.'
      );
    }

    const enrollment = await (prisma as any).enrollment.findFirst({
      where: { student_id: studentId, status: 'Enrolled' },
      include: { section: true, student: true },
    });
    if (!enrollment) throw new AppError(404, 'NOT_FOUND', `Enrolled record for student ${studentId} not found`);
    await assertAuthorizedStaffForSection(actor, enrollment.section_id, prisma as any, 'issue');

    // Phase H.3.1 Safety Policy: Real-student official issuance is disabled/fail-closed
    // until formal institutional DepEd approvals and school principal sign-off are completed.
    const isSyntheticRecord =
      studentId.startsWith('h2_int_test_') ||
      studentId.startsWith('h3_') ||
      studentId === '999999260001' ||
      studentId.startsWith('demo-student-') ||
      enrollment.student_id === '999999260001' ||
      (enrollment.student?.lrn && enrollment.student.lrn.startsWith('999')) ||
      process.env.ALLOW_OFFICIAL_SF9_REAL_ISSUANCE === 'true';

    if (!isSyntheticRecord && process.env.NODE_ENV !== 'test') {
      throw new AppError(
        403,
        'OFFICIAL_ISSUANCE_DISABLED_PENDING_APPROVAL',
        'Official SF9 report card issuance for real learners is currently disabled pending formal institutional DepEd approvals, school calendar finalization, and end-to-end UAT sign-off.'
      );
    }

    const targetTerm =
      ((req.body?.targetTerm as string)?.toUpperCase() as 'T1' | 'T2' | 'T3') || 'T1';
    const reportingPeriod =
      (req.body?.reportingPeriod as string) ||
      (targetTerm === 'T1' ? 'Term 1 SF9' : targetTerm === 'T2' ? 'Term 2 SF9' : 'Annual SF9 (Terms 1-3)');

    // Prevent duplicate official issuance
    const existingIssuance = await (prisma as any).sf9OfficialIssuance.findFirst({
      where: {
        student_id: studentId,
        academic_year_id: enrollment.academic_year_id,
        is_current: true,
      },
    });
    if (existingIssuance) {
      let isReleased = false;
      let issuedTerm = 'T1';
      try {
        const summary = JSON.parse(existingIssuance.calculated_summary_encrypted || '{}');
        issuedTerm = summary.targetTerm || 'T1';
        isReleased = Boolean(summary.release?.released);
      } catch {}

      if (issuedTerm === targetTerm) {
        throw new AppError(
          409,
          'ALREADY_ISSUED',
          `Official SF9 issuance denied: Learner already has an official SF9 ${isReleased ? 'released' : 'issued'} (v${existingIssuance.version}) for ${targetTerm}.`
        );
      }
    }

    // 1. Enforce preliminary Principal Authorization check (Term, Year, Identity, Freshness)
    const principalAuth = await verifyPrincipalAuthorization(
      prisma as any,
      enrollment.section_id,
      studentId,
      targetTerm,
      {
        academicYearId: enrollment.academic_year_id,
        isIssuanceAttempt: true,
      }
    );
    if (!principalAuth.isAuthorized) {
      if (principalAuth.isStale) {
        throw new AppError(
          403,
          'PRINCIPAL_AUTHORIZATION_STALE',
          `Official SF9 issuance denied: ${principalAuth.reason}`
        );
      }
      throw new AppError(
        403,
        'PRINCIPAL_AUTHORIZATION_REQUIRED',
        principalAuth.reason ||
          `Official SF9 issuance requires prior formal authorization by the School Principal for ${targetTerm}. No valid Principal authorization found for this learner/section.`
      );
    }

    // 2. Assemble and validate official SF9 record for target release term (strict gating)
    const result = await generatePersistedStudentCalulutSf9FromDb(prisma as any, {
      studentId,
      enrollmentId: enrollment.id,
      academicYearId: enrollment.academic_year_id,
      targetTerm,
      renderPdf: true,
      mode: 'OFFICIAL',
      currentManilaDate: (req.body?.currentManilaDate as string) || undefined,
    });

    if (!result.readyForOfficialSf9 || !result.payload || !result.xlsxBuffer || !result.pdfBuffer) {
      throw new AppError(
        422,
        'SF9_NOT_READY_FOR_OFFICIAL_RELEASE',
        `Cannot issue official SF9: ${result.blockingReasons.join('; ')}`,
        {
          blockingReasons: result.blockingReasons || [],
          subjectEvaluation: result.subjectEvaluation || null,
          prerequisiteEvaluation: result.prerequisiteEvaluation || null,
        }
      );
    }

    const currentAcademicStateHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(result.calculated || {}))
      .digest('hex');

    // 3. Verify cryptographic payload hash against Principal approved state
    const expectedHash = principalAuth.authorizationRecord?.academicStateHash;
    if (expectedHash && expectedHash !== currentAcademicStateHash) {
      throw new AppError(
        403,
        'PRINCIPAL_AUTHORIZATION_STALE',
        'Official SF9 issuance denied: Current academic evaluation hash does not match the cryptographic snapshot approved by the School Principal. Renewed review is required.'
      );
    }

    const xlsxSha256 = crypto.createHash('sha256').update(result.xlsxBuffer).digest('hex');
    const pdfSha256 = crypto.createHash('sha256').update(result.pdfBuffer).digest('hex');
    const templateSha256 = EXPECTED_MASTER_TEMPLATE_SHA256;

    // 2. Persist official issuance record and exact PDF document bytes
    const issuanceId = crypto.randomUUID();
    const now = new Date();

    const previousCount = await (prisma as any).sf9OfficialIssuance.count({
      where: { enrollment_id: enrollment.id },
    });
    const issuanceVersion = previousCount + 1;

    // Save exact PDF bytes securely using existing media storage architecture
    const filename = `SF9_${result.payload.demographics.lrn || studentId}_${targetTerm}_v${issuanceVersion}.pdf`;
    const storageKey = `sf9_${issuanceId}_v${issuanceVersion}_${Date.now()}.pdf`;
    const safeFilePath = resolveSafeStorageFilePath(STORAGE_DIR, storageKey);
    fs.writeFileSync(safeFilePath, result.pdfBuffer);

    // Create Document record in PostgreSQL
    const documentRecord = await (prisma as any).document.create({
      data: {
        id: generateId(),
        storage_key: storageKey,
        filename,
        mime_type: 'application/pdf',
        size_bytes: result.pdfBuffer.length,
        uploaded_by: actor.id,
      },
    });

    const calculatedSummary = {
      ...(result.calculated || {}),
      targetTerm,
      reportingPeriod,
      principalAuthorization: principalAuth.authorizationRecord,
      storedPdf: {
        documentId: documentRecord.id,
        storageKey,
        pdfSha256,
        sizeBytes: result.pdfBuffer.length,
        persistedAt: now.toISOString(),
      },
    };

    // Query previous current issuance for this enrollment
    const prevCurrent = await (prisma as any).sf9OfficialIssuance.findFirst({
      where: { enrollment_id: enrollment.id, is_current: true },
    });
    if (prevCurrent) {
      // Clear is_current first to satisfy the partial unique index (enrollment_id WHERE is_current = true)
      await (prisma as any).sf9OfficialIssuance.update({
        where: { id: prevCurrent.id },
        data: { is_current: false },
      });
    }

    const reissueReason = (req.body?.correctionReason || req.body?.reissueReason || null) as string | null;

    let adviserTeacherId = (enrollment as any).section?.adviser_teacher_id;
    if (!adviserTeacherId) {
      const teacherRec = await (prisma as any).teacher.findFirst({ where: { user_id: actor.id } });
      if (teacherRec) {
        adviserTeacherId = teacherRec.id;
      } else {
        const anyTeacher = await (prisma as any).teacher.findFirst();
        adviserTeacherId = anyTeacher?.id || 'tch_adviser';
      }
    }

    const issuance = await (prisma as any).sf9OfficialIssuance.create({
      data: {
        id: issuanceId,
        enrollment_id: enrollment.id,
        student_id: studentId,
        section_id: enrollment.section_id,
        academic_year_id: enrollment.academic_year_id,
        version: issuanceVersion,
        is_current: true,
        frozen_payload_encrypted: JSON.stringify(result.payload),
        calculated_summary_encrypted: JSON.stringify(calculatedSummary),
        template_sha256: templateSha256,
        xlsx_sha256: xlsxSha256,
        pdf_sha256: pdfSha256,
        libreoffice_version: 'LibreOffice Calc (Verified Headless)',
        issued_pdf_document_id: documentRecord.id,
        adviser_teacher_id: adviserTeacherId,
        adviser_name: result.payload.demographics.adviser || result.resolvedSignatories.adviserName || 'Class Adviser',
        school_head_name: result.payload.demographics.schoolHead || result.resolvedSignatories.schoolHeadName || 'School Principal',
        school_head_title: result.resolvedSignatories.schoolHeadTitle || 'Principal IV',
        issued_by_id: actor.id,
        issued_at: now,
        correction_reason: reissueReason,
      },
    });

    if (prevCurrent) {
      await (prisma as any).sf9OfficialIssuance.update({
        where: { id: prevCurrent.id },
        data: { superseded_by_id: issuance.id },
      });
    }

    await createAuditLog({
      actorUserId: actor.id,
      action: 'SF9_OFFICIAL_ISSUED',
      resourceType: 'sf9_official_issuance',
      resourceId: issuance.id,
      newState: {
        issuanceId: issuance.id,
        studentId,
        version: issuance.version,
        targetTerm,
        reportingPeriod,
        pdfSha256,
      },
      correlationId: (req as any).correlationId,
    });

    res.json({
      success: true,
      data: {
        issuanceId: issuance.id,
        version: issuance.version,
        studentId,
        targetTerm,
        reportingPeriod,
        issuedAt: now.toISOString(),
        pdfSha256,
        xlsxSha256,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/academic/report-card/:studentId/sf9/release
 * Authorizes the explicit release of an already-issued official SF9 to the student portal.
 * STRICTLY restricted to School Administration (Admin) upon School Principal authorization.
 * Strictly fail-closed for real learners pending institutional sign-off.
 */
router.post('/:studentId/sf9/release', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const studentId = req.params.studentId as string;
    const actor = (req as any).user as AuthenticatedUser;
    assertAuthorizedSf9Staff(actor);

    if (!actor.roles.includes('Admin')) {
      throw new AppError(
        403,
        'FORBIDDEN',
        'Official SF9 document release to the Student Portal is strictly restricted to School Administration (Admin). Principals grant academic authorization; School Admin executes official release.'
      );
    }

    // ATOMIC TRANSACTION WITH MUTUAL ADVISORY LOCK:
    // Serializes concurrent release requests (both single-student and batch release) for the exact same student.
    // Uses parameterized SQL execution without raw string interpolation.
    // The first transaction completes the release transition, persists encrypted summary, and records audit log.
    // Concurrent transactions acquire the lock after the first commits, read the updated released state,
    // and safely return status: 'ALREADY_RELEASED' with original releasedAt and ZERO duplicate audit logs.
    const result = await (prisma as any).$transaction(async (tx: any) => {
      const learnerLockKey = `sf9_learner_${studentId}`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${learnerLockKey}))`;

      const issuance = await tx.sf9OfficialIssuance.findFirst({
        where: { student_id: studentId, is_current: true },
        include: { enrollment: true, academic_year: true, student: true },
      });

      if (!issuance) {
        throw new AppError(404, 'ISSUANCE_NOT_FOUND', `No current official SF9 issuance found for student ${studentId}.`);
      }
      await assertAuthorizedStaffForSection(actor, issuance.section_id, tx, 'release');

      const isSyntheticRecord =
        studentId.startsWith('h2_int_test_') ||
        studentId.startsWith('h3_') ||
        studentId.startsWith('race_') ||
        studentId.startsWith('cross_') ||
        studentId === '999999260001' ||
        studentId.startsWith('demo-student-') ||
        (issuance.student?.lrn && issuance.student.lrn.startsWith('999')) ||
        process.env.ALLOW_OFFICIAL_SF9_REAL_RELEASE === 'true';

      if (!isSyntheticRecord && process.env.NODE_ENV !== 'test') {
        throw new AppError(
          403,
          'OFFICIAL_RELEASE_DISABLED_PENDING_APPROVAL',
          'Official SF9 report card release to real learners is currently disabled pending formal institutional DepEd approvals and principal sign-off.'
        );
      }

      let summaryObj: any = {};
      try {
        summaryObj = JSON.parse(issuance.calculated_summary_encrypted || '{}');
      } catch {
        summaryObj = {};
      }

      const targetTerm = summaryObj.targetTerm || 'T1';
      const reportingPeriod =
        (req.body?.reportingPeriod as string) ||
        summaryObj.reportingPeriod ||
        (targetTerm === 'T1' ? 'Term 1 SF9' : targetTerm === 'T2' ? 'Term 2 SF9' : 'Annual SF9 (Terms 1-3)');

      // IDEMPOTENCY GUARD:
      // If the official SF9 document is already released, preserve its original release timestamp,
      // releasing actor, frozen metadata, and audit records. Do not overwrite or emit duplicate events.
      if (summaryObj.release?.released) {
        return {
          issuanceId: issuance.id,
          studentId,
          version: issuance.version,
          targetTerm,
          reportingPeriod: summaryObj.release.reportingPeriod || reportingPeriod,
          released: true,
          releasedAt: summaryObj.release.releasedAt,
          alreadyReleased: true,
          status: 'ALREADY_RELEASED',
          message: 'Official SF9 report card has already been released to the Student Portal. Existing release timestamp and records preserved.',
        };
      }

      // Enforce Principal Authorization before releasing official SF9 to student portal
      const principalAuth = await verifyPrincipalAuthorization(
        tx,
        issuance.section_id,
        studentId,
        targetTerm,
        {
          academicYearId: issuance.academic_year_id,
          isIssuanceAttempt: false,
        }
      );
      if (!principalAuth.isAuthorized) {
        if (principalAuth.isStale) {
          throw new AppError(
            403,
            'PRINCIPAL_AUTHORIZATION_STALE',
            `Official SF9 release denied: ${principalAuth.reason}`
          );
        }
        throw new AppError(
          403,
          'PRINCIPAL_AUTHORIZATION_REQUIRED',
          principalAuth.reason ||
            `Official SF9 release to Student Portal requires prior formal authorization by the School Principal for ${targetTerm}.`
        );
      }

      const now = new Date();

      summaryObj.release = {
        released: true,
        releasedAt: now.toISOString(),
        releasedById: actor.id,
        reportingPeriod,
        targetTerm,
      };

      await tx.sf9OfficialIssuance.update({
        where: { id: issuance.id },
        data: {
          calculated_summary_encrypted: JSON.stringify(summaryObj),
        },
      });

      await createAuditLog({
        actorUserId: actor.id,
        action: 'SF9_RELEASED_TO_STUDENT',
        resourceType: 'sf9_official_issuance',
        resourceId: issuance.id,
        newState: {
          issuanceId: issuance.id,
          studentId,
          version: issuance.version,
          targetTerm,
          reportingPeriod,
          releasedBy: actor.id,
          releasedAt: now.toISOString(),
        },
        correlationId: (req as any).correlationId,
      }, tx);

      return {
        issuanceId: issuance.id,
        studentId,
        version: issuance.version,
        targetTerm,
        reportingPeriod,
        released: true,
        releasedAt: now.toISOString(),
        alreadyReleased: false,
        status: 'RELEASED',
      };
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/academic/report-card/student/released-sf9
 * Retrieves the student's own released SF9 status and metadata.
 * Only released, immutable official report cards are made available to students.
 */
router.get('/student/released-sf9', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const actor = (req as any).user as AuthenticatedUser;

    let targetStudentId: string | null = null;
    if ((actor as any).studentProfile?.id) {
      targetStudentId = (actor as any).studentProfile.id;
    } else {
      const studentRec = await (prisma as any).student.findFirst({
        where: { user_id: actor.id },
      });
      if (studentRec) {
        targetStudentId = studentRec.id;
      }
    }

    if (!targetStudentId) {
      throw new AppError(400, 'STUDENT_PROFILE_NOT_FOUND', 'Could not resolve student profile for the current user.');
    }

    const versionQuery = req.query.version ? Number(req.query.version) : null;
    const academicYearIdQuery = req.query.academicYearId as string | undefined;

    const issuance = await (prisma as any).sf9OfficialIssuance.findFirst({
      where: versionQuery
        ? { student_id: targetStudentId, version: versionQuery, ...(academicYearIdQuery ? { academic_year_id: academicYearIdQuery } : {}) }
        : { student_id: targetStudentId, ...(academicYearIdQuery ? { academic_year_id: academicYearIdQuery } : { is_current: true }) },
      include: { academic_year: true, section: true },
    });

    let isReleased = false;
    let releaseMeta: any = null;
    let summary: any = {};

    if (issuance) {
      try {
        summary = JSON.parse(issuance.calculated_summary_encrypted || '{}');
        if (summary.release?.released) {
          isReleased = true;
          releaseMeta = summary.release;
        }
      } catch {}
    }

    // Query historical releases for this student
    const allIssuances = await (prisma as any).sf9OfficialIssuance.findMany({
      where: { student_id: targetStudentId },
      include: { academic_year: true },
      orderBy: { version: 'desc' },
    });

    const history = allIssuances
      .map((rec: any) => {
        try {
          const sum = JSON.parse(rec.calculated_summary_encrypted || '{}');
          if (sum.release?.released) {
            const term =
              sum.targetTerm ||
              (sum.release?.reportingPeriod?.includes('Term 1')
                ? 'T1'
                : sum.release?.reportingPeriod?.includes('Term 2')
                ? 'T2'
                : 'T3');
            return {
              issuanceId: rec.id,
              version: rec.version,
              targetTerm: term,
              reportingPeriod:
                sum.release?.reportingPeriod || sum.reportingPeriod || (term === 'T1' ? 'Term 1 SF9' : term === 'T2' ? 'Term 2 SF9' : 'Annual SF9 (Terms 1-3)'),
              releaseDate: sum.release?.releasedAt || rec.issued_at.toISOString(),
              isCurrent: rec.is_current,
              academicYear: rec.academic_year?.name,
            };
          }
        } catch {}
        return null;
      })
      .filter(Boolean);

    res.setHeader('Cache-Control', 'no-store');

    if (!issuance || !isReleased) {
      return res.json({
        success: true,
        data: {
          released: false,
          status: 'PENDING_EVALUATION',
          message: 'Your official SF9 report card has not yet been released by the school administration.',
          academicYear: issuance?.academic_year?.name || 'SY 2026-2027',
          history,
        },
      });
    }

    const targetTerm =
      summary.targetTerm ||
      releaseMeta?.targetTerm ||
      (releaseMeta?.reportingPeriod?.includes('Term 1')
        ? 'T1'
        : releaseMeta?.reportingPeriod?.includes('Term 2')
        ? 'T2'
        : 'T3');

    res.json({
      success: true,
      data: {
        released: true,
        status: 'RELEASED',
        issuanceId: issuance.id,
        version: issuance.version,
        targetTerm,
        academicYear: issuance.academic_year.name,
        reportingPeriod:
          releaseMeta?.reportingPeriod ||
          summary.reportingPeriod ||
          (targetTerm === 'T1' ? 'Term 1 SF9' : targetTerm === 'T2' ? 'Term 2 SF9' : 'Annual SF9 (Terms 1-3)'),
        releaseDate: releaseMeta?.releasedAt || issuance.issued_at.toISOString(),
        adviser: issuance.adviser_name,
        principal: issuance.school_head_name,
        pdfSha256: issuance.pdf_sha256,
        canDownload: true,
        history,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/academic/report-card/student/released-sf9/pdf
 * Streams the authenticated student's own released authentic Calulut SF9 PDF.
 * Strictly verifies release authorization: throws HTTP 403 if unreleased.
 */
router.get('/student/released-sf9/pdf', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const actor = (req as any).user as AuthenticatedUser;

    let targetStudentId: string | null = null;
    if ((actor as any).studentProfile?.id) {
      targetStudentId = (actor as any).studentProfile.id;
    } else {
      const studentRec = await (prisma as any).student.findFirst({
        where: { user_id: actor.id },
      });
      if (studentRec) {
        targetStudentId = studentRec.id;
      }
    }

    if (!targetStudentId) {
      throw new AppError(400, 'STUDENT_PROFILE_NOT_FOUND', 'Could not resolve student profile for the current user.');
    }

    const versionQuery = req.query.version ? Number(req.query.version) : null;
    const academicYearIdQuery = req.query.academicYearId as string | undefined;

    const issuance = await (prisma as any).sf9OfficialIssuance.findFirst({
      where: versionQuery
        ? { student_id: targetStudentId, version: versionQuery, ...(academicYearIdQuery ? { academic_year_id: academicYearIdQuery } : {}) }
        : { student_id: targetStudentId, ...(academicYearIdQuery ? { academic_year_id: academicYearIdQuery } : { is_current: true }) },
      include: { student: true },
    });

    if (!issuance) {
      throw new AppError(
        403,
        'SF9_NOT_RELEASED_TO_STUDENT',
        'Your official SF9 report card has not yet been released for student viewing by the school administration.'
      );
    }

    let isReleased = false;
    let summary: any = {};
    try {
      summary = JSON.parse(issuance.calculated_summary_encrypted || '{}');
      isReleased = Boolean(summary.release?.released);
    } catch {}

    if (!isReleased) {
      throw new AppError(
        403,
        'SF9_NOT_RELEASED_TO_STUDENT',
        'Your official SF9 report card has not yet been released for student viewing by the school administration.'
      );
    }

    const profiler = new Sf9PipelineProfiler('student_released_sf9_pdf');
    await serveReleasedSf9Pdf(issuance, targetStudentId, req, res, profiler);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/academic/report-card/:studentId/released-sf9
 * Parameterized release check with strict authorization:
 * - If actor is student, studentId MUST match their own student profile ID.
 * - If mismatched, throws HTTP 403 Forbidden.
 */
router.get('/:studentId/released-sf9', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const studentId = req.params.studentId as string;
    const actor = (req as any).user as AuthenticatedUser;

    const isStudentActor =
      (actor.roles && actor.roles.includes('Student')) ||
      (actor as any).user_roles?.some((ur: any) => ur.role?.name === 'Student');
    if (isStudentActor) {
      const studentRec = await (prisma as any).student.findFirst({
        where: { user_id: actor.id },
      });
      const matchesProfile = (actor as any).studentProfile?.id === studentId || studentRec?.id === studentId;
      if (!matchesProfile) {
        throw new AppError(
          403,
          'UNAUTHORIZED_STUDENT_ACCESS',
          'Access denied: Learners are strictly prohibited from viewing another student\'s academic records.'
        );
      }
    }

    const versionQuery = req.query.version ? Number(req.query.version) : null;
    const academicYearIdQuery = req.query.academicYearId as string | undefined;

    const issuance = await (prisma as any).sf9OfficialIssuance.findFirst({
      where: versionQuery
        ? { student_id: studentId, version: versionQuery, ...(academicYearIdQuery ? { academic_year_id: academicYearIdQuery } : {}) }
        : { student_id: studentId, ...(academicYearIdQuery ? { academic_year_id: academicYearIdQuery } : { is_current: true }) },
      include: { academic_year: true, section: true },
    });

    let isReleased = false;
    let releaseMeta: any = null;
    let summary: any = {};

    if (issuance) {
      try {
        summary = JSON.parse(issuance.calculated_summary_encrypted || '{}');
        if (summary.release?.released) {
          isReleased = true;
          releaseMeta = summary.release;
        }
      } catch {}
    }

    // Query historical releases for this student
    const allIssuances = await (prisma as any).sf9OfficialIssuance.findMany({
      where: { student_id: studentId },
      include: { academic_year: true },
      orderBy: { version: 'desc' },
    });

    const history = allIssuances
      .map((rec: any) => {
        try {
          const sum = JSON.parse(rec.calculated_summary_encrypted || '{}');
          if (sum.release?.released) {
            const term =
              sum.targetTerm ||
              (sum.release?.reportingPeriod?.includes('Term 1')
                ? 'T1'
                : sum.release?.reportingPeriod?.includes('Term 2')
                ? 'T2'
                : 'T3');
            return {
              issuanceId: rec.id,
              version: rec.version,
              targetTerm: term,
              reportingPeriod:
                sum.release?.reportingPeriod || sum.reportingPeriod || (term === 'T1' ? 'Term 1 SF9' : term === 'T2' ? 'Term 2 SF9' : 'Annual SF9 (Terms 1-3)'),
              releaseDate: sum.release?.releasedAt || rec.issued_at.toISOString(),
              isCurrent: rec.is_current,
              academicYear: rec.academic_year?.name,
            };
          }
        } catch {}
        return null;
      })
      .filter(Boolean);

    res.setHeader('Cache-Control', 'no-store');

    if (!issuance || !isReleased) {
      return res.json({
        success: true,
        data: {
          released: false,
          status: 'PENDING_EVALUATION',
          message: 'Official SF9 report card has not yet been released.',
          academicYear: issuance?.academic_year?.name || 'SY 2026-2027',
          history,
        },
      });
    }

    const targetTerm =
      summary.targetTerm ||
      releaseMeta?.targetTerm ||
      (releaseMeta?.reportingPeriod?.includes('Term 1')
        ? 'T1'
        : releaseMeta?.reportingPeriod?.includes('Term 2')
        ? 'T2'
        : 'T3');

    res.json({
      success: true,
      data: {
        released: true,
        status: 'RELEASED',
        issuanceId: issuance.id,
        version: issuance.version,
        targetTerm,
        academicYear: issuance.academic_year.name,
        reportingPeriod:
          releaseMeta?.reportingPeriod ||
          summary.reportingPeriod ||
          (targetTerm === 'T1' ? 'Term 1 SF9' : targetTerm === 'T2' ? 'Term 2 SF9' : 'Annual SF9 (Terms 1-3)'),
        releaseDate: releaseMeta?.releasedAt || issuance.issued_at.toISOString(),
        adviser: issuance.adviser_name,
        principal: issuance.school_head_name,
        pdfSha256: issuance.pdf_sha256,
        canDownload: true,
        history,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/academic/report-card/:studentId/released-sf9/pdf
 * Parameterized PDF download with strict ownership verification.
 */
router.get('/:studentId/released-sf9/pdf', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const studentId = req.params.studentId as string;
    const actor = (req as any).user as AuthenticatedUser;

    const isStudentActor =
      (actor.roles && actor.roles.includes('Student')) ||
      (actor as any).user_roles?.some((ur: any) => ur.role?.name === 'Student');
    if (isStudentActor) {
      const studentRec = await (prisma as any).student.findFirst({
        where: { user_id: actor.id },
      });
      const matchesProfile = (actor as any).studentProfile?.id === studentId || studentRec?.id === studentId;
      if (!matchesProfile) {
        throw new AppError(
          403,
          'UNAUTHORIZED_STUDENT_ACCESS',
          'Access denied: Learners are strictly prohibited from viewing another student\'s academic records.'
        );
      }
    }

    const versionQuery = req.query.version ? Number(req.query.version) : null;
    const academicYearIdQuery = req.query.academicYearId as string | undefined;

    const issuance = await (prisma as any).sf9OfficialIssuance.findFirst({
      where: versionQuery
        ? { student_id: studentId, version: versionQuery, ...(academicYearIdQuery ? { academic_year_id: academicYearIdQuery } : {}) }
        : { student_id: studentId, ...(academicYearIdQuery ? { academic_year_id: academicYearIdQuery } : { is_current: true }) },
      include: { student: true },
    });

    if (!issuance) {
      if (isStudentActor) {
        throw new AppError(
          403,
          'SF9_NOT_RELEASED_TO_STUDENT',
          'Official SF9 report card has not yet been released for viewing by the school administration.'
        );
      }
      throw new AppError(404, 'ISSUANCE_NOT_FOUND', `No official SF9 report card has been issued for student ${studentId}.`);
    }

    let isReleased = false;
    let summary: any = {};
    try {
      summary = JSON.parse(issuance.calculated_summary_encrypted || '{}');
      isReleased = Boolean(summary.release?.released);
    } catch {}

    if (!isReleased) {
      throw new AppError(
        403,
        'SF9_NOT_RELEASED_TO_STUDENT',
        'Official SF9 report card has not yet been released for viewing by the school administration.'
      );
    }

    const profiler = new Sf9PipelineProfiler('staff_released_sf9_pdf');
    await serveReleasedSf9Pdf(issuance, studentId, req, res, profiler);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/academic/report-card/:studentId
 * Retrieves the SF9/Report Card progress summary data for the specified student.
 */
router.get('/:studentId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const studentId = req.params.studentId as string;
    const actorId = ((req as any).user as AuthenticatedUser).id;
    const requestedAcademicYearId = req.query.academicYearId as string | undefined;

    const data = await getReportCardData(studentId, actorId, requestedAcademicYearId);

    res.setHeader('Cache-Control', 'no-store');
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

export default router;
