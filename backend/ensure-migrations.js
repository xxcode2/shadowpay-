#!/usr/bin/env node
/**
 * Ensure Database Migrations
 * Runs Prisma migrations with proper error handling
 * This is called before the server starts to ensure database is ready
 */

import { execSync } from 'child_process';
import dotenv from 'dotenv';

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.warn('⚠️  DATABASE_URL not set - skipping migrations');
  process.exit(0);
}

console.log('═'.repeat(60));
console.log('🗄️  RUNNING DATABASE MIGRATIONS');
console.log('═'.repeat(60));

try {
  console.log('📍 Database URL configured:', DATABASE_URL.split('@')[1] ? 'YES' : 'NO');
  console.log('\n🔄 Running: prisma migrate deploy (timeout: 30s)');
  
  // Run with 30 second timeout to prevent hanging
  const startTime = Date.now();
  try {
    execSync('npx prisma migrate deploy', {
      stdio: 'inherit',
      env: {
        ...process.env,
        DATABASE_URL,
      },
      timeout: 30000, // 30 seconds
    });
    const duration = Date.now() - startTime;
    console.log(`\n✅ Migrations completed successfully! (${duration}ms)`);
  } catch (timeoutErr) {
    if (timeoutErr.killed) {
      console.warn('\n⚠️  Migrations timed out after 30 seconds - continuing anyway');
    } else {
      throw timeoutErr;
    }
  }
  console.log('═'.repeat(60));
  process.exit(0);
  
} catch (error) {
  console.error('\n❌ Migration failed:', error.message);
  console.log('═'.repeat(60));
  
  // Don't fail startup - let the server try to start anyway
  // This prevents a cascade failure where missing migrations block everything
  console.warn('\n⚠️  WARNING: Continuing startup despite migration errors...');
  console.warn('   If database tables are missing, API calls will fail.');
  console.warn('   Please check DATABASE_URL and run migrations manually.\n');
  
  process.exit(0);
}
