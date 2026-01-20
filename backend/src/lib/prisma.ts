import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

if (!process.env.DATABASE_URL) {
  console.warn('⚠️  DATABASE_URL not set - database operations will fail')
}

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'production' ? ['error'] : ['query', 'error', 'warn'],
    errorFormat: 'pretty',
  });

// Handle connection errors gracefully
prisma.$connect().catch((error: Error) => {
  console.error('Failed to connect to database:', error.message)
})

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

export default prisma;

export async function disconnectPrisma() {
  await prisma.$disconnect()
}
