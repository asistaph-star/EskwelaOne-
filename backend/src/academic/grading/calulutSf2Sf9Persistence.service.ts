/**
 * DIGISKWELA — Phase H.2 Persistence-Backed Official SF2/SF9 Service
 * Module: calulutSf2Sf9Persistence.service.ts
 *
 * Implements the database-backed School Calendar, Official Daily Attendance (SF2),
 * Adviser Term Comments, Institutional Signatories, Protected Grade Publication
 * Snapshots, and Authentic Calulut SF9 Workbook/PDF Assembly against the Phase G.1/H.2
 * schema (`digiskwela_test`).
 */

import crypto from 'crypto';
import fs from 'fs';
import defaultPrisma from '../../config/database.js';
import type { PrismaClient } from '@prisma/client';

export type DatabaseClient = PrismaClient;
import { AppError } from '../../common/middleware/errorHandler.js';
import { getStudentIdentity } from '../../common/utils/studentIdentity.js';
import {
  CALULUT_SF9_MONTH_SLOTS,
  parseManilaDateOnly,
  validateCalendarMonthDefinition,
  validateCalendarDayRelationship,
  validateSectionCalendarExceptionRelationship,
  validateOfficialDailyAttendanceRelationship,
  evaluateCalendarMonthCompleteness,
  planCalendarDayReclassificationImpact,
  aggregateStudentMonthlyAttendanceForSf9,
  mapVerifiedSf2SummariesToCalulutSf9Cells,
  validateGradePublicationSnapshot,
  assertGradebookWritableForDraftSave,
  authorizeSectionAdviserOrOverride,
  resolveSf9AdviserCommentsForCells,
  type AcademicYearRef,
  type SectionRef,
  type EnrollmentRef,
  type SchoolCalendarMonthRecord,
  type SchoolCalendarDayRecord,
  type SectionCalendarExceptionRecord,
  type OfficialDailyAttendanceRecord,
  type CalendarDayKind,
  type OfficialAttendanceStatusCode,
  type ExcusedAttendancePolicy,
  type AuthorizedActorContext,
  type Sf2MonthlyStudentSummary,
  type CalulutSf9AttendanceMappingResult,
} from './calulutSf2Sf9Foundation.js';
import {
  generateCalulutSf9,
  type GenerateSf9Input,
  type Sf9SubjectScores,
  type Sf9CalculatedSummary,
} from './calulutSf9Generator.js';
import { renderCalulutSf9BufferToPdf } from './calulutSf9PdfRenderer.js';
import { REQUIRED_SUBJECT_KEYS } from './calulutSf9Service.js';
import { calculateStudentTermGrade } from './calculationEngine.js';
import { getGradingPolicy } from './policyRegistry.js';
import type { StudentTermScoreInput } from './types.js';
import { resolveSubjectGroup } from '../../gradebooks/ledger.service.js';

export type Sf9MonthKeyLiteral =
  | 'JUN'
  | 'JUL'
  | 'AUG'
  | 'SEP'
  | 'OCT'
  | 'NOV'
  | 'DEC'
  | 'JAN'
  | 'FEB'
  | 'MAR'
  | 'APR';

// ─── Helper Utilities ────────────────────────────────────────────────────────

function toIsoDateOnly(d: Date | string): string {
  if (typeof d === 'string') {
    return d.slice(0, 10);
  }
  return d.toISOString().slice(0, 10);
}

/**
 * Resolves current calendar date in Asia/Manila (UTC+8) timezone as YYYY-MM-DD.
 */
export function getCurrentManilaDateString(): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  } catch {
    const now = new Date();
    const manilaTime = new Date(now.getTime() + (8 * 60 + now.getTimezoneOffset()) * 60000);
    return manilaTime.toISOString().slice(0, 10);
  }
}

function toUtcMidnightDate(isoDateStr: string): Date {
  const parsed = parseManilaDateOnly(isoDateStr);
  if (!parsed) {
    throw new AppError(400, 'INVALID_DATE_FORMAT', `Invalid YYYY-MM-DD date: ${isoDateStr}`);
  }
  return new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day));
}

function dateToExcelSerial(date: Date): string {
  const utcMidnightMs = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const serial = Math.floor(utcMidnightMs / 86_400_000) + 25569;
  return String(serial);
}

async function writeAuditEntry(
  db: DatabaseClient,
  params: {
    userId: string;
    action: string;
    entityType: string;
    entityId?: string | null;
    oldValues?: Record<string, unknown> | null;
    newValues?: Record<string, unknown> | null;
  }
): Promise<void> {
  await db.auditLog.create({
    data: {
      id: crypto.randomUUID(),
      actor_user_id: params.userId,
      action: params.action,
      resource_type: params.entityType,
      resource_id: params.entityId ?? null,
      previous_state: (params.oldValues ?? undefined) as any,
      new_state: (params.newValues ?? undefined) as any,
    },
  });
}

async function resolveSectionAdviserIdentity(
  db: DatabaseClient,
  sectionId: string
): Promise<{
  section: SectionRef;
  adviserTeacherId: string | null;
  adviserUserId: string | null;
  adviserName: string | null;
}> {
  const sec = await db.section.findUnique({
    where: { id: sectionId },
    include: {
      adviser_teacher: {
        include: { user: true },
      },
    },
  });

  if (!sec) {
    throw new AppError(404, 'SECTION_NOT_FOUND', `Section ${sectionId} not found.`);
  }

  const adviserUserId = sec.adviser_teacher?.user_id ?? null;
  const computedAdviserName = sec.adviser_name_snapshot?.trim()
    ? sec.adviser_name_snapshot.trim()
    : sec.adviser_teacher?.user
      ? `${sec.adviser_teacher.user.first_name} ${sec.adviser_teacher.user.middle_name ? sec.adviser_teacher.user.middle_name[0] + '. ' : ''}${sec.adviser_teacher.user.last_name}`
          .replace(/\s+/g, ' ')
          .trim()
          .toUpperCase()
      : null;

  return {
    section: {
      id: sec.id,
      academicYearId: sec.academic_year_id,
      adviserId: adviserUserId ?? sec.adviser_teacher_id ?? null,
      gradeLevel: sec.grade_level,
      name: sec.name,
    },
    adviserTeacherId: sec.adviser_teacher_id ?? null,
    adviserUserId,
    adviserName: computedAdviserName,
  };
}

// ─── 1. School Calendar Persistence Service (Phase H.2 Section 4) ───────────

export async function upsertSchoolCalendarMonth(
  db: DatabaseClient,
  input: {
    id?: string;
    academicYearId: string;
    monthKey: Sf9MonthKeyLiteral;
    calendarYear: number;
    calendarMonth: number;
    plannedInstructionalDays?: number | null;
    actorUserId: string;
  }
) {
  const ay = await db.academicYear.findUnique({
    where: { id: input.academicYearId },
  });
  if (!ay) {
    throw new AppError(404, 'ACADEMIC_YEAR_NOT_FOUND', `AcademicYear ${input.academicYearId} not found.`);
  }

  const slot = CALULUT_SF9_MONTH_SLOTS.find((s) => s.monthKey === input.monthKey);
  if (!slot || slot.monthOfYear !== input.calendarMonth) {
    throw new AppError(
      422,
      'INVALID_SF9_MONTH_SLOT_MAPPING',
      `Month key ${input.monthKey} does not match calendarMonth=${input.calendarMonth}.`
    );
  }

  const ayRef: AcademicYearRef = {
    id: ay.id,
    year: ay.name,
    startDate: toIsoDateOnly(ay.start_date),
    endDate: toIsoDateOnly(ay.end_date),
  };

  const monthCheck = validateCalendarMonthDefinition(
    {
      id: input.id ?? 'pending',
      academicYearId: input.academicYearId,
      calendarYear: input.calendarYear,
      monthOfYear: input.calendarMonth,
      sf9ColumnIndex: slot.index,
      status: 'DRAFT',
    },
    ayRef
  );
  if (!monthCheck.valid) {
    throw new AppError(422, monthCheck.code ?? 'INVALID_CALENDAR_MONTH', monthCheck.message ?? 'Invalid month');
  }

  const record = await db.schoolCalendarMonth.upsert({
    where: {
      academic_year_id_month_key: {
        academic_year_id: input.academicYearId,
        month_key: input.monthKey,
      },
    },
    update: {
      calendar_year: input.calendarYear,
      calendar_month: input.calendarMonth,
      planned_instructional_days: input.plannedInstructionalDays ?? null,
    },
    create: {
      id: input.id ?? crypto.randomUUID(),
      academic_year_id: input.academicYearId,
      month_key: input.monthKey,
      calendar_year: input.calendarYear,
      calendar_month: input.calendarMonth,
      status: 'DRAFT',
      planned_instructional_days: input.plannedInstructionalDays ?? null,
    },
  });

  await writeAuditEntry(db, {
    userId: input.actorUserId,
    action: 'SCHOOL_CALENDAR_MONTH_UPSERT',
    entityType: 'SchoolCalendarMonth',
    entityId: record.id,
    newValues: {
      academicYearId: record.academic_year_id,
      monthKey: record.month_key,
      calendarYear: record.calendar_year,
      calendarMonth: record.calendar_month,
      status: record.status,
    },
  });

  return record;
}

