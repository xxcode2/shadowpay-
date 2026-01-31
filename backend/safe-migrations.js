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
  console.log('🔄 Running migrations... (timeout: 30s)');
  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    timeout: 30000, // 30 seconds
    env: { ...process.env, DATABASE_URL },
  });
  console.log('✅ Migrations completed');
} catch (err) {
  if (err.killed) {
    console.warn('⚠️ Migrations timed out after 30s - continuing anyway');
  } else {
    console.warn('⚠️ Migrations failed:', err.message);
  }
}

process.exit(0);
