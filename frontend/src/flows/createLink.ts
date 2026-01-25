/**
 * ✅ CORRECT ARCHITECTURE:
 * 1. Create link metadata on backend
 * 2. User deposits their own SOL directly (triggers Phantom popup!)
 * 3. Send depositTx to backend for recording
 * 4. Link is ready to claim
 */

import { executeRealDeposit } from './depositFlow.js'
import { LAMPORTS_PER_SOL } from '@solana/web3.js'

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
    if (import.meta.env.DEV) console.log(`📝 Creating payment link for ${amountSOL} SOL...`)
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
    if (import.meta.env.DEV) console.log(`✅ Link created: ${linkId}`)

    // 2️⃣ ✅ USER DIRECTLY PAYS FROM WALLET - This triggers Phantom popup!
    if (import.meta.env.DEV) console.log(`🔐 Requesting payment approval from wallet...`)
    const lamports = Math.round(amountSOL * LAMPORTS_PER_SOL)
    const { tx: depositTx } = await executeRealDeposit({ lamports, wallet })

    if (import.meta.env.DEV) console.log(`✅ User paid ${amountSOL} SOL directly! Transaction: ${depositTx}`)

    // 3️⃣ Record depositTx on backend (ONLY for recording, not execution)
    if (import.meta.env.DEV) console.log(`📝 Recording deposit transaction on backend...`)
    const recordRes = await fetch(`${BACKEND_URL}/api/deposit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        linkId,
        depositTx,
        amount: amountSOL,
        publicKey: wallet.publicKey.toString(),
      }),
    })

    if (!recordRes.ok) {
      throw new Error(`Failed to record deposit: ${recordRes.statusText}`)
    }

    if (import.meta.env.DEV) console.log(`✅ Deposit recorded on backend`)
    return { linkId, depositTx }
  } catch (err: any) {
    console.error('❌ CREATE LINK FLOW ERROR:', err.message || err)
    throw err
  }
}

