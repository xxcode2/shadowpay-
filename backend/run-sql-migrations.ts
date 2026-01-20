import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not set');
  process.exit(1);
}

const pool = new Pool({ 
  connectionString: DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function runMigrations() {
  try {
    console.log('🗄️  Running migrations...');
    
    const client = await pool.connect();
    
    try {
      // Read the migration file
      const sqlPath = path.join(process.cwd(), 'prisma', 'migrations', '0_init', 'migration.sql');
      const sql = fs.readFileSync(sqlPath, 'utf-8');
      
      console.log('📍 Executing SQL...');
      await client.query(sql);
      
      console.log('✅ Migrations completed successfully!');
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigrations();
