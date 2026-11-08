import { z } from 'zod';
import prisma, { withTransaction } from '../config/database.js';
import { generateId } from '../common/utils/uuid.js';
import { AppError } from '../common/middleware/errorHandler.js';
import { createAuditLog } from '../audit/audit.service.js';
import { TermKey } from '@prisma/client';
import {
  validateStrictIsoDateTime,
  validateAcademicYearRange,
} from '../common/utils/calendarValidation.js';

export const createAcademicYearSchema = z.object({
  name: z.string().min(1, 'Name is required').max(50),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  isCurrent: z.boolean().default(false),
  termKeys: z.array(z.enum(['T1', 'T2', 'T3', 'T4'])).min(1).max(4).optional(),
}).superRefine((data, ctx) => {
  const startRes = validateStrictIsoDateTime(data.startDate);
  if (!startRes.valid) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: startRes.error || 'Invalid start date',
      path: ['startDate'],
    });
  }
  const endRes = validateStrictIsoDateTime(data.endDate);
  if (!endRes.valid) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: endRes.error || 'Invalid end date',
      path: ['endDate'],
    });
  }
  if (startRes.valid && endRes.valid) {
    const rangeRes = validateAcademicYearRange(data.startDate, data.endDate);
    if (!rangeRes.valid) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: rangeRes.error || 'Academic year start date must precede end date',
        path: ['endDate'],
      });
    }
  }
});

export const addAcademicTermSchema = z.object({
  key: z.enum(['T1', 'T2', 'T3', 'T4']),
  name: z.string().min(1).max(50).optional(),
  startDate: z.string().datetime().optional().nullable(),
  endDate: z.string().datetime().optional().nullable(),
  confirm: z.boolean().default(true),
  confirmPublishedOverride: z.boolean().optional(),
  confirmedAcademicYearId: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.startDate) {
    const startRes = validateStrictIsoDateTime(data.startDate);
    if (!startRes.valid) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: startRes.error || 'Invalid start date',
        path: ['startDate'],
      });
    }
  }
  if (data.endDate) {
    const endRes = validateStrictIsoDateTime(data.endDate);
    if (!endRes.valid) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: endRes.error || 'Invalid end date',
        path: ['endDate'],
      });
    }
  }
  if (data.startDate && data.endDate) {
    const rangeRes = validateAcademicYearRange(data.startDate, data.endDate);
    if (!rangeRes.valid) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: rangeRes.error || 'Term start date must precede end date',
        path: ['endDate'],
      });
    }
  }
});

export const createSubjectSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(100),
});

export const createSectionSchema = z.object({
  academicYearId: z.string().min(1),
  name: z.string().min(1).max(50),
  gradeLevel: z.number().int().min(1).max(12),
});

const timeFormat = /^([01]\d|2[0-3]):([0-5]\d)$/;

const scheduleValidation = (val: any) => {
  if (val.startTime && !timeFormat.test(val.startTime)) return false;
  if (val.endTime && !timeFormat.test(val.endTime)) return false;
  if (val.startTime && val.endTime) {
    return val.startTime < val.endTime;
  }
  return true;
};

export const createTeacherAssignmentSchema = z.object({
  academicYearId: z.string().min(1),
  teacherId: z.string().min(1),
  sectionId: z.string().min(1),
  subjectId: z.string().min(1),
  days: z.string().max(50).optional(),
  startTime: z.string().regex(timeFormat, 'Invalid time format (HH:MM)').optional().or(z.literal('')),
  endTime: z.string().regex(timeFormat, 'Invalid time format (HH:MM)').optional().or(z.literal('')),
  room: z.string().max(50).optional(),
}).refine(scheduleValidation, {
  message: 'Start time must be before end time, and both must be valid HH:MM',
  path: ['endTime']
});

