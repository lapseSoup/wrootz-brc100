/**
 * Wallet Adapter Unit Tests
 *
 * Tests for BRC100WalletAdapter and SimplySatsAdapter.
 * All external dependencies (WalletClient, fetch, crypto helpers) are mocked
 * so tests exercise the adapter logic — validation, error handling, result
 * transformation — without real network calls or crypto operations.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ─── vi.hoisted: define shared mock instance BEFORE vi.mock factories run ────
// vi.mock() factories are hoisted to the top of the file by vitest.
// Variables referenced inside them must be created with vi.hoisted() so they
// are available at hoist time.
const { mockWalletInstance, walletClientConstructorArgs } = vi.hoisted(() => {
  const mockWalletInstance = {
    connectToSubstrate: vi.fn(),
    waitForAuthentication: vi.fn(),
    isAuthenticated: vi.fn(),
    getPublicKey: vi.fn(),
    getHeight: vi.fn(),
    getNetwork: vi.fn(),
    listOutputs: vi.fn(),
    createAction: vi.fn(),
    createSignature: vi.fn(),
  }

  const walletClientConstructorArgs: string[] = []

  return { mockWalletInstance, walletClientConstructorArgs }
})

// ─── Mock @bsv/sdk ───────────────────────────────────────────────────────────
vi.mock('@bsv/sdk', () => {
  // Must use a regular function (not arrow) so the adapter can call `new WalletClient(...)`.
  // Arrow functions do not have a [[Construct]] slot and cannot be used as constructors.
  function MockWalletClient(substrate: string) {
    walletClientConstructorArgs.push(substrate)
    return mockWalletInstance
  }

  const Hash = {
    hash160: vi.fn().mockReturnValue(new Uint8Array(20).fill(0xab)),
    hash256: vi.fn().mockReturnValue(new Uint8Array(32).fill(0x00)),
  }

  return { WalletClient: MockWalletClient, Hash }
})

// ─── Mock wallet-utils crypto helpers ────────────────────────────────────────
// Prevents decodeBase58Check / createP2PKHLockingScript from running real
// Base58Check checksum validation on arbitrary address strings.
vi.mock('../wallet/wallet-utils', async (importOriginal) => {
  const original = await importOriginal<typeof import('../wallet/wallet-utils')>()
  return {
    ...original,
    createP2PKHLockingScript: vi.fn().mockReturnValue('76a914aabbccdd88ac'),
    buildInscriptionScript: vi.fn().mockReturnValue('0063aabbcc68' + '76a914aabbccdd88ac'),
  }
})

import { BRC100WalletAdapter } from '../wallet/brc100-adapter'
import { SimplySatsAdapter } from '../wallet/simplysats-adapter'
import { WalletConnectionError, WalletAuthError } from '../wallet/errors'
import { withTimeout } from '../wallet/wallet-utils'

/** Reset all mock implementations to their default "happy path" values */
function resetWalletInstance() {
  mockWalletInstance.connectToSubstrate.mockResolvedValue(undefined)
  mockWalletInstance.waitForAuthentication.mockResolvedValue(undefined)
  mockWalletInstance.isAuthenticated.mockResolvedValue(true)
  mockWalletInstance.getPublicKey.mockResolvedValue({ publicKey: 'mock_pubkey_hex_abc123' })
  mockWalletInstance.getHeight.mockResolvedValue({ height: 800000 })
  mockWalletInstance.getNetwork.mockResolvedValue({ network: 'mainnet' })
  mockWalletInstance.listOutputs.mockResolvedValue({ outputs: [] })
  mockWalletInstance.createAction.mockResolvedValue({ txid: 'mock_txid_abc123' })
  mockWalletInstance.createSignature.mockResolvedValue({ signature: [1, 2, 3, 4] })
}

// Arbitrary address — createP2PKHLockingScript is mocked so no real
// Base58Check validation occurs.
const DUMMY_ADDRESS = 'some_bsv_address_string'

// ─── withTimeout (wallet-utils) ───────────────────────────────────────────────

