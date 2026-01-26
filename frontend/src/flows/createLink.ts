/**
 * ✅ CORRECT ARCHITECTURE WITH BACKEND EXECUTION:
 * 1. Create link metadata on backend
 * 2. User signs authorization message (NOT transaction)
 * 3. Frontend sends authorization + amount to backend
 * 4. Backend executes transfer with authenticated RPC
 * 5. Backend records transaction hash
 * 
 * Benefits:
 * - Backend has RPC API key (safe in env variables)
 * - Frontend doesn't need direct RPC access
 * - Clear separation of concerns
 */

import { LAMPORTS_PER_SOL } from '@solana/web3.js'
import { executeRealDeposit } from './depositFlow'

export interface SigningWallet {
  publicKey: { toString(): string }
  signMessage(message: Uint8Array): Promise<Uint8Array>
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
    // 1️⃣ Create link metadata on backend
    console.log(`📝 Creating payment link for ${amountSOL} SOL...`)
    const createRes = await fetch(`${BACKEND_URL}/api/create-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: amountSOL,
        assetType: 'SOL',
      }),
    })

    if (!createRes.ok) {
      throw new Error(`Create link failed: ${createRes.statusText}`)
    }

    const { linkId } = await createRes.json()
    console.log(`✅ Link created: ${linkId}`)

    // 2️⃣ USER SIGNS AUTHORIZATION + BACKEND EXECUTES DEPOSIT
    console.log(`💰 Processing payment...`)
    console.log(`   You will see Phantom popup: "Authorize ${amountSOL} SOL deposit to Privacy Cash pool"`)
    const lamports = Math.round(amountSOL * LAMPORTS_PER_SOL)
    
    // Frontend: Sign authorization message + send to backend
    // Backend: Execute transfer with authenticated RPC + record transaction
    const { tx: depositTx } = await executeRealDeposit({ 
      lamports, 
      wallet: wallet as any,
      linkId
    })
    
    console.log(`✅ Deposit executed by backend: ${depositTx}`)
    console.log(`✅ ${amountSOL} SOL transferred to Privacy Cash pool`)

    console.log(`✅ Link ready! Transaction recorded: ${depositTx}`)
    return { linkId, depositTx }
  } catch (err: any) {
    console.error('❌ CREATE LINK ERROR:', err.message || err.toString())
    throw err
  }
}

