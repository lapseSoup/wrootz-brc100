# Wrootz BRC-100 Production Setup

## Completed Security Remediations

- [x] Session secret - fails fast in production, warns in dev
- [x] Password policy - 8 char min, blocklist, diversity check
- [x] Auth rate limiting - 10 req/min for login/register
- [x] Wallet token security - httpOnly cookies instead of localStorage
- [x] Redis rate limiting - Upstash with in-memory fallback
- [x] Redis idempotency - Upstash with in-memory fallback
- [x] Background lock updates - non-blocking with caching
- [x] Cursor pagination - for feed endpoint
- [x] buyPost re-enabled - with transaction verification

## Simply Sats Wallet Improvements (Phase 1 & 2)

- [x] Lock verification before recording - verifies tx exists on-chain before DB write
- [x] Transaction confirmation tracking - cron endpoint to update confirmed status
- [x] Categorized wallet errors - better UX with actionable error messages
- [x] Auto-reconnect on stale session - transparent reconnect on 401 errors
- [x] Real-time balance updates - immediate balance refresh after lock/unlock

## Production Deployment Checklist

### Required Environment Variables

```bash
# Generate a secure session secret
openssl rand -base64 32
```

Set these in your production environment:

- [ ] `SESSION_SECRET` - 32+ character secret (REQUIRED)
- [ ] `DATABASE_URL` - PostgreSQL connection string for production

### Optional for Multi-Instance Deployments

Get credentials at https://upstash.com:

- [ ] `UPSTASH_REDIS_REST_URL` - Redis URL for distributed rate limiting
- [ ] `UPSTASH_REDIS_REST_TOKEN` - Redis auth token

### Cron Job Setup

Two cron jobs are configured in `vercel.json`:
1. **Lock status updates** - every minute
2. **Transaction confirmations** - every 5 minutes

**Option 1: Vercel Cron (already configured)**
```json
{
  "crons": [
    { "path": "/api/cron/update-locks", "schedule": "* * * * *" },
    { "path": "/api/cron/confirm-transactions", "schedule": "*/5 * * * *" }
  ]
}
```

**Option 2: External Cron (cron-job.org, etc.)**
- Lock updates: `https://your-domain.com/api/cron/update-locks` (every 1 min)
- TX confirmations: `https://your-domain.com/api/cron/confirm-transactions` (every 5 min)
- Headers: `Authorization: Bearer YOUR_CRON_SECRET`

- [ ] Set `CRON_SECRET` environment variable
- [ ] Configure cron jobs

### Database Migration (if using PostgreSQL)

1. Update `prisma/schema.prisma` provider to `postgresql`
2. Set `DATABASE_URL` to PostgreSQL connection string
3. Run: `npx prisma migrate deploy`

- [ ] PostgreSQL database provisioned
- [ ] Migrations applied

## Future Improvements

- [ ] Email verification for account recovery
- [ ] CSRF tokens for financial operations
- [ ] Encrypted audit log details
- [ ] Full payment verification (check recipient address)
- [ ] Locker share distribution automation
