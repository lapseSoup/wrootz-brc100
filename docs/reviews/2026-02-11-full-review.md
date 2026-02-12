# Wrootz BRC-100 Code Review Findings

**Date:** 2026-02-11 (Review #2)
**Reviewer:** Claude Opus 4.6 (automated, 5 parallel agents)
**Scope:** Full codebase (~100 source files)
**Pre-checks:** Lint clean, TypeScript clean, 53/53 tests pass

---

## Overall Health Rating: 6.5/10

**Strengths:** Solid session management (iron-session), good idempotency patterns, clean component structure, proper parameterized queries (no SQL injection), well-structured wallet adapter pattern, good rate limiting across 14 API endpoints.

**Weaknesses:** In-memory locking breaks in distributed deploys, silent error swallowing throughout, excessive polling, <10% test coverage, multiple DRY violations, accessibility gaps.

---

## 1. Critical Issues (5) — Must fix before release

### C1: In-memory idempotency locking allows double-purchase across processes
- **Severity:** CRITICAL
- **File:** `app/lib/idempotency.ts:155-167`
- **Impact:** `inProgressKeys` is a per-process `Set`. Two simultaneous requests on different servers both pass `markInProgress()`, allowing duplicate post purchases or duplicate lock recordings.
- **Fix:** Implement Redis-based distributed locking with `SET ... NX EX` for the in-progress mechanism.
- **Effort:** Medium refactor

### C2: Lock updater race condition — double-expiration corrupts wrootz totals
- **Severity:** CRITICAL
- **File:** `app/lib/lock-updater.ts:79-141`
- **Impact:** `markInProgress('lockUpdate')` is called after the throttle time check. Two servers can both pass the throttle and execute simultaneously, decrementing `totalTu` twice for the same lock, driving wrootz values negative.
- **Fix:** Move `markInProgress()` before the throttle check; release lock if throttle rejects.
- **Effort:** Quick fix

### C3: WalletProvider event listeners never cleaned up
- **Severity:** CRITICAL
- **File:** `app/components/WalletProvider.tsx:73-93`
- **Impact:** `onAccountChange` and `onDisconnect` listeners accumulate on every `connect()` call, causing memory leaks and stale closures that fire old handlers with stale state.
- **Fix:** Store listener unsubscribe functions and call them before registering new listeners or on disconnect.
- **Effort:** Quick fix

### C4: Cron secret comparison vulnerable to timing attack
- **Severity:** CRITICAL
- **Files:** `app/api/cron/confirm-transactions/route.ts:46`, `app/api/cron/update-locks/route.ts:43`
- **Impact:** String `!==` comparison leaks secret character-by-character via timing side-channel.
- **Fix:** Use `crypto.timingSafeEqual()` for constant-time comparison.
- **Effort:** Quick fix

### C5: Lock updater pagination cap causes permanent wrootz inflation
- **Severity:** CRITICAL
- **File:** `app/lib/lock-updater.ts:107-113`
- **Impact:** Hardcoded `take: 5000` means locks beyond that threshold are returned in the same order every time and never expire, permanently inflating post wrootz values.
- **Fix:** Implement cursor-based pagination loop that processes all active locks in batches.
- **Effort:** Medium refactor

---

## 2. High Priority Issues (10) — Should fix this sprint

### H1: Rate limiting is in-memory only
- **Files:** `app/lib/rate-limit.ts:24-25`, `app/lib/server-action-rate-limit.ts:29-42`
- **Impact:** Multiple server instances each have independent rate limit stores; attackers distribute requests across instances to bypass limits.
- **Fix:** Require Redis in production with strict startup validation.

### H2: No rate limiting on wallet connect endpoints
- **File:** `app/api/wallet/connect/route.ts`
- **Impact:** Brute-force attacks on wallet token submissions.
- **Fix:** Add `checkRateLimit(request, RATE_LIMITS.auth)` to POST/DELETE handlers.

### H3: Password policy too weak
- **File:** `app/lib/password-policy.ts:11-19`
- **Impact:** 8-character minimum with small blocklist (31 entries); doesn't check breach databases.
- **Fix:** Increase to 12 characters; expand common password list or integrate HaveIBeenPwned API.

### H4: Excessive polling — 2 requests every 5 seconds
- **File:** `app/post/[id]/PostPageClient.tsx:59`
- **Impact:** Bandwidth waste; fires regardless of tab visibility or data changes.
- **Fix:** Add visibility-aware polling with exponential backoff on unchanged data.

### H5: N+1 queries on profile pages
- **File:** `app/profile/[username]/page.tsx:88-112`
- **Impact:** For each user lock, re-fetches all other locks on that post to recalculate totalTu.
- **Fix:** Use cached `post.totalTu` instead of re-aggregating from locks on every query.

### H6: State updates after async wallet operations
- **File:** `app/components/LockForm.tsx:69-107`
- **Impact:** If component unmounts during lock transaction, `setState` calls cause React warnings and potential bugs.
- **Fix:** Add AbortController or mounted-ref guard for async operations.

### H7: Session secret hardcoded fallback
- **File:** `app/lib/session.ts:14-18`
- **Impact:** If `NODE_ENV` is misconfigured, dev secret `'dev_secret_32_chars_for_local_only!'` is used in production, allowing session forgery.
- **Fix:** Remove fallback; always require `SESSION_SECRET` env var.

### H8: Silent reply-target fetch failure
- **File:** `app/create/page.tsx:62`
- **Impact:** `.catch(() => {})` silently swallows errors; user creates reply to a post that doesn't exist.
- **Fix:** Surface error to user or prevent submission if reply target can't be loaded.

### H9: Missing URL validation on post creation
- **File:** `app/actions/posts/create.ts:25-26`
- **Impact:** imageUrl and videoUrl passed through without format/length validation; potential XSS or open redirect if rendered without escaping.
- **Fix:** Validate URL format with `new URL()`, restrict to allowed domains, add length limit (2048 chars).

### H10: Payment verification accepts malformed public keys
- **File:** `app/lib/blockchain-verify.ts:438-481`
- **Impact:** No format validation before hashing; `parseInt(slice, 16)` silently returns `NaN` for non-hex input, producing unexpected hash results.
- **Fix:** Validate hex format and expected lengths (40/66/130) before processing.

---

## 3. Medium Priority Issues (18) — Good to improve

| # | Issue | Location | Effort |
|---|-------|----------|--------|
| M1 | Identity keys stored in localStorage (XSS-accessible) | `simplysats-adapter.ts:290`, `brc100-adapter.ts:135` | Medium |
| M2 | CSRF nonce failures silently ignored — requests proceed unprotected | `simplysats-adapter.ts:131-133` | Quick |
| M3 | Admin privilege check not atomic with execution (race condition) | `actions/admin.ts:10-25` | Medium |
| M4 | Lock verification exact amount match (inconsistent with 100-sat payment tolerance) | `blockchain-verify.ts:290-292` | Quick |
| M5 | Floating-point satoshi conversions: `Math.round(price * 100_000_000)` | `actions/posts/sales.ts:220` | Medium |
| M6 | FileReader missing onerror handler — unhandled rejection | `EditProfileButton.tsx:44-49` | Quick |
| M7 | `onClose` in useEffect dependency causes constant listener re-attachment | `MobileDrawer.tsx:33` | Quick |
| M8 | Debounce timing edge cases in search components | `SearchBar.tsx:65-79`, `TagInput.tsx:57-71` | Quick |
| M9 | localStorage access without try-catch (SSR/hydration edge case) | `Header.tsx:25-32` | Quick |
| M10 | Upload race condition — second file selection before first upload completes | `ImageUploadSection.tsx:27-66` | Medium |
| M11 | Fragile DOM manipulation via `nextElementSibling` instead of React state | `ProfileAvatar.tsx:28-33` | Quick |
| M12 | Missing security headers (CSP, X-Frame-Options, X-Content-Type-Options) | Middleware level | Medium |
| M13 | PostPageClient (425 lines) and ProfilePageClient (307 lines) too large | Post/Profile pages | Major |
| M14 | 4 different lock item render patterns instead of 1-2 shared components | Multiple files | Medium |
| M15 | Inconsistent Date type: `types/index.ts` uses `Date` but runtime passes ISO strings | `lib/types/index.ts:99` | Quick |
| M16 | `force-dynamic` on all pages disables ISR/CDN caching entirely | `layout.tsx:29`, multiple pages | Quick |
| M17 | Missing `useMemo` for expensive calculations in PostPageClient | `PostPageClient.tsx:54` | Quick |
| M18 | Clickable divs without keyboard support (accessibility) | `LockItem.tsx:46-49`, `SidebarLocks.tsx` | Quick |

---

## 4. Low Priority Issues (15) — Nice to have

| # | Issue |
|---|-------|
| L1 | Console logging of wallet operations in production |
| L2 | ErrorBoundary doesn't log to error tracking service |
| L3 | SatsInput `max` prop declared but unused (void statement) |
| L4 | Missing block time constants (`BLOCKS_PER_HOUR=6`, `BLOCKS_PER_DAY=144`) |
| L5 | PostCard layout shift when searchTags changes |
| L6 | Sidebar uses index in list key (anti-pattern) |
| L7 | TipForm setTimeout may fire after unmount |
| L8 | WalletButton doesn't clear global wallet error on retry |
| L9 | usePolling hook has no AbortController for cleanup |
| L10 | TransactionHistory uses divs instead of semantic table HTML |
| L11 | Tag search has no max length validation on query string |
| L12 | Lock verification errors leak on-chain amounts to client |
| L13 | Callback arrays not cleared before reconnect (only on disconnect) |
| L14 | Wallet session token lacks explicit TTL/forced re-auth |
| L15 | Test coverage <10% — wrootz-calculations, form validation, state management untested |

---

## Prioritized Remediation Plan

### Week 1: Critical Path (C1-C5)
1. **C2** Move `markInProgress()` before throttle check (quick fix)
2. **C3** Store and clean up WalletProvider event listeners (quick fix)
3. **C4** Replace `!==` with `crypto.timingSafeEqual()` in cron routes (quick fix)
4. **C1** Add Redis-based distributed locking to idempotency module (medium)
5. **C5** Implement cursor-based pagination in lock updater (medium)

### Week 2: High Priority (H1-H10)
6. **H7** Remove session secret fallback (quick fix)
7. **H2** Add rate limiting to wallet connect endpoints (quick fix)
8. **H8** Surface reply-target fetch errors (quick fix)
9. **H9** Add URL validation to post creation (quick fix)
10. **H10** Validate pubkey format in payment verification (quick fix)
11. **H1** Require Redis in production (medium)
12. **H6** Add mounted guards to LockForm async ops (medium)
13. **H5** Use cached totalTu in profile queries (medium)
14. **H4** Implement visibility-aware polling (medium)
15. **H3** Strengthen password policy (medium)

### Week 3-4: Medium & Low
16. Address M1-M18 based on feature priorities
17. Add test coverage for wrootz-calculations, form validation
18. Implement security headers via middleware
19. Component refactoring (split large components, consolidate lock renders)

---

## Changes Since Review #1 (previous REVIEW_FINDINGS.md)

**Fixed since last review:**
- C1 (content hash mismatch) — resolved
- C2/C3 (CSRF nonces, session token rotation) — resolved in simplysats-adapter
- H1 (Base58Check checksum) — resolved
- H3 (buyPost idempotency) — now has idempotency protection
- H4 (notification calls) — resolved
- L6 (dust limit) — now enforced at 546 sats
- L8 (callback cleanup) — unsubscribe functions now returned

**New findings this review:** C1-C5 (distributed locking, memory leaks, timing attacks), H4 (polling), H5 (N+1), M6-M18 (React-specific bugs, accessibility)
