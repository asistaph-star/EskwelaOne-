import { z } from 'zod';

/**
 * Validation schema for Teacher student support indicator query parameters.
 */
export const teacherStudentSupportQuerySchema = z.object({
  sectionId: z.string().min(1).optional(),
  subjectId: z.string().min(1).optional(),
  term: z.string().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'startDate must be in YYYY-MM-DD format').optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'endDate must be in YYYY-MM-DD format').optional(),
}).refine(
  (data) => (data.startDate && data.endDate) || (!data.startDate && !data.endDate),
  {
    message: 'Both startDate and endDate must be provided together, or both omitted to use the default 30-day window.',
    path: ['startDate'],
  }
).refine(
  (data) => {
    if (data.startDate && data.endDate) {
      return data.startDate <= data.endDate;
    }
    return true;
  },
  {
    message: 'startDate must be on or before endDate.',
    path: ['startDate'],
  }
);

export type TeacherStudentSupportQuery = z.infer<typeof teacherStudentSupportQuerySchema>;

/**
 * Validation schema for Principal student support aggregate query parameters.
 */
export const principalStudentSupportQuerySchema = z.object({
  gradeLevel: z.coerce.number().int().min(1).max(12).optional(),
  sectionId: z.string().min(1).optional(),
  term: z.string().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'startDate must be in YYYY-MM-DD format').optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'endDate must be in YYYY-MM-DD format').optional(),
}).refine(
  (data) => (data.startDate && data.endDate) || (!data.startDate && !data.endDate),
  {
    message: 'Both startDate and endDate must be provided together, or both omitted to use the default 30-day window.',
    path: ['startDate'],
  }
).refine(
  (data) => {
    if (data.startDate && data.endDate) {
      return data.startDate <= data.endDate;
    }
    return true;
  },
  {
    message: 'startDate must be on or before endDate.',
    path: ['startDate'],
  }
);

export type PrincipalStudentSupportQuery = z.infer<typeof principalStudentSupportQuerySchema>;
