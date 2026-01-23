#!/usr/bin/env node
// Direct database fix script - ensures depositTx is nullable

import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not set');
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });

async function fixDatabase() {
  const client = await pool.connect();
  try {
    console.log('🔧 Fixing database schema...');
    
    // Check current constraint
    const result = await client.query(`
      SELECT constraint_name, constraint_type
      FROM information_schema.table_constraints
      WHERE table_name = 'payment_links' AND column_name = 'depositTx'
    `);
    
    console.log('Current constraints:', result.rows);
    
    // Make depositTx nullable
    await client.query(`
      ALTER TABLE "payment_links" ALTER COLUMN "depositTx" DROP NOT NULL
    `);
    
    console.log('✅ Database fixed - depositTx is now nullable');
  } catch (err) {
    if (err.code === '42P16') {
      console.log('✅ depositTx already nullable');
    } else {
      console.error('❌ Error:', err.message);
      throw err;
    }
  } finally {
    client.release();
    await pool.end();
  }
}

fixDatabase().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
