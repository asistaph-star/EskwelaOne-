import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../config/database.js';
import { generateId } from '../common/utils/uuid.js';
import { requirePermissions, AuthenticatedUser } from '../common/middleware/auth.js';
import { AppError } from '../common/middleware/errorHandler.js';

const router = Router();

// Inventory item creation schema
const createInventorySchema = z.object({
  name: z.string().min(1),
  category: z.string().min(1),
  description: z.string().optional().nullable(),
  quantity: z.number().int().min(0),
  unit: z.string().min(1),
  supplier: z.string().optional().nullable(),
  purchase_date: z.string().datetime().optional().nullable(),
  expiry_date: z.string().datetime().optional().nullable(),
  reorder_level: z.number().int().min(0).optional().nullable(),
  condition: z.string().min(1),
  location: z.string().optional().nullable(),
  status: z.enum(['Good', 'Repair', 'Borrowed', 'Lost', 'Damaged']).default('Good')
});

const updateInventorySchema = createInventorySchema.partial().extend({
  update_details: z.string().min(1).optional()
});

/**
 * GET /api/admin/inventory
 */
router.get('/', requirePermissions('inventory:write'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const items = await prisma.inventoryItem.findMany({
      include: {
        updates: {
          orderBy: { created_at: 'desc' },
          include: {
            user: { select: { first_name: true, last_name: true, id: true } }
          }
        }
      },
      orderBy: { created_at: 'desc' }
    });
    res.json({ success: true, data: items });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/admin/inventory
 */
router.post('/', requirePermissions('inventory:write'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = createInventorySchema.parse(req.body);
    const authUser = (req as any).user as AuthenticatedUser;
    
    // Create inventory item and initial update history in a transaction
    const itemId = generateId();
    const result = await prisma.$transaction(async (tx) => {
      const item = await tx.inventoryItem.create({
        data: {
          id: itemId,
          name: input.name,
          category: input.category,
          description: input.description || null,
          quantity: input.quantity,
          unit: input.unit,
          supplier: input.supplier || null,
          purchase_date: input.purchase_date ? new Date(input.purchase_date) : null,
          expiry_date: input.expiry_date ? new Date(input.expiry_date) : null,
          reorder_level: input.reorder_level ?? null,
          condition: input.condition,
          location: input.location || null,
          status: input.status,
        }
      });
      
      await tx.inventoryUpdate.create({
        data: {
          id: generateId(),
          item_id: itemId,
          user_id: authUser.id,
          action: 'Added',
          details: `Added to inventory: ${input.quantity} ${input.unit}`
        }
      });
      
      return item;
    });
    
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/admin/inventory/:id
 */
router.patch('/:id', requirePermissions('inventory:write'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = updateInventorySchema.parse(req.body);
    const authUser = (req as any).user as AuthenticatedUser;
    const id = String(req.params.id);
    
    const existing = await prisma.inventoryItem.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', 'Inventory item not found');
    }

    const { update_details, ...updateData } = input;
    
    const result = await prisma.$transaction(async (tx) => {
      const updatedItem = await tx.inventoryItem.update({
        where: { id },
        data: {
          ...updateData,
          purchase_date: updateData.purchase_date ? new Date(updateData.purchase_date) : undefined,
          expiry_date: updateData.expiry_date ? new Date(updateData.expiry_date) : undefined
        }
      });
      
      // Determine what action took place
      let action = 'Updated';
      if (input.status && input.status !== existing.status) {
        action = `Status changed to ${input.status}`;
      } else if (input.quantity !== undefined && input.quantity !== existing.quantity) {
        action = 'Quantity adjusted';
      }
      
      await tx.inventoryUpdate.create({
        data: {
          id: generateId(),
          item_id: id,
          user_id: authUser.id,
          action: action,
          details: update_details || `Updated inventory item`
        }
      });
      
      return updatedItem;
    });

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

export default router;
