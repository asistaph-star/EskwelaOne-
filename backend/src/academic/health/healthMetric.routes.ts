/**
 * DigiSkwela — Student Health & Nutrition Routes
 * Module: backend/src/academic/health/healthMetric.routes.ts
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authMiddleware, AuthenticatedUser } from '../../common/middleware/auth.js';
import {
  recordHealthMetric,
  getStudentHealthHistory,
  getSectionHealthRoster,
  updateLearnerDemographics,
  updateLearnerPersonalInfo,
} from './healthMetric.service.js';
import { updatePersonalInfoBackendSchema } from '../../common/validation/studentValidation.js';

const router = Router();
router.use(authMiddleware);

const recordMetricSchema = z.object({
  studentId: z.string().min(1, 'Student ID is required'),
  academicYearId: z.string().optional(),
  sectionId: z.string().optional(),
  measurementPeriod: z.enum(['BOSY', 'EOSY', 'INTERIM']),
  measurementDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Measurement date must be in YYYY-MM-DD format'),
  heightCm: z.number().min(30, 'Height must be at least 30 cm').max(250, 'Height must be at most 250 cm'),
  weightKg: z.number().min(5, 'Weight must be at least 5 kg').max(300, 'Weight must be at most 300 kg'),
  remarks: z.string().optional(),
});

const personalInfoSchema = updatePersonalInfoBackendSchema;

const demographicsSchema = personalInfoSchema;

/**
 * POST /api/academic/health/metrics
 * Records an anthropometric measurement for a student.
 */