export const updateTeacherAssignmentSchema = z.object({
  teacherId: z.string().min(1).optional(),
  days: z.string().max(50).optional(),
  startTime: z.string().regex(timeFormat, 'Invalid time format (HH:MM)').optional().or(z.literal('')),
  endTime: z.string().regex(timeFormat, 'Invalid time format (HH:MM)').optional().or(z.literal('')),
  room: z.string().max(50).optional(),
}).refine(scheduleValidation, {
  message: 'Start time must be before end time, and both must be valid HH:MM',
  path: ['endTime']
});

export async function createAcademicYear(
  input: z.infer<typeof createAcademicYearSchema>,
  actorId: string,
  correlationId?: string
) {
  const rangeValidation = validateAcademicYearRange(input.startDate, input.endDate);
  if (!rangeValidation.valid) {
    throw new AppError(422, 'INVALID_DATE_RANGE', rangeValidation.error || 'Academic year start date must precede end date.');
  }

  const existing = await prisma.academicYear.findUnique({ where: { name: input.name } });
  if (existing) {
    throw new AppError(400, 'DUPLICATE', 'Academic year with this name already exists.');
  }

  return prisma.$transaction(async (tx) => {
    // If this is set to current, we might want to unset others, but for simplicity
    // we'll just insert it.
    if (input.isCurrent) {
      await tx.academicYear.updateMany({
        where: { is_current: true },
        data: { is_current: false },
      });
    }

    const yearId = generateId();
    const year = await tx.academicYear.create({
      data: {
        id: yearId,
        name: input.name,
        start_date: new Date(input.startDate),
        end_date: new Date(input.endDate),
        is_current: input.isCurrent,
      },
    });

    // Create configured terms (defaults to verified 3-term standard [T1, T2, T3] if not specified)
    const terms: TermKey[] = (input.termKeys && input.termKeys.length > 0)
      ? input.termKeys
      : ['T1', 'T2', 'T3'];

    if (terms.length < 3 || terms.length > 4) {
      throw new AppError(
        400,
        'UNSUPPORTED_TERM_CONFIGURATION',
        'Academic years must be configured with either 3 terms (["T1", "T2", "T3"]) or 4 terms (["T1", "T2", "T3", "T4"]) under DepEd grading policies.'
      );
    }
    for (const termKey of terms) {
      await tx.term.create({
        data: {
          id: generateId(),
          academic_year_id: yearId,
          name: `Term ${termKey.replace('T', '')}`,
          key: termKey,
        },
      });
    }

    await createAuditLog({
      actorUserId: actorId,
      action: 'ACADEMIC_YEAR_CREATED',
      resourceType: 'academic_year',
      resourceId: yearId,
      newState: input,
      correlationId,
    }, tx);

    return year;
  });
}

export async function createSubject(
  input: z.infer<typeof createSubjectSchema>,
  actorId: string,
  correlationId?: string
) {
  const existing = await prisma.subject.findUnique({ where: { code: input.code } });
  if (existing) {
    throw new AppError(400, 'DUPLICATE', 'Subject with this code already exists.');
  }

  const subjectId = generateId();
  const subject = await prisma.subject.create({
    data: {
      id: subjectId,
      code: input.code,
      name: input.name,
    },
  });

  await createAuditLog({
    actorUserId: actorId,
    action: 'SUBJECT_CREATED',
    resourceType: 'subject',
    resourceId: subjectId,
    newState: input,
    correlationId,
  });

  return subject;
}

export async function createSection(
  input: z.infer<typeof createSectionSchema>,
  actorId: string,
  correlationId?: string
) {
  const year = await prisma.academicYear.findUnique({ where: { id: input.academicYearId } });
  if (!year) {
    throw new AppError(404, 'NOT_FOUND', 'Academic year not found.');
  }

  const existing = await prisma.section.findUnique({
    where: {
      academic_year_id_name_grade_level: {
        academic_year_id: input.academicYearId,
        name: input.name,
        grade_level: input.gradeLevel,
      }
    }
  });

  if (existing) {
    throw new AppError(400, 'DUPLICATE', 'Section already exists in this academic year.');
  }

  const sectionId = generateId();
  const section = await prisma.section.create({
    data: {
      id: sectionId,
      academic_year_id: input.academicYearId,
      name: input.name,
      grade_level: input.gradeLevel,
    },
  });

  await createAuditLog({
    actorUserId: actorId,
    action: 'SECTION_CREATED',
    resourceType: 'section',
    resourceId: sectionId,
    newState: input,
    correlationId,
  });

  return section;
}

