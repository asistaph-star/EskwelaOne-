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
      section: true,
    },
  });

  return history;
}
