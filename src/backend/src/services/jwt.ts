import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface JwtPayload {
  userId: string;
  tenantId: string;
  role: string;
}

export const verifyToken = (token: string): JwtPayload => {
  return jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
};

export const signToken = (payload: JwtPayload): string => {
  return jwt.sign(payload, process.env.JWT_SECRET!, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
};

export const signRefreshToken = (payload: { userId: string }): string => {
  return jwt.sign(payload, process.env.REFRESH_TOKEN_SECRET!, { expiresIn: '30d' });
};
