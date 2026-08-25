import { PrismaClient } from '@prisma/client';
import { logger } from './logger.js';

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const prisma: PrismaClient =
  global.__prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development'
      ? [{ emit: 'event', level: 'query' }]
      : ['error'],
  });

if (process.env.NODE_ENV === 'development') {
  global.__prisma = prisma;
  (prisma as any).$on('query', (e: any) => {
    logger.debug(`Query: ${e.query} — ${e.duration}ms`);
  });
}
