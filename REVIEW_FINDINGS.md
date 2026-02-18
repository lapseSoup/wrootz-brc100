# Wrootz BRC-100 — Review Findings

**Latest review:** 2026-02-17 (v8 / all findings resolved)
**Full report:** `docs/reviews/review-2026-02-17-v4.md`
**Rating:** 9.5 / 10

> **Legend:** ✅ Fixed

---

## Pre-Review Status

| Check | Status |
|-------|--------|
| ESLint | No warnings or errors |
| TypeScript | No type errors |
| Tests | 212/212 passing (8 test files) |

---

## 🎉 All Findings Resolved

No open issues.

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

## Summary: Issue Status

| Category | Total | ✅ Fixed | Open |
|----------|-------|---------|------|
| Security (S1-10, NS1-2) | 12 | 12 | 0 |
| Bugs (B1-10, NB1-3) | 13 | 13 | 0 |
| Architecture (A1-10, NA1) | 11 | 11 | 0 |
| Quality (Q1-16, NQ1-3) | 19 | 19 | 0 |
| **Total** | **55** | **55** | **0** |
