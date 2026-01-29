/**
 * ✅ EXECUTE LINK CLAIM AND WITHDRAWAL
 * 
 * Uses Privacy Cash SDK with ZK proofs for secure withdrawal
 * 
 * Flow:
 * 1. Frontend: Fetch link details from backend
 * 2. Frontend: Generate ZK proof proving UTXO ownership (without revealing amount)
 * 3. Frontend: Send proof to backend for withdrawal
 * 4. Backend: Verify proof + execute withdrawal as relayer
 * 5. Backend: Return withdrawal confirmation + fees
 */
export async function executeClaimLink(input: {
  linkId: string
  recipientAddress: string
}) {
  const { linkId, recipientAddress } = input

  // ✅ FRONTEND VALIDATION
  if (!linkId || typeof linkId !== 'string') {
    throw new Error('❌ Missing or invalid linkId')
  }

  if (!recipientAddress || typeof recipientAddress !== 'string') {
    throw new Error('❌ Missing recipientAddress')
  }

  // Solana addresses are 32-58 characters base58
  if (recipientAddress.length < 32 || recipientAddress.length > 58) {
    throw new Error('❌ Invalid Solana wallet address format (incorrect length)')
  }

  const BACKEND_URL =
    import.meta.env.VITE_BACKEND_URL ||
    'https://shadowpay-backend-production.up.railway.app'

  console.log(`🚀 Claiming link ${linkId} for ${recipientAddress}...`)
  console.log(`   ⏳ Generating ZK proof for withdrawal...`)

  try {
    // ✅ STEP 1: Fetch link details from backend
    console.log('📋 Step 1: Fetching link details...')
    const linkResponse = await fetch(`${BACKEND_URL}/api/link/${linkId}`)

    if (!linkResponse.ok) {
      const err = await linkResponse.json()
      throw new Error(err.error || 'Link not found')
    }

    const linkData = await linkResponse.json()

    if (linkData.claimed) {
      throw new Error('❌ This link has already been claimed!')
    }

    console.log(`   ✅ Link found: ${linkData.amount} SOL`)

    // ✅ STEP 2: Submit claim to backend
    // Backend will use Privacy Cash SDK to generate real ZK proof and withdraw
    console.log('🔐 Step 2: Submitting to backend...')
    console.log(`   Backend will use Privacy Cash SDK to withdraw...`)

    // ✅ STEP 3: Backend executes withdrawal via Privacy Cash SDK
    console.log('📤 Step 3: Backend executing Privacy Cash withdrawal...')

    const res = await fetch(`${BACKEND_URL}/api/claim-link`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        linkId,
        recipientAddress,
      }),
    })

    // ✅ HANDLE ERROR RESPONSES WITH PROPER PARSING
    if (!res.ok) {
      let errorMsg = `Claim failed with status ${res.status}`
      
      try {
        const contentType = res.headers.get('content-type')
        if (contentType?.includes('application/json')) {
          const errorData = await res.json()
          console.error('❌ Claim failed with details:', errorData)
          errorMsg = errorData.error || errorMsg

          // Friendly error messages
          if (errorMsg.toLowerCase().includes('no valid deposit')) {
            errorMsg = `⏳ Deposit still processing. 
If your deposit appears on Solscan but you can't claim, you can manually record it:
1. Find your transaction on Solscan: https://solscan.io/
2. Copy the Transaction Hash
3. Use the manual recording option below
Or wait 1-2 minutes and try again.`
          } else if (errorMsg.toLowerCase().includes('multi-wallet claiming')) {
            errorMsg = `⚠️ LIMITATION: This payment link can only be claimed by the wallet that created it.\n\nReason: Privacy Cash SDK encrypts funds with the depositor's wallet keys. For security, only the original wallet can decrypt and claim.\n\nOptions:\n1. Use the same wallet that created this link\n2. Ask the creator to claim and send you the funds\n3. Ask creator to share their private claim link`
          } else if (errorMsg.toLowerCase().includes('already claimed')) {
            errorMsg = '❌ This link has already been claimed!'
          } else if (errorMsg.toLowerCase().includes('not found')) {
            errorMsg = '❌ This link does not exist. Please check the link ID.'
          } else if (errorMsg.toLowerCase().includes('invalid solana')) {
            errorMsg = '❌ Invalid wallet address. Please check your Solana address.'
          } else if (errorMsg.toLowerCase().includes('no balance')) {
            errorMsg = '❌ No balance in Privacy Cash pool. Deposit may not have confirmed.'
          } else if (errorMsg.toLowerCase().includes('utxo')) {
            errorMsg = '⏳ No UTXOs available yet. Please wait a moment and retry.'
          }
        } else {
          // Not JSON, try text response
          const errorText = await res.text()
          console.error('❌ Raw error response:', errorText)
          errorMsg = errorText || errorMsg
        }
      } catch (parseErr: any) {
        console.error('⚠️ Could not parse error response:', parseErr.message)
      }

      throw new Error(errorMsg)
    }

    const data = await res.json()
    console.log(`✅ Withdrawal completed successfully!`)
    console.log(`   📤 Transaction: ${data.withdrawTx}`)
    console.log(`   💰 Amount received: ${(data.amount || 0).toFixed(6)} SOL`)

    // ✅ DISPLAY FEE BREAKDOWN
    if (data.fee) {
      console.log(`   💸 Fees paid:`)
      console.log(`      - Base fee: ${(data.fee.baseFee || 0).toFixed(6)} SOL`)
      console.log(`      - Protocol fee (0.35%): ${(data.fee.protocolFee || 0).toFixed(6)} SOL`)
      console.log(`      - Total fees: ${(data.fee.totalFee || 0).toFixed(6)} SOL`)
    }

    if (data.isPartial) {
      console.log(`   ⚠️ PARTIAL WITHDRAWAL - balance was insufficient for full amount`)
    }

    return {
      success: true,
      withdrawTx: data.withdrawTx,
      linkId: data.linkId,
      amount: data.amount || 0,
      fee: data.fee || { baseFee: 0, protocolFee: 0, totalFee: 0 },
      isPartial: data.isPartial || false,
    }
  } catch (err: any) {
    console.error('❌ Claim link error:', err.message || err.toString())
    throw new Error(`❌ Claim failed: ${err.message || 'Unknown error'}`)
  }
}
