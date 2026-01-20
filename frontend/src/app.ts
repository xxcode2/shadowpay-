// Config dari environment atau default
const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001/api'
const SOLANA_RPC = (import.meta as any).env?.VITE_SOLANA_RPC || 'https://mainnet.helius-rpc.com/?api-key=c455719c-354b-4a44-98d4-27f8a18aa79c'

interface WalletState {
  connected: boolean
  address: string | null
  publicKey: any | null
}

interface PaymentLink {
  id: string
  amount: number
  assetType: 'SOL' | 'USDC' | 'USDT'
  claimed: boolean
  claimedBy: string | null
}

export class App {
  private walletState: WalletState = {
    connected: false,
    address: null,
    publicKey: null,
  }

  private connection: any
  private appElement: HTMLElement

  constructor() {
    // Lazy load connection only if needed
    this.connection = null
    this.appElement = document.getElementById('app')!
  }

  async init() {
    console.log('🚀 ShadowPay Frontend Initializing...')
    this.renderUI()
    this.setupEventListeners()
  }

  private renderUI() {
    this.appElement.innerHTML = `
      <div class="min-h-screen bg-gradient-to-b from-slate-950 via-purple-900 to-slate-950">
        <!-- Header -->
        <header class="border-b border-purple-500/20 bg-slate-950/50 backdrop-blur">
          <div class="max-w-6xl mx-auto px-4 py-6 flex justify-between items-center">
            <div class="font-display text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              ShadowPay
            </div>
            <button id="wallet-btn" class="px-6 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg font-semibold transition">
              🔌 Connect Wallet
            </button>
          </div>
        </header>

        <!-- Main Content -->
        <main class="max-w-6xl mx-auto px-4 py-12">
          <!-- Tabs -->
          <div class="flex gap-4 mb-8 border-b border-purple-500/20">
            <button id="tab-create" class="tab-btn active px-4 py-2 font-semibold text-purple-400 border-b-2 border-purple-500">
              💸 Create Link
            </button>
            <button id="tab-claim" class="tab-btn px-4 py-2 font-semibold text-gray-400 hover:text-purple-400">
              🎁 Claim Link
            </button>
          </div>

          <!-- Tab Content -->
          <div id="tab-content" class="grid grid-cols-1 md:grid-cols-2 gap-8">
            <!-- Create Link Panel -->
            <div id="panel-create" class="glass-card p-8 rounded-xl glow-effect">
              <h2 class="text-2xl font-display font-bold mb-6">Create Payment Link</h2>
              
              <form id="form-create" class="space-y-4">
                <div>
                  <label class="block text-sm text-gray-300 mb-2">Amount</label>
                  <input 
                    type="number" 
                    id="input-amount" 
                    placeholder="0.01" 
                    min="0.001"
                    step="0.001"
                    class="w-full px-4 py-2 bg-slate-800 border border-purple-500/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label class="block text-sm text-gray-300 mb-2">Asset Type</label>
                  <select id="select-asset" class="w-full px-4 py-2 bg-slate-800 border border-purple-500/30 rounded-lg text-white focus:outline-none focus:border-purple-500">
                    <option value="SOL">SOL (Solana)</option>
                    <option value="USDC">USDC (USD Coin)</option>
                    <option value="USDT">USDT (Tether)</option>
                  </select>
                </div>

                <button 
                  type="submit"
                  class="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-lg font-semibold transition mt-6"
                >
                  Create Link
                </button>
              </form>

              <!-- Result -->
              <div id="result-create" class="hidden mt-8 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                <h3 class="font-semibold text-green-400 mb-2">✅ Link Created!</h3>
                <div class="text-sm text-gray-300 mb-4">
                  Share this link:
                  <div class="mt-2 p-2 bg-slate-800 rounded text-purple-400 break-all" id="link-url"></div>
                </div>
                <button id="btn-copy-link" class="text-sm px-3 py-1 bg-purple-600 hover:bg-purple-700 rounded transition">
                  📋 Copy Link
                </button>
              </div>
            </div>

            <!-- Claim Link Panel -->
            <div id="panel-claim" class="hidden glass-card p-8 rounded-xl glow-effect">
              <h2 class="text-2xl font-display font-bold mb-6">Claim Payment</h2>
              
              <form id="form-claim" class="space-y-4">
                <div>
                  <label class="block text-sm text-gray-300 mb-2">Link ID or URL</label>
                  <input 
                    type="text" 
                    id="input-link-id" 
                    placeholder="Paste payment link..."
                    class="w-full px-4 py-2 bg-slate-800 border border-purple-500/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                  />
                </div>

                <button 
                  type="submit"
                  class="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-lg font-semibold transition mt-6"
                >
                  Verify & Claim
                </button>
              </form>

              <!-- Link Details -->
              <div id="result-claim" class="hidden mt-8 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                <div class="text-sm space-y-2 text-gray-300">
                  <div>Amount: <span id="claim-amount" class="text-purple-400 font-semibold"></span></div>
                  <div>Asset: <span id="claim-asset" class="text-purple-400 font-semibold"></span></div>
                  <div>Status: <span id="claim-status" class="text-yellow-400 font-semibold">Unclaimed ✓</span></div>
                </div>
                <button 
                  id="btn-claim-now"
                  class="w-full mt-4 py-2 bg-green-600 hover:bg-green-700 rounded font-semibold transition"
                >
                  🎁 Claim Now
                </button>
              </div>
            </div>
          </div>

          <!-- Info Section -->
          <div class="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div class="glass-card p-6 rounded-lg">
              <div class="text-2xl mb-2">🔒</div>
              <h3 class="font-semibold mb-2">Non-Custodial</h3>
              <p class="text-sm text-gray-400">No one holds your funds. Only you control your assets.</p>
            </div>
            <div class="glass-card p-6 rounded-lg">
              <div class="text-2xl mb-2">👻</div>
              <h3 class="font-semibold mb-2">Private</h3>
              <p class="text-sm text-gray-400">Zero-knowledge proofs hide transaction details.</p>
            </div>
            <div class="glass-card p-6 rounded-lg">
              <div class="text-2xl mb-2">⚡</div>
              <h3 class="font-semibold mb-2">Fast</h3>
              <p class="text-sm text-gray-400">Powered by Solana blockchain. Instant transfers.</p>
            </div>
          </div>
        </main>

        <!-- Status Bar -->
        <footer class="border-t border-purple-500/20 bg-slate-950/50 backdrop-blur mt-16">
          <div class="max-w-6xl mx-auto px-4 py-4 text-sm text-gray-400">
            <div id="status-message">Ready</div>
            <div class="text-xs text-gray-500 mt-1">Backend: ${API_URL}</div>
          </div>
        </footer>
      </div>
    `
  }

