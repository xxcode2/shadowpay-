// React entry point untuk SavingsDashboard
// Ini akan di-load jika user mengakses dengan wallet terhubung

import React from 'react'
import ReactDOM from 'react-dom/client'
import { SavingsDashboard } from './SavingsDashboard'

export function renderSavingsDashboard(walletAddress: string, wallet: any) {
  // Cari atau buat container
  let container = document.getElementById('savings-dashboard-root')
  
  if (!container) {
    container = document.createElement('div')
    container.id = 'savings-dashboard-root'
    document.body.appendChild(container)
  }

  // Render React component
  const root = ReactDOM.createRoot(container)
  root.render(
    <React.StrictMode>
      <SavingsDashboard walletAddress={walletAddress} wallet={wallet} />
    </React.StrictMode>
  )
}

export function unmountSavingsDashboard() {
  const container = document.getElementById('savings-dashboard-root')
  if (container) {
    container.remove()
  }
}
