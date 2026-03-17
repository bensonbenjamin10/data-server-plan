# Railway Deployment - data-joe

Project **data-joe** is deployed on Railway with:

## Services

| Service | URL | Description |
|---------|-----|-------------|
| **Backend** | https://backend-production-611d.up.railway.app | Node.js/Express API |
| **Frontend** | https://frontend-production-f322.up.railway.app | React static app |
| **Postgres** | (internal) | PostgreSQL database |

## CLI Commands

```bash
# Link to project
railway link --project c38aedfc-3a1f-44ad-bef2-01737d2dbc4f

# Deploy backend
cd backend && railway link --service backend && railway up

# Deploy frontend  
cd frontend && railway link --service frontend && railway up

# View logs
railway logs

# Open dashboard
railway open
```

## Environment Variables

**Backend** (set via `railway variable set`):
- `DATABASE_URL` - from `${{Postgres.DATABASE_URL}}`
- `SKIP_AUTH` - 0 for production (Clerk enforced); 1 for dev bypass
- `FRONTEND_URL` - for CORS
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME` - when using R2
- `CLERK_SECRET_KEY` - **required** for production auth (get from [Clerk Dashboard → API Keys](https://dashboard.clerk.com))

**Frontend**:
- `VITE_API_URL` - https://backend-production-611d.up.railway.app/api
- `VITE_CLERK_PUBLISHABLE_KEY` - for production auth

## Enforcing Clerk Auth

Clerk is enforced when `SKIP_AUTH` is not `1`. To enable:

1. Get your **Secret Key** from [Clerk Dashboard → API Keys](https://dashboard.clerk.com) (the `sk_test_...` or `sk_live_...` value).
2. Set it on the backend:
   ```bash
   cd backend && railway link -p data-joe -s backend -e production
   railway variable set CLERK_SECRET_KEY=sk_test_YOUR_KEY_HERE
   ```
3. Redeploy if needed: `railway up`

## Root Directories (for GitHub deploy)

When connecting a GitHub repo, set in each service's Settings:
- **Backend**: Root directory = `backend`
- **Frontend**: Root directory = `frontend`
