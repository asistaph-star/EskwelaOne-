import { z } from 'zod';

export const createClinicRecordSchema = z.object({
  studentId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)(:([0-5]\d))?$/, 'Time must be HH:mm or HH:mm:ss').optional(),
  symptoms: z.string().optional(),
  diagnosis: z.string().optional(),
  medications: z.string().optional(),
  treatments: z.string().optional(),
  notes: z.string().optional(),
  temperature: z.coerce.number().optional(),
  bloodPressure: z.string().optional(),
  heartRate: z.string().optional(),
});
