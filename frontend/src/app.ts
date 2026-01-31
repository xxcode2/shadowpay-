/// <reference types="vite/client" />

import { Connection, PublicKey, LAMPORTS_PER_SOL, Transaction, SystemProgram } from '@solana/web3.js'

const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL ||
  'https://shadowpay-backend-production.up.railway.app'

const SOLANA_RPC_URL = 'https://mainnet.helius-rpc.com/?api-key=c455719c-354b-4a44-98d4-27f8a18aa79c'

declare global {
  interface Window {
    solana?: any
  }
}

/**
 * ShadowPay App - Privacy Cash Integration
 *
 * CORRECT MODEL:
 * - Privacy Cash uses UTXO-based ownership
 * - Sender specifies recipient at deposit time
 * - Only the specified recipient can withdraw
 * - No "bearer links" - ownership is cryptographically bound
 */
export class App {
  private walletAddress: string | null = null
  private bound: boolean = false
  private connection: Connection

  constructor() {
    this.connection = new Connection(SOLANA_RPC_URL, 'confirmed')
  }

  init() {
    if (this.bound) return
    this.bound = true
    this.bindEvents()
    console.log('ShadowPay initialized')
  }

  private bindEvents() {
    // Tab switching
    document.getElementById('mode-send')?.addEventListener('click', () => this.switchMode('send'))
    document.getElementById('mode-receive')?.addEventListener('click', () => this.switchMode('receive'))
    document.getElementById('mode-history')?.addEventListener('click', () => this.switchMode('history'))

    // Wallet
    document.getElementById('connect-wallet-btn')?.addEventListener('click', () => this.connectWallet())
    document.getElementById('disconnect-wallet-btn')?.addEventListener('click', () => this.disconnectWallet())

    // Forms
    document.getElementById('send-form')?.addEventListener('submit', (e) => this.handleSend(e))

    // Modal close
    document.getElementById('close-success-modal')?.addEventListener('click', () => {
      document.getElementById('success-modal')?.classList.add('hidden')
    })
  }

  private switchMode(mode: 'send' | 'receive' | 'history') {
    // Update active button
    document.querySelectorAll('.mode-btn').forEach(btn => {
      btn.classList.remove('bg-gradient-to-r', 'from-purple-600', 'to-blue-600', 'text-white')
      btn.classList.add('text-gray-400')
    })

    const active = document.getElementById(`mode-${mode}`)
    active?.classList.add('bg-gradient-to-r', 'from-purple-600', 'to-blue-600', 'text-white')
    active?.classList.remove('text-gray-400')

    // Hide all sections
    document.getElementById('section-send')?.classList.add('hidden')
    document.getElementById('section-receive')?.classList.add('hidden')
    document.getElementById('section-history')?.classList.add('hidden')

    // Show selected section
    document.getElementById(`section-${mode}`)?.classList.remove('hidden')

    // Load data for specific modes
    if (mode === 'receive') {
      this.loadIncomingPayments()
    } else if (mode === 'history') {
      this.loadHistory()
    }
  }

  private async connectWallet() {
    if (!window.solana || !window.solana.isPhantom) {
      alert('Phantom wallet not found. Install from phantom.app')
      return
    }

    try {
      const res = await window.solana.connect({ onlyIfTrusted: false })
      if (!res || !res.publicKey) throw new Error('No public key')

      this.walletAddress = res.publicKey.toString()

      // Update UI
      document.getElementById('connect-wallet-btn')?.classList.add('hidden')
      document.getElementById('wallet-connected')?.classList.remove('hidden')

      const walletEl = document.getElementById('wallet-address')
      if (walletEl && this.walletAddress) {
        walletEl.textContent = `${this.walletAddress.slice(0, 4)}...${this.walletAddress.slice(-4)}`
      }

      console.log('Wallet connected:', this.walletAddress)
    } catch (err: any) {
      console.error('Connection failed:', err.message)
      alert(`Connection failed: ${err.message}`)
    }
  }

