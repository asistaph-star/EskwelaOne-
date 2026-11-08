import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../config/database.js';
import { authMiddleware, requirePermissions, AuthenticatedUser } from '../common/middleware/auth.js';
import { AppError } from '../common/middleware/errorHandler.js';
import {
  getDaysInMonth,
  validateStrictCalendarDate,
} from '../common/utils/calendarValidation.js';
import {
  upsertSchoolCalendarMonth,
  finalizeSchoolCalendarMonth,
  reopenSchoolCalendarMonth,
  upsertSchoolCalendarDay,
  upsertSectionCalendarException,
  CALULUT_SF9_MONTH_SLOTS,
} from './grading/index.js';

const router = Router();
router.use(authMiddleware);

/**
 * GET /api/academic/calendar/months?academicYearId=...
 * Retrieves calendar months for an academic year, with day counts and lifecycle status.
 */
router.get('/months', requirePermissions('academic:read'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { academicYearId } = req.query;
    if (!academicYearId || typeof academicYearId !== 'string') {
      return res.status(400).json({ success: false, message: 'Missing academicYearId query parameter' });
    }

    const months = await (prisma as any).schoolCalendarMonth.findMany({
      where: { academic_year_id: academicYearId },
      include: {
        calendar_days: {
          orderBy: { date: 'asc' },
        },
      },
      orderBy: [
        { calendar_year: 'asc' },
        { calendar_month: 'asc' },
      ],
    });

    const enriched = months.map((m: any) => {
      const instructionalCount = m.calendar_days.filter((d: any) => d.is_instructional).length;
      const nonInstructionalCount = m.calendar_days.filter((d: any) => !d.is_instructional && d.day_kind !== 'HOLIDAY').length;
      const holidayCount = m.calendar_days.filter((d: any) => d.day_kind === 'HOLIDAY').length;
      return {
        ...m,
        instructionalDaysCount: instructionalCount,
        nonInstructionalDaysCount: nonInstructionalCount,
        holidayDaysCount: holidayCount,
        totalDaysRecorded: m.calendar_days.length,
      };
    });

    res.json({ success: true, data: enriched });
  } catch (err) {
    next(err);
  }
});

