import { Router, Request, Response, NextFunction } from 'express';
import { requirePermissions, AuthenticatedUser } from '../../common/middleware/auth.js';
import { clinicInventorySchema, consumeInventorySchema } from './clinicInventory.schema.js';
import { getInventoryItems, createInventoryItem, consumeInventoryStock } from './clinicInventory.service.js';

const router = Router();

/**
 * GET /api/student-services/clinic/inventory
 */
router.get('/', requirePermissions('clinic:read'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const items = await getInventoryItems();
    res.json({ success: true, data: items });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/student-services/clinic/inventory
 */
router.post('/', requirePermissions('clinic:write'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = clinicInventorySchema.parse(req.body);
    const authUser = (req as any).user as AuthenticatedUser;
    
    const result = await createInventoryItem(input, authUser.id);
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/student-services/clinic/inventory/:id/use
 */
router.post('/:id/use', requirePermissions('clinic:write'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params.id);
    const { quantity, reason } = consumeInventorySchema.parse(req.body);
    const authUser = (req as any).user as AuthenticatedUser;

    const result = await consumeInventoryStock(id, quantity, reason, authUser.id);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

export default router;