export async function upsertSchoolCalendarDay(
  db: DatabaseClient,
  input: {
    id?: string;
    academicYearId: string;
    calendarMonthId: string;
    date: string; // YYYY-MM-DD in Asia/Manila
    dayType: CalendarDayKind;
    isInstructional: boolean;
    description?: string | null;
    approvalStatus?: 'DRAFT' | 'APPROVED';
    correctionReason?: string | null;
    actorUserId: string;
  }
) {
  const [ay, month] = await Promise.all([
    db.academicYear.findUnique({ where: { id: input.academicYearId } }),
    db.schoolCalendarMonth.findUnique({ where: { id: input.calendarMonthId } }),
  ]);

  if (!ay) {
    throw new AppError(404, 'ACADEMIC_YEAR_NOT_FOUND', `AcademicYear ${input.academicYearId} not found.`);
  }
  if (!month) {
    throw new AppError(404, 'CALENDAR_MONTH_NOT_FOUND', `SchoolCalendarMonth ${input.calendarMonthId} not found.`);
  }

  if (month.status === 'FINALIZED') {
    throw new AppError(
      409,
      'CALENDAR_MONTH_FINALIZED_LOCKED',
      `SchoolCalendarMonth ${month.month_key} (${month.calendar_year}-${month.calendar_month}) is FINALIZED. Reopen the month with an audited reason before modifying dates.`
    );
  }

  const slot = CALULUT_SF9_MONTH_SLOTS.find((s) => s.monthKey === month.month_key)!;
  const ayRef: AcademicYearRef = {
    id: ay.id,
    year: ay.name,
    startDate: toIsoDateOnly(ay.start_date),
    endDate: toIsoDateOnly(ay.end_date),
  };
  const monthRef: SchoolCalendarMonthRecord = {
    id: month.id,
    academicYearId: month.academic_year_id,
    calendarYear: month.calendar_year,
    monthOfYear: month.calendar_month,
    sf9ColumnIndex: slot.index,
    status: month.status,
  };

  const dayValidation = validateCalendarDayRelationship(
    {
      id: input.id ?? 'pending',
      academicYearId: input.academicYearId,
      calendarMonthId: input.calendarMonthId,
      date: input.date,
      dayKind: input.dayType,
      isInstructional: input.isInstructional,
      reason: input.description ?? null,
    },
    monthRef,
    ayRef
  );

  if (!dayValidation.valid) {
    throw new AppError(
      422,
      dayValidation.code ?? 'INVALID_CALENDAR_DAY',
      dayValidation.message ?? 'Invalid SchoolCalendarDay relationship.'
    );
  }

  const utcDate = toUtcMidnightDate(input.date);
  const existingDay = await db.schoolCalendarDay.findUnique({
    where: {
      academic_year_id_date: {
        academic_year_id: input.academicYearId,
        date: utcDate,
      },
    },
  });

  const approvalStatus = input.approvalStatus ?? 'APPROVED';
  const now = new Date();

  if (!existingDay) {
    const created = await db.schoolCalendarDay.create({
      data: {
        id: input.id ?? crypto.randomUUID(),
        academic_year_id: input.academicYearId,
        calendar_month_id: input.calendarMonthId,
        date: utcDate,
        day_type: input.dayType,
        is_instructional: input.isInstructional,
        description: input.description ?? null,
        approval_status: approvalStatus,
        recorded_by_id: input.actorUserId,
        approved_by_id: approvalStatus === 'APPROVED' ? input.actorUserId : null,
        approved_at: approvalStatus === 'APPROVED' ? now : null,
        correction_reason: input.correctionReason ?? null,
      },
    });

    await writeAuditEntry(db, {
      userId: input.actorUserId,
      action: 'SCHOOL_CALENDAR_DAY_CREATED',
      entityType: 'SchoolCalendarDay',
      entityId: created.id,
      newValues: {
        date: input.date,
        dayType: created.day_type,
        isInstructional: created.is_instructional,
        approvalStatus: created.approval_status,
      },
    });

    return { day: created, invalidatedAttendanceCount: 0 };
  }

  // Reclassification impact check when updating an existing calendar day
  const existingAttRows = await db.officialDailyAttendance.findMany({
    where: {
      calendar_day_id: existingDay.id,
    },
  });

  const impact = planCalendarDayReclassificationImpact({
    monthStatus: month.status,
    previousEffectiveInstructional: existingDay.is_instructional,
    nextEffectiveInstructional: input.isInstructional,
    reclassificationReason: input.correctionReason ?? input.description ?? 'Calendar day reclassified',
    existingAttendanceOnDate: existingAttRows.map((r) => ({
      id: r.id,
      academicYearId: r.academic_year_id,
      sectionId: r.section_id,
      enrollmentId: r.enrollment_id,
      studentId: r.student_id,
      calendarDayId: r.calendar_day_id,
      date: toIsoDateOnly(r.date),
      status: r.status,
      recordStatus: r.record_status,
      recordedById: r.recorded_by_id,
    })),
  });

  if (
    existingDay.is_instructional !== input.isInstructional &&
    (!input.correctionReason || input.correctionReason.trim().length < 5)
  ) {
    throw new AppError(
      422,
      'MISSING_CALENDAR_CORRECTION_REASON',
      'Reclassifying a SchoolCalendarDay between instructional and non-instructional requires a correctionReason (at least 5 characters).'
    );
  }

  const updated = await db.$transaction(async (tx) => {
    const dayRow = await tx.schoolCalendarDay.update({
      where: { id: existingDay.id },
      data: {
        day_type: input.dayType,
        is_instructional: input.isInstructional,
        description: input.description ?? existingDay.description,
        approval_status: approvalStatus,
        updated_by_id: input.actorUserId,
        approved_by_id: approvalStatus === 'APPROVED' ? input.actorUserId : existingDay.approved_by_id,
        approved_at: approvalStatus === 'APPROVED' ? now : existingDay.approved_at,
        correction_reason: input.correctionReason ?? existingDay.correction_reason,
      },
    });

    let invalidatedCount = 0;
    if (impact.attendanceIdsToInvalidate.length > 0) {
      const res = await tx.officialDailyAttendance.updateMany({
        where: {
          id: { in: impact.attendanceIdsToInvalidate },
        },
        data: {
          record_status: 'INVALIDATED_NON_INSTRUCTIONAL',
          correction_reason: impact.invalidationReason,
          updated_by_id: input.actorUserId,
        },
      });
      invalidatedCount = res.count;
    }

    return { day: dayRow, invalidatedAttendanceCount: invalidatedCount };
  });

  await writeAuditEntry(db, {
    userId: input.actorUserId,
    action: 'SCHOOL_CALENDAR_DAY_UPDATED',
    entityType: 'SchoolCalendarDay',
    entityId: existingDay.id,
    oldValues: {
      dayType: existingDay.day_type,
      isInstructional: existingDay.is_instructional,
    },
    newValues: {
      dayType: updated.day.day_type,
      isInstructional: updated.day.is_instructional,
      correctionReason: input.correctionReason ?? null,
      invalidatedAttendanceCount: updated.invalidatedAttendanceCount,
    },
  });

  return updated;
}

export async function upsertSectionCalendarException(
  db: DatabaseClient,
  input: {
    id?: string;
    academicYearId: string;
    sectionId: string;
    calendarDayId: string;
    date: string; // YYYY-MM-DD
    overrideDayType: CalendarDayKind;
    overrideIsInstructional: boolean;
    reason: string;
    approvalStatus?: 'DRAFT' | 'APPROVED';
    actorUserId: string;
  }
) {
  if (!input.reason || input.reason.trim().length < 5) {
    throw new AppError(
      422,
      'INVALID_EXCEPTION_REASON',
      'SectionCalendarException requires a documented reason (at least 5 characters).'
    );
  }

  const [{ section }, calDay] = await Promise.all([
    resolveSectionAdviserIdentity(db, input.sectionId),
    db.schoolCalendarDay.findUnique({ where: { id: input.calendarDayId } }),
  ]);

  if (!calDay) {
    throw new AppError(404, 'CALENDAR_DAY_NOT_FOUND', `SchoolCalendarDay ${input.calendarDayId} not found.`);
  }

  const dayIso = toIsoDateOnly(calDay.date);
  if (dayIso !== input.date) {
    throw new AppError(
      422,
      'CONTRADICTORY_CALENDAR_DAY_DATE',
      `SectionCalendarException date (${input.date}) does not match SchoolCalendarDay.date (${dayIso}).`
    );
  }

  const excValidation = validateSectionCalendarExceptionRelationship(
    {
      id: input.id ?? 'pending',
      academicYearId: input.academicYearId,
      sectionId: input.sectionId,
      calendarDayId: input.calendarDayId,
      overrideDayKind: input.overrideDayType,
      overrideIsInstructional: input.overrideIsInstructional,
      reason: input.reason.trim(),
    },
    section,
    {
      id: calDay.id,
      academicYearId: calDay.academic_year_id,
      calendarMonthId: calDay.calendar_month_id,
      date: dayIso,
      dayKind: calDay.day_type,
      isInstructional: calDay.is_instructional,
    }
  );

  if (!excValidation.valid) {
    throw new AppError(
      422,
      excValidation.code ?? 'INVALID_SECTION_EXCEPTION',
      excValidation.message ?? 'Invalid SectionCalendarException.'
    );
  }

  const approvalStatus = input.approvalStatus ?? 'APPROVED';
  const utcDate = toUtcMidnightDate(input.date);
  const now = new Date();

  const result = await db.$transaction(async (tx) => {
    const exc = await tx.sectionCalendarException.upsert({
      where: {
        section_id_calendar_day_id: {
          section_id: input.sectionId,
          calendar_day_id: input.calendarDayId,
        },
      },
      update: {
        override_day_type: input.overrideDayType,
        override_is_instructional: input.overrideIsInstructional,
        reason: input.reason.trim(),
        approval_status: approvalStatus,
        approved_by_id: approvalStatus === 'APPROVED' ? input.actorUserId : null,
        approved_at: approvalStatus === 'APPROVED' ? now : null,
      },
      create: {
        id: input.id ?? crypto.randomUUID(),
        academic_year_id: input.academicYearId,
        section_id: input.sectionId,
        calendar_day_id: input.calendarDayId,
        date: utcDate,
        override_day_type: input.overrideDayType,
        override_is_instructional: input.overrideIsInstructional,
        reason: input.reason.trim(),
        approval_status: approvalStatus,
        recorded_by_id: input.actorUserId,
        approved_by_id: approvalStatus === 'APPROVED' ? input.actorUserId : null,
        approved_at: approvalStatus === 'APPROVED' ? now : null,
      },
    });

    let invalidatedCount = 0;
    if (approvalStatus === 'APPROVED' && !input.overrideIsInstructional) {
      const upd = await tx.officialDailyAttendance.updateMany({
        where: {
          section_id: input.sectionId,
          calendar_day_id: input.calendarDayId,
          record_status: { in: ['DRAFT', 'VERIFIED'] },
        },
        data: {
          record_status: 'INVALIDATED_NON_INSTRUCTIONAL',
          correction_reason: `Section calendar exception: ${input.reason.trim()}`,
          updated_by_id: input.actorUserId,
        },
      });
      invalidatedCount = upd.count;
    }

    return { exception: exc, invalidatedAttendanceCount: invalidatedCount };
  });

  await writeAuditEntry(db, {
    userId: input.actorUserId,
    action: 'SECTION_CALENDAR_EXCEPTION_UPSERT',
    entityType: 'SectionCalendarException',
    entityId: result.exception.id,
    newValues: {
      sectionId: input.sectionId,
      calendarDayId: input.calendarDayId,
      date: input.date,
      overrideDayType: input.overrideDayType,
      overrideIsInstructional: input.overrideIsInstructional,
      approvalStatus,
      invalidatedAttendanceCount: result.invalidatedAttendanceCount,
    },
  });

  return result;
}

