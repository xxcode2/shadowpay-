# 🔧 OPERATOR_SECRET_KEY Format Issues - FIXED

## Error You Saw
```
Failed to parse OPERATOR_SECRET_KEY: SyntaxError: Unexpected non-whitespace 
character after JSON at position 3 (line 1 column 4)
```

## What Caused It
The `OPERATOR_SECRET_KEY` on Railway was in a format the parser couldn't handle. Common issues:
- Missing closing bracket: `[200,228,213,...,188` (should be `[...188]`)
- Extra characters: `[200,228,213,...,188]extra` 
- Partial value: `[200,228,213,...,` (incomplete)
- Wrong format: `["200","228",...]` (quoted numbers instead of bare numbers)

## What We Fixed
Updated the parser to handle **multiple formats**:

✅ **Format 1: JSON Array (with brackets)**
```
[200,228,213,157,...,188]
```

✅ **Format 2: Comma-separated (no brackets)**
```
200,228,213,157,...,188
```

✅ **Format 3: Comma-separated with spaces**
```
200, 228, 213, 157,..., 188
```

## How to Fix Your Setup

### Step 1: Generate Fresh Keypair
```bash
cd /workspaces/shadowpay-
node generate-operator-wallet.js
```

You'll see:
```
🔑 PRIVATE KEY: 200,228,213,157,140,222,215,18,...,129,188
```

### Step 2: Copy ONLY the Numbers
From the output above, copy just the comma-separated numbers:
```
200,228,213,157,140,222,215,18,...,129,188
```

**Do NOT include:**
- ❌ The `[` bracket
- ❌ The `]` bracket  
- ❌ The label "PRIVATE KEY: "
- ❌ Any newlines or extra spaces

### Step 3: Set on Railway
1. Go to https://dashboard.railway.app
2. Select `shadowpay-backend-production`
3. Click "Variables" tab
4. **Delete the old OPERATOR_SECRET_KEY** (if it exists)
5. Create new variable:
   - **Name**: `OPERATOR_SECRET_KEY`
   - **Value**: (paste ONLY the comma-separated numbers from step 2)
6. Click "Save"

**Example valid values:**
```
200,228,213,157,140,222,215,18,159,133,75,191,136,165,91,175,78,105,6,229,76,188,12,145,158,195,148,56,96,101,204,175,177,135,78,211,123,240,120,176,110,130,74,212,162,208,213,162,34,109,101,70,130,138,182,116,59,130,181,94,157,201,129,188
```

### Step 4: Deploy New Code
The parser has been updated to handle more formats. Push to trigger redeploy:
```bash
git push origin main
```

Or manually redeploy in Railway:
1. Click "Deployments" tab
2. Click the three dots on latest deployment
3. Select "Redeploy"

### Step 5: Check Logs
Wait ~2 minutes for deployment. Then check Railway logs for:

✅ **Success:**
```
✅ Operator keypair loaded successfully
📍 Operator wallet: BrR2YC...abc123...xyz
✅ SDK initialized
```

❌ **Still Error:**
```
❌ KEYPAIR LOADING FAILED
   Error: Invalid number: "..." 
   (This means a number wasn't parsed correctly)
```

Or:
```
❌ KEYPAIR LOADING FAILED
   Error: Number out of range (0-255): 999
   (This means a number was > 255)
```

### Step 6: Top Up Operator
Send 0.1 SOL to the operator wallet shown in logs (the `📍 Operator wallet:` line)

### Step 7: Test
Try a deposit in ShadowPay. It should work! ✅

---

## Validation Rules

The parser now validates that:
- ✅ Each number is between 0 and 255
- ✅ There are exactly 64 numbers
- ✅ All numbers are valid integers (no decimals)
- ✅ Spaces around commas are handled

**Invalid formats** that will be rejected:
```
❌ [200,228,213] - only 3 numbers (need 64)
❌ 200.5,228,213,... - decimal numbers (need integers 0-255)
❌ "200","228","213",... - quoted numbers
❌ 200 228 213 - space-separated (need commas)
❌ [200,228,213,...,999] - number > 255
❌ [200,228,213,...,188]extra - extra characters
```

---

## If You Still See Errors

The improved error messages in Railway logs will tell you exactly what's wrong:

```
✅ Expected formats:
   Option 1 (JSON array): [200,228,213,157,...,188]
   Option 2 (comma-separated): 200,228,213,157,...,188
   Option 3 (comma+spaces): 200, 228, 213, 157,..., 188

⚠️  Your value: [200,228,213,...
```

This shows what you actually sent so you can see the problem.

---

## Common Mistakes

### Mistake 1: Including the brackets
```
❌ [200,228,213,...,188]  ← WRONG
✅ 200,228,213,...,188    ← RIGHT
```

### Mistake 2: Copy-paste included label text
```
❌ 🔑 PRIVATE KEY: 200,228,213,...,188
✅ 200,228,213,...,188
```

### Mistake 3: Extra spaces
```
❌ 200 , 228 , 213  ← WRONG (space before comma)
✅ 200, 228, 213    ← RIGHT
```

### Mistake 4: Incomplete key
```
❌ 200,228,213,...[truncated]  ← WRONG
✅ 200,228,213,...,188  ← RIGHT (all 64 numbers)
```

---

## Confirmation Checklist

After setting OPERATOR_SECRET_KEY on Railway:

- [ ] Value is comma-separated numbers (no brackets)
- [ ] No spaces before commas: `200,228` not `200 ,228`
- [ ] Spaces after commas are OK: `200, 228` is fine
- [ ] No extra characters at beginning or end
- [ ] All 64 numbers are present
- [ ] Redeploy succeeded (check Deployments tab)
- [ ] Railway logs show "✅ Operator keypair loaded successfully"
- [ ] You see the operator wallet public key in logs
- [ ] You sent 0.1 SOL to that wallet
- [ ] Deposit test in ShadowPay shows success ✅

---

## Quick Commands

Generate a fresh key:
```bash
node generate-operator-wallet.js
```

Extract just the key from generated file:
```bash
node -e "console.log(require('./operator-key.json').secretKey.join(','))"
```

Check your current setup:
```bash
./diagnostic.sh
```

---

**Status**: Parser now handles multiple OPERATOR_SECRET_KEY formats. If you still see JSON parse errors, it means the value has invalid characters or format. Follow the steps above to generate a fresh key and set it correctly on Railway.
