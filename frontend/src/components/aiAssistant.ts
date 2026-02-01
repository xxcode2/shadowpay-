/**
 * AI Assistant for ShadowPay
 * Natural language interface for deposit and send operations
 */

import { executeDeposit } from '../flows/depositFlowV2'
import { executeWithdraw } from '../flows/withdrawFlowV2'
import { showError, showSuccess } from '../utils/notificationUtils'

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

      const txId = typeof result === 'string' ? result : (result?.transactionSignature || String(result))
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

      const txId = typeof result === 'string' ? result : ((result as any)?.transactionSignature || String(result))
      onProgress(
        `✅ Send successful!\nAmount: ${intent.amount} SOL\nTo: ${intent.recipient.slice(0, 8)}...\nTX: ${txId}`
      )
      return result
    }

    if (intent.type === 'balance') {
      onProgress(`📊 Checking your private balance...`)
      // Balance check is typically done in the UI
      return { type: 'balance_check' }
    }

    throw new Error(
      `I don't understand that command. Try:\n- "deposit 0.01 SOL"\n- "send 0.01 SOL to <address>"`
    )
  } catch (error: any) {
    const errorMsg = error.message || String(error)
    onProgress(`❌ Error: ${errorMsg}`)
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
