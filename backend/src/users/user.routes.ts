import { Router, Request, Response, NextFunction } from 'express';
import { createUserSchema, updateUserSchema, createUser, getUsers, getUserById, updateUser } from './user.service.js';
import { authMiddleware, requirePermissions, AuthenticatedUser } from '../common/middleware/auth.js';

const router = Router();

// All user routes require authentication
router.use(authMiddleware);

/**
 * GET /api/users
 * Requires user:read permission.
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authUser = (req as any).user as AuthenticatedUser;
    const status = req.query.status as string | undefined;
    const role = req.query.role as string | undefined;

    if (!authUser.permissions.includes('user:read')) {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Not authorized' } });
    }

    const users = await getUsers({ status, role });
    res.json({ success: true, data: users });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/users/:id
 * Users can read their own profile, or need user:read permission to read others.
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authUser = (req as any).user as AuthenticatedUser;
    const targetId = req.params.id as string;

    if (authUser.id !== targetId && !authUser.permissions.includes('user:read')) {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Not authorized to read other users.' } });
    }

    const user = await getUserById(targetId);
    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/users
 * Requires user:write permission (typically ITAdmin/Admin).
 */
router.post('/', requirePermissions('user:write'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = createUserSchema.parse(req.body);
    const correlationId = (req as any).correlationId;
    const actorId = ((req as any).user as AuthenticatedUser).id;
    
    const result = await createUser(input, actorId, correlationId);
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/users/:id
 * Users can update some of their own info, but changing status requires user:write.
 */
router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authUser = (req as any).user as AuthenticatedUser;
    const targetId = req.params.id as string;
    const input = updateUserSchema.parse(req.body);
    
    // LAYER 2: Authorization check
    if (authUser.id !== targetId && !authUser.permissions.includes('user:write')) {
       return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Not authorized to update other users.' } });
    }

    // Only user:write can change status
    if (input.status && !authUser.permissions.includes('user:write')) {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Not authorized to change account status.' } });
    }

    const correlationId = (req as any).correlationId;
    const updated = await updateUser(targetId, input, authUser.id, correlationId);
    
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

export default router;
