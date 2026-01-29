/**
 * ✅ v11.0: SIMPLIFIED BACKEND-WITHDRAW APPROACH
 * 
 * Proven Working & Realistic:
 * 1. Frontend: Connect wallet + request claim
 * 2. Backend: Validate + execute withdrawal (using operator keypair)
 * 3. Relayer: Verify + execute transaction
 * 4. User: Receive SOL
 * 
 * FLOW:
 * 1. Frontend: Fetch link
 * 2. Frontend: POST /claim-link with recipientAddress
 * 3. Backend: Validate link exists & not claimed
 * 4. Backend: Initialize PrivacyCash with operator keypair
 * 5. Backend: Execute withdrawal to recipient
 * 6. Backend: Mark claimed + save TX hash
 * 7. Frontend: Show success ✅
 */

import { PublicKey } from '@solana/web3.js'

export async function executeClaimLink(input: {
  linkId: string
  recipientAddress: string
  wallet: any // Phantom wallet (just for connection verification)
}) {
  const { linkId, recipientAddress, wallet } = input

  // ✅ VALIDATION
  if (!linkId || typeof linkId !== 'string') {
    throw new Error('❌ Missing or invalid linkId')
  }

  if (!recipientAddress || typeof recipientAddress !== 'string') {
    throw new Error('❌ Missing or invalid wallet address')
  }

  if (recipientAddress.length < 32 || recipientAddress.length > 58) {
    throw new Error('❌ Invalid Solana wallet address')
  }

  const BACKEND_URL =
    import.meta.env.VITE_BACKEND_URL ||
    'https://shadowpay-backend-production.up.railway.app'

  console.log('\n' + '='.repeat(70))
  console.log('🔐 CLAIMING & WITHDRAWING PAYMENT LINK')
  console.log('='.repeat(70) + '\n')
  console.log(`🔗 Link ID: ${linkId}`)
  console.log(`📱 Recipient: ${recipientAddress}\n`)

  try {
    // STEP 1: Fetch link details
    console.log('STEP 1: Fetching link details...')
    const linkResponse = await fetch(`${BACKEND_URL}/api/link/${linkId}`)

    if (!linkResponse.ok) {
      const err = await linkResponse.json()
      throw new Error(err.error || 'Link not found')
    }

    const linkData = await linkResponse.json()

    if (linkData.claimed) {
      throw new Error('❌ This link has already been claimed!')
    }

    console.log(`✅ Found: ${linkData.amount} SOL`)
    console.log(`📍 Deposit TX: ${linkData.depositTx}\n`)

    // ✅ STEP 2: REQUEST BACKEND TO EXECUTE WITHDRAWAL
    console.log('STEP 2: Requesting backend to execute withdrawal...')
    console.log(`💸 Withdrawing ${linkData.amount} SOL to ${recipientAddress}\n`)

    const claimRes = await fetch(`${BACKEND_URL}/api/claim-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        linkId,
        recipientAddress,
      }),
    })

    if (!claimRes.ok) {
      let errorMsg = `Claim failed with status ${claimRes.status}`
      try {
        const contentType = claimRes.headers.get('content-type')
        if (contentType?.includes('application/json')) {
          const errorData = await claimRes.json()
          errorMsg = errorData.error || errorMsg
        }
      } catch {}
      throw new Error(errorMsg)
    }

    const claimData = await claimRes.json()
    
    if (!claimData.success) {
      throw new Error(claimData.error || 'Claim failed')
    }

    const withdrawalTx = claimData.withdrawalTx || claimData.withdrawTx

    console.log(`✅ Withdrawal successful!`)
    console.log(`📜 TX Hash: ${withdrawalTx}\n`)

    // ✅ SUCCESS
    console.log('='.repeat(70))
    console.log('✅ LINK CLAIMED & FUNDS WITHDRAWN!')
    console.log('='.repeat(70))
    console.log(`\n💰 Amount: ${linkData.amount} SOL`)
    console.log(`📍 Deposit TX: ${linkData.depositTx}`)
    console.log(`📤 Withdrawal TX: ${withdrawalTx}`)
    console.log(`⏰ Claimed at: ${claimData.claimedAt}`)
    console.log('\n✨ Funds are now in your wallet!')
    console.log('\n' + '='.repeat(70) + '\n')

    return {
      success: true,
      claimed: true,
      withdrawn: true,
      linkId,
      amount: linkData.amount,
      depositTx: linkData.depositTx,
      withdrawalTx: withdrawalTx,
      recipientAddress,
      claimedAt: claimData.claimedAt,
      message: '✅ Link claimed & funds withdrawn to your wallet!',
    }
  } catch (err: any) {
    console.error('❌ Error:', err.message)
    throw new Error(`❌ ${err.message || 'Unknown error'}`)
  }
}