/**
 * Resolves the designated curriculum grade level (e.g. 7, 8, 9, 10) for a subject.
 * Returns null if the subject is not grade-specific or cannot be deterministically classified.
 */
export function resolveSubjectGradeLevel(subject: { code?: string | null; name?: string | null }): number | null {
  const code = (subject.code || '').trim().toUpperCase();
  const name = (subject.name || '').trim();

  // 1. Primary check: Verified DepEd catalog application codes (e.g. FIL7, MATH10, PEH8)
  const codeMatch = code.match(/^(?:FIL|ENG|MATH|SCI|AP|VE|MA|PEH|TLE)(1[0-2]|[1-9])$/);
  if (codeMatch) {
    return parseInt(codeMatch[1], 10);
  }

  // 2. Secondary check: Code ending in numeric grade level (e.g. G7, -7, _7, 7)
  const codeSuffixMatch = code.match(/(?:^|[_\-\s]|G)(1[0-2]|[1-9])$/);
  if (codeSuffixMatch) {
    return parseInt(codeSuffixMatch[1], 10);
  }

  // 3. Fallback check: Subject name ending in numeric grade level (e.g. "Mathematics 10", "Science 8")
  const nameMatch = name.match(/(?:^|\s|Grade\s*)(1[0-2]|[1-9])$/i);
  if (nameMatch) {
    return parseInt(nameMatch[1], 10);
  }

  return null;
}

/**
 * Parses schedule day strings (e.g., 'M,W,F', 'Mon, Wed, Fri', 'T,TH', 'MTWThF') into normalized day tokens.
 */
export function parseScheduleDays(daysStr?: string | null): string[] {
  if (!daysStr) return [];
  const clean = daysStr.trim().toUpperCase();
  if (!clean) return [];
  const parts = clean.split(/[,/\s]+/).filter(Boolean);
  const days: string[] = [];
  for (const part of parts) {
    if (['M', 'MON', 'MONDAY'].includes(part)) days.push('M');
    else if (['T', 'TUE', 'TUES', 'TUESDAY'].includes(part)) days.push('T');
    else if (['W', 'WED', 'WEDNESDAY'].includes(part)) days.push('W');
    else if (['TH', 'THU', 'THURS', 'THURSDAY'].includes(part)) days.push('TH');
    else if (['F', 'FRI', 'FRIDAY'].includes(part)) days.push('F');
    else if (['S', 'SAT', 'SATURDAY'].includes(part)) days.push('SAT');
    else if (['SU', 'SUN', 'SUNDAY'].includes(part)) days.push('SUN');
    else {
      const match = part.match(/(TH|SU|SA|M|T|W|F|S)/g);
      if (match) {
        match.forEach(m => {
          if (m === 'TH') days.push('TH');
          else if (m === 'SU' || m === 'SA' || m === 'S') days.push(m === 'SU' ? 'SUN' : 'SAT');
          else days.push(m);
        });
      } else {
        days.push(part);
      }
    }
  }
  return Array.from(new Set(days));
}

/**
 * Checks whether two day strings have any overlapping days.
 */
export function daysOverlap(days1?: string | null, days2?: string | null): boolean {
  if (!days1 || !days2) return false;
  const d1 = parseScheduleDays(days1);
  const d2 = parseScheduleDays(days2);
  return d1.some(d => d2.includes(d));
}

/**
 * Checks whether two time intervals overlap (open boundary: startA < endB && startB < endA).
 */
export function timeIntervalsOverlap(start1: string, end1: string, start2: string, end2: string): boolean {
  return start1 < end2 && start2 < end1;
}

