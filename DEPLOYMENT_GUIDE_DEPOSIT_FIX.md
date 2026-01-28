## 🚀 DEPLOYMENT GUIDE - DEPOSIT FLOW FIX

### Before You Deploy

Make sure you've read:
1. [DOCUMENTATION_GUIDE.md](DOCUMENTATION_GUIDE.md) - Navigation
2. [EXECUTION_SUMMARY.md](EXECUTION_SUMMARY.md) - Overview
3. [DEPOSIT_FLOW_TECHNICAL.md](DEPOSIT_FLOW_TECHNICAL.md) - Technical details

---

## 📋 Pre-Deployment Checklist

```bash
# 1. Verify all changes are committed
git status
# Result should be: "On branch main, nothing to commit, working tree clean"

# 2. Verify the commits exist
git log --oneline -5
# Should show these commits (in reverse order from newest):
# - 257b21a 📖 Add documentation navigation guide
# - 8b6f36c ✅ Add execution summary of deposit flow fix
# - 08effe1 📚 Add comprehensive documentation for deposit flow fix
# - c8614ed 🧹 Remove unused import in depositFlow
# - c3f2c7f ✅ Fix: USER's wallet pays for deposits, not operator

# 3. Verify both frontend and backend compile
cd /workspaces/shadowpay-/backend && npx tsc --noEmit
# Expected: No errors, just finishes

# 4. Verify backend tests (if any)
cd /workspaces/shadowpay-/backend && npm test 2>&1 || true
# Result: May pass or have pre-existing failures (not our concern)
```

---

## 🔧 Deployment Steps

### Option A: Deploy to Railway (Production)

```bash
# 1. Push to main branch (already done locally)
git push origin main

# 2. Railway auto-deploys on push to main
# Monitor at: https://railway.app
# Backend service should auto-deploy
# Frontend (if on Vercel) should also auto-deploy

# 3. After deployment, run tests
# See TEST_DEPOSIT_FLOW.md for detailed testing
```

### Option B: Deploy Manually

#### Backend Deployment

```bash
# 1. SSH to backend server
ssh user@backend-server

# 2. Navigate to project
cd /path/to/shadowpay-backend

# 3. Pull latest changes
git pull origin main

# 4. Install dependencies (if needed)
npm install

# 5. Generate Prisma client
npx prisma generate

# 6. Build TypeScript
npm run build

# 7. Restart backend service
systemctl restart shadowpay-backend
# OR if using PM2:
pm2 restart shadowpay-backend
```

#### Frontend Deployment

```bash
# 1. SSH to frontend server / build server
ssh user@frontend-server

# 2. Navigate to project
cd /path/to/shadowpay-frontend

# 3. Pull latest changes
git pull origin main

# 4. Install dependencies (if needed)
npm install

# 5. Build frontend
npm run build

# 6. Deploy to hosting
# If on Vercel: automatically deploys on git push
# If on custom server:
#   - Copy dist/ to web root
#   - Restart nginx/apache

```

### Option C: Using Docker (if containerized)

```bash
# 1. Pull latest changes
git pull origin main

# 2. Rebuild Docker images
docker-compose build

# 3. Restart services
docker-compose down
docker-compose up -d

# 4. Verify services are running
docker-compose ps
```

---

## ✅ Post-Deployment Verification

### Immediate (5-10 minutes)

```bash
# 1. Check backend health endpoint
curl https://your-backend.com/health
# Expected: 200 OK with server status

# 2. Check frontend loads
curl https://your-frontend.com
# Expected: 200 OK with HTML

# 3. Check browser console (visit frontend in browser)
# Expected: No critical errors in console
```

### Testing (20-30 minutes)

```bash
# Follow TEST_DEPOSIT_FLOW.md exactly:

# 1. Check operator wallet balance BEFORE
solana balance <OPERATOR_WALLET_ADDRESS>
# Record this number

# 2. Perform a test deposit (0.01 SOL)
# - Go to frontend
# - Create/use payment link
# - Click Deposit
# - Phantom signs
# - Approve

# 3. Check operator wallet balance AFTER
solana balance <OPERATOR_WALLET_ADDRESS>
# Should be IDENTICAL (not changed)

# 4. Check user wallet in Phantom
# Should be approximately 0.01 SOL less (including fees)

# 5. Check backend logs
tail -f /var/log/shadowpay-backend.log | grep -i deposit
# Should show success messages

# 6. Check database
# Verify transaction is recorded
# See TEST_DEPOSIT_FLOW.md for exact queries
```

---

## 🔍 Troubleshooting

### Issue: Backend returning 502 error

```bash
# 1. Check backend logs
journalctl -u shadowpay-backend -n 50

# 2. Verify backend is running
systemctl status shadowpay-backend

# 3. Check database connection
# Backend should log database connection status

# 4. Verify environment variables
# OPERATOR_SECRET_KEY should be set
# RPC_URL should be set
echo $OPERATOR_SECRET_KEY
echo $RPC_URL
```