router.post('/metrics', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = recordMetricSchema.parse(req.body);
    const authUser = (req as any).user as AuthenticatedUser;
    const correlationId = (req as any).correlationId;

    const metric = await recordHealthMetric(input, authUser.id, correlationId);
    res.status(201).json({ success: true, data: metric });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/academic/health/students/:studentId
 * Retrieves historical health measurements for a learner.
 */
router.get('/students/:studentId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const studentId = req.params.studentId as string;
    const authUser = (req as any).user as AuthenticatedUser;

    const history = await getStudentHealthHistory(studentId, authUser.id);
    res.json({ success: true, data: history });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/academic/health/sections/:sectionId
 * Retrieves section-wide health summary for Class Adviser / MAPEH / SF8 preparation.
 */
router.get('/sections/:sectionId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sectionId = req.params.sectionId as string;
    const authUser = (req as any).user as AuthenticatedUser;

    const section = await getSectionHealthRoster(sectionId, authUser.id);
    res.json({ success: true, data: section });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/academic/health/students/:studentId/personal-info
 * Authorized personal information & demographic update by Class Adviser.
 */
router.patch('/students/:studentId/personal-info', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const studentId = req.params.studentId as string;
    const input = personalInfoSchema.parse(req.body);
    const authUser = (req as any).user as AuthenticatedUser;
    const correlationId = (req as any).correlationId;

    const updated = await updateLearnerPersonalInfo(studentId, input, authUser.id, correlationId);
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

import prisma from '../../config/database.js';
import { config } from '../../config/env.js';
import { GuardianAuthorizationService } from '../../notifications/guardianAuthorization.service.js';
import { BrevoEmailProvider } from '../../notifications/email/brevoEmailProvider.js';
import { MockEmailProvider } from '../../notifications/email/mockEmailProvider.js';
import { verifyHealthEncodingPermission, verifyHealthViewingPermission } from './healthMetric.service.js';

/**
 * GET /api/academic/health/students/:studentId/guardian-contact/status
 * Retrieves current guardian contact authorization lifecycle status.
 */
router.get('/students/:studentId/guardian-contact/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const studentId = req.params.studentId as string;
    const authUser = (req as any).user as AuthenticatedUser;

    await verifyHealthViewingPermission(studentId, authUser.id);

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: {
        guardian_email: true,
        guardian_first_name: true,
        guardian_last_name: true,
      },
    });

    if (!student || !student.guardian_email) {
      return res.json({
        success: true,
        data: {
          hasEmail: false,
          status: 'NOT_CONFIGURED',
        },
      });
    }

    const guardianName = [student.guardian_first_name, student.guardian_last_name].filter(Boolean).join(' ').trim();
    let authRecord: any = null;

    try {
      const records: any[] = await (prisma as any).$queryRawUnsafe(
        `SELECT id, status, token_expires_at, verified_at, authorized_at, authorized_by_user_id, verification_method, revocation_reason, created_at
         FROM public.guardian_contact_authorizations
         WHERE student_id = $1 AND guardian_email = $2
         ORDER BY created_at DESC LIMIT 1`,
        studentId,
        student.guardian_email.trim().toLowerCase()
      );
      if (records && records.length > 0) {
        authRecord = records[0];
      }
    } catch {
      // Table may not exist yet in unmigrated environment
    }

    res.json({
      success: true,
      data: {
        hasEmail: true,
        guardianEmail: student.guardian_email,
        guardianName,
        status: authRecord?.status || 'PENDING_VERIFICATION',
        verificationMethod: authRecord?.verification_method || null,
        tokenExpiresAt: authRecord?.token_expires_at || null,
        verifiedAt: authRecord?.verified_at || null,
        authorizedAt: authRecord?.authorized_at || null,
        authorizedByUserId: authRecord?.authorized_by_user_id || null,
        confirmationSource: authRecord?.revocation_reason || null,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/academic/health/students/:studentId/guardian-contact/verify-otp
 * Verifies guardian contact ownership using the 6-digit OTP.
 */
router.post('/students/:studentId/guardian-contact/verify-otp', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const studentId = req.params.studentId as string;
    const { otp } = req.body;
    const authUser = (req as any).user as AuthenticatedUser;

    if (!otp || (typeof otp !== 'string' && typeof otp !== 'number')) {
      return res.status(400).json({ success: false, message: 'A 6-digit verification code is required.' });
    }

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: { guardian_email: true },
    });

    if (!student?.guardian_email) {
      return res.status(400).json({ success: false, message: 'Student does not have a registered guardian email.' });
    }

    const result = await GuardianAuthorizationService.verifyWithOtp(
      prisma,
      studentId,
      student.guardian_email,
      String(otp).trim()
    );

    if (!result.success) {
      return res.status(400).json({ 
        success: false, 
        data: result, 
        message: result.message, 
        error: { message: result.message },
        attemptsRemaining: result.attemptsRemaining 
      });
    }

    res.json({ success: true, data: result, message: result.message });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/academic/health/students/:studentId/guardian-contact/verify-link
 * Verifies guardian contact ownership using the direct link token.
 */
router.post('/students/:studentId/guardian-contact/verify-link', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const studentId = req.params.studentId as string;
    const { token } = req.body;

    if (!token || typeof token !== 'string') {
      return res.status(400).json({ success: false, message: 'Verification token is required.' });
    }

    const result = await GuardianAuthorizationService.verifyWithToken(
      prisma,
      studentId,
      token.trim()
    );

    if (!result.success) {
      return res.status(400).json({ success: false, data: result, message: result.message });
    }

    res.json({ success: true, data: result, message: result.message });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/academic/health/students/:studentId/guardian-contact/authorize
 * Authorizes a guardian contact through verified school records (SF1, enrollment, or in-person).
 */
router.post('/students/:studentId/guardian-contact/authorize', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const studentId = req.params.studentId as string;
    const { 
      reason = 'DepEd SF1 Enrollment Record Verification', 
      verificationMethod = 'SCHOOL_ENROLLMENT_CONFIRMED' 
    } = req.body;
    const authUser = (req as any).user as AuthenticatedUser;

    const { callerRole } = await verifyHealthEncodingPermission(studentId, authUser.id);
    const normRole = (callerRole || '').toUpperCase();
    if (!['ADMIN', 'REGISTRAR', 'ADVISER', 'CLASS_ADVISER'].includes(normRole)) {
      return res.status(403).json({ success: false, message: 'Only Class Advisers, Registrars, or Admins can authorize contacts.' });
    }

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: { guardian_email: true, guardian_first_name: true, guardian_last_name: true },
    });

    if (!student?.guardian_email) {
      return res.status(400).json({ success: false, message: 'No guardian email registered.' });
    }

    const result = await GuardianAuthorizationService.authorizeManuallyByStaff(
      prisma,
      studentId,
      student.guardian_email,
      authUser.id,
      reason,
      verificationMethod
    );

    if (!result.success) {
      return res.status(400).json({ success: false, data: result, message: result.message });
    }

    res.json({ success: true, data: result, message: result.message });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/academic/health/students/:studentId/guardian-contact/resend-verification
 * Resends a fresh 6-digit OTP for the guardian email.
 */
router.post('/students/:studentId/guardian-contact/resend-verification', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const studentId = req.params.studentId as string;
    const authUser = (req as any).user as AuthenticatedUser;

    await verifyHealthEncodingPermission(studentId, authUser.id);

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: { guardian_email: true, guardian_first_name: true, guardian_last_name: true },
    });

    if (!student?.guardian_email) {
      return res.status(400).json({ success: false, message: 'No guardian email registered.' });
    }

    const guardianName = [student.guardian_first_name, student.guardian_last_name].filter(Boolean).join(' ').trim();
    try {
      const result = await GuardianAuthorizationService.registerContact({
        studentId,
        guardianEmail: student.guardian_email,
        guardianName,
        clientPrisma: prisma,
        autoAuthorizeForTesting: false,
      });

      // Dispatch verification OTP email through configured email provider
      if (config.email.gateEmailEnabled && result.verificationEmail) {
        if (config.email.authorizationMode === 'PILOT_WHITELIST') {
          const authorized = (config.email.authorizedRecipients || []).map((e: string) => e.toLowerCase());
          if (authorized.length === 0 || !authorized.includes(result.verificationEmail.to.toLowerCase())) {
            return res.status(403).json({
              success: false,
              message: 'OTP dispatch blocked: Recipient is not on the authorized pilot whitelist (fail-closed protection).',
            });
          }
        }

        const provider = config.email.provider === 'brevo'
          ? new BrevoEmailProvider({
              apiKey: config.email.brevoApiKey,
              senderEmail: config.email.senderEmail,
              senderName: config.email.senderName,
              replyToEmail: config.email.replyToEmail,
            })
          : new MockEmailProvider();

        await provider.sendEmail({
          to: [{ email: result.verificationEmail.to, name: guardianName }],
          subject: result.verificationEmail.subject,
          htmlContent: result.verificationEmail.htmlContent,
          textContent: `Calulut Integrated School: Guardian Verification Code is ${result.otp}. Enter this code in the DigiSkwela portal to verify your contact information.`,
        });
      }

      res.json({
        success: true,
        message: 'Verification code sent to guardian email address.',
        expiresInMinutes: 15,
      });
    } catch (authErr: any) {
      if (authErr.message?.includes('Please wait')) {
        return res.status(429).json({ success: false, message: authErr.message });
      }
      throw authErr;
    }
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/academic/health/students/:studentId/demographics
 * Authorized demographic update (birthdate, recorded sex) by Class Adviser.
 */
router.patch('/students/:studentId/demographics', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const studentId = req.params.studentId as string;
    const input = demographicsSchema.parse(req.body);
    const authUser = (req as any).user as AuthenticatedUser;
    const correlationId = (req as any).correlationId;

    const updated = await updateLearnerPersonalInfo(studentId, input, authUser.id, correlationId);
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

import { generateSf8Report, exportSf8Csv, exportSf8Excel, exportSf8Pdf } from './sf8.service.js';

/**
 * GET /api/academic/health/sf8/sections/:sectionId
 * Generates official DepEd Form 8 (Learner Basic Health and Nutrition Report)
 */
router.get('/sf8/sections/:sectionId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sectionId = req.params.sectionId as string;
    const period = (req.query.period as 'BOSY' | 'EOSY' | 'ALL') || 'ALL';
    const authUser = (req as any).user as AuthenticatedUser;

    const report = await generateSf8Report(sectionId, period, authUser.id);
    res.json({ success: true, data: report });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/academic/health/sf8/sections/:sectionId/export
 * Downloads official DepEd SF8 report in Excel (.xlsx), PDF (.pdf), CSV, or JSON format
 */
router.get('/sf8/sections/:sectionId/export', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sectionId = req.params.sectionId as string;
    const period = (req.query.period as 'BOSY' | 'EOSY' | 'ALL') || 'BOSY';
    const format = (req.query.format as 'xlsx' | 'pdf' | 'csv' | 'json') || 'csv';
    const authUser = (req as any).user as AuthenticatedUser;

    if (format === 'xlsx') {
      const { filename, buffer } = await exportSf8Excel(sectionId, period, authUser.id);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.status(200).send(buffer);
    } else if (format === 'pdf') {
      const { filename, buffer } = await exportSf8Pdf(sectionId, period, authUser.id);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.status(200).send(buffer);
    } else if (format === 'csv') {
      const { filename, csv } = await exportSf8Csv(sectionId, period, authUser.id);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.status(200).send(csv);
    } else {
      const report = await generateSf8Report(sectionId, period, authUser.id);
      res.json({ success: true, data: report });
    }
  } catch (err) {
    next(err);
  }
});

import {
  getSchoolFormCutoff,
  listSchoolFormCutoffs,
  updateSchoolFormCutoff,
} from './schoolFormCutoff.service.js';

const updateCutoffSchema = z.object({
  academicYear: z.string().default('2026-2027'),
  formKey: z.enum(['SF1', 'SF8', 'SF8_BOSY', 'SF8_EOSY']),
  referenceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Reference date must be in YYYY-MM-DD format'),
  isProvisional: z.boolean().default(false),
  basis: z.string().optional(),
});

/**
 * GET /api/academic/health/cutoffs
 * Retrieves configured school-form age cutoff reference dates.
 */
router.get('/cutoffs', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const list = listSchoolFormCutoffs();
    const activeSf1 = getSchoolFormCutoff('2026-2027', 'SF1');
    res.json({ success: true, data: { list, activeSf1 } });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/academic/health/cutoffs
 * Updates a school-form age reference date. Restricted to Admin and Registrar.
 */
router.patch('/cutoffs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authUser = (req as any).user as AuthenticatedUser;
    const isAuthorized = authUser.roles?.some((r: string) =>
      ['admin', 'superadmin', 'registrar'].includes(r.toLowerCase())
    );
    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Configuring school-form cutoffs requires Administrator or Registrar authorization.',
        },
      });
    }

    const input = updateCutoffSchema.parse(req.body);
    const correlationId = (req as any).correlationId;

    const updated = await updateSchoolFormCutoff(
      input.academicYear,
      input.formKey,
      input.referenceDate,
      input.isProvisional,
      input.basis || '',
      authUser.id,
      correlationId
    );

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

export default router;