/**
 * Verifies that the schedule for an assignment does not conflict with existing assignments
 * for the same teacher or the same section within the same academic year.
 */
export async function validateScheduleConflict(params: {
  academicYearId: string;
  teacherId: string;
  sectionId: string;
  days?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  excludeAssignmentId?: string;
}, tx: any = prisma) {
  const { academicYearId, teacherId, sectionId, days, startTime, endTime, excludeAssignmentId } = params;

  if (!days || !startTime || !endTime) {
    return;
  }

  const existingAssignments = await tx.teacherSubjectAssignment.findMany({
    where: {
      academic_year_id: academicYearId,
      id: excludeAssignmentId ? { not: excludeAssignmentId } : undefined,
      days: { not: null },
      start_time: { not: null },
      end_time: { not: null },
      OR: [
        { teacher_id: teacherId },
        { section_id: sectionId },
      ],
    },
    include: {
      subject: true,
      section: true,
      teacher: { include: { user: true } },
    },
  });

  for (const existing of existingAssignments) {
    if (!existing.days || !existing.start_time || !existing.end_time) continue;

    if (daysOverlap(days, existing.days) && timeIntervalsOverlap(startTime, endTime, existing.start_time, existing.end_time)) {
      if (existing.teacher_id === teacherId) {
        const teacherName = existing.teacher?.user ? `${existing.teacher.user.first_name} ${existing.teacher.user.last_name}`.trim() : 'Teacher';
        throw new AppError(
          409,
          'SCHEDULE_CONFLICT',
          `Schedule conflict: ${teacherName} is already assigned to ${existing.subject.name} in Section ${existing.section.name} on ${existing.days} at ${existing.start_time}-${existing.end_time}.`
        );
      }

      if (existing.section_id === sectionId) {
        throw new AppError(
          409,
          'SCHEDULE_CONFLICT',
          `Schedule conflict: Section ${existing.section.name} already has ${existing.subject.name} scheduled on ${existing.days} at ${existing.start_time}-${existing.end_time}.`
        );
      }
    }
  }
}