describe('withTimeout (wallet-utils)', () => {
  it('resolves when the promise completes before the timeout', async () => {
    expect(await withTimeout(Promise.resolve('done'), 1000, 'should not timeout')).toBe('done')
  })

  it('rejects with the timeout message when the promise takes too long', async () => {
    await expect(
      withTimeout(new Promise<string>(() => { /* hangs */ }), 10, 'timed out after 10ms')
    ).rejects.toThrow('timed out after 10ms')
  })

  it('rejects with the original error when the promise rejects before the timeout', async () => {
    await expect(
      withTimeout(Promise.reject(new Error('upstream failure')), 1000, 'should not timeout')
    ).rejects.toThrow('upstream failure')
  })
})

// ─── BRC100WalletAdapter ─────────────────────────────────────────────────────

describe('BRC100WalletAdapter', () => {
  let adapter: BRC100WalletAdapter
  const storage: Record<string, string> = {}

  beforeEach(() => {
    walletClientConstructorArgs.length = 0
    resetWalletInstance()

    // Stub window so isInstalled() returns true and localStorage writes work
    vi.stubGlobal('window', { location: { href: '' } })

    for (const k of Object.keys(storage)) delete storage[k]
    vi.stubGlobal('localStorage', {
      setItem: (k: string, v: string) => { storage[k] = v },
      getItem: (k: string) => storage[k] ?? null,
      removeItem: (k: string) => { delete storage[k] },
    })

    adapter = new BRC100WalletAdapter()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  // ── isInstalled / isConnected ──────────────────────────────────────────────

  describe('isInstalled()', () => {
    it('returns true when window is defined', () => {
      expect(adapter.isInstalled()).toBe(true)
    })
  })

  describe('isConnected()', () => {
    it('returns false before connect()', () => {
      expect(adapter.isConnected()).toBe(false)
    })
  })

  // ── connect() ─────────────────────────────────────────────────────────────

  describe('connect()', () => {
    it('returns the identity public key on success', async () => {
      expect(await adapter.connect()).toBe('mock_pubkey_hex_abc123')
    })

    it('sets isConnected to true after a successful connect', async () => {
      expect(adapter.isConnected()).toBe(false)
      await adapter.connect()
      expect(adapter.isConnected()).toBe(true)
    })

    it('tries HTTP substrate first (Metanet Desktop port 3321)', async () => {
      await adapter.connect()
      expect(walletClientConstructorArgs[0]).toBe('http://localhost:3321')
    })

    it('falls back to XDM when HTTP substrate throws on connectToSubstrate', async () => {
      let callCount = 0
      mockWalletInstance.connectToSubstrate.mockImplementation(() => {
        callCount++
        if (callCount === 1) return Promise.reject(new Error('ECONNREFUSED'))
        return Promise.resolve(undefined)
      })

      const pubkey = await adapter.connect()
      expect(pubkey).toBe('mock_pubkey_hex_abc123')
      expect(walletClientConstructorArgs).toContain('XDM')
    })

    it('throws a helpful error when all substrates fail', async () => {
      mockWalletInstance.connectToSubstrate.mockRejectedValue(new Error('Failed to fetch'))
      await expect(adapter.connect()).rejects.toThrow('No BRC-100 wallet detected')
    })

    it('persists the substrate type to localStorage on success', async () => {
      await adapter.connect()
      expect(localStorage.getItem('brc100_substrate')).toBe('http://localhost:3321')
    })

    it('clears callback arrays before reconnect so listeners do not accumulate', async () => {
      await adapter.connect()
      adapter.onAccountChange(() => {})
      adapter.onDisconnect(() => {})
      resetWalletInstance()
      walletClientConstructorArgs.length = 0
      await adapter.connect()
      expect(adapter.isConnected()).toBe(true)
    })
  })

  // ── disconnect() ──────────────────────────────────────────────────────────

  describe('disconnect()', () => {
    it('sets isConnected to false', async () => {
      await adapter.connect()
      await adapter.disconnect()
      expect(adapter.isConnected()).toBe(false)
    })

    it('fires registered disconnect callbacks', async () => {
      await adapter.connect()
      const cb = vi.fn()
      adapter.onDisconnect(cb)
      await adapter.disconnect()
      expect(cb).toHaveBeenCalledOnce()
    })

    it('removes the substrate key from localStorage', async () => {
      await adapter.connect()
      await adapter.disconnect()
      expect(localStorage.getItem('brc100_substrate')).toBeNull()
    })
  })

  // ── getBalance() ──────────────────────────────────────────────────────────

  describe('getBalance()', () => {
    it('aggregates spendable satoshis across multiple baskets', async () => {
      await adapter.connect()
      mockWalletInstance.listOutputs.mockImplementation(({ basket }: { basket: string }) => {
        if (basket === 'default') return Promise.resolve({ outputs: [{ satoshis: 50000, spendable: true }, { satoshis: 30000, spendable: true }] })
        if (basket === 'bsv') return Promise.resolve({ outputs: [{ satoshis: 20000, spendable: true }] })
        return Promise.resolve({ outputs: [] })
      })

      const balance = await adapter.getBalance()
      expect(balance.satoshis).toBe(100000)
      expect(balance.bsv).toBeCloseTo(0.001)
      expect(balance.usd).toBeUndefined()
    })

    it('excludes outputs where spendable is false', async () => {
      await adapter.connect()
      mockWalletInstance.listOutputs.mockImplementation(({ basket }: { basket: string }) => {
        if (basket === 'default') return Promise.resolve({ outputs: [{ satoshis: 100000, spendable: true }, { satoshis: 99999, spendable: false }] })
        return Promise.resolve({ outputs: [] })
      })

      expect((await adapter.getBalance()).satoshis).toBe(100000)
    })

    it('returns zeros when all basket requests reject', async () => {
      await adapter.connect()
      mockWalletInstance.listOutputs.mockRejectedValue(new Error('network error'))

      const balance = await adapter.getBalance()
      expect(balance.satoshis).toBe(0)
      expect(balance.bsv).toBe(0)
    })

    it('returns zeros when adapter is not connected (ensureConnected throws)', async () => {
      const balance = await adapter.getBalance()
      expect(balance.satoshis).toBe(0)
      expect(balance.bsv).toBe(0)
    })

    it('handles partial basket failures via Promise.allSettled', async () => {
      await adapter.connect()
      mockWalletInstance.listOutputs.mockImplementation(({ basket }: { basket: string }) => {
        if (basket === 'default') return Promise.resolve({ outputs: [{ satoshis: 40000, spendable: true }] })
        return Promise.reject(new Error('basket not found'))
      })

      // Rejected baskets are skipped; successful baskets are counted
      expect((await adapter.getBalance()).satoshis).toBe(40000)
    })

    it('returns zero balance when all baskets are empty', async () => {
      await adapter.connect()
      // listOutputs already returns { outputs: [] } by default
      expect((await adapter.getBalance()).satoshis).toBe(0)
    })
  })

  // ── sendBSV() ─────────────────────────────────────────────────────────────

  describe('sendBSV()', () => {
    beforeEach(async () => { await adapter.connect() })

    it('throws when amount is 0', async () => {
      await expect(adapter.sendBSV(DUMMY_ADDRESS, 0)).rejects.toThrow('at least 1 satoshi')
    })

    it('accepts 1 sat (BSV has no dust limit)', async () => {
      mockWalletInstance.createAction.mockResolvedValue({ txid: 'txid_1sat' })
      const result = await adapter.sendBSV(DUMMY_ADDRESS, 1)
      expect(result.txid).toBe('txid_1sat')
      expect(result.amount).toBe(1)
    })

    it('throws when wallet is not connected', async () => {
      await adapter.disconnect()
      await expect(adapter.sendBSV(DUMMY_ADDRESS, 1000)).rejects.toThrow('Wallet not connected')
    })

    it('accepts any positive amount', async () => {
      mockWalletInstance.createAction.mockResolvedValue({ txid: 'txid_dust_ok' })
      const result = await adapter.sendBSV(DUMMY_ADDRESS, 546)
      expect(result.txid).toBe('txid_dust_ok')
      expect(result.amount).toBe(546)
    })

    it('returns txid and amount on success', async () => {
      mockWalletInstance.createAction.mockResolvedValue({ txid: 'abc123txid' })
      const result = await adapter.sendBSV(DUMMY_ADDRESS, 1000)
      expect(result.txid).toBe('abc123txid')
      expect(result.amount).toBe(1000)
    })

    it('throws when createAction returns no txid', async () => {
      mockWalletInstance.createAction.mockResolvedValue({ txid: undefined })
      await expect(adapter.sendBSV(DUMMY_ADDRESS, 1000)).rejects.toThrow('Transaction creation failed')
    })
  })

  // ── lockBSV() ─────────────────────────────────────────────────────────────

  describe('lockBSV()', () => {
    beforeEach(async () => { await adapter.connect() })

    it('throws when the native lockBSV HTTP endpoint is unavailable', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')))
      await expect(adapter.lockBSV(10000, 144)).rejects.toThrow('does not support native timelocks')

      vi.unstubAllGlobals()
      vi.stubGlobal('localStorage', { setItem: vi.fn(), getItem: vi.fn().mockReturnValue(null), removeItem: vi.fn() })
    })

    it('returns lock result when native endpoint responds', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ txid: 'lock_txid_xyz', unlockBlock: 800144 }),
      }))

      const result = await adapter.lockBSV(10000, 144)
      expect(result.txid).toBe('lock_txid_xyz')
      expect(result.amount).toBe(10000)
      expect(result.unlockBlock).toBe(800144)

      vi.unstubAllGlobals()
      vi.stubGlobal('localStorage', { setItem: vi.fn(), getItem: vi.fn().mockReturnValue(null), removeItem: vi.fn() })
    })

    it('falls back to calculated unlockBlock when response omits it', async () => {
      mockWalletInstance.getHeight.mockResolvedValue({ height: 900000 })

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ txid: 'lock_txid_calc' }),
      }))

      const result = await adapter.lockBSV(10000, 100)
      expect(result.unlockBlock).toBe(900100) // 900000 + 100

      vi.unstubAllGlobals()
      vi.stubGlobal('localStorage', { setItem: vi.fn(), getItem: vi.fn().mockReturnValue(null), removeItem: vi.fn() })
    })

    it('wraps "Failed to fetch" on getHeight as a reconnect error', async () => {
      mockWalletInstance.getHeight.mockRejectedValue(new Error('Failed to fetch'))
      await expect(adapter.lockBSV(10000, 144)).rejects.toThrow('Lost connection to wallet')
    })
  })

  // ── getAddress() / getPubKey() ────────────────────────────────────────────

  describe('getAddress()', () => {
    it('throws when wallet is not connected', async () => {
      await expect(adapter.getAddress()).rejects.toThrow('Wallet not connected')
    })

    it('returns the identity public key when connected', async () => {
      await adapter.connect()
      expect(await adapter.getAddress()).toBe('mock_pubkey_hex_abc123')
    })
  })

  describe('getPubKey()', () => {
    it('throws when wallet is not connected', async () => {
      await expect(adapter.getPubKey()).rejects.toThrow('Wallet not connected')
    })

    it('returns the public key when connected', async () => {
      await adapter.connect()
      expect(await adapter.getPubKey()).toBe('mock_pubkey_hex_abc123')
    })
  })

  // ── getBlockHeight() ──────────────────────────────────────────────────────

  describe('getBlockHeight()', () => {
    it('throws when wallet is not connected', async () => {
      await expect(adapter.getBlockHeight!()).rejects.toThrow('Wallet not connected')
    })

    it('returns block height when connected', async () => {
      await adapter.connect()
      expect(await adapter.getBlockHeight!()).toBe(800000)
    })
  })

  // ── callback registration ─────────────────────────────────────────────────

  describe('onAccountChange()', () => {
    it('returns an unsubscribe function', () => {
      expect(typeof adapter.onAccountChange(() => {})).toBe('function')
    })
  })

  describe('onDisconnect()', () => {
    it('returns an unsubscribe function', () => {
      expect(typeof adapter.onDisconnect(() => {})).toBe('function')
    })

    it('unsubscribing prevents the callback from firing on disconnect', async () => {
      await adapter.connect()
      const cb = vi.fn()
      const unsub = adapter.onDisconnect(cb)
      unsub()
      await adapter.disconnect()
      expect(cb).not.toHaveBeenCalled()
    })
  })
})