export async function finalizeSchoolCalendarMonth(
  db: DatabaseClient,
  input: {
    calendarMonthId: string;
    actorUserId: string;
  }
) {
  const month = await db.schoolCalendarMonth.findUnique({
    where: { id: input.calendarMonthId },
    include: {
      academic_year: true,
      calendar_days: true,
    },
  });

  if (!month) {
    throw new AppError(404, 'CALENDAR_MONTH_NOT_FOUND', `SchoolCalendarMonth ${input.calendarMonthId} not found.`);
  }

  const slot = CALULUT_SF9_MONTH_SLOTS.find((s) => s.monthKey === month.month_key)!;
  const ayRef: AcademicYearRef = {
    id: month.academic_year.id,
    year: month.academic_year.name,
    startDate: toIsoDateOnly(month.academic_year.start_date),
    endDate: toIsoDateOnly(month.academic_year.end_date),
  };
  const monthRef: SchoolCalendarMonthRecord = {
    id: month.id,
    academicYearId: month.academic_year_id,
    calendarYear: month.calendar_year,
    monthOfYear: month.calendar_month,
    sf9ColumnIndex: slot.index,
    status: month.status,
  };

  const dayRecords: SchoolCalendarDayRecord[] = month.calendar_days.map((d) => ({
    id: d.id,
    academicYearId: d.academic_year_id,
    calendarMonthId: d.calendar_month_id,
    date: toIsoDateOnly(d.date),
    dayKind: d.day_type,
    isInstructional: d.is_instructional,
    reason: d.description,
  }));

  const completeness = evaluateCalendarMonthCompleteness({
    month: monthRef,
    academicYear: ayRef,
    calendarDays: dayRecords,
  });

  const unapprovedDates = month.calendar_days
    .filter((d) => d.approval_status !== 'APPROVED')
    .map((d) => toIsoDateOnly(d.date));

  if (!completeness.canFinalize || unapprovedDates.length > 0) {
    throw new AppError(
      422,
      'INCOMPLETE_SCHOOL_CALENDAR_MONTH',
      `Cannot finalize SchoolCalendarMonth ${month.month_key} (${month.calendar_year}-${month.calendar_month}): missingDates=[${completeness.missingDates.join(', ')}], invalidDays=[${completeness.invalidDays.join(', ')}], unapprovedDates=[${unapprovedDates.join(', ')}].`
    );
  }

  const now = new Date();
  const finalized = await db.schoolCalendarMonth.update({
    where: { id: month.id },
    data: {
      status: 'FINALIZED',
      reviewed_by_id: month.reviewed_by_id ?? input.actorUserId,
      reviewed_at: month.reviewed_at ?? now,
      finalized_by_id: input.actorUserId,
      finalized_at: now,
    },
  });

  await writeAuditEntry(db, {
    userId: input.actorUserId,
    action: 'SCHOOL_CALENDAR_MONTH_FINALIZED',
    entityType: 'SchoolCalendarMonth',
    entityId: finalized.id,
    newValues: {
      monthKey: finalized.month_key,
      status: finalized.status,
      instructionalDayCount: completeness.instructionalDates.length,
    },
  });

  return {
    month: finalized,
    completeness,
  };
}

export async function reopenSchoolCalendarMonth(
  db: DatabaseClient,
  input: {
    calendarMonthId: string;
    actor: AuthorizedActorContext;
    reopenReason: string;
  }
) {
  if (input.actor.role !== 'Admin' && input.actor.role !== 'Registrar') {
    throw new AppError(
      403,
      'FORBIDDEN_CALENDAR_REOPEN',
      'Only Admin or Registrar may reopen a FINALIZED SchoolCalendarMonth.'
    );
  }

  const trimmedReason = input.reopenReason?.trim() ?? '';
  if (trimmedReason.length < 5) {
    throw new AppError(
      422,
      'MISSING_REOPEN_REASON',
      'Reopening a SchoolCalendarMonth requires a documented reopenReason (minimum 5 characters).'
    );
  }

  const reopened = await db.schoolCalendarMonth.update({
    where: { id: input.calendarMonthId },
    data: {
      status: 'DRAFT',
      reopened_by_id: input.actor.userId,
      reopened_at: new Date(),
      reopen_reason: trimmedReason,
    },
  });

  await writeAuditEntry(db, {
    userId: input.actor.userId,
    action: 'SCHOOL_CALENDAR_MONTH_REOPENED',
    entityType: 'SchoolCalendarMonth',
    entityId: reopened.id,
    newValues: {
      status: reopened.status,
      reopenReason: trimmedReason,
    },
  });

  return reopened;
}

// ─── 2. Official Daily Attendance (SF2) Persistence Service (Section 5) ─────

export async function recordOfficialDailyAttendance(
  db: DatabaseClient,
  input: {
    id?: string;
    academicYearId: string;
    sectionId: string;
    studentId: string;
    enrollmentId: string;
    calendarDayId: string;
    date: string; // YYYY-MM-DD in Asia/Manila
    status: OfficialAttendanceStatusCode;
    tardyType?: 'MORNING' | 'AFTERNOON' | 'CONSECUTIVE' | null;
    remarks?: string | null;
    correctionReason?: string | null;
    actor: AuthorizedActorContext;
    overrideReason?: string | null;
    currentManilaDate?: string;
  }
) {
  const [{ section, adviserTeacherId, adviserUserId }, enrollmentRow, calDay, sectionExc] =
    await Promise.all([
      resolveSectionAdviserIdentity(db, input.sectionId),
      db.enrollment.findUnique({ where: { id: input.enrollmentId } }),
      db.schoolCalendarDay.findUnique({ where: { id: input.calendarDayId } }),
      db.sectionCalendarException.findUnique({
        where: {
          section_id_calendar_day_id: {
            section_id: input.sectionId,
            calendar_day_id: input.calendarDayId,
          },
        },
      }),
    ]);

  if (!enrollmentRow) {
    throw new AppError(404, 'ENROLLMENT_NOT_FOUND', `Enrollment ${input.enrollmentId} not found.`);
  }
  if (!calDay) {
    throw new AppError(404, 'CALENDAR_DAY_NOT_FOUND', `SchoolCalendarDay ${input.calendarDayId} not found.`);
  }

  // Authorize Class Adviser (accepting either teacher.user_id or teacher.id in activeAdviserIdsForDate)
  const activeAdviserIds = [adviserUserId, adviserTeacherId].filter((v): v is string => Boolean(v));
  const authCheck = authorizeSectionAdviserOrOverride({
    actor: input.actor,
    section,
    activeAdviserIdsForDate: activeAdviserIds,
    overrideReason: input.overrideReason,
  });

  if (!authCheck.authorized) {
    throw new AppError(
      403,
      'FORBIDDEN_NOT_SECTION_ADVISER',
      authCheck.reason ?? 'User is not authorized to record official daily attendance for this section.'
    );
  }

  const enrollmentRef: EnrollmentRef = {
    id: enrollmentRow.id,
    studentId: enrollmentRow.student_id,
    sectionId: enrollmentRow.section_id,
    academicYearId: enrollmentRow.academic_year_id,
    status: enrollmentRow.status as EnrollmentRef['status'],
    effectiveStartDate: enrollmentRow.effective_start_date
      ? toIsoDateOnly(enrollmentRow.effective_start_date)
      : undefined,
    effectiveEndDate: enrollmentRow.effective_end_date
      ? toIsoDateOnly(enrollmentRow.effective_end_date)
      : undefined,
  };

  const calDayRef: SchoolCalendarDayRecord = {
    id: calDay.id,
    academicYearId: calDay.academic_year_id,
    calendarMonthId: calDay.calendar_month_id,
    date: toIsoDateOnly(calDay.date),
    dayKind: calDay.day_type,
    isInstructional: calDay.is_instructional,
    reason: calDay.description,
  };

  const excRef: SectionCalendarExceptionRecord | null =
    sectionExc && sectionExc.approval_status === 'APPROVED'
      ? {
          id: sectionExc.id,
          academicYearId: sectionExc.academic_year_id,
          sectionId: sectionExc.section_id,
          calendarDayId: sectionExc.calendar_day_id,
          overrideDayKind: sectionExc.override_day_type,
          overrideIsInstructional: sectionExc.override_is_instructional,
          reason: sectionExc.reason,
        }
      : null;

  const relValidation = validateOfficialDailyAttendanceRelationship({
    attendance: {
      id: input.id ?? 'pending',
      academicYearId: input.academicYearId,
      sectionId: input.sectionId,
      enrollmentId: input.enrollmentId,
      studentId: input.studentId,
      calendarDayId: input.calendarDayId,
      date: input.date,
      status: input.status,
      recordStatus: 'DRAFT',
      recordedById: input.actor.userId,
    },
    enrollment: enrollmentRef,
    section,
    calendarDay: calDayRef,
    sectionException: excRef,
    currentManilaDate: input.currentManilaDate ?? getCurrentManilaDateString(),
  });

  if (!relValidation.valid) {
    throw new AppError(
      422,
      relValidation.code ?? 'INVALID_ATTENDANCE_RELATIONSHIP',
      relValidation.message ?? 'Invalid OfficialDailyAttendance relationship.'
    );
  }

  const utcDate = toUtcMidnightDate(input.date);
  const existing = await db.officialDailyAttendance.findUnique({
    where: {
      enrollment_id_date: {
        enrollment_id: input.enrollmentId,
        date: utcDate,
      },
    },
  });

  if (existing && existing.record_status === 'VERIFIED') {
    const trimmedReason = input.correctionReason?.trim() ?? '';
    if (trimmedReason.length < 5) {
      throw new AppError(
        422,
        'MISSING_ATTENDANCE_CORRECTION_REASON',
        'Updating an already VERIFIED official daily attendance record requires a documented correctionReason (at least 5 characters).'
      );
    }
  }

  const saved = await db.officialDailyAttendance.upsert({
    where: {
      enrollment_id_date: {
        enrollment_id: input.enrollmentId,
        date: utcDate,
      },
    },
    update: {
      status: input.status,
      record_status: 'DRAFT',
      tardy_type: input.status === 'L' ? (input.tardyType ?? 'MORNING') : null,
      remarks: input.remarks ?? null,
      correction_reason: input.correctionReason ?? null,
      updated_by_id: input.actor.userId,
      verified_by_id: null,
      verified_at: null,
    },
    create: {
      id: input.id ?? crypto.randomUUID(),
      academic_year_id: input.academicYearId,
      section_id: input.sectionId,
      student_id: input.studentId,
      enrollment_id: input.enrollmentId,
      calendar_day_id: input.calendarDayId,
      date: utcDate,
      status: input.status,
      record_status: 'DRAFT',
      tardy_type: input.status === 'L' ? (input.tardyType ?? 'MORNING') : null,
      remarks: input.remarks ?? null,
      correction_reason: input.correctionReason ?? null,
      recorded_by_id: input.actor.userId,
    },
  });

  await writeAuditEntry(db, {
    userId: input.actor.userId,
    action: existing ? 'OFFICIAL_DAILY_ATTENDANCE_UPDATED' : 'OFFICIAL_DAILY_ATTENDANCE_RECORDED',
    entityType: 'OfficialDailyAttendance',
    entityId: saved.id,
    oldValues: existing
      ? { status: existing.status, recordStatus: existing.record_status }
      : null,
    newValues: {
      studentId: saved.student_id,
      enrollmentId: saved.enrollment_id,
      date: input.date,
      status: saved.status,
      recordStatus: saved.record_status,
      correctionReason: saved.correction_reason,
    },
  });

  return saved;
}