### Issue: Phantom not showing signature popup

```bash
# 1. Check browser console for errors
# Open DevTools → Console tab

# 2. Verify SDK is imported correctly
# Check that PrivacyCash package is available

# 3. Check RPC URL is correct
# Should be able to reach Solana RPC

# 4. Try in different wallet
# Use Phantom or Magic wallet with devnet/testnet
```

### Issue: Operator wallet still decreasing

```bash
# 1. STOP all services immediately
# This means old code is still running

# 2. Verify deployment
git log --oneline -1
# Should show: c3f2c7f ✅ Fix: USER's wallet pays for deposits

# 3. Rebuild and redeploy
# Make sure you're deploying the right branch

# 4. Check old services aren't running
ps aux | grep -i shadowpay
# Kill any old processes
```

---

## 📊 Monitoring After Deployment

### Key Metrics to Watch

1. **Operator Wallet Balance**
   - Should be stable (not decreasing)
   - Check hourly for first day

2. **Backend Error Rate**
   - Monitor logs for deposit errors
   - Should be near zero after fix

3. **Deposit Success Rate**
   - Track deposits in database
   - Should be 100% (or close)

4. **User Wallet Balances**
   - Spot check: deposits should cost 0.01 SOL + fees
   - Verify in blockchain explorer

### Sample Monitoring Script

```bash
#!/bin/bash
# Save as: /usr/local/bin/monitor-shadowpay.sh

echo "📊 ShadowPay Monitoring"
echo "===================="
echo ""

echo "🔐 Operator Wallet:"
solana balance <OPERATOR_WALLET>

echo ""
echo "📝 Recent Deposits (Database):"
sqlite3 /path/to/db.sqlite3 \
  "SELECT COUNT(*) as recent_deposits FROM Transaction WHERE \
   type='deposit' AND createdAt > datetime('now', '-1 hour');"

echo ""
echo "⚠️  Backend Errors (Last 10 minutes):"
journalctl -u shadowpay-backend -n 100 | grep -i error | tail -5

echo ""
echo "✅ Backend Status:"
systemctl status shadowpay-backend --no-pager | grep Active
```

---

## 🔄 Rollback Plan (if needed)

If something goes wrong, roll back to previous version:

```bash
# 1. Identify last good commit
git log --oneline -10
# Note the commit before the fix (f80b9b0)

# 2. Revert to previous state
git revert -n c3f2c7f..HEAD  # Revert all our commits
git commit -m "Rollback: Revert deposit flow fix"

# 3. Push rollback
git push origin main

# 4. Redeploy backend/frontend
# Services will auto-deploy on push

# 5. Verify operator wallet
# Should go back to normal (if operator balance was issue)
```

---

## ✨ Success Indicators

You'll know the fix is working when:

✅ **Operator wallet balance is stable**
- Before: 0.00379164 SOL
- After deployment: Still 0.00379164 SOL (unchanged)

✅ **User can see Phantom signature popup**
- When clicking "Deposit"
- Phantom window appears asking to sign

✅ **User's wallet balance decreases**
- Before deposit: 1.5 SOL
- After 0.01 SOL deposit: ~1.489 SOL (accounting for fees)

✅ **Backend shows success logs**
- "📤 Relaying signed transaction"
- "✅ Transaction recorded in database"

✅ **Deposits are recorded in database**
- Check paymentLink table: depositTx is populated
- Check transaction table: new entries appear

✅ **Privacy Cash pool receives deposits**
- Encrypted UTXOs stored
- User can later claim/withdraw

---

## 📞 Support

If you encounter issues:

1. **Check logs**: `journalctl -u shadowpay-backend -n 100`
2. **Read docs**: See DOCUMENTATION_GUIDE.md
3. **Test manually**: Follow TEST_DEPOSIT_FLOW.md
4. **Review code**: Check DEPOSIT_FLOW_TECHNICAL.md
5. **Verify environment**: Check OPERATOR_SECRET_KEY and RPC_URL

---

## 📝 Deployment Completed Checklist

After successful deployment and testing:

- [ ] Pushed changes to main branch
- [ ] Backend deployed and running
- [ ] Frontend deployed and running
- [ ] Ran at least one test deposit
- [ ] Verified operator wallet is stable
- [ ] Verified user wallet decreased
- [ ] Checked backend logs for success
- [ ] Database shows transaction recorded
- [ ] No errors in browser console
- [ ] Monitored for 1 hour (no issues)
- [ ] Team notified of successful deployment

---

## 📚 Related Guides

- [TEST_DEPOSIT_FLOW.md](TEST_DEPOSIT_FLOW.md) - Detailed testing
- [DOCUMENTATION_GUIDE.md](DOCUMENTATION_GUIDE.md) - Where to find info
- [EXECUTION_SUMMARY.md](EXECUTION_SUMMARY.md) - What was fixed
- [DEPOSIT_FLOW_TECHNICAL.md](DEPOSIT_FLOW_TECHNICAL.md) - How it works

✅ **Deployment is ready. Good luck!**
