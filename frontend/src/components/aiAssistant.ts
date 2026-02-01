/**
 * AI Assistant for ShadowPay
 * Natural language interface for deposit and send operations
 */

import { executeDeposit } from '../flows/depositFlowV2'
import { executeWithdraw } from '../flows/withdrawFlowV2'
import { getPrivateBalance } from '../services/privacyCashClient'
import { showError, showSuccess } from '../utils/notificationUtils'
import { Connection, PublicKey } from '@solana/web3.js'

export interface AIAssistantRequest {
  input: string
  wallet: any
  connection: any
}

export interface ParsedIntent {
  type: 'deposit' | 'send' | 'balance' | 'unknown'
  amount?: number
  recipient?: string
  raw: string
}

/**
 * Validate Solana address is valid base58 format
 */
function isValidSolanaAddress(address: string): boolean {
  try {
    // Solana addresses are 44 chars (32 bytes) encoded in base58
    if (address.length < 32 || address.length > 44) {
      return false
    }
    // Try to create PublicKey - will throw if invalid
    new PublicKey(address)
    return true
  } catch {
    return false
  }
}

/**
 * Parse natural language input into actionable intent
 * Examples:
 * - "deposit 0.01 SOL"
 * - "send 0.005 SOL to c5DUNG7hMZy1CpH1ouLYnHHEcQNiEP3oiEQ8rLWeGPF"
 * - "check balance"
 */
export function parseIntent(input: string): ParsedIntent {
  const normalized = input.toLowerCase().trim()

  // Match deposit patterns
  const depositMatch = normalized.match(/deposit\s+([\d.]+)\s*sol?/i)
  if (depositMatch) {
    return {
      type: 'deposit',
      amount: parseFloat(depositMatch[1]),
      raw: input
    }
  }

  // Match send patterns: "send X SOL to address" or "send X to address"
  const sendMatch = normalized.match(
    /send\s+([\d.]+)\s*sol?\s+to\s+([a-zA-Z0-9]{40,})/i
  )
  if (sendMatch) {
    return {
      type: 'send',
      amount: parseFloat(sendMatch[1]),
      recipient: sendMatch[2].trim(),
      raw: input
    }
  }

  // Match balance check
  if (
    normalized.includes('balance') ||
    normalized.includes('check') ||
    normalized.includes('how much')
  ) {
    return {
      type: 'balance',
      raw: input
    }
  }

  return {
    type: 'unknown',
    raw: input
  }
}

/**
 * Execute parsed intent
 */
