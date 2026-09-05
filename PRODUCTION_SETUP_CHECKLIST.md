# Production Setup Checklist: Promotion Copilot + Ollama on Railway

> **Stale as of 2026-09-05**: written before the project migrated off Supabase Cloud — the `SUPABASE_URL`/project references below (`gntpxffonjvnvadjclpl.supabase.co`) point at the old Cloud project. Substitute the current self-hosted gateway (see [PROJECT_HANDBOOK.md](./PROJECT_HANDBOOK.md) §5.1) before following any step literally. The Ollama/Promotion-Copilot feature itself is real and still in use.

## 🎯 GOAL
Get AI Promotion Copilot working on production with Railway-hosted Ollama.

## ⚡ TIMELINE
- Step 1-3: **10 minutes** (get credentials)
- Step 4-5: **5-10 minutes** (deploy Ollama)
- Step 6: **2 minutes** (update API variables)
- Step 7: **1 minute** (test)
- **Total: 20-25 minutes**

---

## ✅ STEP-BY-STEP

### **PHASE 1: Gather Credentials (10 min)**

**Task 1.1:** Get Supabase ANON_KEY
- [ ] Open https://supabase.com/dashboard
- [ ] Select your project (Pharmacy API)
- [ ] Settings → API
- [ ] Copy the "anon/public" key
- [ ] **Save it somewhere safe** (you'll need it in 15 min)

**Task 1.2:** Note down your current Railway project
- [ ] Open https://railway.app
- [ ] Find your **Pharmacy API** service
- [ ] Note the project name
- [ ] You'll deploy Ollama to the **same project**

---

### **PHASE 2: Deploy Ollama to Railway (5-10 min)**

**Task 2.1:** Create new Ollama service
- [ ] Railway Dashboard → Your Pharmacy Project
- [ ] Click **"+ New"** 
- [ ] Select **"New Service"**
- [ ] Choose **"Deploy from GitHub repo"** (this repo)
- [ ] Service name: `ollama`

**Task 2.2:** Configure build
- [ ] Root Directory: `.`
- [ ] Dockerfile: `./Dockerfile.ollama`
- [ ] Start command: (leave blank)

**Task 2.3:** Watch deployment
- [ ] Click **"Deploy"**
- [ ] Watch logs for: `"Listening on 0.0.0.0:11434"`
- [ ] Wait ~5 minutes (neural-chat is downloading ~4GB)
- [ ] Status: **✅ Healthy** (green light in Railway)

**Task 2.4:** Get Ollama URL
- [ ] Go to Ollama service → **Settings**
- [ ] Look for **"Public Domain"**
- [ ] Copy it (example: `ollama-production-abc123.up.railway.app`)
- [ ] **Save it** (you'll need this in 5 min)

**Task 2.5:** Test Ollama
- [ ] Open terminal
- [ ] Run: 
  ```bash
  curl https://ollama-production-xxx.up.railway.app/api/tags
  ```
- [ ] Should see `"neural-chat"` in response ✅

---

### **PHASE 3: Configure API Variables on Railway (2 min)**

**Task 3.1:** Update Pharmacy API variables
- [ ] Railway Dashboard → **Pharmacy API service**
- [ ] Go to **Variables**
- [ ] **Add these variables:**

| Key | Value |
|-----|-------|
| `SUPABASE_URL` | `https://gntpxffonjvnvadjclpl.supabase.co` |
| `SUPABASE_ANON_KEY` | (Paste from Task 1.1) |
| `OLLAMA_BASE_URL` | `https://ollama-production-xxx.up.railway.app` (from Task 2.4) |
| `OLLAMA_MODEL` | `neural-chat` |

- [ ] **Deploy** (Railway auto-redeploys API with new variables)
- [ ] Wait ~2 minutes for API to restart

---

### **PHASE 4: Test Promotion Copilot (1 min)**

**Task 4.1:** Test in admin dashboard
- [ ] Open your web app
- [ ] Login as admin
- [ ] Go to **Promotions** → **Copilot Workspace**
- [ ] Type a test prompt: `"Create a summer sale for all vitamins"`
- [ ] Click **"Generate Proposal"**
- [ ] **Expected:** AI-generated promotion draft appears ✅
- [ ] **If error:** Check Railway logs for both services

---

### **PHASE 5: Verify in Production (Optional)**

```bash
# Test API endpoint directly
curl -X POST https://pharmacyapi-production-xxx.up.railway.app/admin/promotion-copilot/propose \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"prompt":"Summer sale for vitamins","locale":"en","candidateProductIds":[]}'
```

---

## 🚨 TROUBLESHOOTING

| Problem | Solution |
|---------|----------|
| Ollama deployment stuck | Normal on first run (~5 min). Check logs. |
| **503 Unavailable** | Ollama not loaded yet OR API variables not set. Wait 5 min, check Railway logs. |
| **504 Gateway Timeout** | Ollama model crashed. Restart Ollama service in Railway. |
| **Connection Refused** | OLLAMA_BASE_URL incorrect. Check Railway Ollama service domain. |
| **400 Bad Request** | API variables not set OR wrong SUPABASE_ANON_KEY. Verify all 4 variables are set. |

---

## 📋 FILES PROVIDED

| File | Purpose |
|------|---------|
| `Dockerfile.ollama` | Build image for Ollama on Railway |
| `railway.toml` | Railway service config (optional) |
| `OLLAMA_RAILWAY_SETUP.md` | Detailed deployment guide |
| `GET_SUPABASE_KEY.md` | How to get Supabase ANON_KEY |
| `apps/api/.env` | Updated with environment variables (local) |

---

## 🎉 SUCCESS CHECKLIST

When Promotion Copilot works:

- [ ] ✅ Admin can open Copilot Workspace
- [ ] ✅ Can type promotion prompts
- [ ] ✅ AI generates draft promotions in 5-15 seconds
- [ ] ✅ No 503/504 errors in console
- [ ] ✅ Proposals saved to database
- [ ] ✅ Ready for production use!

---

## 🚀 NEXT: Building the AI Assistant Ecosystem

Once Promotion Copilot is stable, you can add:

1. **Inventory Copilot** - Stock optimization
2. **Pricing Assistant** - Dynamic pricing
3. **Analytics Assistant** - Sales insights
4. **Customer Support** - FAQ automation
5. **Purchase Assistant** - Supplier orders
6. **Supplier Assistant** - Vendor management
7. **CEO Dashboard** - Predictive insights

**All will use the same Railway Ollama instance!** Cost stays the same. 🎯

---

## 💬 NEED HELP?

Check Railway logs: Each service has full deployment and runtime logs.
- Ollama service logs should show model loading progress
- API service logs should show promotion requests being processed

Good luck! 🍀