// ─── SimplySatsAdapter ────────────────────────────────────────────────────────

describe('SimplySatsAdapter', () => {
  let adapter: SimplySatsAdapter
  let fetchMock: ReturnType<typeof vi.fn>

  function buildFetchMock(overrides: Record<string, unknown> = {}) {
    const defaults: Record<string, unknown> = {
      getVersion: { version: '1.0.0' },
      waitForAuthentication: { authenticated: true },
      getPublicKey: { publicKey: 'ss_pubkey_hex_def456' },
      getHeight: { height: 800000 },
      listOutputs: { outputs: [] },
      createAction: { txid: 'ss_txid_abc123' },
      lockBSV: { txid: 'ss_lock_txid', unlockBlock: 800144 },
      unlockBSV: { txid: 'ss_unlock_txid', amount: 10000 },
      getNonce: { nonce: 'mock_nonce' },
      getNetwork: { network: 'mainnet' },
      ...overrides,
    }

    return vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      if ((url as string).includes('/api/wallet/connect')) {
        const method = init?.method ?? 'GET'
        if (method === 'GET') return { ok: true, json: () => Promise.resolve({ connected: false }) }
        return { ok: true, json: () => Promise.resolve({ ok: true }) }
      }

      const endpoint = (url as string).split('/').pop() ?? ''
      const responseData = defaults[endpoint] ?? {}
      return {
        ok: true, status: 200,
        headers: { get: () => null },
        json: () => Promise.resolve(responseData),
      }
    })
  }

  beforeEach(() => {
    fetchMock = buildFetchMock()
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('window', { location: { href: '' } })
    adapter = new SimplySatsAdapter()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  // ── isInstalled / isConnected ─────────────────────────────────────────────

  describe('isInstalled()', () => {
    it('returns true when window is defined', () => {
      expect(adapter.isInstalled()).toBe(true)
    })
  })

  describe('isConnected()', () => {
    it('returns false before connect()', () => {
      expect(adapter.isConnected()).toBe(false)
    })
  })

  // ── connect() ─────────────────────────────────────────────────────────────

  describe('connect()', () => {
    it('returns the identity public key on success', async () => {
      expect(await adapter.connect()).toBe('ss_pubkey_hex_def456')
    })

    it('sets isConnected to true after a successful connect', async () => {
      await adapter.connect()
      expect(adapter.isConnected()).toBe(true)
    })

    it('calls getVersion to verify the wallet is reachable', async () => {
      await adapter.connect()
      expect(fetchMock.mock.calls.some(([url]) => (url as string).includes('getVersion'))).toBe(true)
    })

    it('calls waitForAuthentication during the connect flow', async () => {
      await adapter.connect()
      expect(fetchMock.mock.calls.some(([url]) => (url as string).includes('waitForAuthentication'))).toBe(true)
    })

    it('throws when Simply Sats is not running (fetch rejects at the network level)', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Failed to fetch')))
      const freshAdapter = new SimplySatsAdapter()
      await expect(freshAdapter.connect()).rejects.toThrow()
    })
  })

  // ── disconnect() ──────────────────────────────────────────────────────────

  describe('disconnect()', () => {
    it('sets isConnected to false', async () => {
      await adapter.connect()
      await adapter.disconnect()
      expect(adapter.isConnected()).toBe(false)
    })

    it('fires registered disconnect callbacks', async () => {
      await adapter.connect()
      const cb = vi.fn()
      adapter.onDisconnect(cb)
      await adapter.disconnect()
      expect(cb).toHaveBeenCalledOnce()
    })

    it('does not fire unsubscribed callbacks', async () => {
      await adapter.connect()
      const cb = vi.fn()
      const unsub = adapter.onDisconnect(cb)
      unsub()
      await adapter.disconnect()
      expect(cb).not.toHaveBeenCalled()
    })
  })

  // ── getBalance() ──────────────────────────────────────────────────────────

  describe('getBalance()', () => {
    it('sums spendable satoshis and converts to BSV', async () => {
      vi.stubGlobal('fetch', buildFetchMock({
        listOutputs: { outputs: [{ satoshis: 75000, spendable: true }, { satoshis: 25000, spendable: true }] }
      }))
      const balance = await adapter.getBalance()
      expect(balance.satoshis).toBe(100000)
      expect(balance.bsv).toBeCloseTo(0.001)
      expect(balance.usd).toBeUndefined()
    })

    it('excludes unspendable outputs', async () => {
      vi.stubGlobal('fetch', buildFetchMock({
        listOutputs: { outputs: [{ satoshis: 50000, spendable: true }, { satoshis: 50000, spendable: false }] }
      }))
      expect((await adapter.getBalance()).satoshis).toBe(50000)
    })

    it('returns zeros when listOutputs returns an HTTP error', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false, status: 500, headers: { get: () => null },
        json: () => Promise.resolve({ message: 'internal error' }),
      }))
      const balance = await adapter.getBalance()
      expect(balance.satoshis).toBe(0)
      expect(balance.bsv).toBe(0)
    })

    it('returns zeros when fetch rejects entirely', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new WalletConnectionError()))
      const balance = await adapter.getBalance()
      expect(balance.satoshis).toBe(0)
      expect(balance.bsv).toBe(0)
    })

    it('returns zero balance for an empty outputs array', async () => {
      vi.stubGlobal('fetch', buildFetchMock({ listOutputs: { outputs: [] } }))
      expect((await adapter.getBalance()).satoshis).toBe(0)
    })
  })

  // ── sendBSV() ─────────────────────────────────────────────────────────────

  describe('sendBSV()', () => {
    it('throws when amount is 0', async () => {
      await expect(adapter.sendBSV(DUMMY_ADDRESS, 0)).rejects.toThrow('at least 1 satoshi')
    })

    it('accepts 1 sat (BSV has no dust limit)', async () => {
      const result = await adapter.sendBSV(DUMMY_ADDRESS, 1)
      expect(result.txid).toBe('ss_txid_abc123')
      expect(result.amount).toBe(1)
    })

    it('returns txid and amount on success', async () => {
      const result = await adapter.sendBSV(DUMMY_ADDRESS, 10000)
      expect(result.txid).toBe('ss_txid_abc123')
      expect(result.amount).toBe(10000)
    })

    it('throws when createAction returns no txid', async () => {
      vi.stubGlobal('fetch', buildFetchMock({ createAction: {} }))
      await expect(adapter.sendBSV(DUMMY_ADDRESS, 1000)).rejects.toThrow('Transaction creation failed')
    })
  })

  // ── lockBSV() ─────────────────────────────────────────────────────────────

  describe('lockBSV()', () => {
    it('calls through to the lockBSV wallet endpoint', async () => {
      const result = await adapter.lockBSV(10000, 144)
      expect(result.txid).toBe('ss_lock_txid')
      expect(result.amount).toBe(10000)
      expect(result.unlockBlock).toBe(800144)
      expect(fetchMock.mock.calls.some(([url]) => (url as string).includes('lockBSV'))).toBe(true)
    })

    it('includes ordinalOrigin in the request body when provided', async () => {
      await adapter.lockBSV(10000, 144, 'origin_txid_0')
      const lockCall = fetchMock.mock.calls.find(([url]) => (url as string).includes('lockBSV'))
      expect(lockCall).toBeDefined()
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      expect(JSON.parse(lockCall![1].body as string).ordinalOrigin).toBe('origin_txid_0')
    })

    it('sends null ordinalOrigin when not provided', async () => {
      await adapter.lockBSV(10000, 144)
      const lockCall = fetchMock.mock.calls.find(([url]) => (url as string).includes('lockBSV'))
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      expect(JSON.parse(lockCall![1].body as string).ordinalOrigin).toBeNull()
    })

    it('falls back to calculated unlockBlock when response omits it', async () => {
      vi.stubGlobal('fetch', buildFetchMock({ lockBSV: { txid: 'lock_txid_no_block' } }))
      // currentHeight=800000, blocks=100 → 800100
      expect((await adapter.lockBSV(10000, 100)).unlockBlock).toBe(800100)
    })

    it('includes lockAddress (identity pubkey) in the result', async () => {
      expect((await adapter.lockBSV(10000, 144)).lockAddress).toBe('ss_pubkey_hex_def456')
    })

    it('throws WalletConnectionError when fetch rejects (wallet not running)', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Failed to fetch')))
      await expect(adapter.lockBSV(10000, 144)).rejects.toBeInstanceOf(WalletConnectionError)
    })

    it('throws WalletAuthError on HTTP 401 after reconnect attempt fails', async () => {
      // Spy on connect() so the auto-reconnect attempt throws immediately
      vi.spyOn(adapter as unknown as { connect(): Promise<string> }, 'connect')
        .mockRejectedValue(new WalletAuthError())

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false, status: 401,
        headers: { get: () => null },
        json: () => Promise.resolve({ message: 'Unauthorized' }),
      }))

      await expect(adapter.lockBSV(10000, 144)).rejects.toBeInstanceOf(WalletAuthError)
    })
  })

  // ── getAddress() ──────────────────────────────────────────────────────────

  describe('getAddress()', () => {
    it('returns the cached identity key when already connected', async () => {
      await adapter.connect()
      expect(await adapter.getAddress()).toBe('ss_pubkey_hex_def456')
    })

    it('fetches the public key from the wallet when identity key is not cached', async () => {
      expect(await adapter.getAddress()).toBe('ss_pubkey_hex_def456')
    })
  })

  // ── getNetwork() ──────────────────────────────────────────────────────────

  describe('getNetwork()', () => {
    it('returns mainnet', async () => {
      expect(await adapter.getNetwork()).toBe('mainnet')
    })

    it('throws for an unexpected network value', async () => {
      vi.stubGlobal('fetch', buildFetchMock({ getNetwork: { network: 'regtest' } }))
      await expect(adapter.getNetwork()).rejects.toThrow('Unexpected network')
    })
  })

  // ── getBlockHeight() ──────────────────────────────────────────────────────

  describe('getBlockHeight()', () => {
    it('returns the block height from the wallet API', async () => {
      expect(await adapter.getBlockHeight()).toBe(800000)
    })

    it('falls back to WhatsOnChain when the wallet API fails', async () => {
      vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url: string) => {
        if ((url as string).includes('localhost')) throw new Error('ECONNREFUSED')
        return { ok: true, status: 200, json: () => Promise.resolve({ blocks: 850000 }) }
      }))
      expect(await adapter.getBlockHeight()).toBe(850000)
    })

    it('returns 0 when both wallet API and WhatsOnChain fail', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))
      expect(await adapter.getBlockHeight()).toBe(0)
    })
  })

  // ── callback registration ─────────────────────────────────────────────────

  describe('onAccountChange()', () => {
    it('returns an unsubscribe function', () => {
      expect(typeof adapter.onAccountChange(() => {})).toBe('function')
    })

    it('unsubscribing removes the callback so it does not fire on disconnect', async () => {
      await adapter.connect()
      const cb = vi.fn()
      const unsub = adapter.onAccountChange(cb)
      unsub()
      await adapter.disconnect()
      expect(cb).not.toHaveBeenCalled()
    })
  })

  // ── rate limit retry ──────────────────────────────────────────────────────

  describe('rate limit handling (429 retry)', () => {
    it('retries automatically on 429 and succeeds on the second attempt', async () => {
      vi.useFakeTimers()

      let getVersionCallCount = 0
      vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url: string) => {
        if ((url as string).includes('/api/wallet/connect')) {
          return { ok: true, json: () => Promise.resolve({ connected: false }) }
        }

        const endpoint = (url as string).split('/').pop() ?? ''

        if (endpoint === 'getVersion') {
          getVersionCallCount++
          if (getVersionCallCount === 1) {
            return { ok: false, status: 429, headers: { get: () => null }, json: () => Promise.resolve({}) }
          }
        }

        const responses: Record<string, unknown> = {
          getVersion: { version: '1.0.0' },
          waitForAuthentication: { authenticated: true },
          getPublicKey: { publicKey: 'ss_retry_pubkey' },
          getNonce: { nonce: 'n' },
        }
        return {
          ok: true, status: 200, headers: { get: () => null },
          json: () => Promise.resolve(responses[endpoint] ?? {}),
        }
      }))

      const freshAdapter = new SimplySatsAdapter()
      const connectPromise = freshAdapter.connect()

      await vi.advanceTimersByTimeAsync(2000)

      expect(await connectPromise).toBe('ss_retry_pubkey')
      expect(getVersionCallCount).toBeGreaterThanOrEqual(2)

      vi.useRealTimers()
    })
  })
})