export async function verifyOfficialDailyAttendance(
  db: DatabaseClient,
  input: {
    sectionId: string;
    enrollmentId?: string;
    attendanceIds?: string[];
    actor: AuthorizedActorContext;
    overrideReason?: string | null;
  }
) {
  const { section, adviserTeacherId, adviserUserId } = await resolveSectionAdviserIdentity(
    db,
    input.sectionId
  );

  const activeAdviserIds = [adviserUserId, adviserTeacherId].filter((v): v is string => Boolean(v));
  const authCheck = authorizeSectionAdviserOrOverride({
    actor: input.actor,
    section,
    activeAdviserIdsForDate: activeAdviserIds,
    overrideReason: input.overrideReason,
  });

  if (!authCheck.authorized) {
    throw new AppError(
      403,
      'FORBIDDEN_NOT_SECTION_ADVISER',
      authCheck.reason ?? 'Only the assigned Class Adviser may verify official daily attendance.'
    );
  }

  const whereClause: Record<string, unknown> = {
    section_id: input.sectionId,
    record_status: 'DRAFT',
  };
  if (input.enrollmentId) {
    whereClause.enrollment_id = input.enrollmentId;
  }
  if (input.attendanceIds && input.attendanceIds.length > 0) {
    whereClause.id = { in: input.attendanceIds };
  }

  const now = new Date();
  const updated = await db.officialDailyAttendance.updateMany({
    where: whereClause,
    data: {
      record_status: 'VERIFIED',
      verified_by_id: input.actor.userId,
      verified_at: now,
    },
  });

  await writeAuditEntry(db, {
    userId: input.actor.userId,
    action: 'OFFICIAL_DAILY_ATTENDANCE_VERIFIED',
    entityType: 'OfficialDailyAttendance',
    entityId: input.enrollmentId ?? input.sectionId,
    newValues: {
      sectionId: input.sectionId,
      enrollmentId: input.enrollmentId ?? null,
      verifiedCount: updated.count,
    },
  });

  return { verifiedCount: updated.count };
}

/**
 * Computes persisted monthly SF2 attendance summaries for a student across an academic year,
 * supporting both single-enrollment learners and mid-year section transfers (multiple
 * enrollments in the same academic year with non-overlapping effective date windows).
 */
export async function computePersistedStudentMonthlyAttendance(
  db: DatabaseClient,
  params: {
    studentId: string;
    academicYearId: string;
    enrollmentId?: string;
    targetTerm?: 'T1' | 'T2' | 'T3';
    excusedPolicy?: ExcusedAttendancePolicy;
    currentManilaDate?: string;
  }
): Promise<{
  monthlySummaries: Sf2MonthlyStudentSummary[];
  sf9Mapping: CalulutSf9AttendanceMappingResult;
}> {
  const [ay, calendarMonths, enrollments, attendanceRows] = await Promise.all([
    db.academicYear.findUnique({ where: { id: params.academicYearId } }),
    db.schoolCalendarMonth.findMany({
      where: { academic_year_id: params.academicYearId },
      include: { calendar_days: true },
    }),
    db.enrollment.findMany({
      where: {
        student_id: params.studentId,
        academic_year_id: params.academicYearId,
        ...(params.enrollmentId ? { id: params.enrollmentId } : {}),
      },
      include: {
        section: true,
      },
      orderBy: { created_at: 'asc' },
    }),
    db.officialDailyAttendance.findMany({
      where: {
        student_id: params.studentId,
        academic_year_id: params.academicYearId,
        ...(params.enrollmentId ? { enrollment_id: params.enrollmentId } : {}),
      },
    }),
  ]);

  if (!ay) {
    throw new AppError(404, 'ACADEMIC_YEAR_NOT_FOUND', `AcademicYear ${params.academicYearId} not found.`);
  }
  if (enrollments.length === 0) {
    throw new AppError(
      404,
      'ENROLLMENT_NOT_FOUND',
      `No enrollment found for student ${params.studentId} in academic year ${params.academicYearId}.`
    );
  }

  const sectionIds = Array.from(new Set(enrollments.map((e) => e.section_id)));
  const sectionExceptions = await db.sectionCalendarException.findMany({
    where: {
      academic_year_id: params.academicYearId,
      section_id: { in: sectionIds },
      approval_status: 'APPROVED',
    },
  });

  const ayRef: AcademicYearRef = {
    id: ay.id,
    year: ay.name,
    startDate: toIsoDateOnly(ay.start_date),
    endDate: toIsoDateOnly(ay.end_date),
  };

  const currentManilaDate = params.currentManilaDate ?? getCurrentManilaDateString();
  const excusedPolicy = params.excusedPolicy ?? 'UNRESOLVED';

  const monthByKey = new Map(calendarMonths.map((m) => [m.month_key, m]));
  const monthlySummaries: Sf2MonthlyStudentSummary[] = [];

  for (const slot of CALULUT_SF9_MONTH_SLOTS) {
    const dbMonth = monthByKey.get(slot.monthKey);
    if (!dbMonth) {
      continue;
    }

    const monthRef: SchoolCalendarMonthRecord = {
      id: dbMonth.id,
      academicYearId: dbMonth.academic_year_id,
      calendarYear: dbMonth.calendar_year,
      monthOfYear: dbMonth.calendar_month,
      sf9ColumnIndex: slot.index,
      status: dbMonth.status,
      reopenReason: dbMonth.reopen_reason,
    };

    const dayRefs: SchoolCalendarDayRecord[] = dbMonth.calendar_days.map((d) => ({
      id: d.id,
      academicYearId: d.academic_year_id,
      calendarMonthId: d.calendar_month_id,
      date: toIsoDateOnly(d.date),
      dayKind: d.day_type,
      isInstructional: d.is_instructional,
      reason: d.description,
    }));

    const dayIdSet = new Set(dayRefs.map((d) => d.id));

    if (enrollments.length === 1) {
      const enr = enrollments[0];
      const sectionRef: SectionRef = {
        id: enr.section.id,
        academicYearId: enr.section.academic_year_id,
        adviserId: enr.section.adviser_teacher_id,
        gradeLevel: enr.section.grade_level,
        name: enr.section.name,
      };
      const enrRef: EnrollmentRef = {
        id: enr.id,
        studentId: enr.student_id,
        sectionId: enr.section_id,
        academicYearId: enr.academic_year_id,
        status: enr.status as EnrollmentRef['status'],
        effectiveStartDate: enr.effective_start_date
          ? toIsoDateOnly(enr.effective_start_date)
          : undefined,
        effectiveEndDate: enr.effective_end_date
          ? toIsoDateOnly(enr.effective_end_date)
          : undefined,
      };

      const monthExceptions: SectionCalendarExceptionRecord[] = sectionExceptions
        .filter((e) => e.section_id === enr.section_id && dayIdSet.has(e.calendar_day_id))
        .map((e) => ({
          id: e.id,
          academicYearId: e.academic_year_id,
          sectionId: e.section_id,
          calendarDayId: e.calendar_day_id,
          overrideDayKind: e.override_day_type,
          overrideIsInstructional: e.override_is_instructional,
          reason: e.reason,
        }));

      const monthAtt: OfficialDailyAttendanceRecord[] = attendanceRows
        .filter((a) => a.enrollment_id === enr.id && dayIdSet.has(a.calendar_day_id))
        .map((a) => ({
          id: a.id,
          academicYearId: a.academic_year_id,
          sectionId: a.section_id,
          enrollmentId: a.enrollment_id,
          studentId: a.student_id,
          calendarDayId: a.calendar_day_id,
          date: toIsoDateOnly(a.date),
          status: a.status,
          recordStatus: a.record_status,
          recordedById: a.recorded_by_id,
          verifiedById: a.verified_by_id,
          invalidationReason: a.correction_reason,
        }));

      monthlySummaries.push(
        aggregateStudentMonthlyAttendanceForSf9({
          month: monthRef,
          academicYear: ayRef,
          section: sectionRef,
          enrollment: enrRef,
          calendarDays: dayRefs,
          sectionExceptions: monthExceptions,
          attendanceRecords: monthAtt,
          excusedPolicy,
          currentManilaDate,
        })
      );
    } else {
      // Multi-enrollment (mid-year section transfer) aggregation without duplicate date counting
      const perEnrollmentSummaries = enrollments.map((enr) => {
        const sectionRef: SectionRef = {
          id: enr.section.id,
          academicYearId: enr.section.academic_year_id,
          adviserId: enr.section.adviser_teacher_id,
          gradeLevel: enr.section.grade_level,
          name: enr.section.name,
        };
        const enrRef: EnrollmentRef = {
          id: enr.id,
          studentId: enr.student_id,
          sectionId: enr.section_id,
          academicYearId: enr.academic_year_id,
          status: enr.status as EnrollmentRef['status'],
          effectiveStartDate: enr.effective_start_date
            ? toIsoDateOnly(enr.effective_start_date)
            : undefined,
          effectiveEndDate: enr.effective_end_date
            ? toIsoDateOnly(enr.effective_end_date)
            : undefined,
        };
        const monthExceptions: SectionCalendarExceptionRecord[] = sectionExceptions
          .filter((e) => e.section_id === enr.section_id && dayIdSet.has(e.calendar_day_id))
          .map((e) => ({
            id: e.id,
            academicYearId: e.academic_year_id,
            sectionId: e.section_id,
            calendarDayId: e.calendar_day_id,
            overrideDayKind: e.override_day_type,
            overrideIsInstructional: e.override_is_instructional,
            reason: e.reason,
          }));
        const monthAtt: OfficialDailyAttendanceRecord[] = attendanceRows
          .filter((a) => a.enrollment_id === enr.id && dayIdSet.has(a.calendar_day_id))
          .map((a) => ({
            id: a.id,
            academicYearId: a.academic_year_id,
            sectionId: a.section_id,
            enrollmentId: a.enrollment_id,
            studentId: a.student_id,
            calendarDayId: a.calendar_day_id,
            date: toIsoDateOnly(a.date),
            status: a.status,
            recordStatus: a.record_status,
            recordedById: a.recorded_by_id,
            verifiedById: a.verified_by_id,
            invalidationReason: a.correction_reason,
          }));

        return aggregateStudentMonthlyAttendanceForSf9({
          month: monthRef,
          academicYear: ayRef,
          section: sectionRef,
          enrollment: enrRef,
          calendarDays: dayRefs,
          sectionExceptions: monthExceptions,
          attendanceRecords: monthAtt,
          excusedPolicy,
          currentManilaDate,
        });
      });

      const combined: Sf2MonthlyStudentSummary = {
        sf9ColumnIndex: slot.index,
        monthOfYear: dbMonth.calendar_month,
        calendarYear: dbMonth.calendar_year,
        verificationState: 'VERIFIED',
        classDays: perEnrollmentSummaries.reduce((acc, s) => acc + s.classDays, 0),
        daysPresent: perEnrollmentSummaries.reduce((acc, s) => acc + s.daysPresent, 0),
        daysAbsent: perEnrollmentSummaries.reduce((acc, s) => acc + s.daysAbsent, 0),
        daysTardy: perEnrollmentSummaries.reduce((acc, s) => acc + s.daysTardy, 0),
        daysExcused: perEnrollmentSummaries.reduce((acc, s) => acc + s.daysExcused, 0),
        missingInstructionalDates: perEnrollmentSummaries.flatMap((s) => s.missingInstructionalDates),
        unverifiedDraftDates: perEnrollmentSummaries.flatMap((s) => s.unverifiedDraftDates),
        excusedDates: perEnrollmentSummaries.flatMap((s) => s.excusedDates),
        integrityErrors: perEnrollmentSummaries.flatMap((s) => s.integrityErrors),
      };

      const nonVerified = perEnrollmentSummaries.find((s) => s.verificationState !== 'VERIFIED');
      if (nonVerified) {
        combined.verificationState = nonVerified.verificationState;
      }

      monthlySummaries.push(combined);
    }
  }

  const sf9Mapping = mapVerifiedSf2SummariesToCalulutSf9Cells(monthlySummaries, params.targetTerm);
  return {
    monthlySummaries,
    sf9Mapping,
  };
}

