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
    const id = String(req.params.id);

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
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = createUserSchema.parse(req.body);
    const authUser = (req as any).user as AuthenticatedUser;
    const hasUserWrite = authUser.permissions.includes('user:write');
    const isPrincipal = authUser.roles?.includes('Principal');

    if (!hasUserWrite && !isPrincipal) {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Not authorized to create users' } });
    }

    if (!hasUserWrite && isPrincipal) {
      // Principal least-privilege enforcement
      if (input.roles.length !== 1 || input.roles[0] !== 'Teacher') {
        return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Principals are only authorized to create Teacher accounts' } });
      }
    }

    const user = await createUser(input, authUser.id, (req as any).correlationId);
    res.status(201).json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
});

/**
 * Explicit server-side allowlist for self-service user profile updates (callers lacking user:write).
 * Any field not explicitly enumerated here must be rejected to prevent horizontal and vertical privilege escalation.
 */
const SELF_SERVICE_ALLOWED_FIELDS = new Set([
  'firstName',
  'lastName',
  'middleName',
  'first_name',
  'last_name',
  'middle_name',
]);

/**
 * PATCH /api/users/:id
 */
router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authUser = (req as any).user as AuthenticatedUser;
    const id = String(req.params.id);
    const hasUserWrite = authUser.permissions.includes('user:write');

    // 1. Horizontal privilege check: callers without user:write can ONLY update their own profile ID
    if (authUser.id !== id && !hasUserWrite) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Not authorized to modify another user profile' }
      });
    }

    // 2. Vertical privilege escalation check: explicit server-side positive allowlist for self-service updates
    if (!hasUserWrite) {
      const payloadKeys = Object.keys(req.body || {});
      const disallowedKeys = payloadKeys.filter(key => !SELF_SERVICE_ALLOWED_FIELDS.has(key));
      if (disallowedKeys.length > 0) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: `Not authorized to modify restricted fields: ${disallowedKeys.join(', ')}`
          }
        });
      }
    }

    // Normalize snake_case input fields if provided
    const body = { ...req.body };
    if (body.first_name !== undefined && body.firstName === undefined) {
      body.firstName = body.first_name;
    }
    if (body.last_name !== undefined && body.lastName === undefined) {
      body.lastName = body.last_name;
    }
    if (body.middle_name !== undefined && body.middleName === undefined) {
      body.middleName = body.middle_name;
    }

    const input = updateUserSchema.parse(body);

    const user = await updateUser(id, input, authUser.id, (req as any).correlationId);
    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
});

export default router;
