import { z } from 'zod';

export const createClassAttendanceSchema = z.object({
  teacherSubjectAssignmentId: z.string().min(1),
  studentEnrollmentId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  status: z.enum(['P', 'A', 'L', 'E']), // Present, Absent, Late, Excused
  remarks: z.string().optional(),
});

export const bulkClassAttendanceSchema = z.object({
  records: z.array(z.object({
    studentEnrollmentId: z.string().min(1),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
    status: z.enum(['P', 'A', 'L', 'E']),
    remarks: z.string().optional(),
  }))
});
