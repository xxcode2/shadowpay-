/// <reference types="vite/client" />

import { Connection, PublicKey, LAMPORTS_PER_SOL, Transaction, SystemProgram } from '@solana/web3.js'
import type { DepositRequest } from './flows/depositFlow'
import { executeDeposit } from './flows/depositFlowV2'
import { CONFIG } from './config'
import logo from '@/assets/pay.png'

const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL ||
  'https://shadowpay-backend-production.up.railway.app'

const SOLANA_RPC_URL = CONFIG.SOLANA_RPC_URL

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
  private backendUrl: string = BACKEND_URL
  private historyData: { sent: any[], received: any[] } = { sent: [], received: [] }
  private currentHistoryPage: number = 1
  private historyTab: 'sent' | 'received' = 'sent'
  private readonly ITEMS_PER_PAGE = 10

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
    document.getElementById('mode-ai')?.addEventListener('click', () => this.switchMode('ai'))
    document.getElementById('mode-about')?.addEventListener('click', () => this.switchMode('about'))

    // Wallet
    document.getElementById('connect-wallet-btn')?.addEventListener('click', () => this.connectWallet())
    document.getElementById('disconnect-wallet-btn')?.addEventListener('click', () => this.disconnectWallet())

    // Forms
    document.getElementById('send-form')?.addEventListener('submit', (e) => this.handleSend(e))
    document.getElementById('send-to-user-form')?.addEventListener('submit', (e) => this.handleSendToUser(e))
    
    // AI Assistant
    document.getElementById('ai-form')?.addEventListener('submit', (e) => this.handleAISubmit(e))
    
    // AI Suggestions
    document.querySelectorAll('.ai-suggestion').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const button = e.target as HTMLElement
        const command = button.getAttribute('data-command')
        if (command) {
          const input = document.getElementById('ai-input') as HTMLInputElement
          if (input) {
            input.value = command
            input.focus()
          }
        }
      })
    })
    
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

  private switchMode(mode: 'deposit' | 'send' | 'ai' | 'about') {
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
    document.getElementById('section-ai')?.classList.add('hidden')
    document.getElementById('section-about')?.classList.add('hidden')

    // Show selected section
    document.getElementById(`section-${mode}`)?.classList.remove('hidden')

    // Load data for specific modes
    if (mode === 'deposit') {
      this.updateDepositBalance()
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
      // ✅ NEW: Create link on backend FIRST
      console.log('📝 Creating payment link on backend...')
      this.updateLoading('Creating payment link...')
      
      const linkRes = await fetch(`${this.backendUrl}/api/create-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amount,
          assetType: token,
          creatorAddress: this.walletAddress
        })
      })

      if (!linkRes.ok) {
        const error = await linkRes.json().catch(() => ({ error: 'Failed to create link' }))
        throw new Error(error.error || 'Failed to create link')
      }

      const { linkId } = await linkRes.json()
      console.log(`✅ Link created: ${linkId}`)

      this.updateLoading(`Depositing ${amount} ${token} to Privacy Cash...`)
      
      // ✅ Use new V2 deposit flow with official SDK
      const depositTx = await executeDeposit(
        {
          linkId,
          amount: amount.toString(),
          publicKey: this.walletAddress!,
          token
        },
        window.solana
      )

      this.hideLoading()
      this.showModal(
        '✅ Deposit Successful',
        `You have successfully deposited ${amount} ${token} to Privacy Cash!\n\nYour funds are now secure and private.`,
        'success',
        `TX: ${depositTx.slice(0, 20)}...`
      )

      // Reset form
      amountInput.value = ''
      if (tokenSelect) {
        tokenSelect.value = 'SOL'
        const symbol = document.getElementById('send-token-symbol')
        if (symbol) symbol.textContent = 'SOL'
      }

      // Reload balance after delay
      await new Promise(resolve => setTimeout(resolve, 2000))
      await this.updateDepositBalance()

    } catch (err: any) {
      this.hideLoading()
      console.error('Deposit failed:', err)
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
    this.showLoading('Sending from your private balance...')

    try {
      // ✅ DIRECT WITHDRAW & SEND (NO LINK CREATION)
      // User withdraws from their private balance and sends to recipient address
      console.log('💸 Withdrawing from private balance...')
      this.updateLoading('Signing transaction...')
      
      // Import withdraw flow
      const { executeWithdraw } = await import('./flows/withdrawFlowV2')
      
      const withdrawResult = await executeWithdraw(
        {
          walletAddress: this.walletAddress!,
          recipientAddress: recipient,  // Withdraw directly to recipient
          amount: amount.toString()
        },
        window.solana
      )

      this.hideLoading()
      this.showModal(
        '✅ Sent Successfully',
        `You have successfully sent ${amount} SOL to ${recipient.slice(0, 8)}...${recipient.slice(-4)}!`,
        'success',
        `TX: ${withdrawResult.transactionSignature.slice(0, 20)}...`
      )

      // Reset form
      amountInput.value = ''
      recipientInput.value = ''

    } catch (err: any) {
      this.hideLoading()
      console.error('Send failed:', err)
      this.showModal(
        '❌ Send Failed',
        `Could not send your payment.`,
        'error',
        err.message
      )
    } finally {
      btn.disabled = false
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

  private async handleAISubmit(e: Event) {
    e.preventDefault()

    if (!this.walletAddress) {
      this.addAIChatMessage('❌ Please connect your wallet first', 'bot')
      return
    }

    const input = document.getElementById('ai-input') as HTMLInputElement
    const command = input.value.trim()
    
    if (!command) return

    // Add user message
    this.addAIChatMessage(command, 'user')
    input.value = ''

    try {
      // Import AI assistant
      const { parseIntent, executeIntent } = await import('./components/aiAssistant')

      // Parse intent
      const intent = parseIntent(command)

      if (intent.type === 'unknown') {
        this.addAIChatMessage(
          '❓ I don\'t understand. Try:\n• "deposit 0.01 SOL"\n• "send 0.01 SOL to <address>"',
          'bot'
        )
        return
      }

      // Prepare wallet object
      const wallet = window.solana

      // Debug: Log wallet capabilities
      console.log('🔍 Wallet validation debug:')
      console.log('  Has wallet:', !!wallet)
      console.log('  Has publicKey:', !!wallet?.publicKey)
      console.log('  Has signTransaction:', typeof wallet?.signTransaction)
      console.log('  Has sendTransaction:', typeof wallet?.sendTransaction)
      console.log('  Has signMessage:', typeof wallet?.signMessage)
      console.log('  Wallet methods:', Object.getOwnPropertyNames(wallet || {}).slice(0, 10))

      // Validate essential methods (don't require sendTransaction, it might be called differently)
      if (!wallet || !wallet.publicKey) {
        this.addAIChatMessage(
          '❌ Wallet not connected. Please connect your Phantom wallet first.',
          'bot'
        )
        return
      }

      if (typeof wallet.signTransaction !== 'function' && typeof wallet.signMessage !== 'function') {
        this.addAIChatMessage(
          '❌ Wallet not fully initialized. Please try reconnecting your wallet.',
          'bot'
        )
        return
      }

      // Show progress
      const progressMessageId = this.addAIChatMessage('⏳ Processing...', 'bot')

      // Execute intent
      const result = await executeIntent(
        intent,
        {
          input: command,
          wallet,
          connection: this.connection
        },
        (progress: string) => {
          this.updateAIChatMessage(progressMessageId, progress)
        }
      )

      // Message already updated by executeIntent via onProgress callback
      // Don't overwrite - keep the actual result message
    } catch (error: any) {
      const errorMsg = error.message || String(error)
      this.addAIChatMessage(`❌ Error: ${errorMsg}`, 'bot')
    }
  }

  private addAIChatMessage(
    message: string,
    sender: 'user' | 'bot'
  ): string {
    const container = document.getElementById('ai-chat-container')
    if (!container) return ''

    // Clear initial message if first real message
    if (container.querySelector('.py-8')) {
      const initMsg = container.querySelector('.py-8')
      if (initMsg) initMsg.remove()
    }

    const msgId = `msg-${Date.now()}`
    const messageEl = document.createElement('div')
    messageEl.id = msgId
    messageEl.className = `flex gap-2 ${sender === 'user' ? 'justify-end' : 'justify-start'} animate-fadeIn`

    const content = document.createElement('div')
    const isError = message.includes('❌')
    const isSuccess = message.includes('✅')
    
    content.className = `px-4 py-3 rounded-lg text-sm leading-relaxed break-words ${
      sender === 'user'
        ? 'max-w-sm bg-gradient-to-r from-purple-600 to-purple-500 text-white shadow-lg shadow-purple-500/20'
        : isError
        ? 'max-w-sm bg-red-900/30 text-red-100 border border-red-500/30'
        : isSuccess
        ? 'max-w-sm bg-emerald-900/30 text-emerald-100 border border-emerald-500/30'
        : 'max-w-sm bg-gray-800/50 text-gray-100 border border-gray-700/30'
    }`
    
    // Format message with better line breaks and structure
    const formatted = message
      .replace(/\n/g, '<br/>')
      .replace(/<br\/>TX:/g, '<br/><span class="text-xs text-gray-400 font-mono">TX:</span>')
      .replace(/Amount:/g, '<br/><span class="text-xs text-gray-400">Amount:</span>')
      .replace(/To:/g, '<br/><span class="text-xs text-gray-400">To:</span>')
    
    content.innerHTML = formatted

    messageEl.appendChild(content)
    container.appendChild(messageEl)

    // Scroll to bottom
    container.scrollTop = container.scrollHeight

    return msgId
  }

  private updateAIChatMessage(messageId: string, message: string) {
    const messageEl = document.getElementById(messageId)
    if (messageEl) {
      const content = messageEl.querySelector('div')
      if (content) {
        const isError = message.includes('❌')
        const isSuccess = message.includes('✅')
        
        // Update styling based on message content
        if (isError) {
          content.className = 'max-w-sm px-4 py-3 rounded-lg text-sm leading-relaxed break-words bg-red-900/30 text-red-100 border border-red-500/30'
        } else if (isSuccess) {
          content.className = 'max-w-sm px-4 py-3 rounded-lg text-sm leading-relaxed break-words bg-emerald-900/30 text-emerald-100 border border-emerald-500/30'
        }
        
        const formatted = message
          .replace(/\n/g, '<br/>')
          .replace(/<br\/>TX:/g, '<br/><span class="text-xs text-gray-400 font-mono">TX:</span>')
          .replace(/Amount:/g, '<br/><span class="text-xs text-gray-400">Amount:</span>')
          .replace(/To:/g, '<br/><span class="text-xs text-gray-400">To:</span>')
        
        content.innerHTML = formatted
      }
      // Scroll to bottom
      const container = document.getElementById('ai-chat-container')
      if (container) {
        container.scrollTop = container.scrollHeight
      }
    }
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
