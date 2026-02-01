/// <reference types="vite/client" />

import { Connection, PublicKey, LAMPORTS_PER_SOL, Transaction, SystemProgram } from '@solana/web3.js'
import type { DepositRequest } from './flows/depositFlow'
import logo from '@/assets/pay.png'

const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL ||
  'https://shadowpay-backend-production.up.railway.app'

const SOLANA_RPC_URL = 'https://mainnet.helius-rpc.com'

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
    document.getElementById('mode-deposit')?.addEventListener('click', () => this.switchMode('deposit'))
    document.getElementById('mode-send')?.addEventListener('click', () => this.switchMode('send'))
    document.getElementById('mode-receive')?.addEventListener('click', () => this.switchMode('receive'))
    document.getElementById('mode-history')?.addEventListener('click', () => this.switchMode('history'))
    document.getElementById('mode-about')?.addEventListener('click', () => this.switchMode('about'))

    // Wallet
    document.getElementById('connect-wallet-btn')?.addEventListener('click', () => this.connectWallet())
    document.getElementById('disconnect-wallet-btn')?.addEventListener('click', () => this.disconnectWallet())

    // Forms
    document.getElementById('send-form')?.addEventListener('submit', (e) => this.handleSend(e))
    document.getElementById('send-to-user-form')?.addEventListener('submit', (e) => this.handleSendToUser(e))
    
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

  private switchMode(mode: 'deposit' | 'send' | 'receive' | 'history' | 'about') {
    // Update active button
    document.querySelectorAll('.mode-btn').forEach(btn => {
      btn.classList.remove('tab-active')
      btn.classList.add('tab-inactive')
    })

    const active = document.getElementById(`mode-${mode}`)
    active?.classList.remove('tab-inactive')
    active?.classList.add('tab-active')

    // Hide all sections
    document.getElementById('section-deposit')?.classList.add('hidden')
    document.getElementById('section-send')?.classList.add('hidden')
    document.getElementById('section-receive')?.classList.add('hidden')
    document.getElementById('section-history')?.classList.add('hidden')
    document.getElementById('section-about')?.classList.add('hidden')

    // Show selected section
    document.getElementById(`section-${mode}`)?.classList.remove('hidden')

    // Load data for specific modes
    if (mode === 'deposit') {
      this.updateDepositBalance()
    } else if (mode === 'receive') {
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

  private async updateDepositBalance() {
    if (!this.walletAddress) return

    try {
      const res = await fetch(`${BACKEND_URL}/api/history/${this.walletAddress}`)
      if (!res.ok) {
        console.warn('Failed to load balance, status:', res.status)
        return
      }

      const data = await res.json()
      console.log('💰 History data:', data)
      
      const sent = data.sent || []
      
      // Calculate total deposited (sum of all amounts sent)
      const totalDeposited = sent.reduce((sum: number, tx: any) => {
        const amount = parseFloat(tx.amount) || parseFloat(tx.totalAmount) || 0
        console.log(`  Transaction: ${amount} SOL`)
        return sum + amount
      }, 0)
      
      console.log(`💵 Total deposited: ${totalDeposited} SOL`)
      
      const balanceEl = document.getElementById('deposit-balance')
      if (balanceEl) {
        balanceEl.textContent = totalDeposited.toFixed(2)
        console.log('✅ Balance updated to:', totalDeposited.toFixed(2))
      }
    } catch (err) {
      console.error('Failed to load deposit balance:', err)
    }
  }

  /**
   * Show modal notification (success, error, info, warning)
   */
  private showModal(title: string, message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info', details?: string) {
    // Remove existing modal
    const existing = document.getElementById('modal-notification')
    if (existing) existing.remove()

    const iconMap = {
      success: '✅',
      error: '❌',
      info: 'ℹ️',
      warning: '⚠️'
    }

    const bgColorMap = {
      success: 'bg-green-900/50 border-green-500/50',
      error: 'bg-red-900/50 border-red-500/50',
      info: 'bg-blue-900/50 border-blue-500/50',
      warning: 'bg-yellow-900/50 border-yellow-500/50'
    }

    const modal = document.createElement('div')
    modal.id = 'modal-notification'
    modal.className = `fixed inset-0 flex items-center justify-center z-50 backdrop-blur-sm`
    modal.innerHTML = `
      <div class="${bgColorMap[type]} border border-opacity-50 rounded-lg p-6 max-w-md mx-4 shadow-2xl animate-in fade-in zoom-in-95">
        <div class="flex items-start gap-4">
          <div class="text-3xl flex-shrink-0">${iconMap[type]}</div>
          <div class="flex-1 min-w-0">
            <h3 class="text-lg font-semibold text-white mb-2">${title}</h3>
            <p class="text-gray-200 text-sm mb-3">${message}</p>
            ${details ? `<div class="text-xs text-gray-300 bg-black/30 p-2 rounded break-all font-mono">\n              ${details}\n            </div>` : ''}
          </div>
        </div>
        <div class="mt-4 flex justify-end">
          <button onclick="this.closest('#modal-notification').remove()" class="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded font-semibold transition-colors">
            OK
          </button>
        </div>
      </div>
    `
    document.body.appendChild(modal)

    // Auto-close after 5 seconds if it's a success
    if (type === 'success') {
      setTimeout(() => modal.remove(), 5000)
    }
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
    const tokenSelect = document.getElementById('send-token-select') as HTMLSelectElement

    const amount = parseFloat(amountInput.value)
    const token = tokenSelect?.value || 'SOL'

    if (!amount || amount <= 0) {
      alert('Enter a valid amount')
      return
    }

    const btn = document.getElementById('send-submit-btn') as HTMLButtonElement
    btn.disabled = true
    this.showLoading(`Preparing ${token} deposit...`)

    try {
      // Use createLink flow for deposit (no recipient needed)
      const { createLink } = await import('./flows/createLink.js')
      const { PublicKey } = await import('@solana/web3.js')
      
      this.updateLoading(`Depositing ${amount} ${token} to Privacy Cash...`)
      
      const depositResult = await createLink({
        amountSOL: amount,
        wallet: {
          publicKey: new PublicKey(this.walletAddress!),
          signMessage: async (message: Uint8Array) => {
            const sig = await window.solana.signMessage(message)
            return sig.signature
          },
          signTransaction: async (transaction: any) => {
            return await window.solana.signTransaction(transaction)
          }
        }
      })

      this.hideLoading()
      this.showModal(
        '✅ Deposit Successful',
        `You have successfully deposited ${amount} SOL to Privacy Cash. Your funds are now secure and private.`,
        'success',
        `Link ID: ${depositResult.linkId}`
      )

      // Reset form
      amountInput.value = ''
      if (tokenSelect) {
        tokenSelect.value = 'SOL'
        const symbol = document.getElementById('send-token-symbol')
        if (symbol) symbol.textContent = 'SOL'
      }

      // Reload deposit balance
      await new Promise(resolve => setTimeout(resolve, 1000))
      await this.updateDepositBalance()

      // Reset form
      amountInput.value = ''
      if (tokenSelect) {
        tokenSelect.value = 'SOL'
        const symbol = document.getElementById('send-token-symbol')
        if (symbol) symbol.textContent = 'SOL'
      }

    } catch (err: any) {
      this.hideLoading()
      console.error('Send failed:', err)
      this.showModal(
        '❌ Deposit Failed',
        `Your deposit could not be processed.`,
        'error',
        err.message
      )
    } finally {
      btn.disabled = false
    }
  }

  private async handleSendToUser(e: Event) {
    e.preventDefault()

    if (!this.walletAddress) {
      alert('Please connect your wallet first')
      return
    }

    const amountInput = document.getElementById('send-user-amount') as HTMLInputElement
    const recipientInput = document.getElementById('send-user-recipient') as HTMLInputElement

    const amount = parseFloat(amountInput.value)
    const recipient = recipientInput.value.trim()

    if (!amount || amount <= 0) {
        this.showModal(
          '⚠️ Invalid Amount',
          'Please enter a valid amount greater than 0.',
          'warning'
        )
        return
      }

      if (!recipient) {
        this.showModal(
          '⚠️ Missing Recipient',
          'Please enter the recipient wallet address.',
          'warning'
        )
        return
      }

      // Validate recipient address
      try {
        new PublicKey(recipient)
      } catch {
        this.showModal(
          '⚠️ Invalid Address',
          'Please enter a valid Solana wallet address.',
          'warning'
        )
        return
      }

      const btn = document.querySelector('#send-to-user-form button') as HTMLButtonElement
      btn.disabled = true
      this.showLoading('Creating private payment link...')

      try {
        this.updateLoading('Depositing to recipient wallet...')

        // CORRECTED: Deposit directly with recipient as the owner
        // The recipient will be able to withdraw this UTXO because it's encrypted with their key
        const { executeUserPaysDeposit } = await import('./flows/depositFlow.js')
        
        const depositTx = await executeUserPaysDeposit(
          {
            linkId: `link_${Date.now()}`,
            amount: amount.toString(),
            publicKey: this.walletAddress!,
            recipientAddress: recipient,  // ✅ CRITICAL: Recipient owns this UTXO
            token: 'SOL'
          },
          window.solana
        )

        this.hideLoading()
        this.showModal(
          '✅ Payment Sent',
          `You have successfully sent ${amount} SOL to ${recipient.slice(0, 8)}... privately!\n\nThe recipient can now withdraw to their wallet.`,
          'success',
          `TX: ${depositTx.slice(0, 20)}...`
        )

        // Reset form
        amountInput.value = ''
        recipientInput.value = ''

      } catch (err: any) {
        this.hideLoading()
        console.error('Transfer failed:', err)
        this.showModal(
          '❌ Transfer Failed',
          `Could not send your payment.`,
          'error',
          err.message
        )
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
