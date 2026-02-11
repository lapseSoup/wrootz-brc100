# Wrootz BRC-100 Code Review Findings

**Date:** 2026-02-11
**Reviewer:** Claude Opus 4.6
**Overall Health Rating:** 6.5 / 10
**Lint Status:** Clean (0 errors)
**TypeScript Status:** Clean (0 errors)
**Test Coverage:** None (no test suite exists)

---

## Critical Issues (Must Fix Before Release)

### C1. Content Hash Mismatch Blocks ALL Post Creation
- **Severity:** CRITICAL
- **Files:** `app/create/page.tsx:156` vs `app/actions/posts/create.ts:64-72`
- **Issue:** Client hashes full JSON inscription (`JSON.stringify(inscriptionContent)` with app, type, metadata, timestamps), but server verifies by hashing only `${title}${body}`. These never match, so every post creation fails with "Content hash does not match."
- **Fix:** Hash the same data on both sides. Recommended: server should hash `JSON.stringify(inscriptionContent)` matching client, OR client should hash `title + body` matching server.
- **Effort:** Quick fix

### C2. CSRF Nonces Missing from SimplySatsAdapter
- **Severity:** CRITICAL (integration blocker)
- **File:** `app/lib/wallet/simplysats-adapter.ts` (api method)
- **Issue:** Simply Sats requires `X-Simply-Sats-Nonce` header on all authenticated endpoints. The adapter never fetches or sends nonces. All Wrootz -> Simply Sats API calls will 403.
- **Fix:** Before each API call, `POST /getNonce` and include nonce in `X-Simply-Sats-Nonce` header.
- **Effort:** Medium refactor

### C3. Session Token Rotation Not Handled
- **Severity:** CRITICAL (integration blocker)
- **File:** `app/lib/wallet/simplysats-adapter.ts`
- **Issue:** Simply Sats rotates session tokens after state-changing operations (returns new token in `X-Simply-Sats-New-Token` header). The adapter doesn't read or update the token, so subsequent requests fail with 401.
- **Fix:** After each API response, check for `X-Simply-Sats-New-Token` header and update `this.sessionToken`.
- **Effort:** Quick fix

---

## High Priority (Should Fix Soon)

### H1. Base58Check Decoding Skips Checksum Verification
- **Severity:** HIGH
- **Files:** `app/lib/wallet/brc100-adapter.ts:718-736`, `app/lib/wallet/simplysats-adapter.ts:651-668`
- **Issue:** `decodeBase58Check()` strips the 4-byte checksum but never verifies it. A corrupted address would produce a valid-looking but incorrect pubKeyHash, losing funds.
- **Fix:** Compute `SHA256(SHA256(payload))` and verify first 4 bytes match checksum, or use `@bsv/sdk` Address class.
- **Effort:** Quick fix

### H2. Payment Verification Fails for Full-Pubkey Wallet Addresses
- **Severity:** HIGH
- **File:** `app/lib/blockchain-verify.ts:409-492`
- **Issue:** When seller's `walletAddress` is a full public key (66 or 130 hex chars), the code checks if the P2PKH `asm` **contains** the key. P2PKH scripts contain `hash160(pubkey)`, not the full key. This means payment verification always fails for pubkey recipients.
- **Fix:** When recipient identifier is a public key, compute `hash160(pubKey)` and compare against the script's embedded pubKeyHash.
- **Effort:** Medium refactor

### H3. buyPost() Has No Idempotency Protection
- **Severity:** HIGH
- **File:** `app/actions/posts/sales.ts:150-277`
- **Issue:** Two buyers can submit simultaneous purchase requests. Both verify payment on-chain. Both succeed. The losing buyer's payment is gone with no refund.
- **Fix:** Wrap in `withIdempotencyAndLocking` keyed on `postId` (not `txid`).
- **Effort:** Quick fix

### H4. buyPost() Never Notifies Seller or Lockers
- **Severity:** HIGH
- **File:** `app/actions/posts/sales.ts:150-277`
- **Issue:** `notifyPostSold()` and `notifyLockerProfit()` functions exist in `notifications.ts` but are never called from `buyPost()`. Sellers get no sale notification; lockers get no profit notification.
- **Fix:** Call notification functions after successful purchase transaction.
- **Effort:** Quick fix

### H5. Feed Sort Order vs Display Inconsistency
- **Severity:** HIGH
- **File:** `app/actions/posts/queries.ts:198-200,261-268`
- **Issue:** Posts are sorted by database `totalTu` (potentially stale), then `mapPost()` overrides `totalTu` with recalculated value from locks. Display order doesn't match displayed values.
- **Fix:** Either recalculate before sorting, or sort in-app after recalculation.
- **Effort:** Medium refactor

### H6. No Test Suite
- **Severity:** HIGH
- **File:** `package.json` (no test script)
- **Issue:** Zero tests for a financial application handling real BSV. No unit tests, no integration tests, no e2e tests.
- **Fix:** Add vitest with tests for: wrootz calculations, lock verification, payment verification, idempotency, rate limiting.
- **Effort:** Major change

