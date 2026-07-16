# Railway Ollama Deployment Guide

## Step 1: Create Ollama Service on Railway

1. **Login to Railway** → https://railway.app
2. **Go to your Pharmacy API project**
3. **Click "+ New"** → **"New Service"** → **"Deploy from GitHub repo"**
4. **Select this repository** (or create from template)
5. **Service Name:** `ollama` (lowercase)

## Step 2: Configure Build Settings

**In Railway Service Settings:**

1. **Root Directory:** `.` (root of repo)
2. **Dockerfile Path:** `./Dockerfile.ollama`
3. **Build Command:** (leave empty - uses Dockerfile)
4. **Start Command:** (leave empty - uses Dockerfile CMD)

## Step 3: Set Environment Variables

In Railway Ollama service → **Variables:**

```
OLLAMA_HOST=0.0.0.0:11434
OLLAMA_MODELS=/root/.ollama/models
```

## Step 4: Configure Networking

1. **Public Domain:** Enable (Railway will assign a public URL)
   - Example: `ollama-production-abcd.up.railway.app`
2. **Port:** `11434` (Ollama API port)

## Step 5: Monitor Deployment

Railway deploys and:
1. Builds Docker image
2. Starts Ollama service
3. Pulls `neural-chat` model (~4GB, takes ~3-5 min)
4. Service becomes ready

**Check logs** for `"Listening on 127.0.0.1:11434"` when ready.

## Step 6: Test Ollama Service

Once deployed, test the endpoint:

```bash
curl https://ollama-production-xxxx.up.railway.app/api/tags
```

Should return:
```json
{
  "models": [
    {
      "name": "neural-chat:latest",
      "modified_at": "2026-07-17T...",
      "size": 4096000000
    }
  ]
}
```

## Step 7: Update API Environment Variables

In your Pharmacy API service on Railway, add/update:

```
SUPABASE_URL=https://gntpxffonjvnvadjclpl.supabase.co
SUPABASE_ANON_KEY=<your-supabase-anon-key>
OLLAMA_BASE_URL=https://ollama-production-xxxx.up.railway.app
OLLAMA_MODEL=neural-chat
```

Replace `ollama-production-xxxx.up.railway.app` with your actual Ollama service URL from Railway.

## Step 8: Test Promotion Copilot

1. Open your admin dashboard
2. **Promotions** → **Copilot Workspace**
3. Enter a prompt: *"Create a summer sale for all vitamins"*
4. Should get AI-generated promotion draft ✅

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Deployment stuck on "Pulling neural-chat" | Normal - first deployment takes 3-5 min. Check logs. |
| 503 Service Unavailable | Ollama still loading. Wait 5 min, refresh. |
| 504 Gateway Timeout | Ollama model not loaded. Restart service on Railway. |
| Connection refused | Check OLLAMA_BASE_URL is correct and includes `https://` |

## Performance Notes

- **neural-chat response time:** 5-15 seconds typically
- **Memory usage:** ~6GB during inference
- **Railway free tier:** Can run 1 instance continuously
- **Cost:** Included in your Railway subscription ✅

## Next Steps

Once Promotion Copilot is working:
1. Build Inventory Copilot (same Ollama backend)
2. Add Pricing Assistant
3. Expand to full AI business suite

All services will use the same Railway-hosted Ollama instance!
