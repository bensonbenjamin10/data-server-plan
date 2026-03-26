# Railway Deployment - data-joe

Project **data-joe** is deployed on Railway with:

## Services

| Service | URL | Description |
|---------|-----|-------------|
| **Backend** | https://data-joe-server.finjoe.app | Node.js/Express API |
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
- `JWT_SECRET` - **required** for production auth (strong random string for signing JWTs)
- `SKIP_AUTH` - 0 for production; 1 for dev bypass
- `FRONTEND_URL` - for CORS
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME` - when using R2

**Frontend**:
- `VITE_API_URL` - https://data-joe-server.finjoe.app/api

## Set backend URL (after changing backend domain)

After updating the backend's public domain (e.g. to `data-joe-server.finjoe.app`), set the frontend's API URL so the built app calls the correct backend:

```bash
cd frontend
railway link -p data-joe -s frontend -e production
railway variable set VITE_API_URL=https://data-joe-server.finjoe.app/api
```

Then redeploy the frontend so the new value is baked into the build: `railway up`.

(Optional) If you use `FRONTEND_URL` on the backend for CORS, set it to your frontend origin, e.g.:
```bash
cd backend
railway link -p data-joe -s backend -e production
railway variable set FRONTEND_URL=https://data.finjoe.app
```

## Auth Setup

1. Set `JWT_SECRET` on the backend (e.g. `openssl rand -base64 32`):
   ```bash
   cd backend && railway link -p data-joe -s backend -e production
   railway variable set JWT_SECRET=your-generated-secret
   ```
2. Redeploy if needed: `railway up`

## Root Directories (for GitHub deploy)

**Required** – set in each service's Settings → Source → Root Directory:
- **Backend**: Root directory = `backend`
- **Frontend**: Root directory = `frontend`

If the frontend Root Directory is wrong (e.g. repo root), the build fails with `No workspaces found: --workspace=frontend`.