export async function createTeacherAssignment(
  input: z.infer<typeof createTeacherAssignmentSchema>,
  actorId: string,
  correlationId?: string
) {
  try {
    return await withTransaction(async (tx) => {
      // Acquire PostgreSQL transaction-level advisory lock on (academicYearId, sectionId, subjectId)
      // to serialize concurrent requests and eliminate race conditions.
      const lockKey = `assign:${input.academicYearId}:${input.sectionId}:${input.subjectId}`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;

      const [year, teacher, section, subject] = await Promise.all([
        tx.academicYear.findUnique({ where: { id: input.academicYearId } }),
        tx.teacher.findUnique({ where: { id: input.teacherId }, include: { user: true } }),
        tx.section.findUnique({ where: { id: input.sectionId } }),
        tx.subject.findUnique({ where: { id: input.subjectId } }),
      ]);

      if (!year) throw new AppError(404, 'NOT_FOUND', 'Academic year not found.');
      if (!teacher) throw new AppError(404, 'NOT_FOUND', 'Teacher not found.');
      if (!section) throw new AppError(404, 'NOT_FOUND', 'Section not found.');
      if (!subject) throw new AppError(404, 'NOT_FOUND', 'Subject not found.');

      if (section.academic_year_id !== year.id) {
        throw new AppError(400, 'INVALID_RELATION', 'Section does not belong to the specified academic year.');
      }

      // Grade-level compatibility validation (Phase 4C)
      const subjectGradeLevel = resolveSubjectGradeLevel(subject);
      if (subjectGradeLevel !== null && subjectGradeLevel !== section.grade_level) {
        throw new AppError(
          400,
          'GRADE_LEVEL_MISMATCH',
          `${subject.name} cannot be assigned to a Grade ${section.grade_level} section. Please select a Grade ${section.grade_level} subject.`
        );
      }

      // Exclusivity check: Check whether any primary teacher already owns this academic year, section, and subject
      const existing = await tx.teacherSubjectAssignment.findFirst({
        where: {
          academic_year_id: input.academicYearId,
          section_id: input.sectionId,
          subject_id: input.subjectId,
        },
        include: {
          teacher: {
            include: {
              user: true,
            },
          },
        },
      });

      if (existing) {
        if (existing.teacher_id === input.teacherId) {
          throw new AppError(
            400,
            'DUPLICATE',
            `This teacher is already assigned to ${subject.name} in Grade ${section.grade_level} — ${section.name}.`
          );
        }

        const assignedTeacherUser = existing.teacher?.user;
        const assignedTeacherName = assignedTeacherUser
          ? `${assignedTeacherUser.first_name} ${assignedTeacherUser.last_name}`.trim()
          : 'another teacher';

        throw new AppError(
          409,
          'PRIMARY_TEACHER_ALREADY_ASSIGNED',
          `${subject.name} in Grade ${section.grade_level} — ${section.name} is already assigned to ${assignedTeacherName}.`
        );
      }

      // Schedule conflict validation
      if (input.days && input.startTime && input.endTime) {
        await validateScheduleConflict({
          academicYearId: input.academicYearId,
          teacherId: input.teacherId,
          sectionId: input.sectionId,
          days: input.days,
          startTime: input.startTime,
          endTime: input.endTime,
        }, tx);
      }

      const assignmentId = generateId();
      const assignment = await tx.teacherSubjectAssignment.create({
        data: {
          id: assignmentId,
          academic_year_id: input.academicYearId,
          teacher_id: input.teacherId,
          section_id: input.sectionId,
          subject_id: input.subjectId,
          days: input.days,
          start_time: input.startTime,
          end_time: input.endTime,
          room: input.room,
        },
        include: {
          subject: true,
          section: true,
          academic_year: true,
          teacher: { include: { user: true } },
        },
      });

      await createAuditLog({
        actorUserId: actorId,
        action: 'TEACHER_ASSIGNMENT_CREATED',
        resourceType: 'teacher_subject_assignment',
        resourceId: assignmentId,
        newState: input,
        correlationId,
      }, tx);

      return assignment;
    }, { isolationLevel: 'ReadCommitted' });
  } catch (err: any) {
    // If a transaction conflict or concurrency race occurred during assignment creation,
    // verify whether a primary teacher was successfully assigned by the concurrent request.
    if (err?.code === 'P2034' || err?.code === 'P2002') {
      const existing = await prisma.teacherSubjectAssignment.findFirst({
        where: {
          academic_year_id: input.academicYearId,
          section_id: input.sectionId,
          subject_id: input.subjectId,
        },
        include: {
          teacher: { include: { user: true } },
          subject: true,
          section: true,
        },
      });

      if (existing) {
        if (existing.teacher_id === input.teacherId) {
          throw new AppError(
            400,
            'DUPLICATE',
            `This teacher is already assigned to ${existing.subject?.name || 'this subject'} in Grade ${existing.section?.grade_level || ''} — ${existing.section?.name || ''}.`
          );
        }

        const assignedTeacherUser = existing.teacher?.user;
        const assignedTeacherName = assignedTeacherUser
          ? `${assignedTeacherUser.first_name} ${assignedTeacherUser.last_name}`.trim()
          : 'another teacher';

        throw new AppError(
          409,
          'PRIMARY_TEACHER_ALREADY_ASSIGNED',
          `${existing.subject?.name || 'This subject'} in Grade ${existing.section?.grade_level || ''} — ${existing.section?.name || ''} is already assigned to ${assignedTeacherName}.`
        );
      }
    }
    throw err;
  }
}

