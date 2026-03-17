/**
 * Set CORS policy on the R2 bucket via Cloudflare REST API.
 * Run: npx tsx scripts/set-r2-cors.ts
 * Requires: R2_ACCOUNT_ID, R2_BUCKET_NAME, CLOUDFLARE_API_TOKEN
 *
 * Alternative: Use Wrangler CLI (after `npm i -g wrangler` and `wrangler login`):
 *   npx wrangler r2 bucket cors set data-joe --file scripts/r2-cors.json
 *
 * Or set manually in Cloudflare Dashboard: R2 > data-joe > Settings > CORS Policy
 */
import { config } from "dotenv";

config();

const accountId = process.env.R2_ACCOUNT_ID;
const bucketName = process.env.R2_BUCKET_NAME;
const apiToken = process.env.CLOUDFLARE_API_TOKEN;

if (!accountId || !bucketName || !apiToken) {
  console.error(
    "Missing: R2_ACCOUNT_ID, R2_BUCKET_NAME, CLOUDFLARE_API_TOKEN (Cloudflare API token with R2 Edit permission)"
  );
  process.exit(1);
}

const corsPolicy = [
  {
    AllowedOrigins: [
      "http://localhost:5173",
      "http://localhost:3000",
      "https://frontend-production-f322.up.railway.app",
      "https://data.finjoe.app",
    ],
    AllowedMethods: ["GET", "PUT", "POST", "HEAD"],
    AllowedHeaders: ["*"],
    ExposeHeaders: ["ETag"],
    MaxAgeSeconds: 3600,
  },
];

async function main() {
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets/${bucketName}/cors`;
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiToken}`,
    },
    body: JSON.stringify(corsPolicy),
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    console.error("Failed to set CORS:", data.errors || data);
    process.exit(1);
  }
  console.log("CORS policy applied successfully to bucket:", bucketName);
}

main();
