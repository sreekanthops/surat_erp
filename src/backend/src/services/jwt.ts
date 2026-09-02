import jwt from 'jsonwebtoken';

export interface JwtPayload {
  userId: string;
  tenantId: string;
  role: string;
  groupId?: string;
}

export const verifyToken = (token: string): JwtPayload => {
  return jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
};

export const signToken = (payload: JwtPayload): string => {
  return jwt.sign(payload as object, process.env.JWT_SECRET!, {
    expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as any,
  });
};

export const signRefreshToken = (payload: { userId: string }): string => {
  return jwt.sign(payload as object, process.env.REFRESH_TOKEN_SECRET!, { expiresIn: '30d' as any });
};