export async function updateTeacherAssignment(
  id: string,
  input: z.infer<typeof updateTeacherAssignmentSchema>,
  actorId: string,
  correlationId?: string
) {
  return withTransaction(async (tx) => {
    const existing = await tx.teacherSubjectAssignment.findUnique({
      where: { id },
      include: {
        teacher: { include: { user: true } },
        section: true,
        subject: true,
      },
    });

    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', 'Teacher assignment not found.');
    }

    const targetTeacherId = input.teacherId || existing.teacher_id;
    let targetTeacher = existing.teacher;

    if (input.teacherId && input.teacherId !== existing.teacher_id) {
      const newTeacher = await tx.teacher.findUnique({
        where: { id: input.teacherId },
        include: { user: true },
      });
      if (!newTeacher) {
        throw new AppError(404, 'NOT_FOUND', 'Target teacher for reassignment not found.');
      }
      targetTeacher = newTeacher;
    }

    // Basic data integrity for start < end if both are present
    if (input.startTime && input.endTime) {
      if (input.startTime >= input.endTime) {
        throw new AppError(400, 'INVALID_INPUT', 'Start time must be before end time.');
      }
    }

    const effectiveDays = input.days !== undefined ? input.days : existing.days;
    const effectiveStart = input.startTime !== undefined ? input.startTime : existing.start_time;
    const effectiveEnd = input.endTime !== undefined ? input.endTime : existing.end_time;

    if (effectiveDays && effectiveStart && effectiveEnd) {
      await validateScheduleConflict({
        academicYearId: existing.academic_year_id,
        teacherId: targetTeacherId,
        sectionId: existing.section_id,
        days: effectiveDays,
        startTime: effectiveStart,
        endTime: effectiveEnd,
        excludeAssignmentId: id,
      }, tx);
    }

    const assignment = await tx.teacherSubjectAssignment.update({
      where: { id },
      data: {
        teacher_id: targetTeacherId,
        days: input.days !== undefined ? input.days : existing.days,
        start_time: input.startTime !== undefined ? input.startTime : existing.start_time,
        end_time: input.endTime !== undefined ? input.endTime : existing.end_time,
        room: input.room !== undefined ? input.room : existing.room,
      },
      include: {
        subject: true,
        section: true,
        academic_year: true,
        teacher: { include: { user: true } },
      },
    });

    await createAuditLog({
      actorUserId: actorId,
      action: 'TEACHER_ASSIGNMENT_UPDATED',
      resourceType: 'teacher_subject_assignment',
      resourceId: id,
      previousState: {
        teacherId: existing.teacher_id,
        days: existing.days,
        startTime: existing.start_time,
        endTime: existing.end_time,
        room: existing.room,
      },
      newState: {
        teacherId: assignment.teacher_id,
        days: assignment.days,
        startTime: assignment.start_time,
        endTime: assignment.end_time,
        room: assignment.room,
      },
      correlationId,
    }, tx);

    return assignment;
  }, { isolationLevel: 'ReadCommitted' });
}

// ─── Academic Term Administration (Admin / ITAdmin Only) ──────

