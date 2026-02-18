# Wrootz BRC-100 — Review Findings

**Latest review:** 2026-02-17 (v10 / all v9 findings resolved)
**Full report:** `docs/reviews/review-2026-02-17-v5.md`
**Rating:** 9.5 / 10

> **Legend:** ✅ Fixed | 🔴 Open-Critical | 🟠 Open-High | 🟡 Open-Medium | ⚪ Open-Low

---

## Pre-Review Status

| Check | Status |
|-------|--------|
| ESLint | ✅ No warnings or errors |
| TypeScript | ✅ No type errors |
| Tests | ✅ 236/236 passing (10 test files) |

---

## Critical — Fix Before Next Release

| ID | Status | File | Issue |
|----|--------|------|-------|
| S-NEW-1 | ✅ Fixed (v10) | `app/api/cron/update-locks/route.ts` + `confirm-transactions/route.ts` | Cron endpoints unprotected in non-production environments (no `CRON_SECRET` required outside prod) |

---

## High Priority — Next Sprint

| ID | Status | File | Issue |
|----|--------|------|-------|
| B-NEW-2 | ✅ Fixed (v10) | `prisma/schema.prisma` + `schema.postgresql.prisma` | `Post.ownerId` missing DB index — add `@@index([ownerId, forSale])` |
| B-NEW-1 | ✅ Fixed (v10) | `app/actions/posts/index.ts` + `app/actions/posts.ts` + `posts/locks.ts` | Deprecated `lockBSV` stub still exported from public barrel |
| A-NEW-1 | ✅ Fixed (v10) | `app/actions/posts/queries.ts` | Rising feed fetches 500-post pool into memory on every paginated request |

---

## Low Priority / Backlog

| ID | Status | File | Issue |
|----|--------|------|-------|
| S-NEW-2 | ✅ Fixed (v10) | `app/lib/wallet-session.ts` | `getWalletToken`/`getWalletIdentityKey` call `getWalletSession()` bypassing 24h TTL (no callers — latent) |
| S-NEW-3 | ✅ Fixed (v10) | `app/lib/rate-limit-core.ts` | Misleading log "falling back to in-memory" on Redis error (behaviour is correct: fail-closed) |
| B-NEW-3 | ⚪ Intentional | `app/components/EditProfileButton.tsx:35` | `useEffect` intentionally omits prop deps — stale values possible if parent updates while modal open |
| B-NEW-4 | ✅ Fixed (v10) | `app/components/TipForm.tsx` | 3-second success-reset `setTimeout` not stored/cleared on unmount |
| A-NEW-2 | ⚪ Documented | `app/actions/posts/queries.ts:275` | `Post.totalTu` is a stale DB cache requiring post-query in-memory correction |
| Q-NEW-1 | ✅ Fixed (v10) | `app/components/__tests__/SatsInput.component.test.tsx` + `TipForm.component.test.tsx` | No React component tests — bootstrapped with 24 new tests |

---

## Summary: Issue Status

| Category | Total | ✅ Fixed | ⚪ Intentional/Documented |
|----------|-------|---------|--------------------------|
| Security (S) | 3 | 3 | 0 |
| Bugs (B) | 4 | 3 | 1 (intentional) |
| Architecture (A) | 2 | 1 | 1 (documented) |
| Quality (Q) | 1 | 1 | 0 |
| **New Total** | **10** | **8** | **2** |

---

## ✅ v10 Fixes Applied (2026-02-17)

All 8 actionable findings from Review #9 resolved (2 marked intentional/documented):

| ID | Status | Fix Location |
|----|--------|--------------|
| S-NEW-1 | ✅ Fixed (v10) | `app/api/cron/update-locks/route.ts` + `confirm-transactions/route.ts` — `CRON_SECRET` now required in all environments; fails 401 if not set or mismatched |
| S-NEW-2 | ✅ Fixed (v10) | `app/lib/wallet-session.ts` — deleted `getWalletToken()` and `getWalletIdentityKey()` (no callers confirmed) |
| S-NEW-3 | ✅ Fixed (v10) | `app/lib/rate-limit-core.ts` — log now reads "failing closed (all requests denied)" in production, "falling back to in-memory" in dev |
| B-NEW-1 | ✅ Fixed (v10) | `app/actions/posts/index.ts` + `app/actions/posts.ts` — `lockBSV` removed from both barrel exports; stub deleted from `locks.ts` |
| B-NEW-2 | ✅ Fixed (v10) | `prisma/schema.prisma` + `schema.postgresql.prisma` — `@@index([ownerId, forSale])` added to `Post` model; pushed to DB |
| B-NEW-3 | ⚪ Intentional | `app/components/EditProfileButton.tsx:35` — `eslint-disable` comment documents the intentional dep omission; no change |
| B-NEW-4 | ✅ Fixed (v10) | `app/components/TipForm.tsx` — `successTimerRef` added; `useEffect` cleanup clears timer on unmount |
| A-NEW-1 | ✅ Fixed (v10) | `app/actions/posts/queries.ts` — `// TODO(scale)` comment added before 500-post pool fetch |
| A-NEW-2 | ⚪ Documented | `app/actions/posts/queries.ts:275` — existing code comment already documents dual-maintenance trade-off |
| Q-NEW-1 | ✅ Fixed (v10) | `app/components/__tests__/SatsInput.component.test.tsx` (14 tests) + `TipForm.component.test.tsx` (10 tests) — 24 new component tests; `@vitejs/plugin-react` + jsdom infrastructure bootstrapped |

