/**
 * ✅ v8.0: CORRECT NON-CUSTODIAL FLOW
 * 
 * Frontend ONLY uses Privacy Cash SDK for withdrawal
 * Backend is metadata-only (claims & validates)
 * 
 * CORRECT FLOW:
 * 1. Frontend: Fetch link + validate
 * 2. Backend: Mark as claimed, return depositTx
 * 3. Frontend: Call Privacy Cash SDK.withdraw(depositTx)
 * 4. SDK: Handles encryption + ZK proof + relayer
 * 5. Relayer: Verifies & sends SOL to user wallet
 * 6. Done!
 */

import { PublicKey } from '@solana/web3.js'

export async function executeClaimLink(input: {
  linkId: string
  recipientAddress: string
  wallet: any // Phantom wallet
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

    // STEP 2: Mark link as claimed on backend
    console.log('STEP 2: Marking link as claimed...')

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
    console.log(`✅ Link marked as claimed!\n`)

    // STEP 3: Execute withdrawal via Privacy Cash SDK
    console.log('STEP 3: Executing withdrawal via Privacy Cash SDK...')
    console.log(`💸 Withdrawing ${linkData.amount} SOL to ${recipientAddress}\n`)

    let withdrawalTx = null

    try {
      // ✅ Get Privacy Cash SDK from window
      const PrivacyCash = (window as any).PrivacyCash
      if (!PrivacyCash) {
        throw new Error(
          'Privacy Cash SDK not loaded. Make sure Privacy Cash is installed via npm.'
        )
      }

      // ✅ Initialize SDK with user's wallet
      const client = new PrivacyCash({
        RPC_url: 'https://mainnet.helius-rpc.com/?api-key=c455719c-354b-4a44-98d4-27f8a18aa79c',
        owner: wallet.publicKey, // User's wallet public key (or Keypair if available)
      })

      // ✅ Execute withdrawal - SDK handles encryption, ZK proof, relayer call
      const withdrawResult = await client.withdraw({
        lamports: Math.floor((linkData.amount || 0) * 1e9), // Convert SOL to lamports
        recipientAddress: recipientAddress,
      })

      if (withdrawResult && withdrawResult.tx) {
        withdrawalTx = withdrawResult.tx
        console.log(`✅ Withdrawal successful!`)
        console.log(`📜 TX Hash: ${withdrawalTx}\n`)
      } else {
        throw new Error('No transaction returned from Privacy Cash SDK')
      }
    } catch (sdkErr: any) {
      console.error(`❌ SDK withdrawal error: ${sdkErr.message}`)
      throw new Error(
        `Withdrawal failed: ${sdkErr.message}. ` +
        `Make sure Privacy Cash SDK is properly installed and configured.`
      )
    }

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
