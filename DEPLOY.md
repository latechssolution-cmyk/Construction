# Construction ERP — Deployment Guide (Vercel)

## Overview

This app is built with **Next.js 15**, **Mongoose**, and **MongoDB**. Production stack:

| Service | Purpose | Free tier |
|---|---|---|
| **Vercel** | Hosting (Next.js) + Cron Jobs | Yes |
| **MongoDB Atlas** | Database | Yes (M0 cluster) |
| **Cloudinary** | File / document uploads | Yes (25 GB) |
| **Google Cloud Console** | OAuth login (optional) | Yes |

---

## Step 1 — Set up MongoDB Atlas

1. Go to [cloud.mongodb.com](https://cloud.mongodb.com/) → Create a free M0 cluster.
2. Database Access → create a user with a strong password.
3. Network Access → allow access from anywhere (`0.0.0.0/0`) since Vercel's serverless functions
   don't have static IPs (or use MongoDB Atlas's Vercel integration, which manages this for you).
4. Copy the connection string:
   `mongodb+srv://<user>:<password>@<cluster>.mongodb.net/construction_erp?retryWrites=true&w=majority`

---

## Step 2 — Set up Cloudinary (file uploads)

1. Sign up at [cloudinary.com](https://cloudinary.com) (free tier: 25 GB storage).
2. Dashboard → copy **Cloud name**, **API Key**, **API Secret**.

---

## Step 3 — Set up Google OAuth (optional)

1. Go to [console.cloud.google.com](https://console.cloud.google.com).
2. APIs & Services → Credentials → Create OAuth 2.0 Client ID → Web application.
3. Authorized JavaScript origins: `https://your-app.vercel.app`
4. Authorized redirect URIs: `https://your-app.vercel.app/api/auth/callback/google`
5. Copy **Client ID** and **Client Secret**.

---

## Step 4 — Deploy to Vercel

### 4a. Push code to GitHub
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/construction-erp.git
git push -u origin main
```

### 4b. Import to Vercel
1. Go to [vercel.com](https://vercel.com) → Add New Project → Import from GitHub.
2. Select the repo → Framework preset **Next.js** (auto-detected). Root directory:
   `construction-erp` (if the repo contains more than this app).

### 4c. Set Environment Variables in Vercel
Project Settings → **Environment Variables** (add to Production, Preview, and Development):

```
MONGODB_URI            = mongodb+srv://user:pass@cluster.mongodb.net/construction_erp?retryWrites=true&w=majority
NEXTAUTH_URL            = https://your-app.vercel.app
AUTH_SECRET             = (run: openssl rand -base64 32)
GOOGLE_CLIENT_ID        = your-google-client-id           (optional)
GOOGLE_CLIENT_SECRET    = your-google-client-secret        (optional)
GEMINI_API_KEY          = your-gemini-api-key
CLOUDINARY_CLOUD_NAME   = your-cloud-name
CLOUDINARY_API_KEY      = your-cloudinary-api-key
CLOUDINARY_API_SECRET   = your-cloudinary-api-secret
NEXT_PUBLIC_APP_NAME    = Construction LAtech Portal
CRON_SECRET             = (run: openssl rand -base64 32) — required for the equipment-costing cron
```

> **Generate secrets:**
> ```bash
> openssl rand -base64 32
> ```

### 4d. Deploy
Click **Deploy**. Vercel builds and deploys automatically on every push to `main`.

---

## Step 5 — Cron Jobs

`vercel.json` at the repo root schedules one daily run that covers everything the backend needs to
keep in sync without a user opening the app:

```json
{
  "crons": [
    { "path": "/api/cron/daily-jobs", "schedule": "0 20 * * *" }
  ]
}
```

This single endpoint (`/api/cron/daily-jobs`) runs, in order:
1. **Equipment job-costing** — posts a ledger expense for every equipment assignment active that
   day, using the equipment's daily rate.
2. **Overdue invoice sweep** — flips any `sent` invoice past its due date to `overdue`, so
   `/api/invoices/stats` and every list view stay accurate without anyone clicking "refresh."

Vercel automatically attaches `Authorization: Bearer $CRON_SECRET` to the scheduled request, which
the route verifies. Cron Jobs are only available on Vercel Pro+ for schedules more frequent than
once/day — the default schedule above (`0 20 * * *`, 8pm UTC daily) works on the Hobby tier.

To trigger manually (e.g. for testing):
```bash
curl -X POST https://your-app.vercel.app/api/cron/daily-jobs \
  -H "Authorization: Bearer $CRON_SECRET"
```

---

## Step 6 — Seed initial data (optional)

```bash
MONGODB_URI="your-production-uri" npm run db:seed
```

Default credentials (change immediately after first login):
- Admin: `admin@constructionlatech.com` / `Admin@1234`
- CEO: `ceo@constructionlatech.com` / `Ceo@1234`
- Manager: `manager@constructionlatech.com` / `Manager@1234`
- Accountant: `accountant@constructionlatech.com` / `Account@1234`

> ⚠️ **Security:** Change all seeded passwords immediately after going live.

---

## Post-deployment checklist

- [ ] `AUTH_SECRET` and `CRON_SECRET` are random 32-byte base64 strings (not defaults)
- [ ] `GEMINI_API_KEY` is fresh (rotate the one from development)
- [ ] Google OAuth redirect URIs updated to the production domain
- [ ] MongoDB Atlas network access allows Vercel's serverless functions
- [ ] Cloudinary credentials set and file upload tested
- [ ] All seeded demo passwords changed
- [ ] Custom domain configured in Vercel (Settings → Domains)
- [ ] Cron endpoint smoke-tested manually (see Step 5)

---

## Local development

```bash
# 1. Copy env template
cp .env.example .env
# Fill in .env values (MONGODB_URI at minimum)

# 2. Install dependencies
npm install

# 3. (optional) seed sample data
npm run db:seed

# 4. Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Useful commands

```bash
npm run build      # Production build (test before deploying)
npm run lint       # ESLint check
npm run db:seed    # Seed default users + sample data
```

---

## Migrating from Netlify

This app was previously deployed on Netlify (`@netlify/plugin-nextjs` + `netlify.toml`). Both have
been removed in favor of Vercel's native Next.js support (App Router, Server Actions, and Cron
Jobs all work without an adapter). If you still have a Netlify site running, keep it live until the
Vercel deployment has been stable for a full billing cycle, then decommission it — no code changes
are needed to roll back since Netlify's Next.js runtime auto-detects the framework the same way.