  private setupEventListeners() {
    // Wallet button
    document.getElementById('wallet-btn')?.addEventListener('click', () => this.connectWallet())

    // Tab switching
    document.getElementById('tab-create')?.addEventListener('click', () => this.switchTab('create'))
    document.getElementById('tab-claim')?.addEventListener('click', () => this.switchTab('claim'))

    // Forms
    document.getElementById('form-create')?.addEventListener('submit', (e) => this.handleCreateLink(e))
    document.getElementById('form-claim')?.addEventListener('submit', (e) => this.handleClaimLink(e))

    // Copy link button
    document.getElementById('btn-copy-link')?.addEventListener('click', () => this.copyLinkToClipboard())

    // Claim button
    document.getElementById('btn-claim-now')?.addEventListener('click', () => this.processWithdrawal())
  }

  private switchTab(tab: 'create' | 'claim') {
    const tabs = document.querySelectorAll('.tab-btn')
    const panels = document.querySelectorAll('[id^="panel-"]')

    tabs.forEach((t) => t.classList.remove('active', 'text-purple-400', 'border-b-2', 'border-purple-500'))
    tabs.forEach((t) => t.classList.add('text-gray-400'))

    if (tab === 'create') {
      document.getElementById('tab-create')?.classList.add('active', 'text-purple-400', 'border-b-2', 'border-purple-500')
      document.getElementById('panel-create')?.classList.remove('hidden')
      document.getElementById('panel-claim')?.classList.add('hidden')
    } else {
      document.getElementById('tab-claim')?.classList.add('active', 'text-purple-400', 'border-b-2', 'border-purple-500')
      document.getElementById('panel-create')?.classList.add('hidden')
      document.getElementById('panel-claim')?.classList.remove('hidden')
    }
  }

  private async connectWallet() {
    try {
      this.setStatus('🔌 Connecting wallet...')

      if (!window.solana) {
        alert('Please install Phantom wallet')
        return
      }

      const response = await window.solana.connect()
      this.walletState.publicKey = response.publicKey
      this.walletState.address = response.publicKey.toString()
      this.walletState.connected = true

      const btn = document.getElementById('wallet-btn')!
      btn.textContent = `✅ ${this.walletState.address.slice(0, 4)}...${this.walletState.address.slice(-4)}`

      this.setStatus('✅ Wallet connected')
    } catch (err) {
      this.setStatus(`❌ Wallet connection failed: ${err}`)
    }
  }

