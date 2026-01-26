import { LAMPORTS_PER_SOL } from '@solana/web3.js'
import { CONFIG } from '../config'

/**
 * ✅ FRONTEND CLAIM LINK FLOW
 * 
 * Frontend Role:
 * - User selects recipient address
 * - Frontend sends claim request to backend
 * - Backend (RELAYER) executes Privacy Cash withdraw
 * 
 * Backend Role (RELAYER):
 * - Get link details dari database
 * - Use PrivacyCash SDK to withdraw dari pool
 * - Send funds ke recipient address
 * - Record transaction
 * 
 * Privacy:
 * - On-chain transaction shows no link ke original depositor
 * - Zero-knowledge proof ensures recipient/amount cannot be modified
 */

export interface ClaimLinkRequest {
  linkId: string
  recipientAddress: string
}

export interface WithdrawalResult {
  success: boolean
  withdrawTx: string
  linkId: string
  amount: number
  fee: {
    baseFee: number
    protocolFee: number
    totalFee: number
  }
}

export async function executeClaimLink({
  linkId,
  recipientAddress,
}: ClaimLinkRequest): Promise<WithdrawalResult> {
  // ✅ VALIDATION
  if (!linkId || typeof linkId !== 'string') {
    throw new Error('❌ Missing or invalid linkId')
  }

  if (!recipientAddress || typeof recipientAddress !== 'string') {
    throw new Error('❌ Missing recipientAddress')
  }

  // Solana addresses are 32-58 characters base58
  if (recipientAddress.length < 32 || recipientAddress.length > 58) {
    throw new Error('❌ Invalid Solana wallet address format')
  }

  const BACKEND_URL =
    import.meta.env.VITE_BACKEND_URL ||
    'https://shadowpay-backend-production.up.railway.app'

  console.log(`🚀 Claiming link ${linkId}...`)
  console.log(`   📤 Recipient: ${recipientAddress}`)
  console.log(`   ⏳ Backend will execute withdrawal via Privacy Cash SDK...`)

  try {
    const res = await fetch(`${BACKEND_URL}/api/claim-link`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        linkId,
        recipientAddress,
      }),
    })

    // ✅ HANDLE ERRORS WITH FRIENDLY MESSAGES
    if (!res.ok) {
      let errorMsg = `Claim failed with status ${res.status}`

      try {
        const contentType = res.headers.get('content-type')
        if (contentType?.includes('application/json')) {
          const errorData = await res.json()
          console.error('❌ Backend error:', errorData)
          errorMsg = errorData.error || errorMsg

          // Friendly error messages
          if (errorMsg.toLowerCase().includes('no valid deposit')) {
            errorMsg = '⏳ Deposit still processing. Please wait a minute and try again.'
          } else if (errorMsg.toLowerCase().includes('already claimed')) {
            errorMsg = '❌ This link has already been claimed!'
          } else if (errorMsg.toLowerCase().includes('not found')) {
            errorMsg = '❌ This link does not exist. Check the link ID.'
          } else if (errorMsg.toLowerCase().includes('invalid solana')) {
            errorMsg = '❌ Invalid wallet address. Check your Solana address.'
          } else if (errorMsg.toLowerCase().includes('no balance')) {
            errorMsg = '❌ No balance available in Privacy Cash pool for withdrawal.'
          } else if (errorMsg.toLowerCase().includes('utxo')) {
            errorMsg = '⏳ No UTXOs available. Wait a bit for transactions to confirm.'
          }
        } else {
          const errorText = await res.text()
          console.error('❌ Raw response:', errorText)
          errorMsg = errorText || errorMsg
        }
      } catch (parseErr: any) {
        console.error('⚠️ Could not parse error:', parseErr.message)
      }

      throw new Error(errorMsg)
    }

    const data = await res.json()
    console.log(`✅ Withdrawal successful!`)
    console.log(`   📤 Transaction: ${data.withdrawTx}`)
    console.log(`   💰 Amount: ${(data.amount || 0).toFixed(6)} SOL`)

    if (data.fee) {
      const totalFee = (data.fee.baseFee || 0) + (data.fee.protocolFee || 0)
      console.log(`   💸 Fees:`)
      console.log(`      - Base: ${(data.fee.baseFee || 0).toFixed(6)} SOL`)
      console.log(`      - Protocol: ${(data.fee.protocolFee || 0).toFixed(6)} SOL`)
      console.log(`      - Total: ${totalFee.toFixed(6)} SOL`)
    }

    return {
      success: true,
      withdrawTx: data.withdrawTx,
      linkId: data.linkId,
      amount: data.amount || 0,
      fee: {
        baseFee: data.fee?.baseFee || 0,
        protocolFee: data.fee?.protocolFee || 0,
        totalFee: (data.fee?.baseFee || 0) + (data.fee?.protocolFee || 0),
      },
    }
  } catch (err: any) {
    console.error('❌ Claim link error:', err.message || err.toString())
    throw new Error(`❌ Claim failed: ${err.message || 'Unknown error'}`)
  }
}
