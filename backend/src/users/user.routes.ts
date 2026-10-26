import { Router, Request, Response, NextFunction } from 'express';
import {
  createUserSchema,
  updateUserSchema,
  createUser,
  getUsers,
  getUserById,
  updateUser,
  resetUserPassword,
} from './user.service.js';
import { authMiddleware, AuthenticatedUser } from '../common/middleware/auth.js';
import prisma from '../config/database.js';

const router = Router();

// All user routes require authentication
router.use(authMiddleware);

const ADMIN_ALLOWED_ROLES = new Set([
  'Student',
  'Teacher',
  'Principal',
  'Registrar',
  'Guidance',
  'Nurse',
  'GateOperator',
]);

/**
 * GET /api/users
 * Requires user:read permission or Principal/Admin/ITAdmin role.
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authUser = (req as any).user as AuthenticatedUser;
    const status = req.query.status as string | undefined;
    const role = req.query.role as string | undefined;

    const isITAdmin = authUser.roles?.includes('ITAdmin');
    const isAdmin = authUser.roles?.includes('Admin');
    const isPrincipal = authUser.roles?.includes('Principal');
    const hasUserRead = authUser.permissions.includes('user:read');

    if (!hasUserRead && !isPrincipal && !isAdmin && !isITAdmin) {
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

    const isITAdmin = authUser.roles?.includes('ITAdmin');
    const isAdmin = authUser.roles?.includes('Admin');
    const isPrincipal = authUser.roles?.includes('Principal');
    const hasUserRead = authUser.permissions.includes('user:read');

    // A user can always read their own data. Others need user:read, Admin, ITAdmin, or Principal.
    if (authUser.id !== id && !hasUserRead && !isPrincipal && !isAdmin && !isITAdmin) {
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
    const isITAdmin = authUser.roles?.includes('ITAdmin');
    const isAdmin = authUser.roles?.includes('Admin');
    const isPrincipal = authUser.roles?.includes('Principal');
    const hasUserWrite = authUser.permissions.includes('user:write');

    // 1. Base authorization: must be ITAdmin, Admin, Principal, or possess user:write
    if (!isITAdmin && !isAdmin && !isPrincipal && !hasUserWrite) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Not authorized to create users' },
      });
    }

    // 2. Principal least-privilege: Teacher only
    if (!isITAdmin && !isAdmin && isPrincipal) {
      if (input.roles.length !== 1 || input.roles[0] !== 'Teacher') {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Principals are only authorized to create Teacher accounts' },
        });
      }
    }

    // 3. Admin least-privilege: cannot create Admin or ITAdmin
    if (!isITAdmin && (isAdmin || (!isPrincipal && hasUserWrite))) {
      const attemptedPrivilegedRoles = input.roles.filter(r => r === 'Admin' || r === 'ITAdmin');
      if (attemptedPrivilegedRoles.length > 0) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Admins are not authorized to create Admin or ITAdmin accounts',
          },
        });
      }

      const invalidRoles = input.roles.filter(r => !ADMIN_ALLOWED_ROLES.has(r));
      if (invalidRoles.length > 0) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: `Admins are not authorized to assign role(s): ${invalidRoles.join(', ')}`,
          },
        });
      }
    }

    const user = await createUser(input, authUser.id, (req as any).correlationId, {
      actorSchoolId: authUser.schoolId,
      actorRole: authUser.roles[0] || 'User',
      ipAddress: req.ip || req.socket?.remoteAddress,
      userAgent: req.headers['user-agent'] as string | undefined,
    });
    res.status(201).json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
});

/**
 * Explicit server-side allowlist for self-service user profile updates (callers lacking management authority).
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
    const isITAdmin = authUser.roles?.includes('ITAdmin');
    const isAdmin = authUser.roles?.includes('Admin');
    const hasUserWrite = authUser.permissions.includes('user:write');
    const isManager = isITAdmin || isAdmin || hasUserWrite;

    // 1. Horizontal privilege check: non-managers can ONLY update their own profile ID
    if (authUser.id !== id && !isManager) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Not authorized to modify another user profile' }
      });
    }

    // 2. Vertical privilege escalation check: allowlist for self-service callers
    if (!isManager) {
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

    // 3. Admin least-privilege protection: Standard Admin cannot modify Admin or ITAdmin accounts
    if (!isITAdmin && (isAdmin || hasUserWrite) && authUser.id !== id) {
      const targetUser = await prisma.user.findUnique({
        where: { id },
        include: { user_roles: { include: { role: true } } },
      });
      if (!targetUser) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
      }
      const targetRoles = targetUser.user_roles.map(ur => ur.role.name);
      if (targetRoles.includes('Admin') || targetRoles.includes('ITAdmin')) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Admins are not authorized to modify Admin or ITAdmin accounts'
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

    const user = await updateUser(id, input, authUser.id, (req as any).correlationId, {
      actorSchoolId: authUser.schoolId,
      actorRole: authUser.roles[0] || 'User',
      ipAddress: req.ip || req.socket?.remoteAddress,
      userAgent: req.headers['user-agent'] as string | undefined,
    });
    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/users/:id/reset-password
 */
router.post('/:id/reset-password', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authUser = (req as any).user as AuthenticatedUser;
    const id = String(req.params.id);
    const isITAdmin = authUser.roles?.includes('ITAdmin');
    const isAdmin = authUser.roles?.includes('Admin');
    const hasUserWrite = authUser.permissions.includes('user:write');

    if (!isITAdmin && !isAdmin && !hasUserWrite) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Not authorized to reset user passwords' },
      });
    }

    // Admin cannot reset passwords for Admin or ITAdmin accounts
    if (!isITAdmin && (isAdmin || hasUserWrite)) {
      const targetUser = await prisma.user.findUnique({
        where: { id },
        include: { user_roles: { include: { role: true } } },
      });
      if (!targetUser) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
      }
      const targetRoles = targetUser.user_roles.map(ur => ur.role.name);
      if (targetRoles.includes('Admin') || targetRoles.includes('ITAdmin')) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Admins are not authorized to reset passwords for Admin or ITAdmin accounts',
          },
        });
      }
    }

    const result = await resetUserPassword(id, authUser.id, (req as any).correlationId, {
      actorSchoolId: authUser.schoolId,
      actorRole: authUser.roles[0] || 'User',
      ipAddress: req.ip || req.socket?.remoteAddress,
      userAgent: req.headers['user-agent'] as string | undefined,
    });
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

export default router;

