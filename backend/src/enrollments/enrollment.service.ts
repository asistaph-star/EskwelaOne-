import { z } from 'zod';
import prisma, { withTransaction } from '../config/database.js';
import { generateId } from '../common/utils/uuid.js';
import { AppError } from '../common/middleware/errorHandler.js';
import { createAuditLog } from '../audit/audit.service.js';

export const transferStudentSchema = z.object({
  studentId: z.string().min(1),
  newSectionId: z.string().min(1),
  reason: z.string().min(1, 'Transfer reason is required.'),
});

export const initialEnrollmentSchema = z.object({
  studentId: z.string().min(1),
  sectionId: z.string().min(1),
  academicYearId: z.string().min(1),
});

/**
 * Transfer a student mid-year.
 * 
 * ATOMIC TRANSACTION:
 * 1. Close current active enrollment (set status = Transferred_Out, effective_to = NOW)
 * 2. Create new active enrollment in the new section
 * 3. Create audit log
 * 
 * We rely on the partial unique index (academic_year_id, student_id) WHERE status = 'Enrolled'
 * to ensure only one active enrollment exists.
 */
export async function transferStudent(
  input: z.infer<typeof transferStudentSchema>,
  actorId: string,
  correlationId?: string,
) {
  return withTransaction(async (tx) => {
    // Find current active enrollment
    const activeEnrollment = await tx.enrollment.findFirst({
      where: {
        student_id: input.studentId,
        status: 'Enrolled',
      },
    });

    if (!activeEnrollment) {
      throw new AppError(404, 'NOT_FOUND', 'No active enrollment found for this student.');
    }

    if (activeEnrollment.section_id === input.newSectionId) {
      throw new AppError(400, 'INVALID_TRANSFER', 'Student is already enrolled in this section.');
    }

    // Verify the new section exists
    const newSection = await tx.section.findUnique({
      where: { id: input.newSectionId },
    });

    if (!newSection) {
      throw new AppError(404, 'NOT_FOUND', 'New section not found.');
    }

    const now = new Date();

    // 1. Close old enrollment
    await tx.enrollment.update({
      where: { id: activeEnrollment.id },
      data: {
        status: 'Transferred_Out',
      },
    });

    // 2. Create new enrollment
    const newEnrollmentId = generateId();
    const newEnrollment = await tx.enrollment.create({
      data: {
        id: newEnrollmentId,
        academic_year_id: activeEnrollment.academic_year_id,
        student_id: input.studentId,
        section_id: input.newSectionId,
        status: 'Enrolled',
      },
    });

    // 3. Audit
    await createAuditLog({
      actorUserId: actorId,
      action: 'ENROLLMENT_TRANSFERRED',
      resourceType: 'student_enrollment',
      resourceId: input.studentId, // Focus audit on the student
      previousState: { enrollmentId: activeEnrollment.id, sectionId: activeEnrollment.section_id },
      newState: { enrollmentId: newEnrollmentId, sectionId: input.newSectionId },
      reason: input.reason,
      correlationId,
    }, tx);

    return newEnrollment;
  });
}

/**
 * Get the enrollment history of a student for a specific academic year.
 * Shows active and historical (transferred out, withdrawn) enrollments.
 */
export async function getStudentEnrollmentHistory(studentId: string, academicYearId: string) {
  const history = await prisma.enrollment.findMany({
    where: {
      student_id: studentId,
      academic_year_id: academicYearId,
    },
    orderBy: {
      status: 'asc',
    },
    include: {
      section: {
        include: {
          assignments: {
            include: {
              teacher: {
                include: {
                  user: true
                }
              },
              subject: true
            }
          }
        }
      },
    },
  });

  return history;
}

/**
 * Initial enrollment for a student.
 */
export async function createInitialEnrollment(
  input: z.infer<typeof initialEnrollmentSchema>,
  actorId: string,
  correlationId?: string
) {
  return withTransaction(async (tx) => {
    // Verify student exists and has student profile
    const student = await tx.student.findUnique({
      where: { id: input.studentId },
      include: { user: { include: { user_roles: { include: { role: true } } } } }
    });

    if (!student) {
      throw new AppError(404, 'NOT_FOUND', 'Student profile not found.');
    }

    const hasStudentRole = student.user?.user_roles?.some((ur: any) => ur.role.name === 'Student');
    if (!hasStudentRole) {
      throw new AppError(403, 'FORBIDDEN', 'User does not have a Student role.');
    }

    // Verify Section and AcademicYear
    const section = await tx.section.findUnique({
      where: { id: input.sectionId },
    });

    if (!section) {
      throw new AppError(404, 'NOT_FOUND', 'Section not found.');
    }

    if (section.academic_year_id !== input.academicYearId) {
      throw new AppError(400, 'INVALID_RELATION', 'Section does not belong to the specified academic year.');
    }

    // Check for duplicate active enrollment
    const activeEnrollment = await tx.enrollment.findFirst({
      where: {
        student_id: input.studentId,
        academic_year_id: input.academicYearId,
        status: 'Enrolled',
      }
    });

    if (activeEnrollment) {
      throw new AppError(400, 'DUPLICATE', 'Student already has an active enrollment for this academic year.');
    }

    // Create enrollment
    const enrollmentId = generateId();
    const enrollment = await tx.enrollment.create({
      data: {
        id: enrollmentId,
        student_id: input.studentId,
        section_id: input.sectionId,
        academic_year_id: input.academicYearId,
        status: 'Enrolled',
      }
    });

    // Audit log
    await createAuditLog({
      actorUserId: actorId,
      action: 'ENROLLMENT_CREATED',
      resourceType: 'student_enrollment',
      resourceId: enrollmentId,
      newState: input,
      correlationId,
    }, tx);

    return enrollment;
  });
}