// ─── 3. Adviser Comments & Institutional Signatories Persistence (Section 6) ─

export async function assignSectionClassAdviser(
  db: DatabaseClient,
  input: {
    sectionId: string;
    adviserTeacherId: string;
    adviserNameSnapshot?: string | null;
    actorUserId: string;
  }
) {
  const teacher = await db.teacher.findUnique({
    where: { id: input.adviserTeacherId },
    include: { user: true },
  });
  if (!teacher) {
    throw new AppError(404, 'TEACHER_NOT_FOUND', `Teacher ${input.adviserTeacherId} not found.`);
  }

  const snapshotName =
    input.adviserNameSnapshot?.trim() ||
    `${teacher.user.first_name} ${teacher.user.middle_name ? teacher.user.middle_name[0] + '. ' : ''}${teacher.user.last_name}`
      .replace(/\s+/g, ' ')
      .trim()
      .toUpperCase();

  const updated = await db.section.update({
    where: { id: input.sectionId },
    data: {
      adviser_teacher_id: teacher.id,
      adviser_assigned_at: new Date(),
      adviser_name_snapshot: snapshotName,
    },
  });

  await writeAuditEntry(db, {
    userId: input.actorUserId,
    action: 'SECTION_ADVISER_ASSIGNED',
    entityType: 'Section',
    entityId: updated.id,
    newValues: {
      adviserTeacherId: updated.adviser_teacher_id,
      adviserNameSnapshot: updated.adviser_name_snapshot,
    },
  });

  return updated;
}

export async function saveSf9AdviserComment(
  db: DatabaseClient,
  input: {
    id?: string;
    enrollmentId: string;
    studentId: string;
    sectionId: string;
    academicYearId: string;
    term: 'T1' | 'T2' | 'T3';
    comment: string;
    status?: 'DRAFT' | 'PUBLISHED';
    allowPublishedCorrection?: boolean;
    correctionReason?: string | null;
    actor: AuthorizedActorContext;
    overrideReason?: string | null;
  }
) {
  const trimmedComment = input.comment?.trim() ?? '';
  if (!trimmedComment) {
    throw new AppError(422, 'EMPTY_ADVISER_COMMENT', 'Adviser comment text cannot be empty.');
  }

  const [{ section, adviserTeacherId, adviserUserId }, enrollmentRow] = await Promise.all([
    resolveSectionAdviserIdentity(db, input.sectionId),
    db.enrollment.findUnique({ where: { id: input.enrollmentId } }),
  ]);

  if (!enrollmentRow) {
    throw new AppError(404, 'ENROLLMENT_NOT_FOUND', `Enrollment ${input.enrollmentId} not found.`);
  }

  if (
    enrollmentRow.student_id !== input.studentId ||
    enrollmentRow.section_id !== input.sectionId ||
    enrollmentRow.academic_year_id !== input.academicYearId
  ) {
    throw new AppError(
      422,
      'CONTRADICTORY_ENROLLMENT_RELATIONSHIP',
      'Sf9AdviserComment (enrollmentId, studentId, sectionId, academicYearId) does not match Enrollment record.'
    );
  }

  const activeAdviserIds = [adviserUserId, adviserTeacherId].filter((v): v is string => Boolean(v));
  const authCheck = authorizeSectionAdviserOrOverride({
    actor: input.actor,
    section,
    activeAdviserIdsForDate: activeAdviserIds,
    overrideReason: input.overrideReason,
  });

  if (!authCheck.authorized) {
    throw new AppError(
      403,
      'FORBIDDEN_NOT_SECTION_ADVISER',
      authCheck.reason ?? 'Only the designated Class Adviser may save or publish SF9 term comments.'
    );
  }

  const existing = await db.sf9AdviserComment.findUnique({
    where: {
      enrollment_id_term: {
        enrollment_id: input.enrollmentId,
        term: input.term,
      },
    },
  });

  const targetStatus = input.status ?? 'DRAFT';
  const now = new Date();

  if (!existing) {
    const created = await db.sf9AdviserComment.create({
      data: {
        id: input.id ?? crypto.randomUUID(),
        enrollment_id: input.enrollmentId,
        student_id: input.studentId,
        section_id: input.sectionId,
        academic_year_id: input.academicYearId,
        term: input.term,
        comment: trimmedComment,
        status: targetStatus,
        version: 1,
        recorded_by_id: input.actor.userId,
        published_by_id: targetStatus === 'PUBLISHED' ? input.actor.userId : null,
        published_at: targetStatus === 'PUBLISHED' ? now : null,
      },
    });

    await writeAuditEntry(db, {
      userId: input.actor.userId,
      action: targetStatus === 'PUBLISHED' ? 'SF9_ADVISER_COMMENT_PUBLISHED' : 'SF9_ADVISER_COMMENT_SAVED',
      entityType: 'Sf9AdviserComment',
      entityId: created.id,
      newValues: {
        enrollmentId: created.enrollment_id,
        term: created.term,
        status: created.status,
        version: created.version,
      },
    });

    return created;
  }

  if (existing.status === 'PUBLISHED') {
    const trimmedReason = input.correctionReason?.trim() ?? '';
    if (!input.allowPublishedCorrection || trimmedReason.length < 5) {
      throw new AppError(
        409,
        'PUBLISHED_COMMENT_PROTECTED',
        `Adviser comment for ${input.term} is already PUBLISHED and protected from silent overwrite. Set allowPublishedCorrection=true and provide a correctionReason (at least 5 characters).`
      );
    }
  }

  const nextVersion = existing.status === 'PUBLISHED' ? existing.version + 1 : existing.version;
  const updated = await db.sf9AdviserComment.update({
    where: { id: existing.id },
    data: {
      comment: trimmedComment,
      status: targetStatus,
      version: nextVersion,
      updated_by_id: input.actor.userId,
      published_by_id: targetStatus === 'PUBLISHED' ? input.actor.userId : existing.published_by_id,
      published_at: targetStatus === 'PUBLISHED' ? now : existing.published_at,
      correction_reason: input.correctionReason?.trim() ?? existing.correction_reason,
    },
  });

  await writeAuditEntry(db, {
    userId: input.actor.userId,
    action:
      existing.status === 'PUBLISHED'
        ? 'SF9_ADVISER_COMMENT_CORRECTED'
        : targetStatus === 'PUBLISHED'
          ? 'SF9_ADVISER_COMMENT_PUBLISHED'
          : 'SF9_ADVISER_COMMENT_UPDATED',
    entityType: 'Sf9AdviserComment',
    entityId: updated.id,
    oldValues: {
      comment: existing.comment,
      status: existing.status,
      version: existing.version,
    },
    newValues: {
      comment: updated.comment,
      status: updated.status,
      version: updated.version,
      correctionReason: updated.correction_reason,
    },
  });

  return updated;
}

export async function resolvePersistedSf9Signatories(
  db: DatabaseClient,
  params: {
    sectionId: string;
    academicYearId: string;
  }
): Promise<{
  adviserTeacherId: string | null;
  adviserName: string | null;
  schoolHeadName: string | null;
  schoolHeadTitle: string | null;
  schoolName: string;
  schoolId: string | null;
}> {
  const [{ adviserTeacherId, adviserName }, ay, settings] = await Promise.all([
    resolveSectionAdviserIdentity(db, params.sectionId),
    db.academicYear.findUnique({ where: { id: params.academicYearId } }),
    db.schoolSettings.findFirst(),
  ]);

  let schoolHeadName =
    ay?.school_head_name_snapshot?.trim() ||
    settings?.school_head_name?.trim() ||
    null;

  let schoolHeadTitle =
    ay?.school_head_title_snapshot?.trim() ||
    settings?.school_head_title?.trim() ||
    'Principal IV';

  // For genuine official reports, require an appropriately verified institutional signatory
  // (from authorized academic year snapshot or school settings). Silent fallback to arbitrary
  // user accounts with role 'Principal' is disallowed to prevent unauthorized signatories.

  return {
    adviserTeacherId,
    adviserName,
    schoolHeadName,
    schoolHeadTitle,
    schoolName: settings?.school_name?.trim() || 'Calulut Integrated School',
    schoolId: settings?.school_id?.trim() || '500146',
  };
}

// ─── 4. Gradebook Publication Protection Persistence (Section 7) ────────────

export async function saveDraftGradeLedgerEntry(
  db: DatabaseClient,
  input: {
    gradebookId: string;
    expectedGradebookVersion: number;
    studentId: string;
    subjectId: string;
    academicYearId: string;
    term: 'T1' | 'T2' | 'T3';
    draftTermGrade: number;
    draftInitialGrade?: number;
    actorUserId: string;
  }
) {
  const gradebook = await db.gradebooks.findUnique({
    where: { id: input.gradebookId },
  });
  if (!gradebook) {
    throw new AppError(404, 'GRADEBOOK_NOT_FOUND', `Gradebook ${input.gradebookId} not found.`);
  }

  const writableCheck = assertGradebookWritableForDraftSave({
    gradebookId: gradebook.id,
    status: gradebook.status as 'Draft' | 'Submitted' | 'Verified' | 'Published',
    currentVersion: gradebook.version,
    expectedVersion: input.expectedGradebookVersion,
  });

  if (!writableCheck.writable) {
    throw new AppError(
      409,
      writableCheck.code ?? 'GRADEBOOK_NOT_WRITABLE',
      writableCheck.message ?? 'Gradebook cannot be modified by a draft save.'
    );
  }

  const existingGrade = await db.grade.findUnique({
    where: {
      student_id_subject_id_term_academic_year_id: {
        student_id: input.studentId,
        subject_id: input.subjectId,
        term: input.term,
        academic_year_id: input.academicYearId,
      },
    },
  });

  if (existingGrade?.published_term_grade !== null && existingGrade?.published_term_grade !== undefined) {
    throw new AppError(
      409,
      'PUBLISHED_GRADE_SNAPSHOT_PROTECTED',
      `Grade for student=${input.studentId}, subject=${input.subjectId}, term=${input.term} already has a published_term_grade (${existingGrade.published_term_grade}) and cannot be overwritten by a draft save.`
    );
  }

  // Draft save updates only draft fields (`term_grade`) and never populates `published_term_grade`
  const savedGrade = await db.grade.upsert({
    where: {
      student_id_subject_id_term_academic_year_id: {
        student_id: input.studentId,
        subject_id: input.subjectId,
        term: input.term,
        academic_year_id: input.academicYearId,
      },
    },
    update: {
      term_grade: input.draftTermGrade,
    },
    create: {
      id: crypto.randomUUID(),
      student_id: input.studentId,
      subject_id: input.subjectId,
      academic_year_id: input.academicYearId,
      term: input.term,
      term_grade: input.draftTermGrade,
    },
  });

  return savedGrade;
}

