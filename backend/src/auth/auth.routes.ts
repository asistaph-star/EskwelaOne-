import { Router, Request, Response, NextFunction } from 'express';
import { login, loginSchema, getMe, changePassword, changePasswordSchema } from './auth.service.js';
import { authMiddleware, AuthenticatedUser } from '../common/middleware/auth.js';
import { createAuditLog } from '../audit/audit.service.js';
import { aiConversationSessionService } from '../ai/session/aiConversationSession.service.js';
import { authRateLimiter, recordAuthSuccess, recordAuthFailure, getClientIp } from './auth.limiter.js';

const router = Router();

/**
 * POST /api/auth/login
 * Authenticate with School ID + password, receive JWT.
 */
router.post('/login', authRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = loginSchema.parse(req.body);
    const correlationId = (req as any).correlationId;
    const ipAddress = getClientIp(req);
    const userAgent = req.headers['user-agent'] as string | undefined;
    const result = await login(input, correlationId, { ipAddress, userAgent });

    // Successful authentication clears failed attempt allowance for this user
    recordAuthSuccess(req);

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
  } catch (err: any) {
    if (!err || err.statusCode !== 429) {
      recordAuthFailure(req);
    }
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

    // Invalidate active ephemeral AI conversation sessions on logout
    aiConversationSessionService.invalidateUserSessions(user.id);

    await createAuditLog({
      actorUserId: user.id,
      actorSchoolId: user.schoolId,
      actorRole: user.roles[0] || 'User',
      action: 'LOGOUT',
      category: 'AUTHENTICATION',
      resourceType: 'auth',
      targetLabel: `${user.schoolId} (${user.firstName} ${user.lastName})`,
      result: 'SUCCESS',
      correlationId: (req as any).correlationId,
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'] as string | undefined,
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

/**
 * POST /api/auth/change-password
 * Authenticated user changes temporary password to permanent password.
 */
router.post('/change-password', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user as AuthenticatedUser;
    const input = changePasswordSchema.parse(req.body);
    const ipAddress = getClientIp(req);
    const userAgent = req.headers['user-agent'] as string | undefined;
    const result = await changePassword(user.id, input, (req as any).correlationId, {
      actorSchoolId: user.schoolId,
      actorRole: user.roles[0] || 'User',
      ipAddress,
      userAgent,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
});

export default router;

