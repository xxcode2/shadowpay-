import dotenv from 'dotenv';

dotenv.config();

export const config = {
  PORT: parseInt(process.env.PORT || '3001', 10),
  SOLANA_RPC_URL: process.env.SOLANA_RPC_URL || 'https://mainnet.helius-rpc.com/?api-key=c455719c-354b-4a44-98d4-27f8a18aa79c',
  ENABLE_DEBUG: process.env.ENABLE_DEBUG === 'true',
  LINKS_STORAGE_PATH: process.env.LINKS_STORAGE_PATH || './data/links.json',
  
  // Privacy Cash Relayer (for reference, not used by backend)
  RELAYER_URL: process.env.RELAYER_URL || 'https://api3.privacycash.org',
};

