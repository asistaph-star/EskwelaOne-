import { z } from 'zod';

export const createGuidanceSchema = z.object({
  studentId: z.string(),
  date: z.string(),
  type: z.string(),
  reason: z.string().optional(),
  notes: z.string().optional(),
  actionTaken: z.string().optional(),
  followUpDate: z.string().optional(),
  status: z.string().optional(),
});
