# Local Dev Workaround for ERR_NAME_NOT_RESOLVED

If your network DNS cannot resolve `backend-production-611d.up.railway.app`, run the app locally. The frontend will proxy API requests to your local backend, which connects to Railway's Postgres and R2.

## Steps

**Terminal 1 - Backend** (uses Railway env vars for DB and R2):
```bash
cd backend
railway link --project c38aedfc-3a1f-44ad-bef2-01737d2dbc4f --service backend
railway run npm run dev:local
```
*(dev:local forces PORT=3001 so the frontend proxy works)*

**Terminal 2 - Frontend** (proxies /api to localhost:3001):
```bash
cd frontend
npm run dev
```

Then open http://localhost:5173. API requests go to localhost:3001 (no external DNS needed).

## Alternative: Fix DNS

1. **Flush DNS**: `ipconfig /flushdns` (PowerShell as Admin)
2. **Use different DNS**: Set your network adapter to use Google (8.8.8.8) or Cloudflare (1.1.1.1)
3. **Disable VPN** if you use one
4. **Custom domain**: Add a domain you own to Railway (Dashboard → backend service → Settings → Domains)