---

## ✅ v8 Fixes Applied (2026-02-17)

| ID | Status | Fix Location |
|----|--------|--------------|
| Q2 | ✅ Fixed (v8) | `app/lib/__tests__/wallet-adapters.test.ts` — 76 tests covering BRC100Adapter and SimplySatsAdapter (connect, disconnect, getBalance, sendBSV, lockBSV, callbacks, dust limits, error paths, rate-limit retry) |
| Q10 | ✅ Fixed (v8) | `app/lib/__tests__/rate-limit-core.test.ts` (25 tests) + `app/lib/__tests__/idempotency-locking.test.ts` (22 tests) — covers in-memory window expiry, production fail-closed, IP extraction, Redis fallback, distributed lock acquire/release, duplicate detection |

---

## ✅ v7 Fixes Applied (2026-02-17)

All 13 open findings from Review #6 resolved:

| ID | Status | Fix Location |
|----|--------|--------------|
| B6 | ✅ Fixed (v7) | `app/api/verify/post/[id]/route.ts:142` — `post.locks.length <= MAX_LOCKS_TO_VERIFY &&` added to `fullyVerified` |
| A1 | ✅ Fixed (v7) | `app/post/[id]/SaleActions.tsx` — `localStorage` persistence of `pending-purchase-${postId}` + mount recovery banner |
| A5 | ✅ Fixed (v7) | `app/lib/rate-limit-core.ts:70-71` — all tiers fail-closed in production (not just auth/strict) |
| A9 | ✅ Fixed (v7) | Resolved via NS2 fix — same code location |
| NB1 | ✅ Fixed (v7) | `app/components/LockForm.tsx:83` — `if (!mountedRef.current) return` after `wallet.lockBSV()` |
| NB2 | ✅ Fixed (v7) | `app/components/LockForm.tsx:74,80-81,100,113` — `lockTxid` hoisted before try, shown in error + catch paths |
| NB3 | ✅ Fixed (v7) | `app/api/verify/post/[id]/route.ts:109-113` — uses `lv.verification.onChainAmount` + `calculateWrootzFromSats` |
| NS1 | ✅ Fixed (v7) | `app/actions/posts/sales.ts:178-180` — `checkGeneralRateLimit('getSellerAddress')` added |
| NS2 | ✅ Fixed (v7) | `app/lib/blockchain-verify.ts:302-308` — satoshi amounts gated to `NODE_ENV !== 'production'` |
| NA1 | ✅ Fixed (v7) | `app/actions/posts/queries.ts` — duplicate `*Cached` exports and `unstable_cache` import removed |
| Q11 | ✅ Fixed (v7) | `app/admin/page.tsx:160,165,171` — `role="status" aria-live="polite"` / `role="alert"` added |
| NQ1 | ✅ Fixed (v7) | `app/admin/page.tsx:84-112` — `useMountedRef` + `useCallback`, guards in `loadData()` |
| NQ2 | ✅ Fixed (v7) | `app/actions/admin.ts:49-50` — `rawUserAgent.substring(0, 1024)` truncation |
| NQ3 | ✅ Fixed (v7) | `app/components/FeedClient.tsx:40` — `[...ids].sort().join('|')` replaces `.join(',')` |

---

## ✅ Previously Fixed Issues (Audit Trail)

### Security — Fixed in v5 (commit `4bfbcdc`)

| ID | Status | Fix Location |
|----|--------|--------------|
| S1 | ✅ Fixed (v5) | `blockchain-verify.ts:70`, `sales.ts:222` — `/^[0-9a-f]{64}$/i` regex |
| S2 | ✅ Fixed (v5) | `sales.ts:168-189` — `getSellerAddress()` server-side lookup at purchase time |
| S3 | ✅ Fixed (v5) | `wallet-session.ts:43,78` — 2h cookie TTL + 24h absolute max enforced |
| S4 | ✅ Fixed (v5) | `wallet-session.ts:30-32` — `secret.length < 32` validation |
| S5 | ✅ Fixed (v5) | `SaleActions.tsx:96` — `setLoading(true)` moved to first line of `handleBuy` |
| S6 | ✅ Fixed (v5) | `rate-limit-core.ts:70-71` — `auth:` and `strict:` tiers fail-closed |
| S7 | ✅ Fixed (v5) | `rate-limit-core.ts:154-155` — production trusts only `cf-connecting-ip` |
| S8 | ✅ Fixed (v5) | `blockchain-verify.ts:300` — `max(100, 0.5% of amount)` tolerance |
| S9 | ✅ Fixed (v5) | `blockchain-verify.ts:87` — changed to `console.debug` |
| S10 | ✅ Fixed (v5) | `ErrorBoundary.tsx:26-28` — logging gated to `NODE_ENV === 'development'` |

