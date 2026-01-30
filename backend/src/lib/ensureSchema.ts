/**
 * Checks if database schema is up-to-date
 * This is a safety net for production deployments
 * 
 * Checks for:
 * 1. lamports column in payment_links
 * 2. savings tables for the savings feature
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function ensureDbSchema() {
  try {
    console.log('🔍 Checking database schema...')
    
    // Check if payment_links has lamports column
    try {
      await prisma.$queryRaw`SELECT lamports FROM "payment_links" LIMIT 1`
      console.log('✅ payment_links table has lamports column')
    } catch (err: any) {
      if (err.message.includes('lamports')) {
        console.log('⚠️  Adding lamports column to payment_links...')
        await prisma.$executeRawUnsafe(
          `ALTER TABLE "payment_links" ADD COLUMN IF NOT EXISTS "lamports" BIGINT`
        )
        console.log('✅ lamports column added')
      }
    }
    
    // Check if savings tables exist
    try {
      await prisma.$queryRaw`SELECT id FROM "savings" LIMIT 1`
      console.log('✅ savings table exists')
    } catch (err: any) {
      if (err.message.includes('does not exist') || err.code === 'P2021') {
        console.log('⚠️  Savings tables not found')
        console.log('   Run: npx prisma migrate deploy')
        console.log('   Or restart the application which will auto-migrate')
      }
    }
    
    console.log('✅ Database schema check complete')
    return true
    
  } catch (err: any) {
    console.error('❌ Schema check error:', err.message)
    console.log('⚠️  Continuing anyway...')
    return false
    
  } finally {
    await prisma.$disconnect()
  }
}

