import { z } from 'zod';

export type FacultyAttendanceStatus =
  | 'Completed'
  | 'Time Out Pending'
  | 'On Leave'
  | 'Official Business'
  | 'Not Checked In';

export const timeInInputSchema = z.object({
  remarks: z.string().max(255).optional(),
});

export const timeOutInputSchema = z.object({
  remarks: z.string().max(255).optional(),
});

export const adminCorrectionSchema = z.object({
  time_in: z.string().datetime().optional().nullable(),
  time_out: z.string().datetime().optional().nullable(),
  override_status: z.enum(['Official Business']).optional().nullable(),
  override_remarks: z.string().max(255).optional().nullable(),
}).refine(data => {
  if (data.override_status === 'Official Business') {
    return typeof data.override_remarks === 'string' && data.override_remarks.trim().length > 0;
  }
  return true;
}, {
  message: 'Remarks are mandatory when setting Official Business status.',
  path: ['override_remarks'],
});

export const queryFacultyAttendanceSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format').optional(),
  status: z.enum(['All', 'Completed', 'Time Out Pending', 'On Leave', 'Official Business', 'Not Checked In']).optional(),
  department: z.string().optional(),
  search: z.string().optional(),
  page: z.string().regex(/^\d+$/).transform(Number).optional().default('1'),
  limit: z.string().regex(/^\d+$/).transform(Number).optional().default('20'),
});

export type TimeInInput = z.infer<typeof timeInInputSchema>;
export type TimeOutInput = z.infer<typeof timeOutInputSchema>;
export type AdminCorrectionInput = z.infer<typeof adminCorrectionSchema>;
export type QueryFacultyAttendanceInput = z.infer<typeof queryFacultyAttendanceSchema>;
