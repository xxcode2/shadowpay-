/// <reference types="vite/client" />

import { Connection, PublicKey, LAMPORTS_PER_SOL, Transaction, SystemProgram } from '@solana/web3.js'

const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL ||
  'https://shadowpay-backend-production.up.railway.app'

const SOLANA_RPC_URL = 'https://mainnet.helius-rpc.com/?api-key=c455719c-354b-4a44-98d4-27f8a18aa79c'

declare global {
  interface Window {
    solana?: any
    PrivacyCash?: any
  }
}

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
    this.setStatus('Ready — Connect wallet to start')
  }

  private bindEvents() {
    // Tab switching (no savings tab anymore)
    document.getElementById('mode-send')?.addEventListener('click', () => {
      this.switchMode('send')
    })
    document.getElementById('mode-withdraw')?.addEventListener('click', () => {
      this.switchMode('withdraw')
    })
    document.getElementById('mode-profile')?.addEventListener('click', () => {
      this.switchMode('profile')
    })

    // Wallet
    document.getElementById('connect-wallet-btn')?.addEventListener('click', () => {
      this.connectWallet()
    })
    document.getElementById('disconnect-wallet-btn')?.addEventListener('click', () => {
      this.disconnectWallet()
    })

    // Forms
    document.getElementById('send-form')?.addEventListener('submit', (e) => {
      this.handleCreateLink(e)
    })
    document.getElementById('withdraw-form')?.addEventListener('submit', (e) => {
      this.handleClaimLink(e)
    })

    // Link preview on input change
    document.getElementById('claim-link-input')?.addEventListener('blur', () => {
      this.previewLink()
    })

    // Success card handlers
    document.getElementById('close-success-card')?.addEventListener('click', () => {
      document.getElementById('success-card')?.classList.add('hidden')
    })
    document.getElementById('copy-success-link-btn')?.addEventListener('click', () => {
      this.copySuccessLink()
    })
  }

  private switchMode(mode: 'send' | 'withdraw' | 'profile') {
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
    document.getElementById('section-withdraw')?.classList.add('hidden')
    document.getElementById('section-profile')?.classList.add('hidden')

    // Show selected section
    document.getElementById(`section-${mode}`)?.classList.remove('hidden')

    // Load profile data
    if (mode === 'profile') {
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

      this.setStatus('Wallet connected')
    } catch (err: any) {
      this.setStatus(`Connection failed: ${err.message}`)
    }
  }

  private disconnectWallet() {
    this.walletAddress = null
    document.getElementById('wallet-connected')?.classList.add('hidden')
    document.getElementById('connect-wallet-btn')?.classList.remove('hidden')
    this.setStatus('Disconnected')
  }

  /**
   * Create Payment Link Flow:
   * 1. User enters amount
   * 2. User signs transaction to send SOL to operator wallet
   * 3. Backend deposits to Privacy Cash pool
   * 4. User gets shareable link
   */
  private async handleCreateLink(e: Event) {
    e.preventDefault()
    if (!this.walletAddress) {
      alert('Connect wallet first')
      return
    }

    const amountInput = document.getElementById('send-amount-input') as HTMLInputElement
    const amount = parseFloat(amountInput.value)

    if (!amount || amount <= 0) {
      alert('Enter a valid amount')
      return
    }

    const btn = document.getElementById('send-submit-btn') as HTMLButtonElement
    btn.disabled = true
    this.setStatus('Creating payment link...')
    this.showLoading('Preparing transaction...')

    try {
      // Step 1: Call backend to create link and get deposit instructions
      this.updateLoading('Creating link on backend...')
      const createRes = await fetch(`${BACKEND_URL}/api/create-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          creatorAddress: this.walletAddress,
        }),
      })

      if (!createRes.ok) {
        const err = await createRes.json()
        throw new Error(err.error || 'Failed to create link')
      }

      const linkData = await createRes.json()
      const { linkId, operatorAddress, lamports } = linkData

      // Step 2: Create transaction to send SOL to operator
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

      // Get latest blockhash
      const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash()
      transaction.recentBlockhash = blockhash
      transaction.feePayer = fromPubkey

      // Sign with Phantom
      const signedTx = await window.solana.signTransaction(transaction)

      // Send transaction
      this.updateLoading('Sending transaction...')
      const txSignature = await this.connection.sendRawTransaction(signedTx.serialize())

      // Wait for confirmation
      this.updateLoading('Confirming transaction...')
      await this.connection.confirmTransaction({
        blockhash,
        lastValidBlockHeight,
        signature: txSignature,
      })

      // Step 3: Record deposit on backend
      this.updateLoading('Recording deposit...')
      const recordRes = await fetch(`${BACKEND_URL}/api/deposit/record`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          linkId,
          depositTx: txSignature,
          fromAddress: this.walletAddress,
        }),
      })

      if (!recordRes.ok) {
        console.warn('Failed to record deposit, but transaction was successful')
      }

      // Step 4: Show success with link
      this.hideLoading()
      this.showSuccessCard(linkId, amount)
      amountInput.value = ''
      this.setStatus('Payment link created!')

    } catch (err: any) {
      this.hideLoading()
      this.setStatus(`Error: ${err.message}`)
      alert(`Failed to create link: ${err.message}`)
    } finally {
      btn.disabled = false
    }
  }

  /**
   * Preview link details before claiming
   */
  private async previewLink() {
    const linkInput = document.getElementById('claim-link-input') as HTMLInputElement
    const linkId = linkInput.value.trim()

    if (!linkId) {
      document.getElementById('link-preview')?.classList.add('hidden')
      return
    }

    try {
      const res = await fetch(`${BACKEND_URL}/api/link/${linkId}`)
      if (!res.ok) {
        document.getElementById('link-preview')?.classList.add('hidden')
        return
      }

      const link = await res.json()

      const previewEl = document.getElementById('link-preview')
      const amountEl = document.getElementById('link-preview-amount')

      if (previewEl && amountEl) {
        amountEl.textContent = `${link.amount} SOL`
        previewEl.classList.remove('hidden')

        if (link.claimed) {
          amountEl.textContent = 'Already claimed'
          amountEl.classList.remove('text-green-400')
          amountEl.classList.add('text-red-400')
        }
      }
    } catch {
      document.getElementById('link-preview')?.classList.add('hidden')
    }
  }

  /**
   * Claim Payment Link Flow:
   * 1. User enters link ID
   * 2. Backend executes Privacy Cash withdrawal to user's wallet
   * 3. User receives SOL
   */
  private async handleClaimLink(e: Event) {
    e.preventDefault()
    if (!this.walletAddress) {
      alert('Connect wallet first')
      return
    }

    const linkInput = document.getElementById('claim-link-input') as HTMLInputElement
    const linkId = linkInput.value.trim()

    if (!linkId) {
      alert('Enter a link ID')
      return
    }

    const btn = document.getElementById('withdraw-submit-btn') as HTMLButtonElement
    btn.disabled = true
    this.setStatus('Claiming payment...')
    this.showLoading('Processing withdrawal...')

    try {
      // Call backend to execute withdrawal
      const res = await fetch(`${BACKEND_URL}/api/withdraw`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          linkId,
          recipientAddress: this.walletAddress,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Withdrawal failed')
      }

      this.hideLoading()
      this.setStatus('Payment claimed!')
      alert(`Success! You received ${data.amount} SOL\n\nTransaction: ${data.withdrawalTx}`)
      linkInput.value = ''
      document.getElementById('link-preview')?.classList.add('hidden')

    } catch (err: any) {
      this.hideLoading()
      this.setStatus(`Error: ${err.message}`)
      alert(`Failed to claim: ${err.message}`)
    } finally {
      btn.disabled = false
    }
  }

  /**
   * Load transaction history from backend
   */
  private async loadHistory() {
    if (!this.walletAddress) {
      const container = document.getElementById('profile-container')
      if (container) {
        container.innerHTML = `
          <div class="text-center py-12 text-gray-400">
            Connect your wallet to view history
          </div>
        `
      }
      return
    }

    this.setStatus('Loading history...')

    try {
      const res = await fetch(`${BACKEND_URL}/api/history/${this.walletAddress}`)

      if (!res.ok) {
        throw new Error('Failed to load history')
      }

      const { sent, received } = await res.json()

      const container = document.getElementById('profile-container')
      if (!container) return

      const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      }

      const sentHtml = sent.length > 0 ? `
        <div class="gradient-border rounded-3xl p-8 glow-effect">
          <h3 class="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <span class="text-2xl">📤</span> Sent Payments
          </h3>
          <div class="space-y-3">
            ${sent.map((tx: any) => `
              <div class="flex justify-between items-center p-4 rounded-xl bg-gray-900/50 border border-gray-700/30">
                <div>
                  <div class="font-mono text-sm text-gray-400">${tx.linkId.slice(0, 8)}...</div>
                  <div class="text-xs text-gray-500">${formatDate(tx.createdAt)}</div>
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
      ` : ''

      const receivedHtml = received.length > 0 ? `
        <div class="gradient-border rounded-3xl p-8 glow-effect">
          <h3 class="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <span class="text-2xl">💰</span> Received Payments
          </h3>
          <div class="space-y-3">
            ${received.map((tx: any) => `
              <div class="flex justify-between items-center p-4 rounded-xl bg-gray-900/50 border border-gray-700/30">
                <div>
                  <div class="font-mono text-sm text-gray-400">${tx.linkId.slice(0, 8)}...</div>
                  <div class="text-xs text-gray-500">${formatDate(tx.claimedAt)}</div>
                </div>
                <div class="text-right">
                  <div class="font-bold text-green-400">+${tx.amount} SOL</div>
                  <div class="text-xs text-green-400">Received</div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''

      if (sent.length === 0 && received.length === 0) {
        container.innerHTML = `
          <div class="text-center py-12">
            <div class="text-6xl mb-4">📭</div>
            <div class="text-xl text-gray-400">No transactions yet</div>
            <p class="text-gray-500 mt-2">Create or claim a payment link to get started</p>
          </div>
        `
      } else {
        container.innerHTML = sentHtml + receivedHtml
      }

      this.setStatus('History loaded')

    } catch (err: any) {
      this.setStatus(`Error: ${err.message}`)
      const container = document.getElementById('profile-container')
      if (container) {
        container.innerHTML = `
          <div class="text-center py-12 text-red-400">
            Failed to load history: ${err.message}
          </div>
        `
      }
    }
  }

  private showSuccessCard(linkId: string, amount: number) {
    const card = document.getElementById('success-card')
    const linkIdEl = document.getElementById('success-link-id')
    const linkUrlEl = document.getElementById('success-link-url') as HTMLInputElement

    const shareUrl = `${window.location.origin}/claim/${linkId}`

    if (linkIdEl) linkIdEl.textContent = linkId
    if (linkUrlEl) linkUrlEl.value = shareUrl

    card?.classList.remove('hidden')
  }

  private copySuccessLink() {
    const linkUrlEl = document.getElementById('success-link-url') as HTMLInputElement
    if (linkUrlEl) {
      navigator.clipboard.writeText(linkUrlEl.value)

      const notification = document.getElementById('copy-notification')
      notification?.classList.remove('hidden')
      setTimeout(() => {
        notification?.classList.add('hidden')
      }, 2000)
    }
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

  private setStatus(msg: string) {
    const el = document.getElementById('status-message')
    if (el) el.textContent = msg
    if (import.meta.env.DEV) console.log(msg)
  }
}
