import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../services/jwt.js';

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized', code: 'AUTH_002' });
  }
  const token = authHeader.slice(7);
  try {
    const payload = verifyToken(token);
    (req as any).user = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'Token expired or invalid', code: 'AUTH_002' });
  }
};
