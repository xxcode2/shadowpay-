/**
 * ✅ CORRECT ARCHITECTURE SESUAI PRIVACY CASH DOCUMENTATION:
 * 1. Create link metadata on backend
 * 2. ✅ USER EXECUTES DEPOSIT DIRECTLY VIA FRONTEND (PrivacyCash SDK + Phantom popup)
 * 3. Backend ONLY records transaction hash (no execution)
 * 4. Link ready to claim
 * 
 * KEY DIFFERENCE FROM OLD CODE:
 * - OLD: User sign message → Backend execute → Operator wallet pays
 * - NEW: User execute deposit directly → Phantom popup → User pays directly
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

    // 2️⃣ ✅ USER LANGSUNG BAYAR KE PRIVACY CASH POOL
    // ✅ INI YANG AKAN MUNCULKAN POPUP PHANTOM UNTUK APPROVAL TRANSAKSI
    console.log(`💰 Processing payment...`)
    console.log(`   You will see Phantom popup: "Approve transaction: ${amountSOL} SOL to Privacy Cash pool"`)
    const lamports = Math.round(amountSOL * LAMPORTS_PER_SOL)
    const { tx: depositTx } = await executeRealDeposit({ lamports, wallet: wallet as any })
    
    console.log(`✅ User paid ${amountSOL} SOL directly to Privacy Cash pool`)

    // 3️⃣ ✅ KIRIM HASIL KE BACKEND HANYA UNTUK RECORD
    console.log(`📤 Recording transaction on backend...`)
    const recordRes = await fetch(`${BACKEND_URL}/api/deposit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        linkId,
        depositTx, // HANYA RECORD TX HASH, BUKAN EKSEKUSI
        amount: amountSOL,
        publicKey: wallet.publicKey.toString()
      }),
    })

    if (!recordRes.ok) {
      const errorText = await recordRes.text()
      throw new Error(`Failed to record deposit: ${errorText || recordRes.statusText}`)
    }

    console.log(`✅ Link ready! Transaction recorded: ${depositTx}`)
    return { linkId, depositTx }
  } catch (err: any) {
    console.error('❌ CREATE LINK ERROR:', err.message || err.toString())
    throw err
  }
}

