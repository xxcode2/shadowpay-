import React, { useState, useEffect } from 'react'
import { SavingsSDK } from '../services/savingsSDK.js'

const SAVINGS_STYLES = `
.savings-dashboard {
  padding: 20px;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  border-radius: 12px;
  color: #fff;
  max-width: 1000px;
  margin: 20px auto;
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
}

.dashboard-header h1 {
  margin: 0;
  font-size: 28px;
}

.refresh-btn {
  padding: 8px 16px;
  background: #0f3460;
  border: 1px solid #533483;
  color: #fff;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.refresh-btn:hover:not(:disabled) {
  background: #533483;
}

.refresh-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.balance-card {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 15px;
  margin-bottom: 30px;
}

.balance-item {
  background: rgba(255, 255, 255, 0.05);
  padding: 20px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.balance-item label {
  display: block;
  font-size: 12px;
  color: #999;
  margin-bottom: 10px;
  text-transform: uppercase;
}

.amount {
  font-size: 24px;
  font-weight: bold;
  color: #fff;
}

.amount.green {
  color: #4caf50;
}

.amount.red {
  color: #ff6b6b;
}

.tabs {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  overflow-x: auto;
}

.tab-btn {
  padding: 12px 20px;
  background: transparent;
  border: none;
  color: #999;
  cursor: pointer;
  font-size: 14px;
  border-bottom: 2px solid transparent;
  transition: all 0.2s;
  white-space: nowrap;
}

.tab-btn:hover {
  color: #fff;
}

.tab-btn.active {
  color: #fff;
  border-bottom-color: #533483;
}

.tab-content {
  min-height: 300px;
}

.action-btn {
  padding: 12px 20px;
  background: linear-gradient(135deg, #0f3460 0%, #533483 100%);
  border: none;
  color: #fff;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.action-btn:hover {
  opacity: 0.9;
}

.action-btn.send {
  background: linear-gradient(135deg, #1e88e5 0%, #1565c0 100%);
}

.action-btn.withdraw {
  background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%);
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal {
  background: #1a1a2e;
  padding: 30px;
  border-radius: 12px;
  border: 1px solid #533483;
  max-width: 400px;
  width: 90%;
  color: #fff;
}

.modal h3 {
  margin-top: 0;
  margin-bottom: 20px;
}

.modal input, .modal select {
  width: 100%;
  padding: 12px;
  margin-bottom: 20px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid #533483;
  border-radius: 6px;
  color: #fff;
  font-size: 14px;
  box-sizing: border-box;
}

.modal input::placeholder {
  color: #666;
}

.modal-buttons {
  display: flex;
  gap: 10px;
}

.modal-buttons button {
  flex: 1;
  padding: 12px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.modal-buttons button[type="submit"] {
  background: #4caf50;
  color: #fff;
}

.modal-buttons button[type="submit"]:hover:not(:disabled) {
  background: #45a049;
}

.modal-buttons button.cancel {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.modal-buttons button.cancel:hover {
  background: rgba(255, 255, 255, 0.2);
}

.modal-buttons button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.transactions-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.transaction-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px;
  background: rgba(255, 255, 255, 0.05);
  border-left: 4px solid #533483;
  border-radius: 6px;
}

.transaction-item:hover {
  background: rgba(255, 255, 255, 0.08);
}

.tx-type {
  font-weight: bold;
  margin-bottom: 5px;
}

.tx-amount {
  text-align: right;
}

.tx-amount.green {
  color: #4caf50;
}

.tx-amount.red {
  color: #ff6b6b;
}

.empty-state {
  text-align: center;
  padding: 40px;
  color: #999;
}

.loading {
  background: rgba(0, 0, 0, 0.3);
  border-radius: 8px;
}

.error {
  color: #ff6b6b;
}
`

interface SavingsProfile {
  id: string
  walletAddress: string
  assetType: string
  totalDeposited: string
  totalWithdrawn: string
  currentBalance: string
  lastSyncedAt?: string
  transactions: any[]
  autoDeposits: any[]
  goals: any[]
  createdAt: string
  updatedAt: string
}

interface SavingsDashboardProps {
  walletAddress: string
  wallet: any
}

