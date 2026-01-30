/// <reference types="vite/client" />

import { Connection } from '@solana/web3.js'
import { SavingsSDK } from './services/savingsSDK.js'

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

  init() {
    if (this.bound) return
    this.bound = true
    this.bindEvents()
    this.setStatus('Ready — Connect wallet to start')
  }

  private bindEvents() {
    // Tab switching
    document.getElementById('mode-savings')?.addEventListener('click', () => {
      this.switchMode('savings')
    })
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
      this.handleSend(e)
    })
    document.getElementById('withdraw-form')?.addEventListener('submit', (e) => {
      this.handleWithdraw(e)
    })
  }

  private switchMode(mode: 'savings' | 'send' | 'withdraw' | 'profile') {
    // Update active button
    document.querySelectorAll('.mode-btn').forEach(btn => {
      btn.classList.remove('bg-gradient-to-r', 'from-purple-600', 'to-blue-600', 'text-white')
      btn.classList.add('text-gray-400')
    })

    const active = document.getElementById(`mode-${mode}`)
    active?.classList.add('bg-gradient-to-r', 'from-purple-600', 'to-blue-600', 'text-white')

    // Hide all sections
    document.getElementById('section-savings')?.classList.add('hidden')
    document.getElementById('section-send')?.classList.add('hidden')
    document.getElementById('section-withdraw')?.classList.add('hidden')
    document.getElementById('section-profile')?.classList.add('hidden')

    // Show selected section
    document.getElementById(`section-${mode}`)?.classList.remove('hidden')

    // Load specific mode
    if (mode === 'savings') {
      this.loadSavingsDashboard()
    } else if (mode === 'profile') {
      this.loadProfile()
    }
  }

  private async connectWallet() {
    if (!window.solana || !window.solana.isPhantom) {
      alert('❌ Phantom wallet not found. Install from phantom.app')
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

      this.setStatus('✅ Wallet connected')
      
      // Initialize account
      if (this.walletAddress) {
        await SavingsSDK.initAccount(this.walletAddress, 'SOL')
      }
    } catch (err: any) {
      this.setStatus(`❌ Connection failed: ${err.message}`)
    }
  }

  private disconnectWallet() {
    this.walletAddress = null
    document.getElementById('wallet-connected')?.classList.add('hidden')
    document.getElementById('connect-wallet-btn')?.classList.remove('hidden')
    this.setStatus('Disconnected')
  }

  private async handleSend(e: Event) {
    e.preventDefault()
    if (!this.walletAddress) {
      alert('❌ Connect wallet first')
      return
    }

    const form = e.target as HTMLFormElement
    const amount = (document.getElementById('send-amount-input') as HTMLInputElement).value
    const recipient = (document.getElementById('send-recipient-input') as HTMLInputElement).value

    if (!amount || !recipient) {
      alert('❌ Fill all required fields')
      return
    }

    try {
      const btn = document.getElementById('send-submit-btn') as HTMLButtonElement
      btn.disabled = true
      this.setStatus('⏳ Sending...')

      const wallet = this.getWallet()
      await SavingsSDK.sendFromSavings({
        amount: parseFloat(amount),
        assetType: 'SOL',
        recipientAddress: recipient,
        wallet,
      })

      this.setStatus('✅ Sent successfully!')
      form.reset()
      btn.disabled = false
      alert('✅ Transaction sent!')
    } catch (err: any) {
      this.setStatus(`❌ Error: ${err.message}`)
      const btn = document.getElementById('send-submit-btn') as HTMLButtonElement
      btn.disabled = false
      alert(`❌ ${err.message}`)
    }
  }

  private async handleWithdraw(e: Event) {
    e.preventDefault()
    if (!this.walletAddress) {
      alert('❌ Connect wallet first')
      return
    }

    const form = e.target as HTMLFormElement
    const amount = (document.getElementById('withdraw-amount-input') as HTMLInputElement).value

    if (!amount) {
      alert('❌ Enter amount')
      return
    }

    try {
      const btn = document.getElementById('withdraw-submit-btn') as HTMLButtonElement
      btn.disabled = true
      this.setStatus('⏳ Withdrawing...')

      const wallet = this.getWallet()
      await SavingsSDK.withdrawFromSavings({
        amount: parseFloat(amount),
        assetType: 'SOL',
        wallet,
      })

      this.setStatus('✅ Withdrawn successfully!')
      form.reset()
      btn.disabled = false
      alert('✅ Withdrawal complete!')
    } catch (err: any) {
      this.setStatus(`❌ Error: ${err.message}`)
      const btn = document.getElementById('withdraw-submit-btn') as HTMLButtonElement
      btn.disabled = false
      alert(`❌ ${err.message}`)
    }
  }

  private async loadProfile() {
    if (!this.walletAddress) return

    try {
      this.setStatus('⏳ Loading profile...')
      const profile = await SavingsSDK.getSavingsProfile(this.walletAddress)
      
      const container = document.getElementById('profile-container')
      if (!container) return

      const balanceInSOL = (balance: string) => {
        try {
          return (BigInt(balance) / BigInt(1e9)).toString()
        } catch {
          return '0'
        }
      }

      container.innerHTML = `
        <div class="gradient-border rounded-3xl p-8 glow-effect">
          <div class="grid grid-cols-3 gap-6">
            <div class="text-center p-6 rounded-xl bg-purple-500/10 border border-purple-500/20">
              <div class="text-sm text-gray-400 mb-2">Current Balance</div>
              <div class="text-3xl font-bold text-purple-400">${balanceInSOL(profile.currentBalance)}</div>
              <div class="text-xs text-gray-500 mt-2">${profile.assetType}</div>
            </div>
            <div class="text-center p-6 rounded-xl bg-green-500/10 border border-green-500/20">
              <div class="text-sm text-gray-400 mb-2">Total Deposited</div>
              <div class="text-3xl font-bold text-green-400">+${balanceInSOL(profile.totalDeposited)}</div>
              <div class="text-xs text-gray-500 mt-2">${profile.assetType}</div>
            </div>
            <div class="text-center p-6 rounded-xl bg-red-500/10 border border-red-500/20">
              <div class="text-sm text-gray-400 mb-2">Total Withdrawn</div>
              <div class="text-3xl font-bold text-red-400">-${balanceInSOL(profile.totalWithdrawn)}</div>
              <div class="text-xs text-gray-500 mt-2">${profile.assetType}</div>
            </div>
          </div>
        </div>

        ${profile.transactions.length > 0 ? `
          <div class="gradient-border rounded-3xl p-8 glow-effect">
            <h3 class="text-xl font-bold text-white mb-6">Recent Transactions</h3>
            <div class="space-y-3">
              ${profile.transactions.slice(0, 10).map((tx: any) => `
                <div class="flex justify-between items-center p-4 rounded-xl bg-gray-900/50 border border-gray-700/30">
                  <div>
                    <div class="font-semibold text-white">
                      ${tx.type === 'deposit' ? '💳 Deposit' : tx.type === 'send' ? '📤 Send' : '💸 Withdraw'}
                    </div>
                    <div class="text-xs text-gray-400">${new Date(tx.createdAt).toLocaleDateString()}</div>
                  </div>
                  <div class="text-right">
                    <div class="font-bold ${tx.type === 'deposit' ? 'text-green-400' : 'text-red-400'}">
                      ${tx.type === 'deposit' ? '+' : '-'}${balanceInSOL(tx.amount)} ${profile.assetType}
                    </div>
                    <div class="text-xs text-gray-400">${tx.status}</div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
      `
      
      this.setStatus('✅ Profile loaded')
    } catch (err: any) {
      this.setStatus(`❌ Error: ${err.message}`)
    }
  }

  private async loadSavingsDashboard() {
    if (!this.walletAddress) {
      this.setStatus('❌ Connect wallet first')
      return
    }

    try {
      this.setStatus('⏳ Loading dashboard...')
      
      // Ensure account exists
      await SavingsSDK.initAccount(this.walletAddress, 'SOL')
      
      // Load React component
      const { renderSavingsDashboard } = await import('./components/SavingsDashboardRoot.js')
      renderSavingsDashboard(this.walletAddress, this.getWallet())
      
      this.setStatus('✅ Dashboard loaded')
    } catch (err: any) {
      console.error('Error loading dashboard:', err)
      this.setStatus('⚠️ Dashboard: ' + (err.message || 'Check console'))
    }
  }

  private getWallet() {
    if (!window.solana) throw new Error('Wallet not connected')
    const connection = new Connection(SOLANA_RPC_URL, 'confirmed')

    return {
      publicKey: window.solana.publicKey,
      signMessage: (message: Uint8Array) => window.solana.signMessage(message),
      signTransaction: (tx: any) => window.solana.signTransaction(tx),
      signAllTransactions: (txs: any[]) => window.solana.signAllTransactions(txs),
      sendTransaction: async (signedTx: any, options?: any) => {
        const serialized = signedTx.serialize()
        return await connection.sendRawTransaction(serialized, {
          preflightCommitment: options?.preflightCommitment || 'confirmed',
          skipPreflight: false,
        })
      },
    }
  }

  private setStatus(msg: string) {
    const el = document.getElementById('status-message')
    if (el) el.textContent = msg
    if (import.meta.env.DEV) console.log(msg)
  }
}
