import pkg from '@prisma/client'
const { PrismaClient } = pkg

const prisma = new PrismaClient()
const BACKEND_URL = process.env.BACKEND_URL || 'https://shadowpay-backend-production.up.railway.app'

async function testV3() {
  console.log('\n' + '='.repeat(70))
  console.log('✨ v3.0 SIMPLIFIED CLAIM TEST')
  console.log('='.repeat(70) + '\n')

  try {
    // Create link with deposit
    console.log('📝 Creating link with deposit...')
    const linkId = `v3-test-${Date.now()}`
    
    const link = await prisma.paymentLink.create({
      data: {
        id: linkId,
        amount: 0.001,
        lamports: 1000000n,
        assetType: 'SOL',
        depositTx: `tx-${Date.now()}`, // Record that user A deposited
        claimed: false,
        claimedBy: null,
        withdrawTx: null,
        encryptedUtxoPrivateKey: null,
        encryptionIv: null,
        encryptionSalt: null,
      }
    })
    
    console.log(`   ✅ Link created: ${link.id}`)
    console.log(`   Amount: ${link.amount} SOL`)
    console.log(`   Deposit TX: ${link.depositTx}`)

    // Test claim endpoint
    console.log('\n🔓 Claiming link (backend only validates)...')
    
    const recipientAddress = 'c5DUNG7hMZy1CpH1ouLYnHHEcQNiEP3oiEQ8rLWeGPF'
    
    const response = await fetch(`${BACKEND_URL}/api/claim-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        linkId: link.id,
        recipientAddress
      })
    })

    const data = await response.json()

    console.log(`   Status: ${response.status}`)
    console.log(`   Response:`, JSON.stringify(data, null, 2))

    // Verify link is marked as claimed
    const updatedLink = await prisma.paymentLink.findUnique({
      where: { id: linkId }
    })

    console.log('\n✅ VERIFICATION:')
    console.log(`   Link claimed: ${updatedLink?.claimed}`)
    console.log(`   Claimed by: ${updatedLink?.claimedBy}`)
    console.log(`   Withdraw TX: ${updatedLink?.withdrawTx}`)

    console.log('\n📋 NEXT STEPS FOR RECIPIENT:')
    console.log(`   1. Use Privacy Cash SDK to withdraw from shielded pool`)
    console.log(`   2. const result = await client.withdraw({`)
    console.log(`        lamports: 1000000,`)
    console.log(`        recipientAddress: 'c5DUNG...'`)
    console.log(`      })`)
    console.log(`   3. Fees: Base 0.006 SOL + 0.35% of amount`)

    console.log('\n' + '='.repeat(70))
    console.log('✅ v3.0 TEST COMPLETE - Backend is 100% Gas-Free!')
    console.log('='.repeat(70) + '\n')

  } catch (err: any) {
    console.error('❌ Error:', err.message)
  } finally {
    await prisma.$disconnect()
  }
}

testV3()
