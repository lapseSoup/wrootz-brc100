# Wrootz BRC-100 Development Lessons

## Security Patterns

### Session Management
- **Never use hardcoded fallback secrets** - Use `getSessionPassword()` pattern that fails fast in production
- **Validate secret length** - Minimum 32 characters for iron-session
- **Store wallet tokens server-side** - Use httpOnly cookies, not localStorage (XSS vulnerable)

### Password Policy
- **8 character minimum** for financial applications
- **Block common passwords** - Maintain blocklist of "password", "12345678", etc.
- **Check character diversity** - Require at least 4 unique characters

### Rate Limiting
- **Server actions need custom rate limiting** - They don't have NextRequest, use `headers()` from next/headers
- **Always implement Redis + fallback pattern** - Use Upstash when available, Map fallback for dev
- **Financial operations need strict limits** - 5 req/min for buy/sell operations

## Architecture Patterns

### Async Function Migration
- When converting sync functions to async (e.g., `checkRateLimit`), **search for all call sites** and add `await`
- TypeScript will catch Promise-without-await errors

### Return Type Changes
- When changing return types (e.g., array → `{posts, nextCursor}`), **update all consumers**
- Search for function name to find all usages

### Background Updates
- **Don't block queries with status updates** - Use fire-and-forget pattern: `updateLockStatusesIfNeeded().catch(console.error)`
- **Cache expensive operations** - Block height caching reduces API calls

## TypeScript Patterns

### Flexible Type Definitions
- When mapping Prisma results with computed fields, use `any` with eslint disable if type gymnastics becomes too complex:
  ```typescript
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type PostWithRelations = any
  ```

### Optional Chaining for Computed Fields
- Use optional chaining when fields might not be included in all queries:
  ```typescript
  replyCount: (post.incomingLinks || []).length
  replyTo: post.outgoingLinks?.[0]?.targetPost || null
  ```

## Build & Environment

### SESSION_SECRET in Production Builds
- Next.js runs code during build with `NODE_ENV=production`
- Session modules that check for secrets will fail during build if secret not set
- Solution: Add SESSION_SECRET to .env even for local development

### Git Best Practices
- Keep `.env` in `.gitignore`
- Create `.env.example` with all required variables documented
- Never commit secrets, even "development" ones

## Wallet Integration Patterns

### Transaction Verification
- **Verify on-chain before recording** - Always check tx exists on blockchain before writing to DB
- **Use exponential backoff** - Retry 3x with 2s, 4s, 8s delays for API failures
- **Batch API calls** - WhatsOnChain rate limit is 3 req/sec, process in batches with delays

### Error Handling
- **Categorize errors** - Connection, Auth, InsufficientFunds, Rejected, Network, Timeout
- **Include actionable suggestions** - Each error type should have a user-facing action suggestion
- **Parse error messages** - Look for keywords like "401", "insufficient", "rejected" to categorize

### Auto-Reconnect
- **Handle 401 transparently** - Attempt reconnect once before throwing auth error
- **Prevent race conditions** - Use single reconnect promise to prevent multiple concurrent reconnects
- **Clear reconnect state** - Always clear reconnect promise in finally block

### Balance Updates
- **Refresh immediately after operations** - Don't wait for periodic refresh after lock/unlock
- **Expose refresh function from context** - Let components trigger refresh as needed
- **Keep periodic refresh as backup** - 30-second interval for catching external changes
