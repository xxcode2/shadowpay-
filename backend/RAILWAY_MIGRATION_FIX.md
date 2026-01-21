# Railway Deployment Guide - Migration Fix

## Problem
- Frontend getting HTTP 500 from POST /api/deposit
- Root cause: Database schema is out of sync with backend code
- Backend code expects `commitment` field in `payment_links` table
- Railway database doesn't have this column yet

## Solution

### Option 1: Automatic (Recommended)
Railway GitHub integration will automatically:
1. Detect the new migration files in `backend/prisma/migrations/1_add_commitment_and_relations/`
2. Run `prisma migrate deploy` during deployment
3. Update the database schema
4. API will start working

**Just push to main and Railway will handle it** ✅

### Option 2: Manual (If automatic doesn't work)

1. Go to Railway dashboard
2. Select your service
3. Go to Variables tab
4. Verify `DATABASE_URL` is set and pointing to the correct PostgreSQL database
5. Connect to your Railway project via CLI or manually run:

```bash
DATABASE_URL="your_railway_db_url" \
pnpm --filter shadowpay-backend prisma migrate deploy
```

### What the migration does:
- ✅ Adds `commitment` column to `payment_links` 
- ✅ Creates foreign key: `transactions.linkId` → `payment_links.id`
- ✅ Enables CASCADE delete for data integrity
- ✅ Removes UNIQUE constraint from `transactionHash` (allows retries)
- ✅ Adds index on `linkId` for query performance

### Verify it worked:
1. Check Railway logs for "Prisma migration" success message
2. Try POST /api/deposit again
3. Should return 200 (not 500)
4. Check Railway logs: should see `DEPOSIT BODY: { amount, assetType, senderAddress }`

## If still failing:
1. Check Railway logs for exact error message
2. Verify DATABASE_URL environment variable exists
3. Ensure the database is accessible (not frozen/hibernated)
4. Check if Prisma client is regenerated in build (it is, auto-handled by build script)
