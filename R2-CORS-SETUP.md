# R2 CORS Setup

CORS must be configured on the `data-joe` bucket for browser-based uploads/downloads to work.

## Option 1: Cloudflare Dashboard (easiest)

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com) → R2 Object Storage
2. Select the **data-joe** bucket
3. Open **Settings**
4. Under **CORS Policy**, click **Add CORS policy**
5. Paste this JSON:

```json
[
  {
    "AllowedOrigins": [
      "http://localhost:5173",
      "http://localhost:3000",
      "https://frontend-production-f322.up.railway.app",
      "https://data.finjoe.app"
    ],
    "AllowedMethods": ["GET", "PUT", "POST", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

6. Click **Save**

## Option 2: Wrangler CLI

After `npm i -g wrangler` and `wrangler login`:

```bash
cd backend
npx wrangler r2 bucket cors set data-joe --file scripts/r2-cors.json
```

## Option 3: Cloudflare API (curl)

Create an API token at https://dash.cloudflare.com/profile/api-tokens with **R2 Edit** permission, then:

```bash
curl -X PUT "https://api.cloudflare.com/client/v4/accounts/YOUR_ACCOUNT_ID/r2/buckets/data-joe/cors" \
  -H "Authorization: Bearer YOUR_CLOUDFLARE_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d @backend/scripts/r2-cors-api.json
```

Note: The API expects the array format (see Option 1). Create `r2-cors-api.json`:

```json
[
  {
    "AllowedOrigins": ["http://localhost:5173", "http://localhost:3000", "https://frontend-production-f322.up.railway.app", "https://data.finjoe.app"],
    "AllowedMethods": ["GET", "PUT", "POST", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```
