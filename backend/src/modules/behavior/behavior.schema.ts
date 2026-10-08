import { z } from 'zod';

export const createBehaviorSchema = z.object({
  studentId: z.string(),
  type: z.string(),
  date: z.string(),
  status: z.string().optional(),
  note: z.string().optional(),
});
