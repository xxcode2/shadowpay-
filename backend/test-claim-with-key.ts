// Test claim with the actual operator key
import pkg from '@prisma/client'
const { PrismaClient } = pkg
import { Keypair, PublicKey } from '@solana/web3.js'

const prisma = new PrismaClient()
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001'

// The operator secret key from user
const OPERATOR_SECRET_KEY = '202,253,170,66,13,249,5,244,144,34,221,242,253,51,43,127,183,179,0,3,132,4,141,59,184,253,97,178,118,162,10,183,121,216,5,154,48,225,152,218,225,167,29,90,22,182,250,212,238,25,239,61,124,168,183,52,34,0,81,176,243,87,144,4'

async function testClaim() {
  console.log('\n' + '='.repeat(70))
  console.log('🔑 OPERATOR KEY VERIFICATION & CLAIM TEST')
  console.log('='.repeat(70) + '\n')

  try {
    // Step 1: Verify operator key
    console.log('🔍 Step 1: Verifying operator key...')
    const keyArray = OPERATOR_SECRET_KEY.split(',').map(n => parseInt(n.trim(), 10))
    console.log(`   Elements: ${keyArray.length}`)
    
    const operatorKeypair = Keypair.fromSecretKey(new Uint8Array(keyArray))
    const operatorPubkey = operatorKeypair.publicKey.toString()
    console.log(`   ✅ Operator public key: ${operatorPubkey}`)

    // Step 2: Create test link
    console.log('\n📝 Step 2: Creating test link with deposit...')
    
    const linkId = `claim-test-${Date.now()}`
    const link = await prisma.paymentLink.create({
      data: {
        id: linkId,
        amount: 0.001,
        lamports: 1000000n,
        assetType: 'SOL',
        claimed: false,
        claimedBy: null,
        depositTx: `tx-${Date.now()}`,
        withdrawTx: null,
        encryptedUtxoPrivateKey: null,
        encryptionIv: null,
        encryptionSalt: null,
      }
    })
    console.log(`   ✅ Link created: ${link.id}`)
    console.log(`   Amount: ${link.amount} SOL`)
    console.log(`   Has depositTx: ${!!link.depositTx}`)

    // Step 3: Test claim endpoint
    console.log('\n🔓 Step 3: Testing claim endpoint against production...')
    
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
    
    if (response.ok) {
      console.log(`\n✅ CLAIM SUCCESSFUL!`)
      console.log(`   Amount: ${data.amount} SOL`)
      console.log(`   Withdraw TX: ${data.withdrawTx}`)
      console.log(`   Claimed by: ${data.recipientAddress}`)
    } else {
      console.log(`\n⚠️  Claim failed:`)
      console.log(`   Error: ${data.error}`)
      console.log(`   Details: ${data.details}`)
      if (data.hint) console.log(`   Hint: ${data.hint}`)
    }

    console.log('\n' + '='.repeat(70))
    console.log('✅ TEST COMPLETE')
    console.log('='.repeat(70) + '\n')

  } catch (err: any) {
    console.error('❌ Error:', err.message)
  } finally {
    await prisma.$disconnect()
  }
}

testClaim()
