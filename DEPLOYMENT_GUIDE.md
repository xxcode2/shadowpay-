# ShadowPay - Privacy Cash SDK Deployment Guide

## Overview

This guide covers deploying ShadowPay with Privacy Cash SDK integration to production environments (Vercel, Railway, etc.).

## Prerequisites

- Node.js 16+ and pnpm
- Git repository access
- Solana mainnet RPC endpoint (Helius recommended)
- Database (PostgreSQL)
- Deployment platform account (Vercel, Railway, etc.)

## Pre-Deployment Checklist

- [ ] All dependencies installed: `pnpm install`
- [ ] Build succeeds: `npm run build`
- [ ] Environment variables configured
- [ ] Database migrations applied
- [ ] Tests passing (if applicable)
- [ ] Documentation reviewed
- [ ] Privacy Cash SDK version verified
- [ ] RPC endpoint tested
- [ ] Wallet integration tested locally

## Environment Variables

### Frontend Configuration (.env.production)

```bash
# Backend API
VITE_BACKEND_URL=https://shadowpay-backend.example.com

# Solana RPC - Use production endpoint
VITE_SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=YOUR_API_KEY

# Frontend URL
VITE_SHARE_BASE_URL=https://shadowpay.example.com

# Privacy Cash Pool (Official)
VITE_PRIVACY_CASH_POOL=9fhQBBumKEFuXtMBDw8AaQyAjCorLGJQ1S3skWZdQyQD
```

### Backend Configuration (.env.production)

```bash
# Database
DATABASE_URL=postgresql://user:password@host:5432/shadowpay

# Environment
NODE_ENV=production

# Solana
SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=YOUR_API_KEY

# Operator (optional)
OPERATOR_PUBLIC_KEY=your_operator_key_here
```

## Database Setup

### 1. Create Database

```bash
createdb shadowpay
```

### 2. Run Migrations

```bash
cd backend
npm run build
npx prisma migrate deploy
```

### 3. Verify Schema

```bash
npx prisma studio
```

## Deployment Platforms

### Option 1: Vercel (Frontend) + Railway (Backend)

#### Vercel Frontend Deployment

1. **Connect Repository**
   ```bash
   npm i -g vercel
   vercel --prod
   ```

2. **Configure Environment**
   - Go to Vercel Dashboard → Settings → Environment Variables
   - Add frontend env vars (VITE_*)
   - Redeploy

3. **Set Root Directory**
   - Project Settings → Root Directory
   - Set to `frontend`

#### Railway Backend Deployment

1. **Create Project**
   - Connect GitHub repository
   - Select `backend` directory

2. **Configure Variables**
   - Go to Variables tab
   - Add all backend env vars
   - Set `DATABASE_URL` to PostgreSQL

3. **Add PostgreSQL Plugin**
   - Add PostgreSQL service
   - Railway auto-generates `DATABASE_URL`

4. **Deploy**
   - Push to main branch
   - Railway auto-deploys

### Option 2: Docker Deployment

#### Build Docker Images

**Frontend Dockerfile:**
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
COPY pnpm-lock.yaml ./
RUN npm i -g pnpm && pnpm install

COPY frontend/ ./
RUN pnpm run build

EXPOSE 5173
CMD ["pnpm", "run", "preview"]
```

**Backend Dockerfile:**
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
COPY pnpm-lock.yaml ./
RUN npm i -g pnpm && pnpm install

COPY backend/ ./
RUN pnpm run build

EXPOSE 3000
CMD ["npm", "start"]
```

#### Deploy with Docker Compose

```yaml
version: '3.8'

services:
  db:
    image: postgres:15
    environment:
      POSTGRES_DB: shadowpay
      POSTGRES_PASSWORD: password
    volumes:
      - db_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  backend:
    build: ./backend
    environment:
      DATABASE_URL: postgresql://postgres:password@db:5432/shadowpay
      NODE_ENV: production
      SOLANA_RPC_URL: https://mainnet.helius-rpc.com/?api-key=KEY
    ports:
      - "3000:3000"
    depends_on:
      - db

  frontend:
    build: ./frontend
    environment:
      VITE_BACKEND_URL: http://localhost:3000
      VITE_SOLANA_RPC_URL: https://mainnet.helius-rpc.com/?api-key=KEY
      VITE_SHARE_BASE_URL: http://localhost:5173
    ports:
      - "5173:5173"
    depends_on:
      - backend

volumes:
  db_data:
```

## Deployment Steps

### 1. Pre-Flight Checks

```bash
# Test build
npm run build

# Run tests (if applicable)
npm test

# Lint code
npm run lint
```

### 2. Build Artifacts

```bash
# Clean build
rm -rf node_modules dist

# Install dependencies
pnpm install

# Build all packages
npm run build
```

### 3. Database Migration

```bash
cd backend

# Generate Prisma client
npx prisma generate

# Run migrations on production database
npx prisma migrate deploy

# Verify schema
npx prisma db seed  # if seeds exist
```

### 4. Deploy Frontend

```bash
# Using Vercel
vercel --prod

# Or using your platform's CLI
# gh deploy  # GitHub Pages
# npm run build && npm run deploy  # Custom platform
```

### 5. Deploy Backend

```bash
# Using Railway
git push main  # Auto-deploys

# Or Docker
docker build -t shadowpay-backend ./backend
docker push your_registry/shadowpay-backend
```

### 6. Post-Deployment Verification

