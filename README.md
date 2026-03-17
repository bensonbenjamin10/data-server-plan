# Organizational Data Storage & Retrieval Solution

A full-stack file storage app with React frontend, Node.js/Express API, Cloudflare R2 storage, and Clerk authentication.

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
- **Auth**: Clerk (Organizations, RBAC)
- **Database**: PostgreSQL (Prisma)
- **Storage**: Cloudflare R2 (S3-compatible) 
- **Hosting**: Railway (API + DB)

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL (or Railway)
- Cloudflare account (R2)
- Clerk account

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
# Set VITE_CLERK_PUBLISHABLE_KEY

npm install
npm run dev
```

### Development without Clerk

Set `SKIP_AUTH=1` in backend `.env` and run `npm run db:seed` to create dev org/user. The frontend still needs a valid Clerk key for the UI; use Clerk's test keys for local dev.

### Environment Variables

**Backend** (.env):
- `DATABASE_URL` - PostgreSQL connection string
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`
- `CLERK_SECRET_KEY` - for production
- `SKIP_AUTH=1` - dev bypass (optional)
- `FRONTEND_URL` - for CORS

**Frontend** (.env):
- `VITE_CLERK_PUBLISHABLE_KEY`

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

1. Create backend service: connect repo, set root to `backend`
2. Add PostgreSQL plugin
3. Set environment variables
4. Create frontend service: set root to `frontend`, build command `npm run build`, start with static server

## Keyboard Shortcuts

- **Ctrl+U**: Upload files
- **Ctrl+F**: Search (placeholder)
