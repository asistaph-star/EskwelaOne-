import { Router, Request, Response, NextFunction } from 'express';
import { createUserSchema, updateUserSchema, createUser, getUsers, getUserById, updateUser } from './user.service.js';
import { authMiddleware, requirePermissions, AuthenticatedUser } from '../common/middleware/auth.js';

const router = Router();

// All user routes require authentication
router.use(authMiddleware);

/**
 * GET /api/users
 * Requires user:read permission or Principal role.
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authUser = (req as any).user as AuthenticatedUser;
    const status = req.query.status as string | undefined;
    const role = req.query.role as string | undefined;

    const isPrincipal = authUser.roles?.includes('Principal');
    if (!authUser.permissions.includes('user:read') && !isPrincipal) {
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
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authUser = (req as any).user as AuthenticatedUser;
    const id = req.params.id;

    // A user can always read their own data. Others need user:read.
    if (authUser.id !== id && !authUser.permissions.includes('user:read') && !authUser.roles?.includes('Principal')) {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Not authorized' } });
    }

    const user = await getUserById(id);
    if (!user) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
    }

    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/users
 */
router.post('/', requirePermissions('user:write'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = createUserSchema.parse(req.body);
    const user = await createUser(input);
    res.status(201).json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/users/:id
 */
router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authUser = (req as any).user as AuthenticatedUser;
    const id = req.params.id;

    // Simple auth check: a user can update themselves (e.g. profile), or need user:write
    if (authUser.id !== id && !authUser.permissions.includes('user:write')) {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Not authorized' } });
    }

    const input = updateUserSchema.parse(req.body);
    const user = await updateUser(id, input);
    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
});

export default router;
