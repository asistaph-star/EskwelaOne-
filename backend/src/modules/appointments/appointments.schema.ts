import { z } from 'zod';

export const createAppointmentSchema = z.object({
  studentId: z.string().optional(),
  teacherId: z.string().optional(),
  staffId: z.string().optional(),
  date: z.string(),
  time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)(:([0-5]\d))?$/, 'Time must be HH:mm or HH:mm:ss'),
  purpose: z.string(),
  parentEmail: z.string().optional(),
});