  private async handleCreateLink(e: Event) {
    e.preventDefault()

    if (!this.walletState.connected) {
      alert('Please connect wallet first')
      return
    }

    const amount = (document.getElementById('input-amount') as HTMLInputElement).value
    const assetType = (document.getElementById('select-asset') as HTMLSelectElement).value

    if (!amount || parseFloat(amount) <= 0) {
      alert('Please enter valid amount')
      return
    }

    try {
      this.setStatus('💸 Creating payment link...')

      // 🔐 INTEGRATION POINT 1: Privacy Cash SDK
      // TODO: Replace with actual SDK call
      // const result = await sdk.deposit({ 
      //   amount: parseFloat(amount), 
      //   assetType 
      // })
      // const depositTx = result.signature
      
      const depositTx = 'demo-tx-' + Date.now() // Mock transaction

      // Backend receives the deposit event
      const response = await fetch(`${API_URL}/deposit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseFloat(amount),
          assetType,
          depositTx,
        }),
      })

      if (!response.ok) throw new Error('Failed to create link')

      const data = await response.json()
      const linkUrl = `${window.location.origin}?link=${data.linkId}`

      document.getElementById('link-url')!.textContent = linkUrl
      document.getElementById('result-create')?.classList.remove('hidden')

      this.setStatus(`✅ Link created: ${data.linkId}`)
    } catch (err) {
      this.setStatus(`❌ Error: ${err}`)
    }
  }

  private async handleClaimLink(e: Event) {
    e.preventDefault()

    const linkInput = (document.getElementById('input-link-id') as HTMLInputElement).value
    let linkId = linkInput

    // Extract linkId from URL if needed
    if (linkInput.includes('?link=')) {
      linkId = linkInput.split('?link=')[1]
    }

    if (!linkId) {
      alert('Please enter link ID or URL')
      return
    }

    try {
      this.setStatus('🔍 Verifying link...')

      const response = await fetch(`${API_URL}/link/${linkId}`)
      if (!response.ok) throw new Error('Link not found')

      const link: PaymentLink = await response.json()

      document.getElementById('claim-amount')!.textContent = `${link.amount} ${link.assetType}`
      document.getElementById('claim-asset')!.textContent = link.assetType
      document.getElementById('claim-status')!.textContent = link.claimed ? '❌ Already Claimed' : '✓ Available'
      document.getElementById('result-claim')?.classList.remove('hidden')

      // Store linkId for claim action
      ;(window as any).currentLinkId = linkId

      this.setStatus(`✅ Link verified: ${link.amount} ${link.assetType}`)
    } catch (err) {
      this.setStatus(`❌ Error: ${err}`)
    }
  }

  private async processWithdrawal() {
    if (!this.walletState.connected) {
      alert('Please connect wallet first')
      return
    }

    const linkId = (window as any).currentLinkId
    if (!linkId) return

    try {
      this.setStatus('💰 Processing withdrawal...')

      // 🔐 INTEGRATION POINT 2: Privacy Cash SDK
      // TODO: Replace with actual SDK call
      // const result = await sdk.withdraw({
      //   linkId,
      //   recipientAddress: this.walletState.address,
      //   amount: ... // from link data
      // })
      // const withdrawTx = result.signature

      const withdrawTx = 'demo-tx-' + Date.now() // Mock transaction

      // Backend records the withdrawal
      const response = await fetch(`${API_URL}/withdraw`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          linkId,
          recipientAddress: this.walletState.address,
          withdrawTx,
        }),
      })

      if (!response.ok) throw new Error('Withdrawal failed')

      this.setStatus(`✅ Withdrawal successful! Tx: ${withdrawTx}`)
    } catch (err) {
      this.setStatus(`❌ Error: ${err}`)
    }
  }

  private copyLinkToClipboard() {
    const linkText = document.getElementById('link-url')?.textContent
    if (linkText) {
      navigator.clipboard.writeText(linkText)
      alert('Link copied!')
    }
  }

  private setStatus(message: string) {
    const statusEl = document.getElementById('status-message')
    if (statusEl) statusEl.textContent = message
    console.log(message)
  }
}

// Extend window for Phantom wallet
declare global {
  interface Window {
    solana?: any
  }
}
