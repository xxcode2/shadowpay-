import { randomBytes } from 'crypto';

interface LinkData {
  id: string;
  amount: number;
  assetType: 'SOL' | 'USDC' | 'USDT';
  createdAt: number;
  claimedAt?: number;
  claimedBy?: string;
  depositTx: string;
}

// In-memory storage for links (for MVP)
// In production, use a database
const links = new Map<string, LinkData>();

export function createLink(
  amount: number,
  assetType: 'SOL' | 'USDC' | 'USDT',
  depositTx: string
): string {
  const id = randomBytes(16).toString('hex');
  
  links.set(id, {
    id,
    amount,
    assetType,
    createdAt: Date.now(),
    depositTx,
  });

  return id;
}

export function getLink(id: string): LinkData | null {
  return links.get(id) || null;
}

export function claimLink(id: string, claimedBy: string): boolean {
  const link = links.get(id);
  
  if (!link) {
    return false;
  }

  if (link.claimedAt) {
    return false; // Already claimed
  }

  link.claimedAt = Date.now();
  link.claimedBy = claimedBy;
  
  return true;
}