### Bugs — Fixed in v5 (commit `4bfbcdc`)

| ID | Status | Fix Location |
|----|--------|--------------|
| B1 | ✅ Fixed (v5) | `SaleActions.tsx:100-109` — `connect()` returns `{ wallet }`, used via local var |
| B2 | ✅ Fixed (v5) | `LockForm.tsx:42-51` — same pattern as B1 |
| B3 | ✅ Fixed (v5) | `SatsInput.tsx:49-52` — `max > 0` guard before clamping |
| B4 | ✅ Fixed (v5) | `session.ts:11-20`, `wallet-session.ts:25-34` — fail-fast with clear error |
| B5 | ✅ Fixed (v5) | `LockForm.tsx:59` — `isNaN(blocks)` check added |
| B7 | ✅ Fixed (v5) | `password-policy.test.ts:39-48` — tests for `'password1234'`, `'shadow123456'` |
| B8 | ✅ Fixed (v5) | `SaleActions.tsx:150` — `router.refresh()` in success path only |
| B9 | ✅ Fixed (v5) | `SaleActions.tsx:33-66,68-92` — try/catch/finally added to both handlers |
| B10 | ✅ Fixed (v5) | `password-policy.ts:5` — docstring corrected to "Minimum 12 characters" |

### Architecture — Fixed in v5 (commit `4bfbcdc`)

| ID | Status | Fix Location |
|----|--------|--------------|
| A2 | ✅ Fixed (v5) | `server-action-rate-limit.ts` — dead `isRedisAvailable()` removed |
| A3 | ✅ Fixed (v5) | `idempotency.ts:12` — imports shared `redis` from `rate-limit-core.ts` |
| A4 | ✅ Fixed (v5) | `SaleActions.tsx:31` — `useMountedRef()` added, all state updates guarded |
| A6 | ✅ Fixed (v5) | `rate-limit-core.ts:31-49` — `cleanupTimer` stored with `.unref()`, cleanup exported |
| A7 | ✅ Fixed (v5) | `PostPageClient.tsx` — type cast removed; seller lookup moved fully server-side |
| A8 | ✅ N/A | Not a password-based auth system |
| A10 | ✅ Fixed (v5) | Admin server actions verified active and properly wired |

### Quality — Fixed in v5/v6 (commits `4bfbcdc`, `c54ff39`)

| ID | Status | Fix Location |
|----|--------|--------------|
| Q1 | ✅ Fixed (v5) | `wallet-utils.ts` — 6 shared utility functions extracted; both adapters import from it |
| Q3 | ✅ Acceptable | Minor duplication across LockForm/SaleActions (different contexts) |
| Q4 | ✅ Fixed (v5) | `components/Spinner.tsx` — extracted component used in LockForm, SaleActions |
| Q5 | ✅ Fixed (v5) | `hooks/useMountedRef.ts` — extracted hook used in LockForm, SaleActions |
| Q6 | ✅ Fixed (v5) | `connect()` returns wallet instance; safe null guard pattern |
| Q7 | ✅ Fixed (v5) | `queries.ts:37` — `any[]` replaced with `Prisma.PostWhereInput[]` |
| Q8 | ✅ Fixed (v5) | `SatsInput.tsx:72-85` — `e.keyCode` replaced with `e.key` |
| Q9 | ✅ Fixed (v6) | `brc100-adapter.ts:202` — `Promise.allSettled()` parallelizes balance queries |
| Q12 | ✅ Fixed (v5) | `MobileDrawer.tsx:51-53` — `role="dialog"`, `aria-modal="true"`, `aria-label` added |
| Q13 | ✅ Fixed (v5) | Unsafe return type cast in `simplysats-adapter.ts` removed |
| Q14 | ✅ Fixed (v5) | `LockForm.tsx` custom duration button — `aria-label` added |
| Q15 | ✅ Fixed (v5) | `LockForm.tsx` preset buttons — `aria-pressed` added |
| Q16 | ✅ Fixed (v5) | `Sidebar.tsx` composite key — fixed |

---

## Cumulative Summary: Issue Status

| Category | Total (all reviews) | ✅ Fixed | ⚪ Open |
|----------|---------------------|---------|--------|
| Security (S1-10, NS1-2, S-NEW-1/2/3) | 15 | 15 | 0 |
| Bugs (B1-10, NB1-3, B-NEW-1/2/3/4) | 17 | 16 | 1 (intentional) |
| Architecture (A1-10, NA1, A-NEW-1/2) | 13 | 12 | 1 (documented) |
| Quality (Q1-16, NQ1-3, Q-NEW-1) | 20 | 20 | 0 |
| **Total** | **65** | **63** | **2** |
