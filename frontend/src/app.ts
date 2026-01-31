/// <reference types="vite/client" />

import { Connection, PublicKey, LAMPORTS_PER_SOL, Transaction, SystemProgram } from '@solana/web3.js'
import type { DepositRequest } from './flows/depositFlow'
import logo from '@/assets/pay.png'

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
  private historyData: { sent: any[], received: any[] } = { sent: [], received: [] }
  private currentHistoryPage: number = 1
  private historyTab: 'sent' | 'received' = 'sent'
  private readonly ITEMS_PER_PAGE = 10
  
  // Receive section state
  private incomingData: any[] = []
  private currentIncomingPage: number = 1
  private incomingTab: 'available' | 'withdrawn' = 'available'
  private readonly ITEMS_PER_PAGE_RECEIVE = 5

  constructor() {
    this.connection = new Connection(SOLANA_RPC_URL, 'confirmed')
  }

  init() {
    if (this.bound) return
    this.bound = true
    
    // Set logo dynamically (Vite will handle bundling)
    const logoImg = document.getElementById('logo-img') as HTMLImageElement
    if (logoImg) {
      logoImg.src = logo
    }
    
    this.bindEvents()
    console.log('ShadowPay initialized')
  }

  private bindEvents() {
    // Tab switching
    document.getElementById('mode-send')?.addEventListener('click', () => this.switchMode('send'))
    document.getElementById('mode-receive')?.addEventListener('click', () => this.switchMode('receive'))
    document.getElementById('mode-history')?.addEventListener('click', () => this.switchMode('history'))
    document.getElementById('mode-about')?.addEventListener('click', () => this.switchMode('about'))

    // Wallet
    document.getElementById('connect-wallet-btn')?.addEventListener('click', () => this.connectWallet())
    document.getElementById('disconnect-wallet-btn')?.addEventListener('click', () => this.disconnectWallet())

    // Forms
    document.getElementById('send-form')?.addEventListener('submit', (e) => this.handleSend(e))
    
    // Token selector
    document.getElementById('send-token-select')?.addEventListener('change', (e) => {
      const select = e.target as HTMLSelectElement
      const symbol = document.getElementById('send-token-symbol')
      if (symbol) {
        symbol.textContent = select.value
      }
    })

    // Modal close
    document.getElementById('close-success-modal')?.addEventListener('click', () => {
      document.getElementById('success-modal')?.classList.add('hidden')
    })
  }

  private switchMode(mode: 'send' | 'receive' | 'history' | 'about') {
    // Update active button
    document.querySelectorAll('.mode-btn').forEach(btn => {
      btn.classList.remove('tab-active')
      btn.classList.add('tab-inactive')
    })

    const active = document.getElementById(`mode-${mode}`)
    active?.classList.remove('tab-inactive')
    active?.classList.add('tab-active')

    // Hide all sections
    document.getElementById('section-send')?.classList.add('hidden')
    document.getElementById('section-receive')?.classList.add('hidden')
    document.getElementById('section-history')?.classList.add('hidden')
    document.getElementById('section-about')?.classList.add('hidden')

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
    const tokenSelect = document.getElementById('send-token-select') as HTMLSelectElement

    const amount = parseFloat(amountInput.value)
    const recipient = recipientInput.value.trim()
    const token = tokenSelect?.value || 'SOL'

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
    this.showLoading(`Preparing ${token} private payment...`)

    try {
      // Step 1: Call backend to create private payment record
      this.updateLoading(`Creating ${token} payment record...`)

      const createRes = await fetch(`${BACKEND_URL}/api/private-send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          senderAddress: this.walletAddress,
          recipientAddress: recipient,
          token, // Include selected token
        }),
      })

      if (!createRes.ok) {
        const err = await createRes.json()
        throw new Error(err.error || 'Failed to create private payment')
      }

      const { paymentId, lamports } = await createRes.json()

      // Step 2: Deposit to Privacy Cash with recipient encryption key
      // This creates UTXOs that ONLY the recipient can decrypt
      this.updateLoading(`Depositing ${token} to Privacy Cash...`)
      
      // Import deposit flow - using Privacy Cash SDK with recipient encryption key binding
      const { executeUserPaysDeposit } = await import('./flows/depositFlow.js')
      
      const depositRequest: DepositRequest = {
        linkId: paymentId,
        amount: amount.toString(),
        publicKey: this.walletAddress,
        recipientAddress: recipient,  // ✅ Pass recipient so SDK can bind UTXO to them
        token, // Pass token to deposit flow
      }
      
      const depositTxSig = await executeUserPaysDeposit(
        depositRequest,
        window.solana
      )

      // Step 3: Notify backend of successful Privacy Cash deposit
      this.updateLoading('Finalizing private payment...')

      const confirmRes = await fetch(`${BACKEND_URL}/api/private-send/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentId,
          depositTx: depositTxSig,
          token, // Include token
        }),
      })

      if (!confirmRes.ok) {
        console.warn('Failed to confirm with backend, but deposit succeeded on Privacy Cash')
      }

      // Success!
      this.hideLoading()
      this.showSuccess(amount, recipient, token)

      // Reset form
      amountInput.value = ''
      recipientInput.value = ''
      if (tokenSelect) {
        tokenSelect.value = 'SOL'
        const symbol = document.getElementById('send-token-symbol')
        if (symbol) symbol.textContent = 'SOL'
      }

    } catch (err: any) {
      this.hideLoading()
      console.error('Send failed:', err)
      alert(`Payment failed: ${err.message}`)
    } finally {
      btn.disabled = false
    }
  }

  /**
   * LOAD INCOMING PAYMENTS WITH PAGINATION
   *
   * For the connected wallet, fetch incoming private payments
   * Separated into Available and Withdrawn tabs with 5 items per page
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
          <div class="text-center py-12">
            <div class="text-6xl mb-4">📭</div>
            <h3 class="text-xl text-gray-400">No Incoming Payments</h3>
            <p class="text-gray-500 mt-2">When someone sends you a private payment, it will appear here.</p>
          </div>
        `
        return
      }

      // Separate into available and withdrawn
      this.incomingData = payments
      this.currentIncomingPage = 1
      this.incomingTab = 'available'
      
      this.renderIncomingTab()

    } catch (err: any) {
      container.innerHTML = `
        <div class="text-center py-12 text-red-400">
          Failed to load incoming payments: ${err.message}
        </div>
      `
    }
  }

  private renderIncomingTab() {
    const container = document.getElementById('receive-container')
    if (!container) return

    const isAvailable = this.incomingTab === 'available'
    const filteredData = this.incomingData.filter((p: any) => 
      isAvailable ? !p.withdrawn : p.withdrawn
    )

    const totalPages = Math.ceil(filteredData.length / this.ITEMS_PER_PAGE_RECEIVE)
    const startIdx = (this.currentIncomingPage - 1) * this.ITEMS_PER_PAGE_RECEIVE
    const endIdx = startIdx + this.ITEMS_PER_PAGE_RECEIVE
    const pageData = filteredData.slice(startIdx, endIdx)

    const availableCount = this.incomingData.filter((p: any) => !p.withdrawn).length
    const withdrawnCount = this.incomingData.filter((p: any) => p.withdrawn).length

    let html = `
      <!-- Tab Navigation -->
      <div class="flex gap-4 mb-8">
        <button id="receive-tab-available" class="px-6 py-2 rounded-lg font-medium transition ${
          this.incomingTab === 'available' 
            ? 'bg-green-600 text-white' 
            : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
        }">
          Available ${availableCount > 0 ? `(${availableCount})` : ''}
        </button>
        <button id="receive-tab-withdrawn" class="px-6 py-2 rounded-lg font-medium transition ${
          this.incomingTab === 'withdrawn' 
            ? 'bg-gray-600 text-white' 
            : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
        }">
          Withdrawn ${withdrawnCount > 0 ? `(${withdrawnCount})` : ''}
        </button>
      </div>
    `

    if (pageData.length === 0) {
      html += `
        <div class="text-center py-8">
          <div class="text-gray-400">${isAvailable ? 'No available payments' : 'No withdrawn payments'}</div>
        </div>
      `
    } else {
      html += `
        <div class="space-y-4 mb-6">
          ${pageData.map((payment: any) => `
            <div class="p-4 rounded-lg bg-gray-850 border border-gray-700 hover:border-green-500/50 transition">
              <div class="flex justify-between items-start">
                <div class="flex-1">
                  <div class="text-2xl font-semibold text-green-400">+${payment.amount} SOL</div>
                  <div class="text-xs text-gray-500 mt-1">Received ${this.formatDate(payment.createdAt)}</div>
                </div>
                <div class="text-right">
                  <div class="text-xs font-medium ${isAvailable ? 'text-green-500' : 'text-gray-400'}">
                    ${isAvailable ? '✓ Available' : '✓ Withdrawn'}
                  </div>
                </div>
              </div>
              ${isAvailable ? `
                <button
                  onclick="window.shadowpay.withdrawPayment('${payment.id}')"
                  class="w-full mt-4 py-2.5 rounded-lg bg-green-600 hover:bg-green-700 text-white font-medium transition-colors"
                >
                  Withdraw to Wallet
                </button>
              ` : ''}
            </div>
          `).join('')}
        </div>
      `
    }

    // Add pagination if more than 1 page
    if (totalPages > 1) {
      html += `
        <div class="flex justify-center items-center gap-2 mt-6">
          <button id="incoming-prev-page" class="px-3 py-1 rounded border border-gray-700 text-sm text-gray-400 hover:text-gray-200 hover:border-gray-600 transition ${this.currentIncomingPage === 1 ? 'opacity-50 cursor-not-allowed' : ''}">
            ← Prev
          </button>
          <div class="flex gap-1">
            ${Array.from({ length: totalPages }, (_, i) => i + 1).map(page => `
              <button class="incoming-page-btn px-3 py-1 rounded text-sm transition ${
                page === this.currentIncomingPage 
                  ? 'bg-green-600 text-white' 
                  : 'border border-gray-700 text-gray-400 hover:text-gray-200 hover:border-gray-600'
              }" data-page="${page}">
                ${page}
              </button>
            `).join('')}
          </div>
          <button id="incoming-next-page" class="px-3 py-1 rounded border border-gray-700 text-sm text-gray-400 hover:text-gray-200 hover:border-gray-600 transition ${this.currentIncomingPage === totalPages ? 'opacity-50 cursor-not-allowed' : ''}">
            Next →
          </button>
        </div>
      `
    }

    container.innerHTML = html

    // Attach event listeners
    document.getElementById('receive-tab-available')?.addEventListener('click', () => {
      this.incomingTab = 'available'
      this.currentIncomingPage = 1
      this.renderIncomingTab()
    })

    document.getElementById('receive-tab-withdrawn')?.addEventListener('click', () => {
      this.incomingTab = 'withdrawn'
      this.currentIncomingPage = 1
      this.renderIncomingTab()
    })

    document.getElementById('incoming-prev-page')?.addEventListener('click', () => {
      if (this.currentIncomingPage > 1) {
        this.currentIncomingPage--
        this.renderIncomingTab()
      }
    })

    document.getElementById('incoming-next-page')?.addEventListener('click', () => {
      if (this.currentIncomingPage < totalPages) {
        this.currentIncomingPage++
        this.renderIncomingTab()
      }
    })

    document.querySelectorAll('.incoming-page-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const page = parseInt((e.target as HTMLElement).getAttribute('data-page') || '1')
        this.currentIncomingPage = page
        this.renderIncomingTab()
      })
    })
  }

  private loadIncomingPage(page: number) {
    this.currentIncomingPage = page
    this.renderIncomingTab()
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
          linkId: paymentId,  // Backend expects 'linkId', not 'paymentId'
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

      const data = await res.json()
      this.historyData = {
        sent: data.sent || [],
        received: data.received || []
      }
      this.currentHistoryPage = 1
      this.historyTab = 'sent'

      this.renderHistoryTab()

    } catch (err: any) {
      container.innerHTML = `
        <div class="text-center py-12 text-red-400">
          Failed to load history: ${err.message}
        </div>
      `
    }
  }

  private renderHistoryTab() {
    const container = document.getElementById('history-container')
    if (!container) return

    if (this.historyData.sent.length === 0 && this.historyData.received.length === 0) {
      container.innerHTML = `
        <div class="text-center py-12">
          <div class="text-6xl mb-4">📭</div>
          <div class="text-xl text-gray-400">No transactions yet</div>
          <p class="text-gray-500 mt-2">Send or receive a private payment to get started</p>
        </div>
      `
      return
    }

    const isSent = this.historyTab === 'sent'
    const data = isSent ? this.historyData.sent : this.historyData.received
    const totalPages = Math.ceil(data.length / this.ITEMS_PER_PAGE)
    const startIdx = (this.currentHistoryPage - 1) * this.ITEMS_PER_PAGE
    const endIdx = startIdx + this.ITEMS_PER_PAGE
    const pageData = data.slice(startIdx, endIdx)

    let html = `
      <!-- Tab Navigation -->
      <div class="flex gap-4 mb-8">
        <button id="history-tab-sent" class="px-6 py-2 rounded-lg font-medium transition ${
          this.historyTab === 'sent' 
            ? 'bg-purple-600 text-white' 
            : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
        }">
          Sent ${this.historyData.sent.length > 0 ? `(${this.historyData.sent.length})` : ''}
        </button>
        <button id="history-tab-received" class="px-6 py-2 rounded-lg font-medium transition ${
          this.historyTab === 'received' 
            ? 'bg-purple-600 text-white' 
            : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
        }">
          Received ${this.historyData.received.length > 0 ? `(${this.historyData.received.length})` : ''}
        </button>
      </div>

      <!-- Transactions List -->
      <div class="space-y-3 mb-6">
        ${pageData.map((tx: any) => {
          if (isSent) {
            return `
              <div class="p-4 rounded-lg bg-gray-850 border border-gray-700 hover:border-purple-500/50 transition">
                <div class="flex justify-between items-start">
                  <div class="flex-1">
                    <div class="text-sm font-medium text-gray-300">
                      To: <span class="inline-flex items-center gap-1 group relative cursor-help">
                        🔒 Shielded Recipient
                        <span class="opacity-0 group-hover:opacity-100 absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 border border-gray-700 rounded text-xs text-gray-300 whitespace-nowrap transition-opacity pointer-events-none">
                          Recipient address is encrypted on-chain
                        </span>
                      </span>
                    </div>
                    <div class="text-xs text-gray-500 mt-1">${this.formatDate(tx.createdAt)}</div>
                  </div>
                  <div class="text-right">
                    <div class="font-semibold text-gray-100">-${tx.amount} SOL</div>
                    <div class="text-xs font-medium mt-1 ${tx.claimed ? 'text-green-500' : 'text-amber-500'}">
                      ${tx.claimed ? '✓ Claimed' : '⏱ Pending'}
                    </div>
                  </div>
                </div>
              </div>
            `
          } else {
            return `
              <div class="p-4 rounded-lg bg-gray-850 border border-gray-700 hover:border-green-500/50 transition">
                <div class="flex justify-between items-start">
                  <div class="flex-1">
                    <div class="text-sm font-medium text-gray-300">Private payment received</div>
                    <div class="text-xs text-gray-500 mt-1">${this.formatDate(tx.claimedAt || tx.createdAt)}</div>
                  </div>
                  <div class="text-right">
                    <div class="font-semibold text-gray-100">+${tx.amount} SOL</div>
                    <div class="text-xs font-medium mt-1 text-green-500">✓ Available</div>
                  </div>
                </div>
              </div>
            `
          }
        }).join('')}
      </div>

      <!-- Pagination -->
      ${totalPages > 1 ? `
        <div class="flex justify-center items-center gap-2 mt-6">
          <button id="prev-page" class="px-3 py-1 rounded border border-gray-700 text-sm text-gray-400 hover:text-gray-200 hover:border-gray-600 transition ${this.currentHistoryPage === 1 ? 'opacity-50 cursor-not-allowed' : ''}">
            ← Prev
          </button>
          <div class="flex gap-1">
            ${Array.from({ length: totalPages }, (_, i) => i + 1).map(page => `
              <button class="page-btn px-3 py-1 rounded text-sm transition ${
                page === this.currentHistoryPage 
                  ? 'bg-purple-600 text-white' 
                  : 'border border-gray-700 text-gray-400 hover:text-gray-200 hover:border-gray-600'
              }" data-page="${page}">
                ${page}
              </button>
            `).join('')}
          </div>
          <button id="next-page" class="px-3 py-1 rounded border border-gray-700 text-sm text-gray-400 hover:text-gray-200 hover:border-gray-600 transition ${this.currentHistoryPage === totalPages ? 'opacity-50 cursor-not-allowed' : ''}">
            Next →
          </button>
        </div>
      ` : ''}
    `

    container.innerHTML = html

    // Attach event listeners
    document.getElementById('history-tab-sent')?.addEventListener('click', () => {
      this.historyTab = 'sent'
      this.currentHistoryPage = 1
      this.renderHistoryTab()
    })

    document.getElementById('history-tab-received')?.addEventListener('click', () => {
      this.historyTab = 'received'
      this.currentHistoryPage = 1
      this.renderHistoryTab()
    })

    document.getElementById('prev-page')?.addEventListener('click', () => {
      if (this.currentHistoryPage > 1) {
        this.currentHistoryPage--
        this.renderHistoryTab()
      }
    })

    document.getElementById('next-page')?.addEventListener('click', () => {
      if (this.currentHistoryPage < totalPages) {
        this.currentHistoryPage++
        this.renderHistoryTab()
      }
    })

    document.querySelectorAll('.page-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const page = parseInt((e.target as HTMLElement).getAttribute('data-page') || '1')
        this.currentHistoryPage = page
        this.renderHistoryTab()
      })
    })
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

  private showSuccess(amount: number, recipient: string, token: string = 'SOL') {
    const modal = document.getElementById('success-modal')
    const amountEl = document.getElementById('success-amount')
    const recipientEl = document.getElementById('success-recipient')
    const messageEl = document.getElementById('success-message')

    if (amountEl) amountEl.textContent = `${amount} ${token}`
    if (recipientEl) recipientEl.textContent = `${recipient.slice(0, 8)}...${recipient.slice(-8)}`
    if (messageEl) messageEl.textContent = `Your ${token} payment has been sent privately using zero-knowledge proofs.`

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
