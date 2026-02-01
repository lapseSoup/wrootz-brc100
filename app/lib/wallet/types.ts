// Wallet abstraction types for BSV wallet integration

export interface WalletBalance {
  bsv: number      // Balance in BSV
  satoshis: number // Balance in satoshis
  usd?: number     // Optional USD value
}

export interface LockResult {
  txid: string           // Transaction ID of the lock
  lockAddress: string    // Address where BSV is locked
  amount: number         // Amount locked in satoshis
  unlockBlock: number    // Block height when lock expires
}

export interface SendResult {
  txid: string
  amount: number // Amount sent in satoshis
}

// 1Sat Ordinals inscription types
export interface InscriptionData {
  base64Data: string    // Content encoded in Base64
  mimeType: string      // Content type (e.g., 'application/json', 'text/plain')
  map?: Record<string, string>  // Optional metadata
}

export interface InscriptionResult {
  txid: string          // Transaction ID of the inscription
  origin: string        // Inscription ID (txid_vout format)
  rawtx?: string        // Raw transaction hex
}

export interface WalletProvider {
  // Wallet identification
  name: string
  icon: string

  // Connection
  isInstalled(): boolean
  isConnected(): boolean
  connect(): Promise<string>  // Returns wallet address
  disconnect(): Promise<void>

  // Account info
  getAddress(): Promise<string>
  getBalance(): Promise<WalletBalance>
  getPubKey(): Promise<string>

  // Transactions
  sendBSV(to: string, satoshis: number): Promise<SendResult>

  // Locking (time-locked transactions)
  lockBSV(satoshis: number, blocks: number): Promise<LockResult>

  // Message signing (for authentication)
  signMessage(message: string): Promise<string>

  // 1Sat Ordinals
  inscribe(data: InscriptionData): Promise<InscriptionResult>

  // Events
  onAccountChange(callback: (address: string) => void): void
  onDisconnect(callback: () => void): void
}

export type WalletType = 'yours' | 'shuallet' | 'brc100' | 'none'

export interface WalletState {
  type: WalletType
  address: string | null
  balance: WalletBalance | null
  isConnected: boolean
  isConnecting: boolean
  error: string | null
}
