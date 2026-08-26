import { Request, Response, NextFunction } from 'express';
import { logger } from '../services/logger.js';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
}

export const errorHandler = (
  err: AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  const statusCode = err.statusCode || 500;
  const code = err.code || 'INTERNAL_ERROR';

  logger.error(err.message, { stack: err.stack, code });

  res.status(statusCode).json({
    error: process.env.NODE_ENV === 'development' ? err.message : (statusCode === 500 ? 'Internal server error' : err.message),
    code,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};
