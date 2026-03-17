# Organizational Data Storage & Retrieval Solution

A full-stack file storage app with React frontend, Node.js/Express API, Cloudflare R2 storage, and custom email/password authentication.

## Features

- **Upload**: Single-file (presigned PUT) and multipart (resumable) uploads
- **Download**: Presigned URLs for secure downloads
- **Pause/Resume**: Large files (>5MB) support pause and resume
- **Folders**: Create and navigate folder hierarchy
- **RBAC**: Admin, member, viewer roles via Clerk Organizations
- **Design**: Pantone-inspired palette, industry-standard UI patterns

## Tech Stack

- **Frontend**: React 18, Vite, TanStack Query, Tailwind CSS, Framer Motion
- **Backend**: Node.js, Express, TypeScript
- **Auth**: Custom email/password (Organizations, RBAC)
- **Database**: PostgreSQL (Prisma)
- **Storage**: Cloudflare R2 (S3-compatible) 
- **Hosting**: Railway (API + DB)

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL (or Railway)
- Cloudflare account (R2)

### Backend

```bash
cd backend
cp .env.example .env
# Edit .env with your credentials

npm install
npm run db:generate
npm run db:push
npm run db:seed   # For dev with SKIP_AUTH=1
npm run dev
```

### Frontend

```bash
cd frontend
cp .env.example .env
# Set VITE_API_URL (e.g. http://localhost:3001/api)

npm install
npm run dev
```

### Development with auth bypass

Set `SKIP_AUTH=1` in backend `.env` and run `npm run db:seed` to create dev org/user (email: dev@example.com, password: dev123). API calls will use dev-user-id without JWT.

### Environment Variables

**Backend** (.env):
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - strong random string for signing JWTs (required in production)
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`
- `SKIP_AUTH=1` - dev bypass (optional)
- `FRONTEND_URL` - for CORS

**Frontend** (.env):
- `VITE_API_URL` - backend API URL (e.g. http://localhost:3001/api)

## Cloudflare R2 Setup

1. Create R2 bucket in Cloudflare dashboard
2. Create API token (R2 Object Read & Write)
3. Configure CORS on the bucket:
```json
[{
  "AllowedOrigins": ["http://localhost:5173", "https://your-app.railway.app"],
  "AllowedMethods": ["GET", "PUT", "POST", "HEAD"],
  "AllowedHeaders": ["*"]
}]
```

## Deployment (Railway)

Both services build from the **project root** (monorepo). Configure each service as follows.

### Backend Service

1. **Root Directory**: `.` (or leave empty)
2. **Variables**: Add `DATABASE_URL` — either:
   - Click **+ New** → **Database** → **PostgreSQL** (Railway auto-adds `DATABASE_URL` when linked), or
   - Add `DATABASE_URL` manually with your PostgreSQL connection string
3. **Other variables**: `JWT_SECRET`, `FRONTEND_URL`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`
4. **Start command**: Uses default from `railpack.json` → `npm run start -w backend`

### Frontend Service

1. **Root Directory**: `.` (same as backend)
2. **Start command** (choose one):
   - **Option A**: Add variable `RAILPACK_CONFIG_FILE=railpack-frontend.json` (Railpack uses this at build time)
   - **Option B**: In Railway → Service → Settings → Deploy → set **Custom Start Command** to `npm run start -w frontend`
3. **Other variables**: `VITE_API_URL` - backend API URL (e.g. https://your-backend.up.railway.app/api)

> **Important**: Without a different start command, both services run the backend start script and the frontend will crash. Use Option A or B above.

## Keyboard Shortcuts

- **Ctrl+U**: Upload files
- **Ctrl+F**: Search (placeholder)
