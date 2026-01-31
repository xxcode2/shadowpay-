#!/usr/bin/env node
// Direct database fix script - ensures depositTx is nullable

import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not set - skipping DB fix');
  // Exit with 0 (success) so the app can still start
  process.exit(0);
}

const pool = new Pool({ connectionString: DATABASE_URL });

async function fixDatabase() {
  let client;
  const startTime = Date.now();
  try {
    // Set a 15 second timeout for DB operations
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Database fix timeout after 15s')), 15000)
    );
    
    const dbPromise = (async () => {
      client = await pool.connect();
      console.log('🔧 Attempting to fix database schema...');
      
      // Make depositTx nullable - ignore errors if already nullable
      try {
        await client.query(`
          ALTER TABLE "payment_links" ALTER COLUMN "depositTx" DROP NOT NULL
        `);
        console.log('✅ depositTx set to nullable');
      } catch (alterErr) {
        if (alterErr.code === '42P16') {
          console.log('✅ depositTx already nullable');
        } else {
          console.warn('⚠️ Could not modify depositTx:', alterErr.message);
        }
      }
    })();
    
    await Promise.race([dbPromise, timeout]);
  } catch (err) {
    if (err.message.includes('timeout')) {
      console.warn('⚠️ Database fix operation timed out - continuing anyway');
    } else {
      console.error('⚠️ DB connection failed:', err.message);
    }
  } finally {
    if (client) client.release();
    await pool.end();
    const duration = Date.now() - startTime;
    console.log(`✅ DB fix complete (${duration}ms)`);
  }
}

fixDatabase().catch(err => {
  console.error('⚠️ Fatal error in DB fix:', err.message);
  // Don't exit with error - allow server to start anyway
  process.exit(0);
});
