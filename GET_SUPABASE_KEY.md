# Get Supabase ANON_KEY

## Quick Steps:

1. **Login to Supabase** → https://supabase.com/dashboard
2. **Select your project** → "Pharmacy API" (or similar)
3. **Go to Settings** (bottom left) → **API**
4. **Copy the "anon/public" key**
   - It looks like: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

## Where to paste it:

### Local Development:
File: `apps/api/.env`
```
SUPABASE_ANON_KEY="<paste-here>"
```

### Railway Production:
1. Open Railway dashboard
2. Select your **Pharmacy API service**
3. Go to **Variables**
4. Add:
   ```
   SUPABASE_ANON_KEY=<paste-here>
   ```

## Verify it works:

After updating, test the promotion copilot in your admin dashboard. If you see AI-generated promotions instead of errors, you're good! ✅