  private disconnectWallet() {
    this.walletAddress = null
    document.getElementById('wallet-connected')?.classList.add('hidden')
    document.getElementById('connect-wallet-btn')?.classList.remove('hidden')
    console.log('Wallet disconnected')
  }

  /**
   * SEND PRIVATE PAYMENT
   *
   * Flow:
   * 1. User enters amount + recipient wallet address
   * 2. Frontend calls backend to initiate private transfer
   * 3. Backend creates UTXO with recipient as owner
   * 4. User signs transaction
   * 5. Payment is delivered privately
   */
  private async handleSend(e: Event) {
    e.preventDefault()

    if (!this.walletAddress) {
      alert('Please connect your wallet first')
      return
    }

    const amountInput = document.getElementById('send-amount-input') as HTMLInputElement
    const recipientInput = document.getElementById('send-recipient-input') as HTMLInputElement

    const amount = parseFloat(amountInput.value)
    const recipient = recipientInput.value.trim()

    if (!amount || amount <= 0) {
      alert('Enter a valid amount')
      return
    }

    if (!recipient) {
      alert('Enter recipient wallet address')
      return
    }

    // Validate recipient address
    try {
      new PublicKey(recipient)
    } catch {
      alert('Invalid Solana wallet address')
      return
    }

    const btn = document.getElementById('send-submit-btn') as HTMLButtonElement
    btn.disabled = true
    this.showLoading('Preparing private payment...')

    try {
      // Step 1: Call backend to create private payment
      this.updateLoading('Creating shielded UTXO...')

      const createRes = await fetch(`${BACKEND_URL}/api/private-send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          senderAddress: this.walletAddress,
          recipientAddress: recipient,
        }),
      })

      if (!createRes.ok) {
        const err = await createRes.json()
        throw new Error(err.error || 'Failed to create private payment')
      }

      const { paymentId, operatorAddress, lamports } = await createRes.json()

      // Step 2: User signs transaction to send SOL to operator
      this.updateLoading('Please approve transaction in Phantom...')

      const fromPubkey = new PublicKey(this.walletAddress)
      const toPubkey = new PublicKey(operatorAddress)

      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey,
          toPubkey,
          lamports: BigInt(lamports),
        })
      )

      const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash()
      transaction.recentBlockhash = blockhash
      transaction.feePayer = fromPubkey

      const signedTx = await window.solana.signTransaction(transaction)

      // Step 3: Send transaction
      this.updateLoading('Sending transaction...')
      const txSignature = await this.connection.sendRawTransaction(signedTx.serialize())

      // Step 4: Wait for confirmation
      this.updateLoading('Confirming transaction...')
      await this.connection.confirmTransaction({
        blockhash,
        lastValidBlockHeight,
        signature: txSignature,
      })

      // Step 5: Notify backend of successful deposit
      this.updateLoading('Finalizing private payment...')

      const confirmRes = await fetch(`${BACKEND_URL}/api/private-send/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentId,
          depositTx: txSignature,
        }),
      })

      if (!confirmRes.ok) {
        console.warn('Failed to confirm with backend, but transaction succeeded')
      }

      // Success!
      this.hideLoading()
      this.showSuccess(amount, recipient)

      // Reset form
      amountInput.value = ''
      recipientInput.value = ''

    } catch (err: any) {
      this.hideLoading()
      console.error('Send failed:', err)
      alert(`Payment failed: ${err.message}`)
    } finally {
      btn.disabled = false
    }
  }

  /**
   * LOAD INCOMING PAYMENTS
   *
   * For the connected wallet, fetch all incoming private payments
   * that haven't been withdrawn yet.
   */
  private async loadIncomingPayments() {
    const container = document.getElementById('receive-container')
    if (!container) return

    if (!this.walletAddress) {
      container.innerHTML = `
        <div class="text-center py-12 text-gray-400">
          Connect your wallet to view incoming payments
        </div>
      `
      return
    }

    container.innerHTML = `
      <div class="text-center py-12">
        <div class="loading-spinner mx-auto mb-4"></div>
        <p class="text-gray-400">Scanning for incoming payments...</p>
      </div>
    `

    try {
      const res = await fetch(`${BACKEND_URL}/api/incoming/${this.walletAddress}`)

      if (!res.ok) {
        throw new Error('Failed to load incoming payments')
      }

      const { payments } = await res.json()

      if (!payments || payments.length === 0) {
        container.innerHTML = `
          <div class="gradient-border rounded-3xl p-8 text-center">
            <div class="text-6xl mb-4">📭</div>
            <h3 class="text-xl font-bold text-white mb-2">No Incoming Payments</h3>
            <p class="text-gray-400">When someone sends you a private payment, it will appear here.</p>
          </div>
        `
        return
      }

      container.innerHTML = payments.map((payment: any) => `
        <div class="gradient-border rounded-3xl p-6 glow-effect">
          <div class="flex justify-between items-center mb-4">
            <div>
              <div class="text-3xl font-bold text-green-400">+${payment.amount} SOL</div>
              <div class="text-sm text-gray-400">Received ${this.formatDate(payment.createdAt)}</div>
            </div>
            <div class="text-right">
              <span class="px-3 py-1 rounded-full text-sm ${payment.withdrawn ? 'bg-gray-500/20 text-gray-400' : 'bg-green-500/20 text-green-400'}">
                ${payment.withdrawn ? 'Withdrawn' : 'Available'}
              </span>
            </div>
          </div>
          ${!payment.withdrawn ? `
            <button
              onclick="window.shadowpay.withdrawPayment('${payment.id}')"
              class="w-full py-3 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold transition-all"
            >
              Withdraw to Wallet
            </button>
          ` : ''}
        </div>
      `).join('')

    } catch (err: any) {
      container.innerHTML = `
        <div class="text-center py-12 text-red-400">
          Failed to load incoming payments: ${err.message}
        </div>
      `
    }
  }

  /**
   * WITHDRAW PAYMENT
   *
   * Withdraw an incoming payment to connected wallet.
   * Only the designated recipient can withdraw (UTXO ownership).
   */
  async withdrawPayment(paymentId: string) {
    if (!this.walletAddress) {
      alert('Please connect your wallet first')
      return
    }

    this.showLoading('Processing withdrawal...')

    try {
      this.updateLoading('Generating ZK proof...')

      const res = await fetch(`${BACKEND_URL}/api/withdraw`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentId,
          recipientAddress: this.walletAddress,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Withdrawal failed')
      }

      const { amount, txSignature } = await res.json()

      this.hideLoading()
      this.showNotification(`Withdrawn ${amount} SOL successfully!`)

      // Reload incoming payments
      this.loadIncomingPayments()

    } catch (err: any) {
      this.hideLoading()
      alert(`Withdrawal failed: ${err.message}`)
    }
  }

  /**
   * LOAD HISTORY
   *
   * Show all sent and received payments for this wallet.
   */
  private async loadHistory() {
    const container = document.getElementById('history-container')
    if (!container) return

    if (!this.walletAddress) {
      container.innerHTML = `
        <div class="text-center py-12 text-gray-400">
          Connect your wallet to view history
        </div>
      `
      return
    }

    container.innerHTML = `
      <div class="text-center py-12">
        <div class="loading-spinner mx-auto mb-4"></div>
        <p class="text-gray-400">Loading history...</p>
      </div>
    `

    try {
      const res = await fetch(`${BACKEND_URL}/api/history/${this.walletAddress}`)

      if (!res.ok) {
        throw new Error('Failed to load history')
      }

      const { sent, received } = await res.json()

      if ((!sent || sent.length === 0) && (!received || received.length === 0)) {
        container.innerHTML = `
          <div class="text-center py-12">
            <div class="text-6xl mb-4">📭</div>
            <div class="text-xl text-gray-400">No transactions yet</div>
            <p class="text-gray-500 mt-2">Send or receive a private payment to get started</p>
          </div>
        `
        return
      }

      let html = ''

      // Sent payments
      if (sent && sent.length > 0) {
        html += `
          <div class="gradient-border rounded-3xl p-6">
            <h3 class="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <svg class="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
              </svg>
              Sent Payments
            </h3>
            <div class="space-y-3">
              ${sent.map((tx: any) => `
                <div class="flex justify-between items-center p-4 rounded-xl bg-gray-900/50 border border-gray-700/30">
                  <div>
                    <div class="text-sm text-gray-400">To: ${tx.recipientAddress ? tx.recipientAddress.slice(0, 8) + '...' : 'Unknown'}</div>
                    <div class="text-xs text-gray-500">${this.formatDate(tx.createdAt)}</div>
                  </div>
                  <div class="text-right">
                    <div class="font-bold text-purple-400">-${tx.amount} SOL</div>
                    <div class="text-xs ${tx.claimed ? 'text-green-400' : 'text-yellow-400'}">
                      ${tx.claimed ? 'Claimed' : 'Pending'}
                    </div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        `
      }

      // Received payments
      if (received && received.length > 0) {
        html += `
          <div class="gradient-border rounded-3xl p-6 mt-6">
            <h3 class="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <svg class="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"/>
              </svg>
              Received Payments
            </h3>
            <div class="space-y-3">
              ${received.map((tx: any) => `
                <div class="flex justify-between items-center p-4 rounded-xl bg-gray-900/50 border border-gray-700/30">
                  <div>
                    <div class="text-sm text-gray-400">Private payment</div>
                    <div class="text-xs text-gray-500">${this.formatDate(tx.claimedAt || tx.createdAt)}</div>
                  </div>
                  <div class="text-right">
                    <div class="font-bold text-green-400">+${tx.amount} SOL</div>
                    <div class="text-xs text-green-400">Received</div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        `
      }

      container.innerHTML = html

    } catch (err: any) {
      container.innerHTML = `
        <div class="text-center py-12 text-red-400">
          Failed to load history: ${err.message}
        </div>
      `
    }
  }

  // Utility methods
  private formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  private showSuccess(amount: number, recipient: string) {
    const modal = document.getElementById('success-modal')
    const amountEl = document.getElementById('success-amount')
    const recipientEl = document.getElementById('success-recipient')
    const messageEl = document.getElementById('success-message')

    if (amountEl) amountEl.textContent = `${amount} SOL`
    if (recipientEl) recipientEl.textContent = `${recipient.slice(0, 8)}...${recipient.slice(-8)}`
    if (messageEl) messageEl.textContent = 'Your payment has been sent privately using zero-knowledge proofs.'

    modal?.classList.remove('hidden')
  }

  private showLoading(message: string) {
    const modal = document.getElementById('loading-modal')
    const msgEl = document.getElementById('loading-message')
    if (msgEl) msgEl.textContent = message
    modal?.classList.remove('hidden')
  }

  private updateLoading(message: string) {
    const msgEl = document.getElementById('loading-message')
    if (msgEl) msgEl.textContent = message
  }

  private hideLoading() {
    document.getElementById('loading-modal')?.classList.add('hidden')
  }

  private showNotification(text: string) {
    const notification = document.getElementById('notification')
    const textEl = document.getElementById('notification-text')
    if (textEl) textEl.textContent = text
    notification?.classList.remove('hidden')
    setTimeout(() => notification?.classList.add('hidden'), 3000)
  }
}

// Export for global access (for withdraw buttons)
declare global {
  interface Window {
    shadowpay: App
  }
}
