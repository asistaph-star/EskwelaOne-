import { Router, Request, Response, NextFunction } from 'express';
import { login, loginSchema, getMe } from './auth.service.js';
import { authMiddleware, AuthenticatedUser } from '../common/middleware/auth.js';
import { createAuditLog } from '../audit/audit.service.js';

const router = Router();

/**
 * POST /api/auth/login
 * Authenticate with email + password, receive JWT.
 */
router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = loginSchema.parse(req.body);
    const correlationId = (req as any).correlationId;
    const result = await login(input, correlationId);

    res.cookie('auth_token', result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000, // 1 day
    });

    res.json({
      success: true,
      data: {
        user: result.user
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/logout
 * Server-side logout acknowledgment (JWT is stateless, so this is mostly for audit).
 */
router.post('/logout', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user as AuthenticatedUser;
    await createAuditLog({
      actorUserId: user.id,
      action: 'LOGOUT',
      resourceType: 'auth',
      correlationId: (req as any).correlationId,
    });

    res.clearCookie('auth_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    });

    res.json({ success: true, message: 'Logged out successfully.' });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/auth/me
 * Get current authenticated user's full profile + permissions.
 */
router.get('/me', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user as AuthenticatedUser;
    const profile = await getMe(user.id);

    res.json({
      success: true,
      data: profile,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
