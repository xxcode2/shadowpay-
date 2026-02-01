/**
 * ✅ USER-CENTRIC DEPOSIT ARCHITECTURE
 * 
 * Flow:
 * 1. Create link metadata on backend
 * 2. User signs deposit transaction in their wallet
 * 3. Backend relays signed transaction to Privacy Cash
 * 4. Funds go directly to Privacy Cash pool (not operator)
 * 
 * Non-custodial: Operator never holds user funds
 */

import { LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js'
import { executeUserPaysDeposit } from './depositFlow'

export interface SigningWallet {
  publicKey: { toString(): string }
  signMessage(message: Uint8Array): Promise<Uint8Array>
  signTransaction?: (transaction: any) => Promise<any>
}

export async function createLink({
  amountSOL,
  wallet,
}: {
  amountSOL: number
  wallet: SigningWallet
}): Promise<{ linkId: string; depositTx: string }> {
  const BACKEND_URL =
    import.meta.env.VITE_BACKEND_URL ||
    'https://shadowpay-backend-production.up.railway.app'

  try {
    // 1️⃣ CREATE LINK METADATA ON BACKEND
    console.log(`📝 Creating payment link for ${amountSOL} SOL...`)
    const walletAddress = wallet.publicKey.toString()
    console.log(`   Creator: ${walletAddress}`)
    
    const createRes = await fetch(`${BACKEND_URL}/api/create-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: amountSOL,
        assetType: 'SOL',
        creatorAddress: walletAddress, // ✅ NEW: Send creator address
      }),
    })

    if (!createRes.ok) {
      throw new Error(`Create link failed: ${createRes.statusText}`)
    }

    const { linkId } = await createRes.json()
    console.log(`✅ Link created: ${linkId}`)

    // 2️⃣ USER SIGNS DEPOSIT TRANSACTION (Non-Custodial)
    console.log(`💰 Processing payment...`)
    console.log(`   📋 Step 1: Building deposit transaction`)
    console.log(`   🔐 Step 2: User signs in wallet`)
    console.log(`   📤 Step 3: Backend relays to Privacy Cash`)

    const amountStr = amountSOL.toString()

    // ✅ Create proper wallet adapter with PublicKey
    const walletAdapter = {
      publicKey: new PublicKey(walletAddress),
      signMessage: wallet.signMessage,
      signTransaction: wallet.signTransaction || (async (tx: any) => tx)
    }

    // ✅ USER SIGNS & DEPOSITS - FUNDS GO DIRECTLY TO PRIVACY CASH POOL
    const depositTx = await executeUserPaysDeposit(
      {
        linkId,
        amount: amountStr,
        publicKey: walletAddress,
      },
      walletAdapter
    )

    console.log(`✅ User deposited ${amountSOL} SOL directly to Privacy Cash pool`)
    console.log(`✅ Link ready! Transaction: ${depositTx}`)
    return { linkId, depositTx }
  } catch (err: any) {
    console.error('❌ CREATE LINK ERROR:', err.message || err.toString())
    throw err
  }
}

