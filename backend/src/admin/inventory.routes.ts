import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../config/database.js';
import { generateId } from '../common/utils/uuid.js';
import { requirePermissions, AuthenticatedUser } from '../common/middleware/auth.js';
import { AppError } from '../common/middleware/errorHandler.js';
import { createAuditLog } from '../audit/audit.service.js';

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
  status: z.enum(['Good', 'Repair', 'Borrowed', 'Lost', 'Damaged', 'Retired', 'Disposed']).default('Good')
});

const updateInventorySchema = createInventorySchema.partial().extend({
  update_details: z.string().min(1).optional()
});

const retireSchema = z.object({
  reason: z.string().min(1, 'Retirement reason is required'),
  reference_number: z.string().optional().nullable()
});

const disposeSchema = z.object({
  reason: z.string().min(1, 'Disposal reason is required'),
  reference_number: z.string().optional().nullable()
});

const voidSchema = z.object({
  reason: z.string().min(3, 'Void reason must be at least 3 characters')
});

/**
 * GET /api/admin/inventory
 */
router.get('/', requirePermissions('inventory:read'), async (req: Request, res: Response, next: NextFunction) => {
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

      await createAuditLog({
        actorUserId: authUser.id,
        action: 'CREATE',
        resourceType: 'inventory_item',
        resourceId: itemId,
        newState: item
      }, tx);
      
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

      await createAuditLog({
        actorUserId: authUser.id,
        action: 'UPDATE',
        resourceType: 'inventory_item',
        resourceId: id,
        previousState: existing,
        newState: updatedItem,
        reason: update_details || action
      }, tx);
      
      return updatedItem;
    });

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/admin/inventory/:id/retire
 * Lifecycle transition: Active -> Retired
 */
router.post('/:id/retire', requirePermissions('inventory:write'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params.id);
    const input = retireSchema.parse(req.body);
    const authUser = (req as any).user as AuthenticatedUser;

    const existing = await prisma.inventoryItem.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', 'Inventory item not found');
    }
    if (existing.status === 'Retired') {
      throw new AppError(400, 'BAD_REQUEST', 'Asset is already retired');
    }
    if (existing.status === 'Disposed') {
      throw new AppError(400, 'BAD_REQUEST', 'Cannot retire an asset that has already been disposed');
    }

    const details = input.reason + (input.reference_number ? ` (Ref: ${input.reference_number})` : '');

    const result = await prisma.$transaction(async (tx) => {
      const updatedItem = await tx.inventoryItem.update({
        where: { id },
        data: { status: 'Retired' }
      });

      await tx.inventoryUpdate.create({
        data: {
          id: generateId(),
          item_id: id,
          user_id: authUser.id,
          action: 'Retired',
          details
        }
      });

      await createAuditLog({
        actorUserId: authUser.id,
        action: 'RETIRE',
        resourceType: 'inventory_item',
        resourceId: id,
        previousState: { status: existing.status },
        newState: { status: 'Retired' },
        reason: details
      }, tx);

      return updatedItem;
    });

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/admin/inventory/:id/dispose
 * Lifecycle transition: Retired -> Disposed
 */
router.post('/:id/dispose', requirePermissions('inventory:write'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params.id);
    const input = disposeSchema.parse(req.body);
    const authUser = (req as any).user as AuthenticatedUser;

    const existing = await prisma.inventoryItem.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', 'Inventory item not found');
    }
    if (existing.status !== 'Retired') {
      throw new AppError(400, 'BAD_REQUEST', 'Asset must be retired before it can be marked as disposed');
    }

    const details = input.reason + (input.reference_number ? ` (Ref: ${input.reference_number})` : '');

    const result = await prisma.$transaction(async (tx) => {
      const updatedItem = await tx.inventoryItem.update({
        where: { id },
        data: { status: 'Disposed' }
      });

      await tx.inventoryUpdate.create({
        data: {
          id: generateId(),
          item_id: id,
          user_id: authUser.id,
          action: 'Disposed',
          details
        }
      });

      await createAuditLog({
        actorUserId: authUser.id,
        action: 'DISPOSE',
        resourceType: 'inventory_item',
        resourceId: id,
        previousState: { status: existing.status },
        newState: { status: 'Disposed' },
        reason: details
      }, tx);

      return updatedItem;
    });

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/admin/inventory/:id/void
 * Exceptional correction workflow: ITAdmin only, strictly for records with zero operational history
 */
router.post('/:id/void', requirePermissions('inventory:write'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params.id);
    const input = voidSchema.parse(req.body);
    const authUser = (req as any).user as AuthenticatedUser;

    // Authorization: ITAdmin role required for Void Entry
    if (!authUser.roles.includes('ITAdmin')) {
      throw new AppError(403, 'FORBIDDEN', 'Void Entry is an exceptional correction workflow restricted to ITAdmin authorization.');
    }

    const existing = await prisma.inventoryItem.findUnique({
      where: { id },
      include: { updates: true }
    });
    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', 'Inventory item not found');
    }

    // Strict checks: Must not have operational history beyond initial entry
    if (existing.updates.length > 1 || (existing.updates.length === 1 && existing.updates[0].action !== 'Added')) {
      throw new AppError(400, 'BAD_REQUEST', 'Cannot void an asset with operational history (maintenance, custody, or status adjustments). Use the Retire Asset workflow instead.');
    }

    if (['Retired', 'Disposed'].includes(existing.status)) {
      throw new AppError(400, 'BAD_REQUEST', 'Cannot void an asset that has already been retired or disposed.');
    }

    await prisma.$transaction(async (tx) => {
      await createAuditLog({
        actorUserId: authUser.id,
        action: 'VOID',
        resourceType: 'inventory_item',
        resourceId: id,
        previousState: existing,
        reason: input.reason
      }, tx);

      await tx.inventoryUpdate.deleteMany({ where: { item_id: id } });
      await tx.inventoryItem.delete({ where: { id } });
    });

    res.json({ success: true, message: 'Inventory record voided successfully' });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/admin/inventory/:id
 * Ordinary hard delete is disabled to preserve property accountability.
 */
router.delete('/:id', requirePermissions('inventory:write'), async (_req: Request, _res: Response, next: NextFunction) => {
  next(new AppError(405, 'METHOD_NOT_ALLOWED', 'Ordinary deletion of inventory items is disabled. Real property must use the Retire Asset / Mark as Disposed lifecycle workflow. Exceptional data-entry corrections must use Void Entry.'));
});

export default router;