export async function publishSubjectTermGradeSnapshot(
  db: DatabaseClient,
  input: {
    enrollmentId: string;
    studentId: string;
    subjectId: string;
    academicYearId: string;
    term: 'T1' | 'T2' | 'T3';
    gradebookId: string;
    expectedGradebookVersion: number;
    transmutedTermGrade: number;
    initialGrade: number;
    actor: AuthorizedActorContext;
    correctionReason?: string | null;
  }
) {
  const [gradebook, existingGrade] = await Promise.all([
    db.gradebooks.findUnique({ where: { id: input.gradebookId } }),
    db.grade.findUnique({
      where: {
        student_id_subject_id_term_academic_year_id: {
          student_id: input.studentId,
          subject_id: input.subjectId,
          term: input.term,
          academic_year_id: input.academicYearId,
        },
      },
    }),
  ]);

  if (!gradebook) {
    throw new AppError(404, 'GRADEBOOK_NOT_FOUND', `Gradebook ${input.gradebookId} not found.`);
  }

  const isRepublication =
    existingGrade?.published_term_grade !== null &&
    existingGrade?.published_term_grade !== undefined;

  if (isRepublication && input.actor.role !== 'Admin' && input.actor.role !== 'Registrar') {
    throw new AppError(
      403,
      'FORBIDDEN_PUBLISHED_GRADE_REVISION',
      'Revising an already-published grade snapshot requires Admin/Principal/Registrar authorization.'
    );
  }

  const termNumber: 1 | 2 | 3 = input.term === 'T1' ? 1 : input.term === 'T2' ? 2 : 3;
  const pubCheck = validateGradePublicationSnapshot({
    enrollmentId: input.enrollmentId,
    subjectId: input.subjectId,
    term: termNumber,
    gradebookId: gradebook.id,
    currentGradebookStatus: gradebook.status as 'Draft' | 'Submitted' | 'Verified' | 'Published',
    currentGradebookVersion: gradebook.version,
    expectedGradebookVersion: input.expectedGradebookVersion,
    transmutedTermGrade: input.transmutedTermGrade,
    initialGrade: input.initialGrade,
    publishedById: input.actor.userId,
    isRepublicationCorrection: isRepublication,
    correctionReason: input.correctionReason,
  });

  if (!pubCheck.valid || !pubCheck.normalizedPublishedSnapshot) {
    const status = pubCheck.code === 'OPTIMISTIC_LOCK_VERSION_CONFLICT' ? 409 : 422;
    throw new AppError(
      status,
      pubCheck.code ?? 'INVALID_GRADE_PUBLICATION',
      pubCheck.message ?? 'Grade publication snapshot validation failed.'
    );
  }

  const snap = pubCheck.normalizedPublishedSnapshot;
  const now = new Date();

  const result = await db.$transaction(async (tx) => {
    const updatedGb = await tx.gradebooks.update({
      where: { id: gradebook.id },
      data: {
        status: 'Published',
        version: snap.publishedVersion,
        updated_at: now,
      },
    });

    const savedGrade = await tx.grade.upsert({
      where: {
        student_id_subject_id_term_academic_year_id: {
          student_id: input.studentId,
          subject_id: input.subjectId,
          term: input.term,
          academic_year_id: input.academicYearId,
        },
      },
      update: {
        term_grade: snap.publishedTermGrade,
        published_term_grade: snap.publishedTermGrade,
        published_initial_grade: snap.publishedInitialGradeFixed2,
        published_gradebook_id: snap.publishedGradebookId,
        published_version: snap.publishedVersion,
        published_at: now,
        published_by_id: snap.publishedById,
        publication_correction_reason: snap.publicationCorrectionReason,
      },
      create: {
        id: crypto.randomUUID(),
        student_id: input.studentId,
        subject_id: input.subjectId,
        academic_year_id: input.academicYearId,
        term: input.term,
        term_grade: snap.publishedTermGrade,
        published_term_grade: snap.publishedTermGrade,
        published_initial_grade: snap.publishedInitialGradeFixed2,
        published_gradebook_id: snap.publishedGradebookId,
        published_version: snap.publishedVersion,
        published_at: now,
        published_by_id: snap.publishedById,
        publication_correction_reason: snap.publicationCorrectionReason,
      },
    });

    return { grade: savedGrade, gradebook: updatedGb };
  });

  await writeAuditEntry(db, {
    userId: input.actor.userId,
    action: isRepublication ? 'GRADE_SNAPSHOT_REPUBLISHED' : 'GRADE_SNAPSHOT_PUBLISHED',
    entityType: 'Grade',
    entityId: result.grade.id,
    oldValues: existingGrade
      ? {
          publishedTermGrade: existingGrade.published_term_grade,
          publishedVersion: existingGrade.published_version,
        }
      : null,
    newValues: {
      studentId: input.studentId,
      subjectId: input.subjectId,
      term: input.term,
      publishedTermGrade: result.grade.published_term_grade,
      publishedVersion: result.grade.published_version,
      correctionReason: result.grade.publication_correction_reason,
    },
  });

  return result;
}

// ─── 5. Persisted Database-to-Calulut SF9 Workbook & PDF Assembly (Section 8) ─

const SUBJECT_SLOT_PATTERNS: Array<{
  key: keyof Sf9SubjectScores;
  label: string;
  pattern: RegExp;
}> = [
  { key: 'filipino', label: 'Filipino', pattern: /filipino|^fil/i },
  { key: 'english', label: 'English', pattern: /english|^eng/i },
  { key: 'math', label: 'Mathematics', pattern: /math/i },
  { key: 'science', label: 'Science', pattern: /science|^sci/i },
  { key: 'ap', label: 'Araling Panlipunan (AP)', pattern: /araling panlipunan|^ap(?:\b|_|-|\d)/i },
  { key: 'gmrc', label: 'GMRC / Values Education / EsP', pattern: /edukasyon sa pagpapakatao|\besp\b|gmrc|values/i },
  { key: 'tle', label: 'TLE / EPP', pattern: /technology (?:and|&|\+) livelihood|\btle\b|\bepp\b/i },
  { key: 'music', label: 'Music & Arts', pattern: /music|^mus|^ma(?:\b|_|-|\d)/i },
  { key: 'pe', label: 'Physical Education & Health (PE)', pattern: /physical education|\bpe\b|\bpeh\b|^peh/i },
];

export interface SubjectTermGradeStatus {
  grade: number | null;
  published: boolean;
}

export interface SubjectEvaluationSummary {
  key: keyof Sf9SubjectScores;
  label: string;
  t1: SubjectTermGradeStatus;
  t2: SubjectTermGradeStatus;
  t3: SubjectTermGradeStatus;
  isComplete: boolean;
  status: 'COMPLETE' | 'PARTIAL' | 'MISSING';
}

export interface PrerequisiteEvaluation {
  targetTerm?: 'T1' | 'T2' | 'T3';
  demographics: {
    validLrn: boolean;
    validBirthdate: boolean;
    validGender: boolean;
    age: number | null;
  };
  signatories: {
    adviserName: string | null;
    schoolHeadName: string | null;
    schoolHeadTitle: string | null;
    hasAdviser: boolean;
    hasSchoolHead: boolean;
  };
  attendance: {
    readyForOfficialSf9: boolean;
    finalizedMonthsCount: number;
    totalRequiredMonths: number;
    blockingReasons: string[];
  };
  comments: {
    t1: boolean;
    t2: boolean;
    t3: boolean;
  };
  subjects: Record<string, SubjectEvaluationSummary>;
}

export interface PersistedStudentSf9AssemblyResult {
  readyForOfficialSf9: boolean;
  blockingReasons: string[];
  payload?: GenerateSf9Input;
  xlsxBuffer?: Buffer;
  pdfBuffer?: Buffer;
  calculated?: Sf9CalculatedSummary;
  attendanceMapping: CalulutSf9AttendanceMappingResult;
  resolvedSignatories: {
    adviserName: string | null;
    schoolHeadName: string | null;
    schoolHeadTitle: string | null;
  };
  subjectEvaluation?: Record<string, SubjectEvaluationSummary>;
  prerequisiteEvaluation?: PrerequisiteEvaluation;
}

/**
 * Queries saved grades (published snapshots), verified daily attendance, published
 * adviser term comments, and institutional signatories from `digiskwela_test`,
 * validates all official SF9 release gates, populates Calulut's original SF9
 * workbook (`master_template_sanitized.xlsx`), and optionally renders the PDF
 * via headless LibreOffice Calc.
 */
