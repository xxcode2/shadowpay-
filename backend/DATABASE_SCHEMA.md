/**
 * Database Schema untuk ShadowPay Backend
 * 
 * Untuk production, implementasikan dengan PostgreSQL/MongoDB
 * File ini menunjukkan struktur yang diperlukan
 */

// Table: payment_links
interface PaymentLink {
  id: string;              // UUID atau random hash
  amount: number;          // Dalam lamports (SOL) atau base units (SPL)
  assetType: 'SOL' | 'USDC' | 'USDT';
  createdAt: Date;
  claimedAt?: Date;        // Null jika belum di-claim
  claimedBy?: string;      // Wallet address yang claim link
  depositTx: string;       // Transaction signature
  expiresAt?: Date;        // Optional: expiry time
  
  // Index
  // PRIMARY KEY: id
  // INDEX: createdAt (untuk query recent links)
  // INDEX: claimedAt (untuk query unclaimed links)
}

// Table: transactions (opsional, untuk audit trail)
interface Transaction {
  id: string;              // UUID
  type: 'DEPOSIT' | 'WITHDRAW';
  linkId?: string;         // Reference ke payment_link
  walletAddress: string;
  assetType: 'SOL' | 'USDC' | 'USDT';
  amount: number;
  txHash: string;          // Solana transaction signature
  status: 'PENDING' | 'CONFIRMED' | 'FAILED';
  createdAt: Date;
  updatedAt: Date;
  error?: string;
  
  // Index
  // PRIMARY KEY: id
  // INDEX: txHash (untuk quick lookup)
  // INDEX: walletAddress (untuk user history)
  // INDEX: createdAt (untuk time-based queries)
}

// Table: users (opsional, untuk analytics)
interface User {
  id: string;              // UUID
  walletAddress: string;   // Primary identifier
  createdAt: Date;
  lastActive: Date;
  linksCreated: number;
  totalDeposited: number;  // Dalam SOL equivalent
  
  // UNIQUE INDEX: walletAddress
  // INDEX: createdAt (untuk analytics)
}

// Implementation Examples:

// PostgreSQL
/*
CREATE TABLE payment_links (
  id VARCHAR(32) PRIMARY KEY,
  amount BIGINT NOT NULL,
  asset_type VARCHAR(10) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  claimed_at TIMESTAMP,
  claimed_by VARCHAR(44),
  deposit_tx VARCHAR(88) NOT NULL,
  expires_at TIMESTAMP,
  
  INDEX idx_created_at (created_at),
  INDEX idx_claimed_at (claimed_at)
);

CREATE TABLE transactions (
  id VARCHAR(36) PRIMARY KEY,
  type VARCHAR(10) NOT NULL,
  link_id VARCHAR(32),
  wallet_address VARCHAR(44) NOT NULL,
  asset_type VARCHAR(10) NOT NULL,
  amount BIGINT NOT NULL,
  tx_hash VARCHAR(88) NOT NULL UNIQUE,
  status VARCHAR(10) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  error TEXT,
  
  INDEX idx_tx_hash (tx_hash),
  INDEX idx_wallet_address (wallet_address),
  INDEX idx_created_at (created_at),
  FOREIGN KEY (link_id) REFERENCES payment_links(id)
);
*/

// MongoDB
/*
db.paymentLinks.createIndex({ createdAt: 1 })
db.paymentLinks.createIndex({ claimedAt: 1 })

db.transactions.createIndex({ txHash: 1 }, { unique: true })
db.transactions.createIndex({ walletAddress: 1 })
db.transactions.createIndex({ createdAt: 1 })
*/
