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

Set up a cron job to update lock statuses every minute:

**Option 1: Vercel Cron**
Add to `vercel.json`:
```json
{
  "crons": [{
    "path": "/api/cron/update-locks",
    "schedule": "* * * * *"
  }]
}
```

**Option 2: External Cron (cron-job.org, etc.)**
- URL: `https://your-domain.com/api/cron/update-locks`
- Frequency: Every 1 minute
- Headers: `Authorization: Bearer YOUR_CRON_SECRET`

- [ ] Set `CRON_SECRET` environment variable
- [ ] Configure cron job

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
