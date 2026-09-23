import { z } from 'zod';
import prisma from '../config/database.js';
import { generateId } from '../common/utils/uuid.js';
import { AppError } from '../common/middleware/errorHandler.js';
import { createAuditLog } from '../audit/audit.service.js';
import { TermKey } from '@prisma/client';

export const createAcademicYearSchema = z.object({
  name: z.string().min(1, 'Name is required').max(50),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  isCurrent: z.boolean().default(false),
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

export const createTeacherAssignmentSchema = z.object({
  academicYearId: z.string().min(1),
  teacherId: z.string().min(1),
  sectionId: z.string().min(1),
  subjectId: z.string().min(1),
});

export async function createAcademicYear(
  input: z.infer<typeof createAcademicYearSchema>,
  actorId: string,
  correlationId?: string
) {
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

    // Create the 4 Terms (T1, T2, T3, T4)
    const terms: TermKey[] = ['T1', 'T2', 'T3', 'T4'];
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

export async function createTeacherAssignment(
  input: z.infer<typeof createTeacherAssignmentSchema>,
  actorId: string,
  correlationId?: string
) {
  const [year, teacher, section, subject] = await Promise.all([
    prisma.academicYear.findUnique({ where: { id: input.academicYearId } }),
    prisma.teacher.findUnique({ where: { id: input.teacherId } }),
    prisma.section.findUnique({ where: { id: input.sectionId } }),
    prisma.subject.findUnique({ where: { id: input.subjectId } }),
  ]);

  if (!year) throw new AppError(404, 'NOT_FOUND', 'Academic year not found.');
  if (!teacher) throw new AppError(404, 'NOT_FOUND', 'Teacher not found.');
  if (!section) throw new AppError(404, 'NOT_FOUND', 'Section not found.');
  if (!subject) throw new AppError(404, 'NOT_FOUND', 'Subject not found.');

  if (section.academic_year_id !== year.id) {
    throw new AppError(400, 'INVALID_RELATION', 'Section does not belong to the specified academic year.');
  }

  const existing = await prisma.teacherSubjectAssignment.findUnique({
    where: {
      academic_year_id_teacher_id_section_id_subject_id: {
        academic_year_id: input.academicYearId,
        teacher_id: input.teacherId,
        section_id: input.sectionId,
        subject_id: input.subjectId,
      }
    }
  });

  if (existing) {
    throw new AppError(400, 'DUPLICATE', 'This teacher assignment already exists.');
  }

  const assignmentId = generateId();
  const assignment = await prisma.teacherSubjectAssignment.create({
    data: {
      id: assignmentId,
      academic_year_id: input.academicYearId,
      teacher_id: input.teacherId,
      section_id: input.sectionId,
      subject_id: input.subjectId,
    },
  });

  await createAuditLog({
    actorUserId: actorId,
    action: 'TEACHER_ASSIGNMENT_CREATED',
    resourceType: 'teacher_subject_assignment',
    resourceId: assignmentId,
    newState: input,
    correlationId,
  });

  return assignment;
}