export async function addAcademicTerm(
  academicYearId: string,
  input: z.infer<typeof addAcademicTermSchema>,
  actorId: string,
  correlationId?: string
) {
  // 1. Authorize: strictly Admin and ITAdmin from database-derived roles
  const actorUser = await prisma.user.findUnique({
    where: { id: actorId },
    include: { user_roles: { include: { role: true } } },
  });
  const hasAdminRole = actorUser?.user_roles.some(
    (ur) => ur.role.name === 'Admin' || ur.role.name === 'ITAdmin'
  );
  if (!hasAdminRole) {
    throw new AppError(403, 'FORBIDDEN', 'Only Admin and ITAdmin are authorized to add academic terms.');
  }

  // 2. Transactional execution with full isolation
  return prisma.$transaction(async (tx) => {
    // Validate Academic Year inside transaction
    const year = await tx.academicYear.findUnique({
      where: { id: academicYearId },
      include: { terms: { orderBy: { key: 'asc' } } },
    });
    if (!year) {
      throw new AppError(404, 'NOT_FOUND', 'Academic year not found.');
    }

    // Check max terms capacity under DepEd policies
    if (year.terms.length >= 4) {
      throw new AppError(400, 'MAX_TERMS_REACHED', 'The academic year already has the maximum of 4 terms.');
    }

    // Prevent duplicate terms
    const existingTerm = year.terms.find((t) => t.key === input.key);
    if (existingTerm) {
      throw new AppError(409, 'DUPLICATE_TERM', `Term ${input.key} already exists for this academic year.`);
    }

    // Enforce chronological sequence (T1 -> T2 -> T3 -> T4)
    const sequenceMap: Record<number, TermKey> = {
      0: 'T1',
      1: 'T2',
      2: 'T3',
      3: 'T4',
    };
    const expectedKey = sequenceMap[year.terms.length];
    if (input.key !== expectedKey) {
      throw new AppError(
        400,
        'INVALID_TERM_SEQUENCE',
        `Terms must be added in chronological sequence. Expected next term is ${expectedKey}, but received ${input.key}.`
      );
    }

    // Safeguard: Block changes if certified SF9 report cards are already released
    const officialIssuances = await tx.sf9OfficialIssuance.count({
      where: { academic_year_id: academicYearId },
    });
    if (officialIssuances > 0) {
      throw new AppError(
        409,
        'TERM_CHANGE_BLOCKED_OFFICIAL_RELEASE',
        'Cannot modify academic terms for a school year with certified, officially released SF9 report cards.'
      );
    }

    // Safeguard (Task 1): Detect published gradebooks and academic results
    const publishedGbCount = await tx.gradebooks.count({
      where: {
        term: { academic_year_id: academicYearId },
        status: { in: ['Published', 'PUBLISHED'] },
      },
    });
    const publishedGradesCount = await tx.grade.count({
      where: {
        academic_year_id: academicYearId,
        published_term_grade: { not: null },
      },
    });

    const hasPublishedResults = publishedGbCount > 0 || publishedGradesCount > 0;
    if (hasPublishedResults) {
      const isDeliberatelyConfirmed =
        input.confirmPublishedOverride === true &&
        input.confirmedAcademicYearId === academicYearId;

      if (!isDeliberatelyConfirmed) {
        throw new AppError(
          409,
          'PUBLISHED_RESULTS_EXIST',
          `Published academic results exist for ${year.name} (${publishedGbCount} published gradebook(s), ${publishedGradesCount} published grade(s)). Adding term ${input.key} will expand required terms to 4 and revert finalized subject ratings and General Average to PENDING until ${input.key} results are submitted and published. To authorize this policy change, deliberate confirmation is required (confirmPublishedOverride: true with confirmedAcademicYearId: "${academicYearId}").`
        );
      }
    }

    if (input.startDate && input.endDate) {
      const rangeValidation = validateAcademicYearRange(input.startDate, input.endDate);
      if (!rangeValidation.valid) {
        throw new AppError(422, 'INVALID_DATE_RANGE', rangeValidation.error || 'Term start date must precede end date.');
      }
    }

    const termId = generateId();
    const defaultName =
      input.key === 'T1' ? 'First Term' :
      input.key === 'T2' ? 'Second Term' :
      input.key === 'T3' ? 'Third Term' : 'Fourth Term';

    const term = await tx.term.create({
      data: {
        id: termId,
        academic_year_id: academicYearId,
        name: input.name || defaultName,
        key: input.key,
        start_date: input.startDate ? new Date(input.startDate) : null,
        end_date: input.endDate ? new Date(input.endDate) : null,
      },
    });

    await createAuditLog({
      actorUserId: actorId,
      action: 'ACADEMIC_TERM_ADDED',
      resourceType: 'academic_term',
      resourceId: termId,
      newState: {
        academic_year_id: academicYearId,
        academic_year_name: year.name,
        key: input.key,
        name: term.name,
        published_results_overridden: hasPublishedResults,
        published_gradebooks_count: publishedGbCount,
        published_grades_count: publishedGradesCount,
      },
      correlationId,
    }, tx);

    return term;
  });
}