---

## Medium Priority (Good to Improve)

### M1. Payment Verification 1% Tolerance Allows Underpayment
- **File:** `app/lib/blockchain-verify.ts:472-474`
- **Issue:** 1% tolerance on a 1 BSV post = 1M sats underpayment possible.
- **Fix:** Reduce to fixed small tolerance (e.g., 100 sats).
- **Effort:** Quick fix

### M2. Lock Status Update TOCTOU Race Condition
- **Files:** `app/lib/lock-updater.ts:99-176`, `app/actions/posts/helpers.ts:25-106`
- **Issue:** Concurrent cron calls can read the same locks and double-decrement `totalTu`, driving it negative.
- **Fix:** Add distributed lock (Redis SETNX) or optimistic locking.
- **Effort:** Medium refactor

### M3. Unlock Transaction Hardcodes 1-Sat Miner Fee
- **File:** `app/lib/wallet/brc100-adapter.ts:487-489`
- **Issue:** Real fee is always higher than 1 sat. Unlocks will fail to broadcast, trapping locked funds.
- **Fix:** Let the wallet handle fee calculation.
- **Effort:** Quick fix

### M4. Floating-Point Arithmetic for BSV Amounts
- **File:** `app/lib/constants.ts:24-30`
- **Issue:** `satsToBsv()` returns imprecise floats used in further calculations. `0.1 + 0.2 = 0.30000000000000004`.
- **Fix:** Use satoshis (integers) as canonical unit everywhere. Only convert to BSV for display.
- **Effort:** Medium refactor

### M5. `getTagWrootzHistory` Calls Its Own API via HTTP
- **File:** `app/actions/tags.ts:100-108`
- **Issue:** Server action fetches `localhost:3000/api/block` instead of calling `getCurrentBlock()`. Fails in serverless.
- **Fix:** Call `getCurrentBlock()` directly.
- **Effort:** Quick fix

### M6. `getPostsByTag` Fetches ALL Active Locks
- **File:** `app/actions/tags.ts:197-228`
- **Issue:** Fetches every active lock with tag (with full post includes) for case-insensitive matching. N+1 performance issue at scale.
- **Fix:** Use `LOWER()` SQL function or PostgreSQL `ILIKE` in production.
- **Effort:** Medium refactor

### M7. Notification Fan-Out Is Sequential
- **File:** `app/actions/notifications.ts:133-141,153-163`
- **Issue:** One DB write per follower. Blocks response for popular users/tags.
- **Fix:** Use `prisma.notification.createMany()`.
- **Effort:** Quick fix

### M8. Unbounded findMany() on Hot Paths
- **Files:** `queries.ts:324,390,472`, `tags.ts:197`, `admin.ts:173,203,271`
- **Issue:** `getTopTags`, `getTopLockers`, `getRisingPosts`, admin queries fetch entire tables.
- **Fix:** Add `take` limits.
- **Effort:** Quick fix

### M9. Lock Status Update Logic Duplicated
- **Files:** `app/actions/posts/helpers.ts:25-106`, `app/lib/lock-updater.ts:99-176`
- **Issue:** Nearly identical code in two files. Will drift apart.
- **Fix:** Extract shared function.
- **Effort:** Quick fix

### M10. No Session Rotation on Login/Register
- **File:** `app/actions/auth.ts`
- **Issue:** Session fixation possible - existing session cookie is reused.
- **Fix:** Clear existing session before setting new one on auth.
- **Effort:** Quick fix

### M11. Rate Limiting Falls Back to In-Memory
- **File:** `app/lib/server-action-rate-limit.ts`
- **Issue:** Without Redis configured, rate limiting is per-process only and easily bypassed across instances.
- **Fix:** Configure Upstash Redis for production.
- **Effort:** Configuration change

### M12. Lock Updater Cron Loads ALL Active Locks into Memory
- **File:** `app/lib/lock-updater.ts:99-104`
- **Issue:** No batching, no cursor. With 100K locks this is a memory bomb.
- **Fix:** Process in batches with cursor-based pagination.
- **Effort:** Medium refactor

---

## Low Priority (Nice to Have)

### L1. `PostWithRelations` typed as `any`
- **File:** `app/actions/posts/queries.ts:256`
- **Fix:** Define proper Prisma return type

### L2. Rising filter ignores pagination
- **File:** `app/actions/posts/queries.ts:92-148`
- **Fix:** Implement cursor-based pagination for rising feed

### L3. Cron endpoints unprotected in development
- **File:** `app/api/cron/update-locks/route.ts:28-34`
- **Fix:** Always require CRON_SECRET

### L4. No CSP security headers
- **Fix:** Add `Content-Security-Policy` header in `next.config.js`

### L5. `listForSale` missing rate limiting
- **File:** `app/actions/posts/sales.ts:12-83`
- **Fix:** Add `checkStrictRateLimit('listForSale')`