export const SavingsDashboard: React.FC<SavingsDashboardProps> = ({ walletAddress, wallet }) => {
  const [profile, setProfile] = useState<SavingsProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('overview')

  useEffect(() => {
    // Add styles
    if (!document.getElementById('savings-styles')) {
      const styleEl = document.createElement('style')
      styleEl.id = 'savings-styles'
      styleEl.textContent = SAVINGS_STYLES
      document.head.appendChild(styleEl)
    }

    loadProfile()
  }, [walletAddress])

  const loadProfile = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await SavingsSDK.getSavingsProfile(walletAddress)
      setProfile(data)
    } catch (err: any) {
      setError(err.message)
      console.error('❌ Error loading profile:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="savings-dashboard loading">
        <p>Loading savings profile...</p>
      </div>
    )
  }

  if (error) {
    // Check if it's an account not found error
    const isAccountNotFound = error.includes('not found') || error.includes('404')
    
    return (
      <div className="savings-dashboard error">
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <p style={{ fontSize: '16px', marginBottom: '20px', color: '#ff6b6b' }}>
            {isAccountNotFound ? '💡 No savings account yet' : `❌ ${error}`}
          </p>
          {isAccountNotFound && (
            <p style={{ fontSize: '14px', color: '#999', marginBottom: '20px' }}>
              Click Retry to initialize your savings account
            </p>
          )}
          <button className="action-btn" onClick={loadProfile}>
            {isAccountNotFound ? 'Initialize Account' : 'Retry'}
          </button>
        </div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="savings-dashboard">
        <div className="empty-state">
          <p>No savings account found</p>
          <button className="action-btn" style={{ marginTop: '20px' }} onClick={loadProfile}>
            Try Again
          </button>
        </div>
      </div>
    )
  }

  const balanceInSOL = (balance: string) => {
    try {
      return (BigInt(balance) / BigInt(1e9)).toString()
    } catch {
      return '0'
    }
  }

  return (
    <div className="savings-dashboard">
      <div className="dashboard-header">
        <h1>💰 My Savings</h1>
        <button className="refresh-btn" onClick={loadProfile}>↻ Refresh</button>
      </div>

      {/* Balance Summary */}
      <div className="balance-card">
        <div className="balance-item">
          <label>Current Balance</label>
          <div className="amount">{balanceInSOL(profile.currentBalance)} {profile.assetType}</div>
        </div>
        <div className="balance-item">
          <label>Total Deposited</label>
          <div className="amount green">+{balanceInSOL(profile.totalDeposited)}</div>
        </div>
        <div className="balance-item">
          <label>Total Withdrawn</label>
          <div className="amount red">-{balanceInSOL(profile.totalWithdrawn)}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button
          className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button
          className={`tab-btn ${activeTab === 'transactions' ? 'active' : ''}`}
          onClick={() => setActiveTab('transactions')}
        >
          Transactions ({profile.transactions.length})
        </button>
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {activeTab === 'overview' && (
          <div>
            <h3 style={{ marginBottom: '15px' }}>Quick Actions</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px' }}>
              <button className="action-btn">💳 Deposit</button>
              <button className="action-btn send">📤 Send</button>
              <button className="action-btn withdraw">💸 Withdraw</button>
            </div>
          </div>
        )}

        {activeTab === 'transactions' && (
          <div className="transactions-list">
            {profile.transactions.length === 0 ? (
              <div className="empty-state">No transactions yet</div>
            ) : (
              profile.transactions.map((tx: any) => (
                <div key={tx.id} className="transaction-item">
                  <div>
                    <div className="tx-type">
                      {tx.type === 'deposit' && '💳 Deposit'}
                      {tx.type === 'send' && '📤 Send'}
                      {tx.type === 'withdraw' && '💸 Withdraw'}
                    </div>
                    <div style={{ fontSize: '12px', color: '#999' }}>
                      {tx.status} • {new Date(tx.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div className={`tx-amount ${tx.type === 'deposit' ? 'green' : 'red'}`} style={{ fontWeight: 'bold' }}>
                    {tx.type === 'deposit' ? '+' : '-'}{balanceInSOL(tx.amount)}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}
