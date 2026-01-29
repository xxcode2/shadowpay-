/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BACKEND_URL?: string
  readonly VITE_RPC_URL?: string
  readonly VITE_SOLANA_RPC_URL?: string
  readonly VITE_SHARE_BASE_URL?: string
  readonly VITE_PRIVACY_CASH_POOL?: string
  [key: string]: any
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
