import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../../config/env.js';
import { AppError } from './errorHandler.js';
import prisma from '../../config/database.js';

export interface AuthenticatedUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  status: string;
  permissions: string[];
  roles: string[];
}

/**
 * Extract and verify the JWT from the Authorization header.
 * Populates req.user with the authenticated user's identity and permissions.
 * 
 * The authenticated identity is NEVER derived from client-provided IDs.
 * It is always extracted from the verified JWT payload.
 */
export async function authMiddleware(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    let token = '';

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else if (req.cookies && req.cookies.auth_token) {
      token = req.cookies.auth_token;
    }

    if (!token) {
      throw new AppError(401, 'UNAUTHORIZED', 'Authentication required.');
    }

    const payload = jwt.verify(token, config.jwt.secret) as { userId: string };

    // Fetch the full user with roles and permissions from DB
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: {
        user_roles: {
          include: {
            role: {
              include: {
                role_permissions: {
                  include: { permission: true },
                },
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new AppError(401, 'UNAUTHORIZED', 'User not found.');
    }

    if (user.status !== 'active') {
      throw new AppError(401, 'ACCOUNT_INACTIVE', 'Your account has been deactivated.');
    }

    // Collect all permissions from all roles
    const permissions = new Set<string>();
    const roles: string[] = [];

    for (const ur of user.user_roles) {
      roles.push(ur.role.name);
      for (const rp of ur.role.role_permissions) {
        permissions.add(rp.permission.key);
      }
    }

    (req as any).user = {
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      status: user.status,
      permissions: Array.from(permissions),
      roles,
    } satisfies AuthenticatedUser;

    next();
  } catch (err) {
    if (err instanceof AppError) {
      next(err);
      return;
    }
    if ((err as any)?.name === 'JsonWebTokenError' || (err as any)?.name === 'TokenExpiredError') {
      next(new AppError(401, 'UNAUTHORIZED', 'Invalid or expired token.'));
      return;
    }
    next(err);
  }
}

/**
 * Permission guard factory.
 * Checks that the authenticated user has ALL the required permissions.
 * 
 * Usage:
 *   router.get('/grades', authMiddleware, requirePermissions('grade:read'), handler)
 */
export function requirePermissions(...requiredPermissions: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const user = (req as any).user as AuthenticatedUser | undefined;
    if (!user) {
      next(new AppError(401, 'UNAUTHORIZED', 'Authentication required.'));
      return;
    }

    const missing = requiredPermissions.filter(p => !user.permissions.includes(p));
    if (missing.length > 0) {
      next(new AppError(403, 'FORBIDDEN', 'You do not have permission to access this resource.'));
      return;
    }

    next();
  };
}