1. **Check API Health**
   ```bash
   curl https://your-backend.example.com/health
   ```

2. **Test Deposit Flow**
   - Navigate to frontend URL
   - Connect wallet
   - Create deposit link
   - Execute test deposit
   - Verify transaction on Solana Explorer

3. **Monitor Logs**
   - Backend logs in deployment platform
   - Frontend browser console
   - Database queries

## Monitoring & Maintenance

### Health Checks

**Add health endpoint to backend:**

```typescript
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: 'connected',
  })
})
```

### Logging

Configure structured logging:

```typescript
console.log(JSON.stringify({
  timestamp: new Date().toISOString(),
  level: 'info',
  message: 'Deposit executed',
  txHash: 'xxx',
  amount: 0.1,
}))
```

### Error Tracking

Consider adding:
- Sentry for error tracking
- LogRocket for frontend debugging
- Datadog for monitoring

## SSL/HTTPS Setup

### Vercel
- Automatic SSL certificate
- Configured by default

### Railway
- Automatic SSL certificate
- HTTPS always enabled

### Custom Domain
1. Update DNS records
2. Configure CORS for your domain
3. Update environment variables

## Database Backup

### Automated Backups

**Railway:** Automatic daily backups

**Custom PostgreSQL:**
```bash
# Manual backup
pg_dump $DATABASE_URL > backup.sql

# Restore
psql $DATABASE_URL < backup.sql

# Or use automated service:
# - Heroku Postgres
# - AWS RDS
# - DigitalOcean Managed Database
```

## Rollback Procedure

### If Issues Occur

1. **Check Logs**
   ```bash
   # Vercel logs
   vercel logs

   # Railway logs
   railway logs

   # Docker logs
   docker logs container_name
   ```

2. **Database Rollback**
   ```bash
   # List migrations
   npx prisma migrate status

   # Resolve/reset if needed
   npx prisma migrate resolve --rolled-back migration_name
   ```

3. **Redeploy Previous Version**
   ```bash
   # Using git
   git revert commit_hash
   git push main
   ```

## Performance Optimization

### Frontend

```typescript
// Code splitting - already handled by Vite
// Lazy load Privacy Cash SDK if needed
const PrivacyCash = await import('privacycash')
```

### Backend

```typescript
// Database query optimization
// Use indexes
CREATE INDEX idx_transactions_linkId ON transactions(linkId);
CREATE INDEX idx_paymentLinks_id ON paymentLinks(id);

// Connection pooling (Prisma default)
// Already configured
```

### CDN Setup

**Vercel:** Built-in CDN - no configuration needed

**Custom:** Use Cloudflare or similar

## Cost Optimization

### Database
- Use shared tier for small deployments
- Scale up as needed
- Monitor query performance

### Compute
- Start with small instances
- Use auto-scaling
- Monitor resource usage

### API Calls
- Cache RPC responses if possible
- Batch transactions
- Use efficient RPC providers (Helius recommended)

## Scaling Considerations

### Horizontal Scaling
- Stateless backend (no sessions on instance)
- Shared database
- Load balancer

### Vertical Scaling
- Increase instance size
- Upgrade database tier
- Add read replicas

## Security Checklist

- [ ] HTTPS/SSL enabled
- [ ] Environment variables secured
- [ ] Database credentials rotated
- [ ] API keys rotated
- [ ] CORS properly configured
- [ ] Rate limiting enabled
- [ ] Input validation on all endpoints
- [ ] SQL injection prevention (Prisma handles)
- [ ] XSS prevention on frontend
- [ ] CSRF tokens if needed
- [ ] Wallet address validation
- [ ] Transaction verification

## Troubleshooting Deployments

### Build Failures

**Issue:** Build fails during deployment

**Solution:**
```bash
# Clear cache
rm -rf .next dist node_modules

# Reinstall
pnpm install

# Rebuild locally
npm run build
```

### Database Connection Issues

**Issue:** Cannot connect to database

**Solution:**
- Verify DATABASE_URL format
- Check database is running
- Test connection: `psql $DATABASE_URL`
- Check firewall rules

### RPC Connection Issues

**Issue:** Solana RPC is timing out

**Solution:**
- Use reliable RPC provider (Helius)
- Add request timeout handling
- Implement retry logic
- Monitor RPC status

### CORS Issues

**Issue:** Frontend blocked by CORS

**Solution:**
```typescript
// Backend
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true
}))
```

## Post-Deployment

1. **Monitor Performance**
   - Page load times
   - API response times
   - Error rates

2. **Gather Feedback**
   - User testing
   - Error reports
   - Feature requests

3. **Plan Updates**
   - Privacy Cash SDK updates
   - Solana network upgrades
   - Feature improvements

## Disaster Recovery

### Backup Strategy
- Daily automated database backups
- Code stored in Git
- Environment variables documented (securely)

### Recovery Plan
1. Restore from latest backup
2. Redeploy application
3. Verify data integrity
4. Monitor for issues

## Documentation

Keep these files updated:
- [PRIVACY_CASH_INTEGRATION.md](./PRIVACY_CASH_INTEGRATION.md)
- [QUICK_START.md](./QUICK_START.md)
- [INTEGRATION_SUMMARY.md](./INTEGRATION_SUMMARY.md)

## Support

For deployment issues:
1. Check platform documentation
2. Review application logs
3. Test locally first
4. Contact platform support

---

**Last Updated:** January 26, 2026  
**Status:** Ready for Production Deployment
