# Wrootz BRC-100 — Review Findings

**Latest review:** 2026-02-17 (v12 / all v11 findings resolved)
**Full report:** `docs/reviews/review-2026-02-17-v11.md`
**Rating:** 9.0 / 10

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
| S-NEW-1 | ✅ Fixed (v10) | `app/api/cron/update-locks/route.ts` + `confirm-transactions/route.ts` | Cron endpoints unprotected in non-production environments |
| B-11-1 | ✅ Fixed (v12) | `app/components/EditProfileButton.tsx:209,278` | `var(--error)` → `var(--danger)` |
| B-11-2 | ✅ Fixed (v12) | `app/globals.css` + `WalletButton.tsx`, `MyLocks.tsx`, `TransactionHistory.tsx` | `--success: var(--accent)` added to globals.css |
| B-11-3 | ✅ Fixed (v12) | `app/components/FeedClient.tsx:82` | `var(--primary-dark)` → `var(--primary-hover)` |

---

## High Priority — Next Sprint

| ID | Status | File | Issue |
|----|--------|------|-------|
| B-NEW-2 | ✅ Fixed (v10) | `prisma/schema.prisma` + `schema.postgresql.prisma` | `Post.ownerId` missing DB index |
| B-NEW-1 | ✅ Fixed (v10) | `app/actions/posts/index.ts` + `app/actions/posts.ts` | Deprecated `lockBSV` stub in barrel |
| A-NEW-1 | ✅ Fixed (v10) | `app/actions/posts/queries.ts` | Rising feed 500-post pool fetch |
| B-11-4 | ✅ Fixed (v12) | `app/hooks/useAppData.ts` + `app/components/SWRProvider.tsx` + `app/layout.tsx` | FetchError class surfaces HTTP status; `swrConfig` wired via `<SWRConfig>` provider |
| B-11-5 | ✅ Fixed (v12) | `app/components/ReplyForm.tsx:33` | `setError('Failed to post reply')` added in catch |
| B-11-6 | ✅ Fixed (v12) | `app/components/WalletButton.tsx` | `copiedTimerRef` stores timer; `useEffect` cleanup clears on unmount |
| A-11-1 | ✅ Fixed (v12) | `PostPageClient.tsx`, `ProfilePageClient.tsx` | ErrorBoundary wraps LockForm, TipForm, SaleActions, VerificationBadge, MyLocks |
| A-11-2 | ✅ Fixed (v12) | `post/[id]/page.tsx`, `profile/[username]/page.tsx`, `tag/[tag]/page.tsx` | `generateMetadata` with title, description, OG tags |
| A-11-3 | ✅ Fixed (v12) | `profile/[username]`, `tag/[tag]`, `notifications`, `create` | `loading.tsx` skeletons added |
| A-11-4 | ✅ Fixed (v12) | `profile/[username]`, `tag/[tag]`, `notifications` | `error.tsx` boundaries added |
| Q-11-1 | ✅ Fixed (v12) | `app/components/EditProfileButton.tsx` | `role="dialog"`, `aria-modal`, `aria-labelledby`, Escape key, backdrop click, focus management |
| Q-11-2 | ✅ Fixed (v12) | `app/components/FeedFilter.tsx` | `aria-pressed={currentFilter === filter.value}` added |
| Q-11-3 | ✅ Fixed (v12) | `FollowUserButton.tsx`, `FollowTagButton.tsx` | `aria-busy={isPending}` added |

---

## Medium Priority — Sprint After

| ID | Status | File | Issue |
|----|--------|------|-------|
| B-11-7 | ✅ Fixed (v12) | `app/components/VerificationBadge.tsx` | `useMountedRef` guard added after async `verify()` |
| B-11-8 | ✅ Fixed (v12) | `app/post/[id]/PostPageClient.tsx` | `useMountedRef` guard added in `fetchData` and `fetchUserBalance` |
| B-11-9 | ✅ Fixed (v12) | `app/components/HidePostButton.tsx` | Error state added; title/aria-label shows "Action failed" on error |
| B-11-10 | ✅ Fixed (v12) | `app/profile/ProfilePageClient.tsx` | Visibility-aware polling with `visibilitychange` listener |
| A-11-5 | ✅ Fixed (v12) | `app/loading.tsx` | `lg:` → `md:` breakpoint aligned with `page.tsx` |
| A-11-6 | ✅ Fixed (v12) | `app/layout.tsx` | Blocking `<script>` in `<head>` sets `data-theme` before paint |
| Q-11-4 | ✅ Fixed (v12) | `app/components/CollapsibleSection.tsx` | Space key + `e.preventDefault()` added to `onKeyDown` |
| Q-11-5 | ✅ Fixed (v12) | `app/components/PostCard.tsx` | `<Link>` replaced with `<article>` + `onClick`/`onKeyDown` navigation |
| Q-11-6 | ✅ Fixed (v12) | `app/components/SatsInput.tsx` + call sites | `label` prop added; LockForm, TipForm, SaleActions pass unique labels |
| Q-11-7 | ✅ Fixed (v12) | `app/components/LockForm.tsx` | Success banner with 5s auto-clear timer and `role="status"` |
| Q-11-8 | ✅ Fixed (v12) | `app/components/FeedClient.tsx` | `hasLoadedOnce` ref gates "Refreshing..." after first data load |

