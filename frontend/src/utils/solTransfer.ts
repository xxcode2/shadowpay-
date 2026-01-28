/**
 * SOL Transfer Utility
 * Handles sending SOL from user's Phantom wallet to recipient
 */

import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js'

/**
 * Send SOL from user's Phantom wallet to recipient wallet
 * This is a REAL payment that the user must approve in Phantom
 */
export async function sendSolPayment(
  wallet: any,
  recipientAddress: string,
  amountSOL: number
): Promise<{ txHash: string; amount: number }> {
  if (!wallet) {
    throw new Error('Wallet not connected')
  }

  if (!wallet.publicKey) {
    throw new Error('Wallet public key not available')
  }

  // Validate recipient address
  let recipientPubkey: PublicKey
  try {
    recipientPubkey = new PublicKey(recipientAddress)
  } catch {
    throw new Error(`Invalid recipient address: ${recipientAddress}`)
  }

  // Validate amount
  if (amountSOL <= 0) {
    throw new Error('Amount must be greater than 0')
  }

  const lamports = Math.round(amountSOL * LAMPORTS_PER_SOL)

  console.log(`💳 Requesting SOL payment via Phantom...`)
  console.log(`   From: ${wallet.publicKey.toString()}`)
  console.log(`   To: ${recipientAddress}`)
  console.log(`   Amount: ${amountSOL} SOL (${lamports} lamports)`)

  try {
    // Get the RPC connection (default to mainnet-beta, but use devnet for testing)
    const rpcUrl = process.env.VITE_RPC_URL || 'https://api.mainnet-beta.solana.com'
    const connection = new Connection(rpcUrl, 'confirmed')

    // Get recent blockhash
    const { blockhash } = await connection.getLatestBlockhash('confirmed')

    // Create transfer instruction
    const instruction = SystemProgram.transfer({
      fromPubkey: wallet.publicKey,
      toPubkey: recipientPubkey,
      lamports: lamports,
    })

    // Create transaction
    const transaction = new Transaction({
      recentBlockhash: blockhash,
      feePayer: wallet.publicKey,
    }).add(instruction)

    console.log(`📤 Sending transaction to Phantom for approval...`)

    // Request user signature via Phantom
    const signedTransaction = await wallet.signTransaction(transaction)

    console.log(`✅ Transaction signed by user`)
    console.log(`   Sending transaction to blockchain...`)

    // Send transaction
    const txHash = await connection.sendRawTransaction(
      signedTransaction.serialize(),
      {
        skipPreflight: false,
        maxRetries: 3,
      }
    )

    console.log(`📡 Transaction submitted: ${txHash}`)

    // Wait for confirmation
    console.log(`⏳ Waiting for transaction confirmation...`)
    const confirmation = await connection.confirmTransaction(
      txHash,
      'confirmed'
    )

    if (confirmation.value.err) {
      throw new Error(
        `Transaction failed: ${JSON.stringify(confirmation.value.err)}`
      )
    }

    console.log(`✅ Payment confirmed!`)
    console.log(`   Transaction: ${txHash}`)
    console.log(`   Amount: ${amountSOL} SOL`)

    return {
      txHash,
      amount: amountSOL,
    }
  } catch (error: any) {
    console.error('❌ SOL transfer failed:', error)

    // Check if it's a user rejection
    if (error.message?.includes('User rejected')) {
      throw new Error('User rejected the payment request')
    }

    if (error.message?.includes('insufficient funds')) {
      throw new Error('Insufficient SOL balance for this payment')
    }

    throw new Error(`Payment failed: ${error.message}`)
  }
}

/**
 * Validate recipient address format
 */
export function validateSolAddress(address: string): boolean {
  try {
    new PublicKey(address)
    return true
  } catch {
    return false
  }
}
