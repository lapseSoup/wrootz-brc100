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