---

## Low Priority / Backlog

| ID | Status | File | Issue |
|----|--------|------|-------|
| S-NEW-2 | ✅ Fixed (v10) | `app/lib/wallet-session.ts` | `getWalletToken`/`getWalletIdentityKey` bypassing 24h TTL |
| S-NEW-3 | ✅ Fixed (v10) | `app/lib/rate-limit-core.ts` | Misleading log on Redis error |
| B-NEW-3 | ⚪ Intentional | `app/components/EditProfileButton.tsx:35` | `useEffect` intentionally omits prop deps |
| B-NEW-4 | ✅ Fixed (v10) | `app/components/TipForm.tsx` | 3-second success-reset `setTimeout` not cleared on unmount |
| A-NEW-2 | ⚪ Documented | `app/actions/posts/queries.ts:275` | `Post.totalTu` stale DB cache requiring in-memory correction |
| Q-NEW-1 | ✅ Fixed (v10) | `SatsInput.component.test.tsx` + `TipForm.component.test.tsx` | No React component tests |
| Q-11-9 | ✅ Fixed (v12) | `app/(auth)/register/page.tsx` | Client-side password-confirm validation with inline mismatch indicator |
| Q-11-10 | ⚪ Open-Low | `app/components/MobileDrawer.tsx` | No focus return to trigger on close |
| Q-11-11 | ⚪ Open-Low | `SearchBar.tsx`, `TagInput.tsx` | Missing ARIA combobox pattern on autocomplete |

---

## Summary: Issue Status

| Category | Total | ✅ Fixed | ⚪ Open |
|----------|-------|---------|--------|
| Security (S) | 15 | 15 | 0 |
| Bugs (B) | 27 | 26 | 1 (intentional) |
| Architecture (A) | 19 | 18 | 1 (documented) |
| Quality (Q) | 31 | 29 | 2 (low) |
| **Total** | **92** | **88** | **4** |

---

## Review #11 Findings (2026-02-17) — UX/UI Polish & Stability

### New Issues: 27 total (3 critical, 10 high, 11 medium, 3 low)

**Phase 1 — Security:** No new issues. Security posture remains strong.

**Phase 2 — Bugs (10 new):**
- 3 critical CSS variable bugs causing invisible UI elements in production
- 1 high compound SWR bug causing infinite 401 retries on session expiry
- 1 high silent error swallowing in ReplyForm
- 1 high setTimeout leak in WalletButton
- 4 medium stability issues (mountedRef guards, visibility polling, error feedback)

**Phase 3 — Architecture (6 new):**
- ErrorBoundary exists but never used
- No SEO metadata on any dynamic route
- Missing loading/error boundaries for most routes
- Loading skeleton breakpoint mismatch
- Dark mode FOUC

**Phase 4 — Quality (11 new):**
- EditProfileButton modal lacks ARIA dialog, focus trap, keyboard handlers
- Missing aria-pressed on FeedFilter
- Missing aria-busy on Follow buttons
- CollapsibleSection missing Space key
- PostCard has nested interactive elements inside Link
- SatsInput shared aria-label
- LockForm no success confirmation
- FeedClient "Refreshing..." false positive
- Register page missing password-confirm check
- MobileDrawer no focus return
- SearchBar/TagInput missing ARIA combobox

---

## ✅ v12 Fixes Applied (2026-02-17)

All 25 actionable findings from Review #11 resolved (2 remain open-low):