export async function generatePersistedStudentCalulutSf9FromDb(
  db: DatabaseClient,
  params: {
    studentId: string;
    enrollmentId: string;
    academicYearId: string;
    targetTerm?: 'T1' | 'T2' | 'T3';
    renderPdf?: boolean;
    excusedPolicy?: ExcusedAttendancePolicy;
    currentManilaDate?: string;
    mode?: 'OFFICIAL' | 'DRAFT';
    profiler?: any;
  }
): Promise<PersistedStudentSf9AssemblyResult> {
  const isDraftMode = params.mode === 'DRAFT';
  const targetTerm: 'T1' | 'T2' | 'T3' = params.targetTerm || 'T3';

  if (params.profiler?.start) params.profiler.start('db_retrieval');
  const [student, enrollment, rawGrades, rawComments] = await Promise.all([
    db.student.findUnique({
      where: { id: params.studentId },
      include: { user: true },
    }),
    db.enrollment.findUnique({
      where: { id: params.enrollmentId },
      include: {
        section: true,
        academic_year: true,
      },
    }),
    db.grade.findMany({
      where: {
        student_id: params.studentId,
        academic_year_id: params.academicYearId,
      },
      include: {
        subject: true,
        published_gradebook: {
          include: {
            columns: {
              include: {
                entries: {
                  where: {
                    OR: [
                      { enrollment_id: params.enrollmentId },
                      { enrollment: { student_id: params.studentId } },
                    ],
                    is_superseded: false,
                  },
                },
              },
            },
          },
        },
      },
    }),
    db.sf9AdviserComment.findMany({
      where: {
        enrollment_id: params.enrollmentId,
      },
    }),
  ]);
  if (params.profiler?.stop) params.profiler.stop('db_retrieval');
  if (params.profiler?.start) params.profiler.start('data_mapping');

  if (!student) {
    throw new AppError(404, 'STUDENT_NOT_FOUND', `Student ${params.studentId} not found.`);
  }
  if (!enrollment) {
    throw new AppError(404, 'ENROLLMENT_NOT_FOUND', `Enrollment ${params.enrollmentId} not found.`);
  }
  if (
    enrollment.student_id !== student.id ||
    enrollment.academic_year_id !== params.academicYearId
  ) {
    throw new AppError(
      422,
      'CONTRADICTORY_ENROLLMENT_STUDENT',
      'Enrollment does not belong to the requested student and academic year.'
    );
  }

  const blockingReasons: string[] = [];

  // 1. Validate authoritative demographics
  const validLrn = student.lrn && /^\d{12}$/.test(student.lrn.trim()) ? student.lrn.trim() : null;
  if (!validLrn) {
    blockingReasons.push('MISSING_AUTHORITATIVE_LRN');
  }

  let birthdateSerial: string | null = null;
  let age: number | null = null;
  if (student.date_of_birth) {
    const dob = new Date(student.date_of_birth);
    if (!Number.isNaN(dob.getTime())) {
      birthdateSerial = dateToExcelSerial(dob);
      const ageDifMs = Date.now() - dob.getTime();
      age = Math.max(5, Math.abs(new Date(ageDifMs).getUTCFullYear() - 1970));
    }
  }
  if (!birthdateSerial || !age) {
    blockingReasons.push('MISSING_AUTHORITATIVE_BIRTHDATE');
  }

  let gender: 'M' | 'F' | null = null;
  if (student.gender && /^(male|female|m|f)$/i.test(student.gender.trim())) {
    gender = student.gender.trim().toLowerCase().startsWith('f') ? 'F' : 'M';
  } else {
    blockingReasons.push('MISSING_AUTHORITATIVE_GENDER');
  }

  // 2. Resolve Signatories from Database
  const signatories = await resolvePersistedSf9Signatories(db, {
    sectionId: enrollment.section_id,
    academicYearId: params.academicYearId,
  });
  if (!signatories.adviserName) {
    blockingReasons.push('MISSING_SECTION_ADVISER_SIGNATORY');
  }
  if (!signatories.schoolHeadName) {
    blockingReasons.push('MISSING_SCHOOL_HEAD_SIGNATORY');
  }

  // 3. Resolve Published Term Grade Snapshots based on target release term
  const gradesPayload: Partial<Sf9SubjectScores> = {};
  const subjectEvaluation: Record<string, SubjectEvaluationSummary> = {};

  for (const slot of SUBJECT_SLOT_PATTERNS) {
    const matching = rawGrades.filter(
      (g) =>
        g.subject &&
        (slot.pattern.test(g.subject.name) || slot.pattern.test(g.subject.code || ''))
    );

    const t1Row = matching.find((g) => g.term === 'T1');
    const t2Row = matching.find((g) => g.term === 'T2');
    const t3Row = matching.find((g) => g.term === 'T3');

    const isPubValid = (g: any) => {
      if (!g || typeof g.published_term_grade !== 'number') return false;
      if (g.published_gradebook && g.published_gradebook.status !== 'Published') {
        return false;
      }
      return true;
    };

    const validateTrustedHistoricalProvenance = async (
      g: any
    ): Promise<{ valid: boolean; reason?: string }> => {
      try {
        // 1. Authoritative source document verification
        const doc = await db.document.findFirst({
          where: {
            student_id: enrollment.student_id,
            type: {
              in: [
                'HISTORICAL_REPORT_CARD',
                'OFFICIAL_TRANSCRIPT',
                'AUTHENTICATED_PERMANENT_RECORD_SF10',
              ],
            },
          },
        });

        if (!doc) {
          return { valid: false, reason: 'HOLLOW_GRADEBOOK_NO_ASSESSMENT_COLUMNS' };
        }

        // 2. Storage file integrity: verify file exists on disk
        if (doc.file_path && !fs.existsSync(doc.file_path)) {
          return { valid: false, reason: 'HISTORICAL_SOURCE_DOCUMENT_MISSING_ON_DISK' };
        }

        // 3. Immutable audit verification by authorized role (Registrar or Admin)
        const audit = await db.auditLog.findFirst({
          where: {
            OR: [
              { resource_id: g.id },
              {
                resource_id: enrollment.student_id,
                action: {
                  in: [
                    'HISTORICAL_GRADE_IMPORT',
                    'SF10_PERMANENT_RECORD_IMPORT',
                    'LEGITIMATE_TRANSCRIPT_TRANSCRIPTION',
                  ],
                },
              },
            ],
            result: 'SUCCESS',
          },
        });

        if (!audit) {
          return { valid: false, reason: 'HOLLOW_GRADEBOOK_NO_AUTHENTICATED_AUDIT_LOG' };
        }

        return { valid: true };
      } catch (err) {
        return { valid: false, reason: 'HOLLOW_GRADEBOOK_NO_ASSESSMENT_COLUMNS' };
      }
    };

    const validateAssessmentProvenance = async (
      g: any
    ): Promise<{ valid: boolean; reason?: string }> => {
      // 1. Source gradebook and publication status relationship
      if (!g || typeof g.published_term_grade !== 'number') {
        return { valid: false, reason: 'MISSING_NUMERIC_PUBLISHED_GRADE' };
      }
      if (g.published_gradebook && g.published_gradebook.status !== 'Published') {
        return { valid: false, reason: 'GRADEBOOK_NOT_PUBLISHED' };
      }

      // If no published_gradebook record or no assessment columns exist,
      // validate authentic historical provenance; otherwise reject as hollow gradebook.
      const cols = g.published_gradebook?.columns;
      if (!Array.isArray(cols) || cols.length === 0) {
        return await validateTrustedHistoricalProvenance(g);
      }

      // 2. Validate applicable assessment structure (DepEd Order No. 015, s. 2026)
      const hasWW = cols.some((c: any) => c.type === 'WW');
      const hasPT = cols.some((c: any) => c.type === 'PT');
      const hasExam = cols.some((c: any) => ['EX', 'QA', 'TE', 'ST1', 'ST2'].includes(c.type));

      if (!hasWW || !hasPT || !hasExam) {
        // Must ensure learner has recorded non-null scores in the present columns
        let hasAnyScore = false;
        for (const col of cols) {
          const entry = col.entries?.find(
            (e: any) =>
              e.enrollment_id === params.enrollmentId ||
              e.enrollment?.student_id === params.studentId
          );
          if (entry && entry.score !== null && entry.score !== undefined && !isNaN(Number(entry.score))) {
            hasAnyScore = true;
          }
        }
        if (!hasAnyScore) {
          return { valid: false, reason: 'HOLLOW_GRADEBOOK_NO_ASSESSMENT_COLUMNS' };
        }
        return { valid: true };
      }

      // 3. Validate target learner's required scores across ALL columns
      const scoreMap: Record<string, number> = {};
      for (const col of cols) {
        const entry = col.entries?.find(
          (e: any) =>
            e.enrollment_id === params.enrollmentId ||
            e.enrollment?.student_id === params.studentId
        );
        if (
          !entry ||
          entry.score === null ||
          entry.score === undefined ||
          isNaN(Number(entry.score))
        ) {
          return { valid: false, reason: 'INCOMPLETE_LEARNER_SCORES' };
        }
        scoreMap[col.id] = Number(entry.score);
      }

      // 4. Validate relationship between published grade, source gradebook, and calculated snapshot
      try {
        const wwCols = cols.filter((c: any) => c.type === 'WW');
        const ptCols = cols.filter((c: any) => c.type === 'PT');
        const exCols = cols.filter((c: any) => ['EX', 'QA', 'TE', 'ST1', 'ST2'].includes(c.type));

        const wwScores = wwCols.map((c: any) => ({
          id: c.id,
          label: c.label,
          score: scoreMap[c.id],
          maxScore: c.max_score,
        }));
        const ptScores = ptCols.map((c: any) => ({
          id: c.id,
          label: c.label,
          score: scoreMap[c.id],
          maxScore: c.max_score,
        }));

        const isDynamic = exCols.some((c: any) => c.type === 'EX' || c.type === 'QA');
        let dynamicExams: any = undefined;
        let st1: any = undefined;
        let st2: any = undefined;
        let te: any = undefined;

        if (isDynamic) {
          dynamicExams = exCols.map((c: any) => ({
            id: c.id,
            label: c.label,
            score: scoreMap[c.id],
            maxScore: c.max_score,
            weight: 100 / exCols.length,
          }));
        } else {
          const colSt1 = exCols.find((c: any) => c.type === 'ST1');
          const colSt2 = exCols.find((c: any) => c.type === 'ST2');
          const colTe = exCols.find((c: any) => c.type === 'TE');
          if (colSt1) st1 = { score: scoreMap[colSt1.id], maxScore: colSt1.max_score };
          if (colSt2) st2 = { score: scoreMap[colSt2.id], maxScore: colSt2.max_score };
          if (colTe) te = { score: scoreMap[colTe.id], maxScore: colTe.max_score };
        }

        const calcInput: StudentTermScoreInput = {
          enrollmentId: params.enrollmentId,
          wwScores,
          ptScores,
          dynamicExams,
          st1,
          st2,
          te,
        };

        const subjectGroup = resolveSubjectGroup(g.subject?.code, g.subject?.name);
        const policy = getGradingPolicy({
          schoolYear: enrollment.academic_year.name,
          gradeLevel: enrollment.section.grade_level,
          subjectGroup,
        });

        const calc = calculateStudentTermGrade(calcInput, policy);
        if (!calc.isComplete || calc.termGrade === null) {
          return { valid: false, reason: 'CALCULATION_INCOMPLETE' };
        }

        const expectedTermGrade = Math.round(calc.termGrade);
        if (g.published_term_grade !== expectedTermGrade) {
          return { valid: false, reason: 'SNAPSHOT_CALCULATION_MISMATCH' };
        }
      } catch (err) {
        return { valid: false, reason: 'POLICY_CALCULATION_ERROR' };
      }

      return { valid: true };
    };

    const t1Prov = t1Row ? await validateAssessmentProvenance(t1Row) : { valid: false };
    const t2Prov = t2Row ? await validateAssessmentProvenance(t2Row) : { valid: false };
    const t3Prov = t3Row ? await validateAssessmentProvenance(t3Row) : { valid: false };

    const t1Pub = t1Row && isPubValid(t1Row) && t1Prov.valid ? (t1Row.published_term_grade as number) : null;
    const t2Pub = t2Row && isPubValid(t2Row) && t2Prov.valid ? (t2Row.published_term_grade as number) : null;
    const t3Pub = t3Row && isPubValid(t3Row) && t3Prov.valid ? (t3Row.published_term_grade as number) : null;

    const t1Val = typeof t1Pub === 'number' ? t1Pub : (typeof t1Row?.term_grade === 'number' ? Math.round(t1Row.term_grade) : (typeof t1Row?.published_term_grade === 'number' ? t1Row.published_term_grade : null));
    const t2Val = typeof t2Pub === 'number' ? t2Pub : (typeof t2Row?.term_grade === 'number' ? Math.round(t2Row.term_grade) : (typeof t2Row?.published_term_grade === 'number' ? t2Row.published_term_grade : null));
    const t3Val = typeof t3Pub === 'number' ? t3Pub : (typeof t3Row?.term_grade === 'number' ? Math.round(t3Row.term_grade) : (typeof t3Row?.published_term_grade === 'number' ? t3Row.published_term_grade : null));

    const isComplete =
      targetTerm === 'T1'
        ? typeof t1Pub === 'number'
        : targetTerm === 'T2'
        ? typeof t1Pub === 'number' && typeof t2Pub === 'number'
        : typeof t1Pub === 'number' && typeof t2Pub === 'number' && typeof t3Pub === 'number';

    const hasAny = t1Val !== null || t2Val !== null || t3Val !== null;

    subjectEvaluation[slot.key] = {
      key: slot.key,
      label: slot.label,
      t1: { grade: t1Val, published: typeof t1Pub === 'number' },
      t2: { grade: t2Val, published: typeof t2Pub === 'number' },
      t3: { grade: t3Val, published: typeof t3Pub === 'number' },
      isComplete,
      status: isComplete ? 'COMPLETE' : hasAny ? 'PARTIAL' : 'MISSING',
    };

    if (isComplete) {
      gradesPayload[slot.key] = [
        t1Pub,
        targetTerm !== 'T1' ? t2Pub : null,
        targetTerm === 'T3' ? t3Pub : null,
      ] as any;
    } else {
      const t1MissingProv = t1Row && isPubValid(t1Row) && !t1Prov.valid;
      const t2MissingProv = (targetTerm === 'T2' || targetTerm === 'T3') && t2Row && isPubValid(t2Row) && !t2Prov.valid;
      const t3MissingProv = targetTerm === 'T3' && t3Row && isPubValid(t3Row) && !t3Prov.valid;

      if (t1MissingProv || t2MissingProv || t3MissingProv) {
        const failedProv = t1MissingProv ? t1Prov : t2MissingProv ? t2Prov : t3Prov;
        const blockerReason = failedProv.reason || 'MISSING_ACADEMIC_ASSESSMENT_PROVENANCE';
        blockingReasons.push(`${blockerReason}:${slot.key}`);
      } else {
        blockingReasons.push(`UNPUBLISHED_OR_MISSING_SUBJECT_GRADES:${slot.key}`);
      }

      if (isDraftMode) {
        gradesPayload[slot.key] = [t1Val ?? 0, t2Val ?? 0, t3Val ?? 0];
      }
    }
  }

  // 4. Compute Verified Monthly Attendance from Database (scoped to targetTerm)
  const { sf9Mapping: attendanceMapping } = await computePersistedStudentMonthlyAttendance(db, {
    studentId: student.id,
    academicYearId: params.academicYearId,
    targetTerm,
    excusedPolicy: params.excusedPolicy ?? 'UNRESOLVED',
    currentManilaDate: params.currentManilaDate ?? getCurrentManilaDateString(),
  });

  if (!attendanceMapping.readyForOfficialSf9) {
    blockingReasons.push(...attendanceMapping.blockingReasons);
  }

  // 5. Resolve Published Adviser Term Comments based on target release term
  const enrollmentRef: EnrollmentRef = {
    id: enrollment.id,
    studentId: enrollment.student_id,
    sectionId: enrollment.section_id,
    academicYearId: enrollment.academic_year_id,
    status: enrollment.status as EnrollmentRef['status'],
  };

  const resolvedComments = resolveSf9AdviserCommentsForCells({
    enrollment: enrollmentRef,
    mode: isDraftMode ? 'DRAFT_PREVIEW' : 'OFFICIAL',
    comments: rawComments.map((c) => ({
      enrollmentId: c.enrollment_id,
      studentId: c.student_id,
      sectionId: c.section_id,
      academicYearId: c.academic_year_id,
      term: c.term === 'T1' ? 1 : c.term === 'T2' ? 2 : 3,
      commentText: c.comment,
      status: c.status,
    })),
  });

  if (resolvedComments.integrityErrors.length > 0) {
    blockingReasons.push(...resolvedComments.integrityErrors);
  }
  if (!resolvedComments.sf9Comments.t1) {
    blockingReasons.push('MISSING_PUBLISHED_ADVISER_COMMENT:T1');
  }
  if ((targetTerm === 'T2' || targetTerm === 'T3') && !resolvedComments.sf9Comments.t2) {
    blockingReasons.push('MISSING_PUBLISHED_ADVISER_COMMENT:T2');
  }
  if (targetTerm === 'T3' && !resolvedComments.sf9Comments.t3) {
    blockingReasons.push('MISSING_PUBLISHED_ADVISER_COMMENT:T3');
  }

  const totalRequiredMonths = targetTerm === 'T1' ? 4 : targetTerm === 'T2' ? 8 : 11;

  const prerequisiteEvaluation: PrerequisiteEvaluation = {
    targetTerm,
    demographics: {
      validLrn: !!validLrn,
      validBirthdate: !!(birthdateSerial && age),
      validGender: !!gender,
      age,
    },
    signatories: {
      adviserName: signatories.adviserName,
      schoolHeadName: signatories.schoolHeadName,
      schoolHeadTitle: signatories.schoolHeadTitle,
      hasAdviser: !!signatories.adviserName,
      hasSchoolHead: !!signatories.schoolHeadName,
    },
    attendance: {
      readyForOfficialSf9: attendanceMapping.readyForOfficialSf9,
      finalizedMonthsCount: (attendanceMapping as any).attendance?.classDays
        ? (attendanceMapping as any).attendance.classDays.filter((d: number | null) => typeof d === 'number' && d > 0).length
        : 0,
      totalRequiredMonths,
      blockingReasons: attendanceMapping.readyForOfficialSf9 ? [] : attendanceMapping.blockingReasons,
    },
    comments: {
      t1: !!resolvedComments.sf9Comments.t1,
      t2: !!resolvedComments.sf9Comments.t2,
      t3: !!resolvedComments.sf9Comments.t3,
    },
    subjects: subjectEvaluation,
  };

  if (!isDraftMode && (blockingReasons.length > 0 || !attendanceMapping.readyForOfficialSf9)) {
    return {
      readyForOfficialSf9: false,
      blockingReasons,
      attendanceMapping,
      resolvedSignatories: {
        adviserName: signatories.adviserName,
        schoolHeadName: signatories.schoolHeadName,
        schoolHeadTitle: signatories.schoolHeadTitle,
      },
      subjectEvaluation,
      prerequisiteEvaluation,
    };
  }

  const identity = getStudentIdentity(student);
  const formattedName = `${identity.lastName}, ${identity.firstName}${
    identity.middleName ? ' ' + identity.middleName : ''
  }`.toUpperCase();

  const sf9Payload: GenerateSf9Input = {
    demographics: {
      name: formattedName,
      lrn: validLrn!,
      birthdateSerial: birthdateSerial!,
      age: age!,
      gender: gender!,
      gradeLevel: enrollment.section.grade_level,
      section: enrollment.section.name,
      schoolYear: enrollment.academic_year.name,
      schoolName: signatories.schoolName,
      schoolId: signatories.schoolId ?? '500146',
      schoolHead: signatories.schoolHeadName!,
      adviser: signatories.adviserName!,
    },
    grades: gradesPayload,
    attendance: (attendanceMapping as any).attendance ?? {
      present: Array(11).fill(null),
      absent: Array(11).fill(null),
      classDays: Array(11).fill(null),
    },
    comments: resolvedComments.sf9Comments,
    targetTerm,
    mode: params.mode ?? 'OFFICIAL',
  };

  if (params.profiler?.stop) params.profiler.stop('data_mapping');
  if (params.profiler?.start) params.profiler.start('xlsx_population');
  const genResult = generateCalulutSf9(sf9Payload);
  if (params.profiler?.stop) params.profiler.stop('xlsx_population');

  if (!genResult.success) {
    const combinedBlockingReasons = Array.from(
      new Set([...blockingReasons, genResult.reason, ...genResult.missing])
    );
    return {
      readyForOfficialSf9: false,
      blockingReasons: combinedBlockingReasons,
      attendanceMapping,
      resolvedSignatories: {
        adviserName: signatories.adviserName,
        schoolHeadName: signatories.schoolHeadName,
        schoolHeadTitle: signatories.schoolHeadTitle,
      },
      subjectEvaluation,
      prerequisiteEvaluation,
    };
  }

  let pdfBuffer: Buffer | undefined;
  if (params.renderPdf) {
    pdfBuffer = await renderCalulutSf9BufferToPdf(genResult.buffer, {
      cachePolicy: 'no-store',
      profiler: params.profiler,
    });
  }

  return {
    readyForOfficialSf9: true,
    blockingReasons: [],
    payload: sf9Payload,
    xlsxBuffer: genResult.buffer,
    pdfBuffer,
    calculated: genResult.calculated,
    attendanceMapping,
    resolvedSignatories: {
      adviserName: signatories.adviserName,
      schoolHeadName: signatories.schoolHeadName,
      schoolHeadTitle: signatories.schoolHeadTitle,
    },
    subjectEvaluation,
    prerequisiteEvaluation,
  };
}


