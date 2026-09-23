import { z } from 'zod';
import prisma from '../config/database.js';
import { withTransaction } from '../config/database.js';
import { generateId } from '../common/utils/uuid.js';
import { AppError } from '../common/middleware/errorHandler.js';
import { createAuditLog } from '../audit/audit.service.js';

// ─── DTOs ──────────────────────────────────────────────────

export const upsertGradeSchema = z.object({
  studentId: z.string().min(1),
  subjectId: z.string().min(1),
  term: z.enum(['T1', 'T2', 'T3', 'T4']),
  schoolYear: z.string().min(1),
  writtenWork: z.number().min(0).max(100).optional().nullable(),
  performanceTask: z.number().min(0).max(100).optional().nullable(),
  termAssessment: z.number().min(0).max(100).optional().nullable(),
  termGrade: z.number().min(0).max(100).optional().nullable(),
});

// ─── SERVICE ───────────────────────────────────────────────

/**
 * Create or update a grade entry.
 */
export async function upsertGrade(
  input: z.infer<typeof upsertGradeSchema>,
  actorId: string,
  correlationId?: string,
) {
  return withTransaction(async (tx) => {
    // 1. Lookup academic year id
    const academicYear = await tx.academicYear.findUnique({
      where: { name: input.schoolYear }
    });
    if (!academicYear) throw new AppError(404, 'NOT_FOUND', 'Academic year not found');
    const academic_year_id = academicYear.id;

    // Enforce ownership: The teacher must be assigned to the student's section for this subject
    const enrollment = await tx.enrollment.findFirst({
      where: { student_id: input.studentId, academic_year_id, status: 'Enrolled' }
    });
    if (!enrollment) throw new AppError(404, 'NOT_FOUND', 'Student enrollment not found');

    const assignment = await tx.teacherSubjectAssignment.findFirst({
      where: {
        section_id: enrollment.section_id,
        subject_id: input.subjectId,
        teacher: { user_id: actorId }
      }
    });

    if (!assignment) {
      throw new AppError(403, 'FORBIDDEN', 'You are not assigned to teach this subject for this student\'s section.');
    }

    const existing = await tx.grade.findFirst({
      where: {
        student_id: input.studentId,
        subject_id: input.subjectId,
        term: input.term,
        academic_year_id,
      },
    });

    const data = {
      written_work: input.writtenWork,
      performance_task: input.performanceTask,
      term_assessment: input.termAssessment,
      term_grade: input.termGrade,
    };

    let result;
    if (existing) {
      result = await tx.grade.update({
        where: { id: existing.id },
        data,
      });

      await createAuditLog({
        actorUserId: actorId,
        action: 'GRADE_UPDATED',
        resourceType: 'grade',
        resourceId: result.id,
        newState: input,
        correlationId,
      }, tx);
    } else {
      result = await tx.grade.create({
        data: {
          id: generateId(),
          student_id: input.studentId,
          subject_id: input.subjectId,
          term: input.term,
          academic_year_id,
          ...data,
        },
      });

      await createAuditLog({
        actorUserId: actorId,
        action: 'GRADE_CREATED',
        resourceType: 'grade',
        resourceId: result.id,
        newState: input,
        correlationId,
      }, tx);

      return result;
    }
  });
}

/**
 * Get grades for a specific section, subject, term, and school year.
 */
export async function getGradesForSectionAndSubject(
  sectionId: string,
  subjectId: string,
  term: 'T1' | 'T2' | 'T3' | 'T4',
  schoolYear: string,
  requestingUserId: string,
) {
  // Enforce ownership check
  const assignment = await prisma.teacherSubjectAssignment.findFirst({
    where: {
      section_id: sectionId,
      subject_id: subjectId,
      teacher: { user_id: requestingUserId }
    }
  });

  if (!assignment) {
    throw new AppError(403, 'FORBIDDEN', 'You are not assigned to teach this subject for this section.');
  }

  const academicYear = await prisma.academicYear.findUnique({
    where: { name: schoolYear }
  });
  if (!academicYear) throw new AppError(404, 'NOT_FOUND', 'Academic year not found');
  const academic_year_id = academicYear.id;

  const enrollments = await prisma.enrollment.findMany({
    where: { section_id: sectionId, academic_year_id, status: 'Enrolled' },
    include: { student: { include: { user: true } } },
    orderBy: { student: { user: { last_name: 'asc' } } }
  });

  const studentIds = enrollments.map(e => e.student_id);

  const rawGrades = await prisma.grade.findMany({
    where: {
      student_id: { in: studentIds },
      subject_id: subjectId,
      term,
      academic_year_id,
    },
    include: { academic_year: true }
  });

  const grades = rawGrades.map(g => ({
    ...g,
    school_year: g.academic_year.name
  }));

  return {
    enrollments,
    grades,
  };
}