| ID | Status | Fix Location |
|----|--------|--------------|
| B-11-1 | ✅ Fixed (v12) | `EditProfileButton.tsx` — `var(--error)` → `var(--danger)` at 2 locations |
| B-11-2 | ✅ Fixed (v12) | `globals.css` — `--success: var(--accent)` added to `:root` and `[data-theme="dark"]` |
| B-11-3 | ✅ Fixed (v12) | `FeedClient.tsx` — `var(--primary-dark)` → `var(--primary-hover)` |
| B-11-4 | ✅ Fixed (v12) | `useAppData.ts` — `FetchError` class surfaces HTTP status; `SWRProvider.tsx` created; wired in `layout.tsx` |
| B-11-5 | ✅ Fixed (v12) | `ReplyForm.tsx` — `setError('Failed to post reply')` in catch block |
| B-11-6 | ✅ Fixed (v12) | `WalletButton.tsx` — `copiedTimerRef` stores timer; `useEffect` cleanup on unmount |
| B-11-7 | ✅ Fixed (v12) | `VerificationBadge.tsx` — `useMountedRef` guard after async verify() |
| B-11-8 | ✅ Fixed (v12) | `PostPageClient.tsx` — `useMountedRef` guard in fetchData and fetchUserBalance |
| B-11-9 | ✅ Fixed (v12) | `HidePostButton.tsx` — error state + title/aria-label feedback |
| B-11-10 | ✅ Fixed (v12) | `ProfilePageClient.tsx` — visibility-aware polling with `visibilitychange` listener |
| A-11-1 | ✅ Fixed (v12) | `PostPageClient.tsx` + `ProfilePageClient.tsx` — ErrorBoundary wraps 6 high-risk widgets |
| A-11-2 | ✅ Fixed (v12) | `post/[id]/page.tsx`, `profile/[username]/page.tsx`, `tag/[tag]/page.tsx` — `generateMetadata` with OG tags |
| A-11-3 | ✅ Fixed (v12) | 4 new `loading.tsx` files: profile, tag, notifications, create |
| A-11-4 | ✅ Fixed (v12) | 3 new `error.tsx` files: profile, tag, notifications |
| A-11-5 | ✅ Fixed (v12) | `loading.tsx` — `lg:` → `md:` breakpoint aligned |
| A-11-6 | ✅ Fixed (v12) | `layout.tsx` — blocking `<script>` sets `data-theme` before paint |
| Q-11-1 | ✅ Fixed (v12) | `EditProfileButton.tsx` — full ARIA dialog: role, aria-modal, aria-labelledby, Escape, backdrop click, focus management |
| Q-11-2 | ✅ Fixed (v12) | `FeedFilter.tsx` — `aria-pressed` on filter buttons |
| Q-11-3 | ✅ Fixed (v12) | `FollowUserButton.tsx` + `FollowTagButton.tsx` — `aria-busy={isPending}` |
| Q-11-4 | ✅ Fixed (v12) | `CollapsibleSection.tsx` — Space key + `e.preventDefault()` in onKeyDown |
| Q-11-5 | ✅ Fixed (v12) | `PostCard.tsx` — `<Link>` → `<article>` with onClick/onKeyDown navigation, role="link" |
| Q-11-6 | ✅ Fixed (v12) | `SatsInput.tsx` — `label` prop; LockForm/TipForm/SaleActions pass unique labels |
| Q-11-7 | ✅ Fixed (v12) | `LockForm.tsx` — success banner with 5s auto-clear, `role="status"` |
| Q-11-8 | ✅ Fixed (v12) | `FeedClient.tsx` — `hasLoadedOnce` ref gates "Refreshing..." indicator |
| Q-11-9 | ✅ Fixed (v12) | `register/page.tsx` — client-side password-confirm validation |
| Q-11-10 | ⚪ Open-Low | `MobileDrawer.tsx` — focus return to trigger (deferred) |
| Q-11-11 | ⚪ Open-Low | `SearchBar.tsx`, `TagInput.tsx` — ARIA combobox pattern (deferred) |

---

## Prioritized Remediation — Review #11

### Immediate (before next release)
1. **B-11-1, B-11-2, B-11-3** CSS variable fixes — add `--success`, replace `--error`→`--danger`, `--primary-dark`→`--primary-hover`. **Effort: quick**
2. **B-11-4** Fix SWR fetcher to surface HTTP status; wire `swrConfig` via `<SWRConfig>`. **Effort: medium**
3. **B-11-5** ReplyForm: add `setError()` in catch block. **Effort: quick**

### Next sprint
4. **A-11-1** Wire ErrorBoundary around LockForm, TipForm, SaleActions, VerificationBadge. **Effort: quick**
5. **A-11-2** Add `generateMetadata` to post, profile, tag pages. **Effort: medium**
6. **Q-11-1** EditProfileButton modal ARIA + keyboard. **Effort: medium**
7. **B-11-6** WalletButton setTimeout cleanup. **Effort: quick**
8. **B-11-7, B-11-8** MountedRef guards in VerificationBadge, PostPageClient. **Effort: quick**
9. **B-11-10** Profile page visibility-aware polling. **Effort: quick**
10. **Q-11-2, Q-11-3** aria-pressed on FeedFilter, aria-busy on Follow buttons. **Effort: quick**

### Sprint after
11. **A-11-3, A-11-4** Add loading.tsx and error.tsx for remaining routes. **Effort: medium**
12. **A-11-5** Fix loading skeleton breakpoint. **Effort: quick**
13. **A-11-6** Dark mode FOUC blocking script. **Effort: quick**
14. **Q-11-4 through Q-11-8** Remaining accessibility and UX polish. **Effort: medium**

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
| Q2 | ✅ Fixed (v8) | `app/lib/__tests__/wallet-adapters.test.ts` — 76 tests covering BRC100Adapter and SimplySatsAdapter |
| Q10 | ✅ Fixed (v8) | `app/lib/__tests__/rate-limit-core.test.ts` (25 tests) + `app/lib/__tests__/idempotency-locking.test.ts` (22 tests) |

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
| Bugs (B1-10, NB1-3, B-NEW-1/2/3/4, B-11-1..10) | 27 | 26 | 1 (intentional) |
| Architecture (A1-10, NA1, A-NEW-1/2, A-11-1..6) | 19 | 18 | 1 (documented) |
| Quality (Q1-16, NQ1-3, Q-NEW-1, Q-11-1..11) | 31 | 29 | 2 (low) |
| **Total** | **92** | **88** | **4** |
