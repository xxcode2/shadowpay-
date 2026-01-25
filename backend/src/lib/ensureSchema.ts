/**
 * Checks if lamports column exists, if not runs migration
 * This is a safety net for production deployments
 * 
 * Uses separate SQL statements to avoid "multiple commands" error
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function ensureDbSchema() {
  try {
    console.log('🔍 Checking database schema...')
    
    // Try a simple query to check if lamports column exists
    await prisma.$queryRaw`SELECT lamports FROM "payment_links" LIMIT 1`
    
    console.log('✅ Database schema is up-to-date (lamports column exists)')
    return true
  } catch (err: any) {
    if (err.message.includes('does not exist') || err.message.includes('lamports')) {
      console.log('⚠️  Database schema is outdated, running migrations...')
      try {
        // Execute each ALTER TABLE separately - PostgreSQL doesn't allow multiple statements in prepared statement
        console.log('  → Adding lamports column to payment_links...')
        await prisma.$executeRawUnsafe(
          `ALTER TABLE "payment_links" ADD COLUMN IF NOT EXISTS "lamports" BIGINT`
        )
        
        console.log('  → Adding lamports column to transactions...')
        await prisma.$executeRawUnsafe(
          `ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "lamports" BIGINT`
        )
        
        console.log('✅ Database schema updated successfully')
        return true
      } catch (migErr: any) {
        console.error('❌ Failed to update schema:', migErr.message)
        console.log('⚠️  Continuing anyway - schema might already be updated')
        return false
      }
    }
    console.error('❌ Unexpected error:', err.message)
    throw err
  } finally {
    await prisma.$disconnect()
  }
}