export async function removeAcademicTerm(
  academicYearId: string,
  termId: string,
  actorId: string,
  correlationId?: string
) {
  // 1. Authorize: strictly Admin and ITAdmin from database-derived roles
  const actorUser = await prisma.user.findUnique({
    where: { id: actorId },
    include: { user_roles: { include: { role: true } } },
  });
  const hasAdminRole = actorUser?.user_roles.some(
    (ur) => ur.role.name === 'Admin' || ur.role.name === 'ITAdmin'
  );
  if (!hasAdminRole) {
    throw new AppError(403, 'FORBIDDEN', 'Only Admin and ITAdmin are authorized to remove academic terms.');
  }

  // 2. Transactional execution with full isolation
  return prisma.$transaction(async (tx) => {
    // Validate Academic Year inside transaction
    const year = await tx.academicYear.findUnique({
      where: { id: academicYearId },
      include: { terms: { orderBy: { key: 'asc' } } },
    });
    if (!year) {
      throw new AppError(404, 'NOT_FOUND', 'Academic year not found.');
    }

    const term = year.terms.find((t) => t.id === termId);
    if (!term) {
      throw new AppError(404, 'NOT_FOUND', 'Term not found in this academic year.');
    }

    // DepEd Minimum Supported Terms Check (Task 4)
    // Supported DepEd JHS configurations are strictly 3 terms (trimestral) or 4 terms (quarterly).
    // One-term and two-term configurations are not supported by DepEd grading policies.
    if (year.terms.length <= 3) {
      throw new AppError(
        400,
        'UNSUPPORTED_TERM_CONFIGURATION',
        `Cannot reduce academic year "${year.name}" below 3 terms. DepEd junior high school grading policies support 3-term (trimestral) and 4-term (quarterly) calendars. One-term and two-term configurations are not supported.`
      );
    }

    // Highest term check (preserve chronological sequence, never intermediate deletion)
    const highestTerm = year.terms[year.terms.length - 1];
    if (term.id !== highestTerm.id) {
      throw new AppError(
        400,
        'CANNOT_REMOVE_INTERMEDIATE_TERM',
        `Only the highest configured term (${highestTerm.key}) can be removed to preserve chronological sequence.`
      );
    }

    // Dependency checks & transactional deletion
    const gbCount = await tx.gradebooks.count({ where: { term_id: term.id } });
    const gCount = await tx.grade.count({ where: { academic_year_id: academicYearId, term: term.key } });
    const assCount = await tx.gradebook_columns.count({ where: { gradebook: { term_id: term.id } } });
    const commCount = await tx.sf9AdviserComment.count({ where: { academic_year_id: academicYearId, term: term.key } });
    const issCount = await tx.sf9OfficialIssuance.count({ where: { academic_year_id: academicYearId } });

    if (gbCount > 0 || gCount > 0 || assCount > 0 || commCount > 0 || issCount > 0) {
      const depDetails: string[] = [];
      if (gbCount > 0) depDetails.push(`${gbCount} gradebook(s)`);
      if (gCount > 0) depDetails.push(`${gCount} grade record(s)`);
      if (assCount > 0) depDetails.push(`${assCount} assessment(s)`);
      if (commCount > 0) depDetails.push(`${commCount} adviser comment(s)`);
      if (issCount > 0) depDetails.push(`${issCount} official SF9 issuance(s)`);

      throw new AppError(
        409,
        'TERM_HAS_DEPENDENCIES',
        `Cannot remove term ${term.key}: active academic dependencies exist (${depDetails.join(', ')}). Removal blocked to preserve academic integrity.`
      );
    }

    await tx.term.delete({
      where: { id: term.id },
    });

    await createAuditLog({
      actorUserId: actorId,
      action: 'ACADEMIC_TERM_REMOVED',
      resourceType: 'academic_term',
      resourceId: term.id,
      previousState: {
        id: term.id,
        academic_year_id: academicYearId,
        academic_year_name: year.name,
        key: term.key,
        name: term.name,
      },
      correlationId,
    }, tx);

    return { success: true, removedTerm: term };
  });
}

