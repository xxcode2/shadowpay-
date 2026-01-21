import { Keypair, PublicKey } from '@solana/web3.js';

export declare class PrivacyCash {
  publicKey: PublicKey;
  
  constructor(options: {
    RPC_url: string;
    owner: string | number[] | Uint8Array | Keypair;
    enableDebug?: boolean;
  });

  setLogger(logger: (msg: string) => void): this;
  
  clearCache(): Promise<this>;
  
  deposit(options: {
    lamports: number;
  }): Promise<{
    tx: string;
  }>;
  
  depositUSDC(options: {
    base_units: number;
  }): Promise<{
    tx: string;
  }>;
  
  withdraw(options: {
    lamports: number;
    recipientAddress?: string;
    referrer?: string;
  }): Promise<{
    isPartial: boolean;
    tx: string;
    recipient: string;
    amount_in_lamports: number;
    fee_in_lamports: number;
  }>;
  
  withdrawUSDC(options: {
    base_units: number;
    recipientAddress?: string;
    referrer?: string;
  }): Promise<{
    isPartial: boolean;
    tx: string;
    recipient: string;
    amount_in_base_units: number;
    fee_in_base_units: number;
  }>;
}

declare module 'privacycash' {
  export { PrivacyCash };
}
