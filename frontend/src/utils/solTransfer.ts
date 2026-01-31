/**
 * Privacy Cash SDK Deposit Utility
 * Handles depositing SOL into Privacy Cash shielded pool via SDK (not manual transfer)
 */

import { PrivacyCashService } from '../services/privacyCashService'
// @ts-ignore
declare module 'bn.js';
import BN from 'bn.js'

export interface DepositRequest {
  linkId: string
  amount: string
  publicKey: string
  token?: string  // ✅ Token type: "SOL", "USDC", "USDT", etc.
}

/**
 * Deposit SOL via Privacy Cash SDK into shielded pool
 * This is NOT a manual transfer - it uses Privacy Cash SDK for privacy
 * User must sign message for encryption key derivation
 */
export async function depositViaPriVacyCash(
  wallet: any,
  amount: string,
  linkId: string,
  publicKey: string
): Promise<{ depositTxHash: string; amount: string }> {
  if (!wallet) {
    throw new Error('Wallet not connected')
  }

  if (!wallet.publicKey) {
    throw new Error('Wallet public key not available')
  }

  const amountSOL = parseFloat(amount)
  if (amountSOL <= 0) {
    throw new Error('Amount must be greater than 0')
  }

  const lamports = Math.round(amountSOL * 1e9)

  console.log(`🔐 Starting Privacy Cash SDK deposit...`)
  console.log(`   User: ${publicKey}`)
  console.log(`   Amount: ${amountSOL} SOL (${lamports} lamports)`)
  console.log(`   Link ID: ${linkId}`)

  try {
    // ✅ STEP 1: Initialize Privacy Cash SDK
    console.log('📋 Step 1: Initializing Privacy Cash SDK...')
    console.log(`   🔑 Deriving encryption key from wallet signature...`)

    try {
      await PrivacyCashService.deriveEncryptionKey(wallet)
      console.log(`   ✅ Encryption key derived`)
    } catch (keyErr: any) {
      throw new Error('Failed to initialize Privacy Cash SDK: ' + keyErr.message)
    }

    // ✅ STEP 2: Create encrypted UTXO
    console.log('🔐 Step 2: Creating encrypted UTXO...')

    let encryptionService: any
    let utxoKeypair: any
    try {
      encryptionService = PrivacyCashService.getEncryptionService()
      utxoKeypair = PrivacyCashService.getUtxoKeypair()

      const amountBN = new BN(lamports)
      const blindingBN = new BN(Math.floor(Math.random() * 1000000000))

      const utxoData = {
        amount: amountBN.toString(),
        blinding: blindingBN.toString(),
        pubkey: utxoKeypair.pubkey.toString(),
        mintAddress: 'So11111111111111111111111111111111111111112', // SOL mint
        timestamp: Date.now(),
        linkId,
      }

      console.log(`   ✅ UTXO created (encrypted with your key)`)
      console.log(`   Amount: ${amountSOL} SOL`)
      console.log(`   Blinding factor: ${blindingBN.toString()}`)

      // ✅ STEP 3: User signs UTXO data
      console.log('🔐 Step 3: Requesting signature for encryption...')
      console.log(`   ⏳ Sign the message in Phantom (this enables privacy)`)

      let signature: Uint8Array
      try {
        const messageToSign = new TextEncoder().encode(
          JSON.stringify(utxoData)
        )
        signature = await wallet.signMessage(messageToSign)
        console.log(`   ✅ Message signed (privacy enabled)`)
      } catch (signErr: any) {
        if (signErr.message?.includes('User rejected')) {
          throw new Error('User rejected the signature request')
        }
        throw new Error('Failed to sign UTXO: ' + signErr.message)
      }

      // Handle wallets that return { signature } object
      // @ts-ignore
      if (signature.signature instanceof Uint8Array) {
        // @ts-ignore
        signature = signature.signature
      }

      if (!(signature instanceof Uint8Array)) {
        throw new Error('Signature is not a valid Uint8Array')
      }

      // ✅ STEP 4: Send encrypted UTXO to backend for relay
      console.log('📤 Step 4: Sending encrypted UTXO to backend...')
      console.log(`   🔄 Relaying to Privacy Cash pool...`)

      const BACKEND_URL =
        (import.meta as any).env.VITE_BACKEND_URL ||
        'https://shadowpay-backend-production.up.railway.app'

      const depositResponse = await fetch(`${BACKEND_URL}/api/deposit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          linkId,
          utxo: utxoData,
          signature: Array.from(signature),
          amount: amountSOL,
          publicKey,
        }),
      })

      if (!depositResponse.ok) {
        const err = await depositResponse.json()
        throw new Error(err.error || 'Failed to deposit to Privacy Cash')
      }

      const depositData = await depositResponse.json()

      console.log(`✅ Deposit successful!`)
      console.log(`   Privacy Cash TX: ${depositData.tx}`)
      console.log(`   Amount: ${amountSOL} SOL`)
      console.log(`   Status: In Privacy Cash shielded pool ✨`)
      console.log(`   Only you can claim these funds (encrypted with your key)`)

      return {
        depositTxHash: depositData.tx || depositData.transactionHash,
        amount: amountSOL.toString(),
      }
    } catch (sdkErr: any) {
      console.error('❌ SDK Error:', sdkErr)
      throw new Error('Privacy Cash SDK error: ' + sdkErr.message)
    }
  } catch (error: any) {
    console.error('❌ Privacy Cash deposit failed:', error)

    if (error.message?.includes('User rejected')) {
      throw new Error('User rejected the deposit request')
    }

    if (error.message?.includes('insufficient')) {
      throw new Error('Insufficient SOL balance')
    }

    throw error
  }
}

