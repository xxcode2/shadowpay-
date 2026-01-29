/**
 * ✅ v6.0: CLAIM + WITHDRAW FLOW
 * 
 * Backend handles BOTH:
 * 1. Marks link as claimed
 * 2. Executes withdrawal to recipient wallet
 * 
 * 2-STEP PROCESS:
 * 1. Fetch link details
 * 2. Claim + Withdraw (backend does both)
 */

import { PublicKey } from '@solana/web3.js'

export async function executeClaimLink(input: {
  linkId: string
  recipientAddress: string
}) {
  const { linkId, recipientAddress } = input

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
  console.log('📋 CLAIMING PAYMENT LINK')
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

    console.log(`✅ Found: ${linkData.amount} SOL\n`)

    // STEP 2: Claim + Withdraw (backend does both)
    console.log('STEP 2: Claiming link and withdrawing funds...')

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

    console.log(`✅ Link claimed successfully!`)
    console.log(`📤 Funds withdrawn to wallet!\n`)

    // SUCCESS - show final result
    console.log('='.repeat(70))
    console.log('✅ LINK CLAIMED & WITHDRAWN!')
    console.log('='.repeat(70))
    console.log(`\n💰 Amount: ${claimData.amount} SOL`)
    console.log(`📍 Deposit TX: ${claimData.depositTx}`)
    console.log(`💸 Withdrawal TX: ${claimData.withdrawalTx}`)
    console.log(`⏰ Claimed at: ${claimData.claimedAt}`)
    console.log('\n✨ Funds are now in your wallet!')

    console.log('\n' + '='.repeat(70) + '\n')

    return {
      success: true,
      claimed: true,
      withdrawn: true,
      linkId,
      amount: claimData.amount,
      depositTx: claimData.depositTx,
      recipientAddress,
      claimedAt: claimData.claimedAt,
      withdrawalTx: claimData.withdrawalTx,
      message: '✅ Link claimed & funds withdrawn to your wallet!',
    }

  } catch (err: any) {
    console.error('❌ Error:', err.message)
    throw new Error(`❌ ${err.message || 'Unknown error'}`)
  }
}