const monthSchema = z.object({
  academicYearId: z.string().min(1),
  calendarYear: z.number().int().min(2000).max(2100),
  calendarMonth: z.number().int().min(1).max(12),
  plannedInstructionalDays: z.number().int().min(0).max(31).optional(),
}).superRefine((data, ctx) => {
  const maxDays = getDaysInMonth(data.calendarYear, data.calendarMonth);
  if (data.plannedInstructionalDays !== undefined && data.plannedInstructionalDays > maxDays) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Planned instructional days (${data.plannedInstructionalDays}) cannot exceed total days in month (${maxDays}) for ${data.calendarYear}-${String(data.calendarMonth).padStart(2, '0')}.`,
      path: ['plannedInstructionalDays'],
    });
  }
});

/**
 * POST /api/academic/calendar/months
 * Creates or updates a calendar month definition (Admin/Principal/Registrar).
 */
router.post('/months', requirePermissions('academic:write'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = monthSchema.parse(req.body);
    const authUser = (req as any).user as AuthenticatedUser;

    const slot = CALULUT_SF9_MONTH_SLOTS.find((s) => s.monthOfYear === parsed.calendarMonth);
    const monthKey = slot ? slot.monthKey : 'AUG';

    const result = await upsertSchoolCalendarMonth(prisma as any, {
      academicYearId: parsed.academicYearId,
      monthKey,
      calendarYear: parsed.calendarYear,
      calendarMonth: parsed.calendarMonth,
      plannedInstructionalDays: parsed.plannedInstructionalDays,
      actorUserId: authUser.id,
    });

    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/academic/calendar/months/:id/finalize
 * Finalizes an approved calendar month so official attendance can be sealed.
 */
router.post('/months/:id/finalize', requirePermissions('academic:write'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const calendarMonthId = req.params.id as string;
    const authUser = (req as any).user as AuthenticatedUser;

    const result = await finalizeSchoolCalendarMonth(prisma as any, {
      calendarMonthId,
      actorUserId: authUser.id,
    });

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/academic/calendar/months/:id/reopen
 * Reopens a finalized calendar month with mandatory audit reason.
 */
router.post('/months/:id/reopen', requirePermissions('academic:write'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const calendarMonthId = req.params.id as string;
    const { reopenReason } = req.body || {};
    const authUser = (req as any).user as AuthenticatedUser;

    if (!reopenReason || typeof reopenReason !== 'string' || reopenReason.trim().length < 5) {
      return res.status(422).json({
        success: false,
        message: 'A valid reopen reason of at least 5 characters is required',
      });
    }

    const result = await reopenSchoolCalendarMonth(prisma as any, {
      calendarMonthId,
      reopenReason: reopenReason.trim(),
      actor: {
        userId: authUser.id,
        role: (authUser.roles[0] || 'Admin') as any,
      },
    });

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

const daySchema = z.object({
  academicYearId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  dayKind: z.enum(['INSTRUCTIONAL', 'NON_INSTRUCTIONAL', 'HOLIDAY']),
  description: z.string().optional().nullable(),
  holidayName: z.string().optional().nullable(),
  reclassificationReason: z.string().optional().nullable(),
}).superRefine((data, ctx) => {
  const res = validateStrictCalendarDate(data.date);
  if (!res.valid) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: res.error || 'Invalid calendar date',
      path: ['date'],
    });
  }
});

/**
 * POST /api/academic/calendar/days
 * Configures instructional, non-instructional, or holiday days.
 */
router.post('/days', requirePermissions('academic:write'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = daySchema.parse(req.body);
    const authUser = (req as any).user as AuthenticatedUser;

    const academicYear = await prisma.academicYear.findUnique({
      where: { id: parsed.academicYearId },
    });
    if (!academicYear) {
      throw new AppError(404, 'ACADEMIC_YEAR_NOT_FOUND', `Academic year ${parsed.academicYearId} not found.`);
    }

    const targetTime = new Date(`${parsed.date}T00:00:00.000Z`).getTime();
    if (academicYear.start_date && targetTime < academicYear.start_date.getTime()) {
      throw new AppError(422, 'DATE_OUT_OF_BOUNDS', `Date ${parsed.date} is before academic year start date (${academicYear.start_date.toISOString().split('T')[0]}).`);
    }
    if (academicYear.end_date && targetTime > academicYear.end_date.getTime()) {
      throw new AppError(422, 'DATE_OUT_OF_BOUNDS', `Date ${parsed.date} is after academic year end date (${academicYear.end_date.toISOString().split('T')[0]}).`);
    }

    const dateParts = parsed.date.split('-');
    const calendarYear = parseInt(dateParts[0], 10);
    const calendarMonth = parseInt(dateParts[1], 10);

    const monthRecord = await (prisma as any).schoolCalendarMonth.findFirst({
      where: {
        academic_year_id: parsed.academicYearId,
        calendar_year: calendarYear,
        calendar_month: calendarMonth,
      },
    });

    if (!monthRecord) {
      throw new AppError(404, 'MONTH_NOT_FOUND', `Calendar month ${calendarYear}-${calendarMonth} not found. Please create the calendar month first.`);
    }

    const isInstructional = parsed.dayKind === 'INSTRUCTIONAL';

    const result = await upsertSchoolCalendarDay(prisma as any, {
      academicYearId: parsed.academicYearId,
      calendarMonthId: monthRecord.id,
      date: parsed.date,
      dayType: parsed.dayKind as any,
      isInstructional,
      description: parsed.holidayName || parsed.description,
      correctionReason: parsed.reclassificationReason,
      actorUserId: authUser.id,
    });

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

const exceptionSchema = z.object({
  sectionId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  dayKind: z.enum(['INSTRUCTIONAL', 'NON_INSTRUCTIONAL', 'HOLIDAY']),
  exceptionReason: z.string().min(3),
}).superRefine((data, ctx) => {
  const res = validateStrictCalendarDate(data.date);
  if (!res.valid) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: res.error || 'Invalid calendar date',
      path: ['date'],
    });
  }
});

/**
 * POST /api/academic/calendar/exceptions
 * Records section-level calendar exceptions (e.g. localized weather suspension).
 */
router.post('/exceptions', requirePermissions('academic:write'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = exceptionSchema.parse(req.body);
    const authUser = (req as any).user as AuthenticatedUser;

    const section = await prisma.section.findUnique({
      where: { id: parsed.sectionId },
    });
    if (!section) throw new AppError(404, 'SECTION_NOT_FOUND', `Section ${parsed.sectionId} not found`);

    const dateObj = new Date(`${parsed.date}T00:00:00.000Z`);
    const day = await (prisma as any).schoolCalendarDay.findFirst({
      where: {
        academic_year_id: section.academic_year_id,
        date: dateObj,
      },
    });

    if (!day) {
      throw new AppError(404, 'DAY_NOT_FOUND', `School calendar day for date ${parsed.date} does not exist in academic year.`);
    }

    const result = await upsertSectionCalendarException(prisma as any, {
      academicYearId: section.academic_year_id,
      sectionId: parsed.sectionId,
      calendarDayId: day.id,
      date: parsed.date,
      overrideDayType: parsed.dayKind as any,
      overrideIsInstructional: parsed.dayKind === 'INSTRUCTIONAL',
      reason: parsed.exceptionReason,
      actorUserId: authUser.id,
    });

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

export default router;
