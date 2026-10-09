import { z } from 'zod';

export const createExcuseSchema = z.object({
  teacherId: z.string().min(1, 'Teacher selection is required'),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  reason: z.string().min(5, 'Reason must be at least 5 characters long').max(1000),
  documentId: z.string().optional(),
});

export const patchExcuseStatusSchema = z.object({
  status: z.enum(['Pending Review', 'Approved', 'Rejected']),
  teacherNote: z.string().optional()
});
