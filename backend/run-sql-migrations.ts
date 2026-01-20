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
      
      console.log('📍 Checking database connection...');
      const result = await client.query('SELECT NOW()');
      console.log('✅ Database connected');
      
      // Run each statement separately to handle idempotency
      const statements = sql.split(';').filter(stmt => stmt.trim());
      
      for (const statement of statements) {
        if (!statement.trim()) continue;
        
        try {
          console.log(`📝 Running: ${statement.substring(0, 50)}...`);
          await client.query(statement);
        } catch (error: any) {
          // If table already exists, that's okay
          if (error.code === '42P07') {
            console.log('   ℹ️  Table already exists, skipping...');
          } else {
            throw error;
          }
        }
      }
      
      console.log('✅ Migrations completed successfully!');
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('❌ Migration failed:', error);
    // Don't exit with error - let server start anyway
    console.error('⚠️  Continuing with server startup...');
  } finally {
    await pool.end();
  }
}

runMigrations();