// ─── Default Singleton Service Export (Bound to src/config/database.js) ──────

export const calulutSf2Sf9PersistenceService = {
  upsertSchoolCalendarMonth: (input: any, db: DatabaseClient = defaultPrisma as any) => upsertSchoolCalendarMonth(db, input),
  upsertSchoolCalendarDay: (input: any, db: DatabaseClient = defaultPrisma as any) => upsertSchoolCalendarDay(db, input),
  upsertSectionCalendarException: (input: any, db: DatabaseClient = defaultPrisma as any) => upsertSectionCalendarException(db, input),
  finalizeSchoolCalendarMonth: (input: any, db: DatabaseClient = defaultPrisma as any) => finalizeSchoolCalendarMonth(db, input),
  reopenSchoolCalendarMonth: (input: any, db: DatabaseClient = defaultPrisma as any) => reopenSchoolCalendarMonth(db, input),
  assignSectionClassAdviser: (input: any, db: DatabaseClient = defaultPrisma as any) => assignSectionClassAdviser(db, input),
  resolvePersistedSf9Signatories: (input: any, db: DatabaseClient = defaultPrisma as any) => resolvePersistedSf9Signatories(db, input),
  recordOfficialDailyAttendance: (input: any, db: DatabaseClient = defaultPrisma as any) => recordOfficialDailyAttendance(db, input),
  verifyOfficialDailyAttendance: (input: any, db: DatabaseClient = defaultPrisma as any) => verifyOfficialDailyAttendance(db, input),
  computePersistedStudentMonthlyAttendance: (input: any, db: DatabaseClient = defaultPrisma as any) => computePersistedStudentMonthlyAttendance(db, input),
  saveSf9AdviserComment: (input: any, db: DatabaseClient = defaultPrisma as any) => saveSf9AdviserComment(db, input),
  saveDraftGradeLedgerEntry: (input: any, db: DatabaseClient = defaultPrisma as any) => saveDraftGradeLedgerEntry(db, input),
  publishSubjectTermGradeSnapshot: (input: any, db: DatabaseClient = defaultPrisma as any) => publishSubjectTermGradeSnapshot(db, input),
  generatePersistedStudentCalulutSf9FromDb: (params: any, db: DatabaseClient = defaultPrisma as any) => generatePersistedStudentCalulutSf9FromDb(db, params),
};
