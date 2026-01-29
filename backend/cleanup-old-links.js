// Cleanup old test links that don't have depositTx
// This is for testing - remove old links created before migration
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function cleanup() {
  console.log('🧹 Cleaning up old test links without depositTx...')
  
  try {
    // Find all links without depositTx
    const oldLinks = await prisma.paymentLink.findMany({
      where: {
        OR: [
          { depositTx: null },
          { depositTx: '' }
        ]
      },
      select: {
        id: true,
        amount: true,
        createdAt: true,
        encryptedUtxoPrivateKey: true
      }
    })
    
    console.log(`\n📋 Found ${oldLinks.length} links without depositTx:`)
    oldLinks.forEach(link => {
      console.log(`   - ${link.id}`)
      console.log(`     Amount: ${link.amount} SOL`)
      console.log(`     Created: ${link.createdAt}`)
      console.log(`     Has encrypted key: ${!!link.encryptedUtxoPrivateKey}`)
    })
    
    if (oldLinks.length > 0) {
      // Delete them
      const result = await prisma.paymentLink.deleteMany({
        where: {
          OR: [
            { depositTx: null },
            { depositTx: '' }
          ]
        }
      })
      
      console.log(`\n✅ Deleted ${result.count} old links`)
    }
    
  } catch (err) {
    console.error('❌ Error:', err.message)
  } finally {
    await prisma.$disconnect()
  }
}

cleanup()