### L6. No dust limit enforcement on sendBSV
- **Files:** `brc100-adapter.ts:270-295`, `simplysats-adapter.ts:334-353`
- **Fix:** `if (satoshis < 546) throw`

### L7. No network validation on wallet connection
- **Fix:** Call `getNetwork()` after connect, reject if not mainnet

### L8. Callback arrays in wallet adapters never cleaned up (memory leak)
- **Files:** `brc100-adapter.ts:33-34`, `simplysats-adapter.ts:45-46`
- **Fix:** Return unsubscribe functions from event handlers

### L9. Identity keys stored in localStorage (XSS risk)
- **Files:** `brc100-adapter.ts:131-133`

### L10. 94 console.log/warn/error calls - no structured logging
- **Fix:** Add a logging utility with levels

### L11. `cancelSale` doesn't reset `lockerSharePercentage`
- **File:** `app/actions/posts/sales.ts:123-129`

### L12. `getTagStats` uses `lock.amount` (BSV) but calls it `totalLockedSats`
- **File:** `app/actions/tags.ts:30`

### L13. Dead dependency: `yours-wallet-provider` in package.json
- **Fix:** `npm uninstall yours-wallet-provider`

### L14. FeedClient `useEffect` re-renders on every SWR poll due to new array reference
- **File:** `app/components/FeedClient.tsx:35-47`
- **Fix:** Compare JSON or use stable reference

---

## Simply Sats Compatibility

| Dimension | Status |
|---|---|
| BSV SDK version | Fully compatible (both `^1.10.3`) |
| Wallet protocol | Well integrated (first-class adapter) |
| HTTP API surface | **2 critical gaps** (CSRF nonces + token rotation) |
| Data types | Aligned (`LockedOutput` is identical) |
| Database schemas | Different but complementary (wallet vs app) |
| Network config | Both mainnet-only |
| Code duplication | Moderate (5+ utility functions duplicated across projects) |
| Dead dependency | `yours-wallet-provider` unused in Wrootz |

### Recommended Alignment Actions
1. **CRITICAL:** Add CSRF nonce support to `SimplySatsAdapter` (C2)
2. **CRITICAL:** Handle `X-Simply-Sats-New-Token` session rotation (C3)
3. **MEDIUM:** Remove `yours-wallet-provider` and legacy `bsv` v2 dependencies
4. **MEDIUM:** Extract shared utility code into a common package
5. **LOW:** Align ordinal basket naming (`ordinals` vs `wrootz_ordinals`)

---

## Prioritized Remediation Plan

### Sprint 1: Blockers (1-2 days)
- [ ] **C1:** Fix content hash mismatch (blocks all post creation)
- [ ] **C2:** Add CSRF nonce support to SimplySatsAdapter
- [ ] **C3:** Handle session token rotation in SimplySatsAdapter
- [ ] **H3:** Add idempotency to buyPost() (keyed on postId)
- [ ] **H4:** Call notification functions from buyPost()
- [ ] **M3:** Remove hardcoded 1-sat fee from unlock

### Sprint 2: Financial Safety (2-3 days)
- [ ] **H1:** Add checksum verification to Base58Check decoding
- [ ] **H2:** Fix payment verification for full-pubkey addresses
- [ ] **M1:** Reduce payment tolerance from 1% to fixed amount
- [ ] **M2:** Add distributed lock to prevent TOCTOU on lock updates
- [ ] **M4:** Standardize on satoshis as canonical unit

### Sprint 3: Stability & Performance (2-3 days)
- [ ] **H5:** Fix feed sort/display inconsistency
- [ ] **M5:** Replace self-fetch in getTagWrootzHistory
- [ ] **M6:** Optimize tag search queries
- [ ] **M7:** Batch notification fan-out
- [ ] **M8:** Add limits to unbounded queries
- [ ] **M9:** Deduplicate lock update logic
- [ ] **M12:** Add batching to lock updater cron

### Sprint 4: Production Hardening (3-5 days)
- [ ] **H6:** Add test suite (vitest) for core business logic
- [ ] **M10:** Add session rotation on login
- [ ] **M11:** Configure Upstash Redis for production
- [ ] **L3:** Protect cron endpoints
- [ ] **L4:** Add CSP headers
- [ ] **L5-L8:** Low priority fixes

---

## Architecture Summary

**Positive:**
- Clean layering: Components -> Server Actions -> Prisma -> Database
- No circular dependencies
- Consistent error handling across API routes
- Graceful fallback chain (Redis -> in-memory)
- Proper transaction batching with `prisma.$transaction()`
- Rate limiting on all 14 API endpoints
- Proper RSC boundary discipline (54 client, 16 server files)

**Concerning:**
- N+1 query patterns in profile/tag hot paths
- Unbounded queries on admin and analytics
- Single-instance assumption for caching
- No data access layer abstraction (26 files directly import Prisma)
- No test coverage for a financial application