export async function executeIntent(
  intent: ParsedIntent,
  request: AIAssistantRequest,
  onProgress: (msg: string) => void
): Promise<any> {
  const { wallet, connection } = request

  onProgress(`🤖 Processing: ${intent.raw}`)

  try {
    if (intent.type === 'deposit') {
      if (!intent.amount || intent.amount <= 0) {
        throw new Error('Please specify a valid amount (e.g., "deposit 0.01 SOL")')
      }

      onProgress(`💰 Depositing ${intent.amount} SOL to your private wallet...`)

      const lamports = Math.round(intent.amount * 1e9)
      const result = await executeDeposit(
        {
          linkId: `ai-${Date.now()}`,
          amount: lamports.toString(),
          publicKey: wallet.publicKey?.toString?.() || 'unknown'
        } as any,
        wallet
      )

      const txId = typeof result === 'string' 
        ? result 
        : (result as any)?.transactionSignature 
        ? (result as any).transactionSignature 
        : String(result)
      onProgress(`✅ Deposit successful!\nAmount: ${intent.amount} SOL\nTX: ${txId}`)
      return result
    }

    if (intent.type === 'send') {
      if (!intent.amount || intent.amount <= 0) {
        throw new Error(
          'Please specify a valid amount (e.g., "send 0.01 SOL to <address>")'
        )
      }

      if (!intent.recipient) {
        throw new Error(
          'Please specify a recipient address (e.g., "send 0.01 SOL to c5DUNG7...")'
        )
      }

      // Validate recipient address is valid Solana address
      if (!isValidSolanaAddress(intent.recipient)) {
        throw new Error(
          `Invalid recipient address: "${intent.recipient}". Must be a valid Solana address (44 characters, base58 format)`
        )
      }

      onProgress(
        `📤 Sending ${intent.amount} SOL to ${intent.recipient.slice(0, 8)}...`
      )

      const lamports = Math.round(intent.amount * 1e9)
      const result = await executeWithdraw(
        {
          walletAddress: wallet.publicKey?.toString?.() || 'unknown',
          recipientAddress: intent.recipient,
          amount: (lamports / 1e9).toString()
        } as any,
        wallet
      )

      const txId = typeof result === 'string' 
        ? result 
        : (result as any)?.transactionSignature 
        ? (result as any).transactionSignature 
        : String(result)
      onProgress(
        `✅ Send successful!\nAmount: ${intent.amount} SOL\nTo: ${intent.recipient.slice(0, 8)}...\nTX: ${txId}`
      )
      return result
    }

    if (intent.type === 'balance') {
      onProgress(`📊 Fetching your private balance...`)
      
      try {
        // Validate we have connection and wallet
        if (!connection || !wallet?.publicKey) {
          throw new Error('Wallet not connected')
        }

        // Fetch actual balance
        const balanceLamports = await getPrivateBalance(connection, {
          publicKey: wallet.publicKey,
          signMessage: async (msg: Uint8Array) => {
            return await wallet.signMessage(msg)
          }
        })

        const balanceSOL = (balanceLamports / 1e9).toFixed(6)
        onProgress(
          `💰 Private balance: ${balanceSOL} SOL (${balanceLamports} lamports)`
        )
        return { type: 'balance_check', balance: balanceLamports, balanceSOL }
      } catch (err: any) {
        throw new Error(`Balance check failed: ${err.message}`)
      }
    }

    throw new Error(
      `I don't understand that command. Try:\n- "deposit 0.01 SOL"\n- "send 0.01 SOL to <address>"`
    )
  } catch (error: any) {
    const errorMsg = error.message || String(error)
    
    // More helpful error messages
    if (errorMsg.includes('disconnected port')) {
      onProgress(`❌ Wallet connection issue. Please reconnect your wallet and try again.`)
    } else if (errorMsg.includes('User rejected')) {
      onProgress(`❌ You rejected the signature request. Please try again and approve.`)
    } else if (errorMsg.includes('No private balance')) {
      onProgress(`❌ No private balance. Deposit funds first using "deposit X SOL"`)
    } else if (errorMsg.includes('Non-base58 character') || errorMsg.includes('Invalid recipient address')) {
      onProgress(`❌ Invalid recipient address format. Solana addresses must be 44 characters, base58 encoded.`)
    } else if (errorMsg.includes('Balance check failed')) {
      onProgress(`❌ Could not fetch balance: ${errorMsg}`)
    } else {
      onProgress(`❌ Error: ${errorMsg}`)
    }
    throw error
  }
}

/**
 * Format AI response for display
 */
export function formatResponse(message: string): string {
  return message.replace(/\n/g, '<br/>')
}

/**
 * Get AI suggestions based on wallet state
 */
export function getAISuggestions(hasBalance: boolean, hasConnected: boolean): string[] {
  if (!hasConnected) {
    return [
      '🔗 Connect your wallet first',
      'Try: "connect wallet"'
    ]
  }

  if (!hasBalance) {
    return [
      '💰 You have no private balance',
      'Try: "deposit 0.01 SOL"'
    ]
  }

  return [
    '📤 Send funds: "send 0.01 SOL to <address>"',
    '💾 Deposit more: "deposit 0.05 SOL"',
    '📊 Check balance'
  ]
}
