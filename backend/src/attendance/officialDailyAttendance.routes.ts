import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../config/database.js';
import { authMiddleware, requirePermissions, AuthenticatedUser } from '../common/middleware/auth.js';
import { AppError } from '../common/middleware/errorHandler.js';
import { classifyAcademicYearLifecycle } from '../common/utils/calendarValidation.js';
import {
  recordOfficialDailyAttendance,
  verifyOfficialDailyAttendance,
  computePersistedStudentMonthlyAttendance,
} from '../academic/grading/index.js';

const router = Router();
router.use(authMiddleware);

/**
 * GET /api/attendance/sf2/sections/:sectionId/daily?date=YYYY-MM-DD
 * Retrieves section attendance for a specific date, returning all enrolled students.
 * Students without a record receive an explicit `NOT_RECORDED` status.
 */
router.get('/sections/:sectionId/daily', requirePermissions('attendance:read'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sectionId = req.params.sectionId as string;
    const { date } = req.query;

    if (!date || typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ success: false, message: 'Valid date query parameter (YYYY-MM-DD) is required' });
    }

    // Fetch section details and designated adviser
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

    // Fetch active enrollments in alphabetical order
    const enrollments = await (prisma as any).enrollment.findMany({
      where: {
        section_id: sectionId,
        status: 'Enrolled',
      },
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

    // Check school calendar day kind and section exception for this date
    const dateObj = new Date(`${date}T00:00:00.000Z`);
    const calDay = await (prisma as any).schoolCalendarDay.findFirst({
      where: {
        academic_year_id: section.academic_year_id,
        date: dateObj,
      },
    });

    const exception = await (prisma as any).sectionCalendarException.findFirst({
      where: {
        section_id: sectionId,
        date: dateObj,
      },
    });

    let effectiveDayKind: 'INSTRUCTIONAL' | 'NON_INSTRUCTIONAL' | 'HOLIDAY' = 'INSTRUCTIONAL';
    let dayDescription: string | null = null;

    if (exception) {
      effectiveDayKind = exception.day_kind;
      dayDescription = `Section Exception: ${exception.exception_reason}`;
    } else if (calDay) {
      effectiveDayKind = calDay.day_kind;
      dayDescription = calDay.holiday_name || calDay.description || null;
    }

    // Fetch existing official attendance records for this section and date
    const attendanceRecords = await (prisma as any).officialDailyAttendance.findMany({
      where: {
        section_id: sectionId,
        date: dateObj,
      },
      include: {
        recorded_by: true,
        verified_by: true,
      },
    });

    const recordMap = new Map<string, any>(attendanceRecords.map((r: any) => [r.enrollment_id, r]));

    // Construct full roster with explicit NOT_RECORDED status
    const roster = enrollments.map((enr: any) => {
      const rec = recordMap.get(enr.id);
      return {
        enrollmentId: enr.id,
        studentId: enr.student_id,
        lrn: enr.student.lrn,
        lastName: enr.student?.last_name || enr.student?.user?.last_name || '',
        firstName: enr.student?.first_name || enr.student?.user?.first_name || '',
        gender: enr.student.gender || 'Unknown',
        statusCode: rec ? rec.status : 'NOT_RECORDED', // 'PRESENT' | 'ABSENT' | 'TARDY' | 'EXCUSED' | 'NOT_RECORDED'
        recordStatus: rec ? rec.record_status : 'DRAFT',   // 'DRAFT' | 'VERIFIED'
        minutesLate: rec ? rec.minutes_late : null,
        remarks: rec ? rec.remarks : null,
        excuseReason: rec ? rec.correction_reason : null,
        recordId: rec ? rec.id : null,
        recordedBy: rec?.recorded_by ? `${rec.recorded_by.first_name} ${rec.recorded_by.last_name}` : null,
        verifiedBy: rec?.verified_by ? `${rec.verified_by.first_name} ${rec.verified_by.last_name}` : null,
        verifiedAt: rec?.verified_at ? rec.verified_at.toISOString() : null,
      };
    });

    res.json({
      success: true,
      data: {
        sectionId,
        sectionName: section.name,
        gradeLevel: section.grade_level,
        academicYear: section.academic_year?.name,
        adviser: section.adviser_teacher
          ? `${section.adviser_teacher.user.first_name} ${section.adviser_teacher.user.last_name}`
          : null,
        date,
        effectiveDayKind,
        dayDescription,
        summary: {
          totalEnrolled: enrollments.length,
          present: roster.filter((r: any) => r.statusCode === 'PRESENT').length,
          tardy: roster.filter((r: any) => r.statusCode === 'TARDY').length,
          absent: roster.filter((r: any) => r.statusCode === 'ABSENT').length,
          excused: roster.filter((r: any) => r.statusCode === 'EXCUSED').length,
          notRecorded: roster.filter((r: any) => r.statusCode === 'NOT_RECORDED').length,
          verifiedCount: roster.filter((r: any) => r.recordStatus === 'VERIFIED').length,
        },
        roster,
      },
    });
  } catch (err) {
    next(err);
  }
});

const saveAttendanceSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  entries: z.array(z.object({
    enrollmentId: z.string().min(1),
    statusCode: z.enum(['PRESENT', 'ABSENT', 'TARDY', 'EXCUSED', 'P', 'A', 'L', 'E']),
    minutesLate: z.number().int().min(0).max(480).optional().nullable(),
    remarks: z.string().optional().nullable(),
    excuseReason: z.string().optional().nullable(),
  })).min(1),
});

/**
 * POST /api/attendance/sf2/sections/:sectionId/daily
 * Saves or updates official daily attendance records.
 * Restricted to designated Section Class Adviser (or Admin/Principal/Registrar override).
 */
router.post('/sections/:sectionId/daily', requirePermissions('attendance:write'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sectionId = req.params.sectionId as string;
    const parsed = saveAttendanceSchema.parse(req.body);
    const authUser = (req as any).user as AuthenticatedUser;

    const savedRecords: any[] = [];

    const section = await (prisma as any).section.findUnique({
      where: { id: sectionId },
      include: { academic_year: true },
    });
    if (!section) throw new AppError(404, 'NOT_FOUND', `Section ${sectionId} not found`);

    const lifecycle = classifyAcademicYearLifecycle(section.academic_year);
    if (lifecycle === 'HISTORICAL') {
      throw new AppError(403, 'HISTORICAL_ACADEMIC_YEAR_READ_ONLY', 'Cannot record or modify attendance for a historical academic year. Historical records are strictly read-only.');
    }
    if (lifecycle === 'UPCOMING') {
      throw new AppError(403, 'UPCOMING_ACADEMIC_YEAR_INACTIVE', 'Cannot record or modify attendance for an upcoming academic year that has not yet become active.');
    }

    const dateObj = new Date(`${parsed.date}T00:00:00.000Z`);
    const day = await (prisma as any).schoolCalendarDay.findFirst({
      where: {
        academic_year_id: section.academic_year_id,
        date: dateObj,
      },
    });

    if (!day) {
      throw new AppError(422, 'DAY_NOT_IN_CALENDAR', `Date ${parsed.date} is not configured in the school calendar.`);
    }

    const enrollments = await (prisma as any).enrollment.findMany({
      where: { id: { in: parsed.entries.map((e) => e.enrollmentId) } },
    });
    const enrollmentMap = new Map<string, any>(enrollments.map((e: any) => [e.id, e]));

    // Process all entries transactionally or iteratively with authorization check
    for (const item of parsed.entries) {
      const enr = enrollmentMap.get(item.enrollmentId);
      if (!enr) continue;

      const statusMap: Record<string, 'P' | 'A' | 'L' | 'E'> = {
        PRESENT: 'P',
        ABSENT: 'A',
        TARDY: 'L',
        EXCUSED: 'E',
        P: 'P',
        A: 'A',
        L: 'L',
        E: 'E',
      };
      const resolvedStatus = statusMap[item.statusCode] || 'P';

      const result = await recordOfficialDailyAttendance(prisma as any, {
        academicYearId: section.academic_year_id,
        sectionId,
        studentId: enr.student_id,
        enrollmentId: item.enrollmentId,
        calendarDayId: day.id,
        date: parsed.date,
        status: resolvedStatus,
        remarks: item.remarks ?? undefined,
        correctionReason: item.excuseReason ?? undefined,
        actor: {
          userId: authUser.id,
          role: (authUser.roles[0] || 'Teacher') as any,
        },
      });
      savedRecords.push(result);
    }

    res.json({
      success: true,
      data: {
        date: parsed.date,
        savedCount: savedRecords.length,
        records: savedRecords,
      },
    });
  } catch (err) {
    next(err);
  }
});

const verifyAttendanceSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  enrollmentIds: z.array(z.string().min(1)).optional(), // if omitted, verifies all in section for date
});

/**
 * POST /api/attendance/sf2/sections/:sectionId/verify
 * Marks daily attendance as VERIFIED.
 */
router.post('/sections/:sectionId/verify', requirePermissions('attendance:write'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sectionId = req.params.sectionId as string;
    const parsed = verifyAttendanceSchema.parse(req.body);
    const authUser = (req as any).user as AuthenticatedUser;

    const section = await (prisma as any).section.findUnique({
      where: { id: sectionId },
      include: { academic_year: true },
    });
    if (!section) throw new AppError(404, 'NOT_FOUND', `Section ${sectionId} not found`);

    const lifecycle = classifyAcademicYearLifecycle(section.academic_year);
    if (lifecycle === 'HISTORICAL') {
      throw new AppError(403, 'HISTORICAL_ACADEMIC_YEAR_READ_ONLY', 'Cannot verify attendance for a historical academic year. Historical records are strictly read-only.');
    }
    if (lifecycle === 'UPCOMING') {
      throw new AppError(403, 'UPCOMING_ACADEMIC_YEAR_INACTIVE', 'Cannot verify attendance for an upcoming academic year that has not yet become active.');
    }

    const dateObj = new Date(`${parsed.date}T00:00:00.000Z`);
    const existing = await (prisma as any).officialDailyAttendance.findMany({
      where: {
        section_id: sectionId,
        date: dateObj,
        ...(parsed.enrollmentIds && parsed.enrollmentIds.length > 0 ? { enrollment_id: { in: parsed.enrollmentIds } } : {}),
      },
      select: { id: true },
    });

    const attendanceIds = existing.map((e: any) => e.id);
    if (attendanceIds.length === 0) {
      return res.status(400).json({ success: false, message: 'No attendance records found to verify for this date' });
    }

    const verifiedResult = await verifyOfficialDailyAttendance(prisma as any, {
      sectionId,
      attendanceIds,
      actor: {
        userId: authUser.id,
        role: (authUser.roles[0] || 'Teacher') as any,
      },
    });

    res.json({
      success: true,
      data: {
        date: parsed.date,
        verifiedCount: attendanceIds.length,
        result: verifiedResult,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/attendance/sf2/sections/:sectionId/monthly-summary?year=...&month=...
 * Retrieves verified monthly SF2 aggregates for all learners in the section.
 */
router.get('/sections/:sectionId/monthly-summary', requirePermissions('attendance:read'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sectionId = req.params.sectionId as string;
    const { year, month } = req.query;

    const calendarYear = parseInt(year as string, 10);
    const calendarMonth = parseInt(month as string, 10);

    if (isNaN(calendarYear) || isNaN(calendarMonth) || calendarMonth < 1 || calendarMonth > 12) {
      return res.status(400).json({ success: false, message: 'Valid year and month (1-12) are required' });
    }

    const section = await (prisma as any).section.findUnique({
      where: { id: sectionId },
      include: {
        academic_year: true,
        adviser_teacher: { include: { user: true } },
      },
    });

    if (!section) throw new AppError(404, 'NOT_FOUND', `Section ${sectionId} not found`);

    const enrollments = await (prisma as any).enrollment.findMany({
      where: { section_id: sectionId, status: 'Enrolled' },
      include: { student: { include: { user: true } } },
      orderBy: [
        { student: { user: { last_name: 'asc' } } },
        { student: { user: { first_name: 'asc' } } },
      ],
    });

    const summaries: any[] = [];
    for (const enr of enrollments) {
      const s = await computePersistedStudentMonthlyAttendance(prisma as any, {
        studentId: enr.student_id,
        enrollmentId: enr.id,
        academicYearId: section.academic_year_id,
        excusedPolicy: 'COUNT_AS_EXCUSED_ABSENCE',
      });
      const monthSum = s.monthlySummaries.find((m: any) => m.calendarMonth === calendarMonth || m.monthOfYear === calendarMonth);
      summaries.push({
        enrollmentId: enr.id,
        studentId: enr.student_id,
        lrn: enr.student.lrn,
        lastName: enr.student?.last_name || enr.student?.user?.last_name || '',
        firstName: enr.student?.first_name || enr.student?.user?.first_name || '',
        gender: enr.student.gender,
        daysPresent: monthSum?.daysPresent ?? 0,
        daysAbsent: monthSum?.daysAbsent ?? 0,
        timesTardy: monthSum?.daysTardy ?? 0,
        classDays: monthSum?.classDays ?? 0,
        verificationStatus: monthSum?.verificationState ?? 'UNVERIFIED',
      });
    }

    res.json({
      success: true,
      data: {
        sectionId,
        sectionName: section.name,
        calendarYear,
        calendarMonth,
        summaries,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/attendance/sf2/students/:studentId?academicYearId=...
 * Retrieves official DepEd SF2 monthly summary and daily attendance log for a specific learner.
 * Supports historical academic years with read-only indicators.
 */
router.get('/students/:studentId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const studentParam = req.params.studentId as string;
    const requestedAcademicYearId = req.query.academicYearId as string | undefined;
    const authUser = (req as any).user as AuthenticatedUser;

    const isStudent = authUser.roles.includes('Student');
    const hasAttendanceRead = authUser.permissions.includes('attendance:read');
    const hasAcademicRead = authUser.permissions.includes('academic:read');

    if (!hasAttendanceRead && !(isStudent && hasAcademicRead)) {
      throw new AppError(403, 'FORBIDDEN', 'Insufficient permissions to view official student attendance.');
    }

    // Resolve student record (supports id or user_id)
    const student = await (prisma as any).student.findFirst({
      where: {
        OR: [
          { id: studentParam },
          { user_id: studentParam },
        ],
      },
      include: {
        current_section: {
          include: {
            academic_year: true,
          },
        },
      },
    });

    if (!student) {
      throw new AppError(404, 'NOT_FOUND', 'Student record not found.');
    }

    // Ownership check for Student role
    if (isStudent && student.user_id !== authUser.id) {
      throw new AppError(403, 'FORBIDDEN', 'You are only authorized to view your own attendance records.');
    }

    // Determine target academic year
    let targetAcademicYearId = requestedAcademicYearId;
    if (!targetAcademicYearId) {
      if (student.current_section?.academic_year_id) {
        targetAcademicYearId = student.current_section.academic_year_id;
      } else {
        const currentAy = await (prisma as any).academicYear.findFirst({
          where: { is_current: true },
        });
        targetAcademicYearId = currentAy?.id;
      }
    }

    if (!targetAcademicYearId) {
      throw new AppError(404, 'NOT_FOUND', 'No academic year found.');
    }

    // Resolve student's enrollment in this academic year
    const enrollment = await (prisma as any).enrollment.findFirst({
      where: {
        student_id: student.id,
        academic_year_id: targetAcademicYearId,
      },
      include: {
        academic_year: true,
        section: true,
      },
    });

    if (!enrollment) {
      return res.json({
        success: true,
        data: {
          studentId: student.id,
          academicYearId: targetAcademicYearId,
          academicYearName: null,
          isCurrent: false,
          isHistorical: true,
          sectionName: null,
          gradeLevel: null,
          monthlySummaries: [],
          dailyRecords: [],
          cumulative: {
            totalSchoolDays: 0,
            totalPresent: 0,
            totalAbsent: 0,
            totalTardy: 0,
            attendanceRate: null,
          },
        },
      });
    }

    // Compute official SF2 monthly attendance using DepEd rule engine
    const sf2Monthly = await computePersistedStudentMonthlyAttendance(prisma as any, {
      studentId: student.id,
      enrollmentId: enrollment.id,
      academicYearId: targetAcademicYearId,
      excusedPolicy: 'COUNT_AS_EXCUSED_ABSENCE',
    });

    // Query daily attendance records for this student and academic year
    const dailyRecords = await (prisma as any).officialDailyAttendance.findMany({
      where: {
        student_id: student.id,
        academic_year_id: targetAcademicYearId,
      },
      include: {
        recorded_by: {
          select: { first_name: true, last_name: true },
        },
        verified_by: {
          select: { first_name: true, last_name: true },
        },
      },
      orderBy: { date: 'desc' },
      take: 100,
    });

    const lifecycle = classifyAcademicYearLifecycle(enrollment.academic_year);
    const isHistorical = lifecycle === 'HISTORICAL';
    const isUpcoming = lifecycle === 'UPCOMING';

    const totalSchoolDays = sf2Monthly.monthlySummaries.reduce((acc: number, m: any) => acc + (m.classDays || 0), 0);
    const totalPresent = sf2Monthly.monthlySummaries.reduce((acc: number, m: any) => acc + (m.daysPresent || 0), 0);
    const totalAbsent = sf2Monthly.monthlySummaries.reduce((acc: number, m: any) => acc + (m.daysAbsent || 0), 0);
    const totalTardy = sf2Monthly.monthlySummaries.reduce((acc: number, m: any) => acc + (m.daysTardy || 0), 0);
    const attendanceRate = totalSchoolDays > 0 ? Math.round((totalPresent / totalSchoolDays) * 1000) / 10 : null;

    res.json({
      success: true,
      data: {
        studentId: student.id,
        enrollmentId: enrollment.id,
        academicYearId: targetAcademicYearId,
        academicYearName: enrollment.academic_year.name,
        isCurrent: enrollment.academic_year.is_current,
        isHistorical,
        isUpcoming,
        lifecycle,
        sectionId: enrollment.section_id,
        sectionName: enrollment.section.name,
        gradeLevel: enrollment.section.grade_level,
        enrollmentStatus: enrollment.status,
        monthlySummaries: sf2Monthly.monthlySummaries,
        cumulative: {
          totalSchoolDays,
          totalPresent,
          totalAbsent,
          totalTardy,
          attendanceRate,
        },
        dailyRecords: dailyRecords.map((r: any) => ({
          id: r.id,
          date: r.date instanceof Date ? r.date.toISOString().split('T')[0] : r.date,
          statusCode: r.status,
          statusLabel: r.status === 'P' ? 'Present' : r.status === 'A' ? 'Absent' : r.status === 'L' ? 'Tardy' : 'Excused',
          recordStatus: r.record_status,
          remarks: r.remarks,
          recordedBy: r.recorded_by ? `${r.recorded_by.first_name} ${r.recorded_by.last_name}` : null,
          verifiedBy: r.verified_by ? `${r.verified_by.first_name} ${r.verified_by.last_name}` : null,
        })),
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
