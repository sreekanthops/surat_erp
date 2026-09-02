import { Request, Response, NextFunction } from 'express';

/**
 * Middleware factory that restricts a route to specific roles.
 * Roles are checked in order; first match allows access.
 * Usage: requireRole('OWNER', 'SUPER_ADMIN')
 */
export const requireRole = (...roles: string[]) =>
  (req: Request, res: Response, next: NextFunction) => {
    const userRole: string = (req as any).user?.role;
    if (!userRole) {
      return res.status(401).json({ error: 'Unauthorized', code: 'AUTH_002' });
    }
    if (!roles.includes(userRole)) {
      return res.status(403).json({
        error: `Access denied. Required role: ${roles.join(' or ')}`,
        code: 'AUTH_004',
      });
    }
    next();
  };
