import jwt from 'jsonwebtoken';

export interface JwtPayload {
  userId: string;
  tenantId: string;
  role: string;
  groupId?: string;
}

const JWT_SECRET = process.env.JWT_SECRET || 'surat_textile_default_jwt_secret_key_32_chars!';
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || 'surat_textile_default_refresh_jwt_secret_key_32_chars!';

export const verifyToken = (token: string): JwtPayload => {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
};

export const signToken = (payload: JwtPayload): string => {
  return jwt.sign(payload as object, JWT_SECRET, {
    expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as any,
  });
};

export const signRefreshToken = (payload: { userId: string }): string => {
  return jwt.sign(payload as object, REFRESH_TOKEN_SECRET, { expiresIn: '30d' as any });
};
