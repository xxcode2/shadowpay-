#!/usr/bin/env node
// Safe migrations runner - only runs if DATABASE_URL is set

import { execSync } from 'child_process';
import dotenv from 'dotenv';

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.warn('⚠️  DATABASE_URL not set - skipping migrations');
  process.exit(0);
}

try {
  console.log('🔄 Running migrations...');
  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    timeout: 10000,
  });
  console.log('✅ Migrations completed');
} catch (err) {
  console.warn('⚠️ Migrations failed or timed out - continuing anyway');
  console.warn('   Error:', err.message);
}

process.exit(0);
