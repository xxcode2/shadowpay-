// Test full flow: Create Link → Deposit → Claim
import pkg from '@prisma/client'
const { PrismaClient } = pkg
import { PublicKey } from '@solana/web3.js'

const prisma = new PrismaClient()
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001'

async function testFullFlow() {
  console.log('\n' + '='.repeat(60))
  console.log('🧪 FULL FLOW TEST: Create Link → Deposit → Claim')
  console.log('='.repeat(60) + '\n')

  try {
    // Step 1: Create a payment link
    console.log('📝 Step 1: Creating payment link...')
    
    const linkData = {
      id: `test-flow-${Date.now()}`,
      amount: 0.001, // 0.001 SOL
      lamports: 1000000n,
      assetType: 'SOL',
      claimed: false,
      claimedBy: null,
      depositTx: null,
      withdrawTx: null,
      encryptedUtxoPrivateKey: null,
      encryptionIv: null,
      encryptionSalt: null,
    }

    const link = await prisma.paymentLink.create({
      data: linkData
    })

    console.log(`✅ Link created: ${link.id}`)
    console.log(`   Amount: ${link.amount} SOL`)
    console.log(`   Lamports: ${link.lamports}`)
    console.log(`   Has depositTx: ${!!link.depositTx}`)

    // Step 2: Simulate deposit (record it in DB)
    console.log('\n💰 Step 2: Recording deposit transaction...')
    
    const fakeTx = `test-deposit-${Date.now()}`
    
    const updated = await prisma.paymentLink.update({
      where: { id: link.id },
      data: {
        depositTx: fakeTx,
        updatedAt: new Date()
      }
    })

    console.log(`✅ Deposit recorded: ${updated.depositTx}`)
    console.log(`   Has depositTx: ${!!updated.depositTx}`)

    // Step 3: Simulate claim request
    console.log('\n🔓 Step 3: Testing claim endpoint...')
    
    const recipientAddress = 'c5DUNG7hMZy1CpH1ouLYnHHEcQNiEP3oiEQ8rLWeGPF'
    
    try {
      const response = await fetch(`${BACKEND_URL}/api/claim-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          linkId: link.id,
          recipientAddress
        })
      })

      const data = await response.json()

      if (response.ok) {
        console.log(`✅ Claim successful!`)
        console.log(`   Status: ${response.status}`)
        console.log(`   Amount received: ${data.amount} SOL`)
        console.log(`   Withdraw TX: ${data.withdrawTx}`)
      } else {
        console.log(`⚠️  Claim returned error:`)
        console.log(`   Status: ${response.status}`)
        console.log(`   Error: ${data.error}`)
        console.log(`   Details: ${data.details}`)
      }
    } catch (fetchErr: any) {
      console.error(`❌ Fetch error: ${fetchErr.message}`)
    }

    console.log('\n' + '='.repeat(60))
    console.log('✅ FULL FLOW TEST COMPLETE')
    console.log('='.repeat(60) + '\n')

  } catch (err: any) {
    console.error('❌ Test failed:', err.message)
    console.error(err.stack)
  } finally {
    await prisma.$disconnect()
  }
}

testFullFlow()
