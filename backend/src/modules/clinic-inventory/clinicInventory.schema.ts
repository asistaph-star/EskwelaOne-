import { z } from 'zod';

export const clinicInventorySchema = z.object({
  name: z.string().min(1),
  category: z.string().min(1),
  description: z.string().optional().nullable(),
  quantity: z.number().int().min(0),
  unit: z.string().min(1),
  expiry_date: z.string().datetime().optional().nullable(),
  reorder_level: z.number().int().min(0).optional().nullable()
});

export const consumeInventorySchema = z.object({
  quantity: z.number().int().positive(),
  reason: z.string().min(1)
});
