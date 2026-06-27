# Construction ERP — Deployment Guide

## Overview

This app is built with **Next.js 15**, **Prisma 5**, and **PostgreSQL**. The recommended
production stack is:

| Service | Purpose | Free tier |
|---|---|---|
| **Vercel** | Hosting (Next.js) | Yes |
| **Neon** or **Supabase** | PostgreSQL database | Yes |
| **Cloudinary** | File / document uploads | Yes (25 GB) |
| **Google Cloud Console** | OAuth login | Yes |

---

## Step 1 — Set up a cloud PostgreSQL database

### Option A: Neon (recommended)
1. Go to [neon.tech](https://neon.tech) → Create project → "construction-erp"
2. Copy the **Connection string** (looks like `postgresql://user:pass@ep-xxx.neon.tech/main?sslmode=require`)

### Option B: Supabase
1. Go to [supabase.com](https://supabase.com) → New project
2. Settings → Database → Copy the **URI** connection string (use the "connection pooling" string for serverless)

---

## Step 2 — Set up Cloudinary (file uploads)

1. Sign up at [cloudinary.com](https://cloudinary.com) (free tier: 25 GB storage)
2. Dashboard → copy **Cloud name**, **API Key**, **API Secret**

---

## Step 3 — Set up Google OAuth (optional)

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. APIs & Services → Credentials → Create OAuth 2.0 Client ID
3. Application type: **Web application**
4. Authorized JavaScript origins: `https://your-app.vercel.app`
5. Authorized redirect URIs: `https://your-app.vercel.app/api/auth/callback/google`
6. Copy **Client ID** and **Client Secret**

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
1. Go to [vercel.com](https://vercel.com) → Add New Project → Import from GitHub
2. Select your repository → Framework: **Next.js** (auto-detected)

### 4c. Set Environment Variables in Vercel
In the Vercel project settings → **Environment Variables**, add:

```
DATABASE_URL          = postgresql://user:pass@ep-xxx.neon.tech/main?sslmode=require
NEXTAUTH_URL          = https://your-app.vercel.app
NEXTAUTH_SECRET       = (run: openssl rand -base64 32)
GOOGLE_CLIENT_ID      = your-google-client-id
GOOGLE_CLIENT_SECRET  = your-google-client-secret
GEMINI_API_KEY        = your-gemini-api-key
CLOUDINARY_CLOUD_NAME = your-cloud-name
CLOUDINARY_API_KEY    = your-cloudinary-api-key
CLOUDINARY_API_SECRET = your-cloudinary-api-secret
NEXT_PUBLIC_APP_NAME  = Construction LAtech Portal
```

> **Generate NEXTAUTH_SECRET:**
> ```bash
> openssl rand -base64 32
> ```

### 4d. Deploy
Click **Deploy**. Vercel will build and deploy automatically.

---

## Step 5 — Run database migrations

After the first deploy, run migrations using Vercel CLI or locally with the production DATABASE_URL:

```bash
# Option A: Run locally against production DB
DATABASE_URL="your-production-url" npx prisma migrate deploy

# Option B: Use Vercel CLI
vercel env pull .env.local
npx prisma migrate deploy
```

> **Note:** Use `prisma migrate deploy` (not `db push`) in production — it runs migration history safely.

---

## Step 6 — Seed initial data (optional)

To create the default admin user and sample data:

```bash
DATABASE_URL="your-production-url" npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed.ts
```

Default credentials (change immediately after first login):
- Admin: `admin@constructionlatech.com` / `Admin@1234`
- CEO: `ceo@constructionlatech.com` / `Ceo@1234`
- Manager: `manager@constructionlatech.com` / `Manager@1234`
- Accountant: `accountant@constructionlatech.com` / `Account@1234`

> ⚠️ **Security:** Change all seeded passwords immediately after going live.

---

## Post-deployment checklist

- [ ] `NEXTAUTH_SECRET` is a random 32-byte base64 string (not the default)
- [ ] `GEMINI_API_KEY` is fresh (rotate the one from development)
- [ ] Google OAuth redirect URIs updated to production domain
- [ ] Database migrations ran successfully (`prisma migrate deploy`)
- [ ] Cloudinary credentials set and file upload tested
- [ ] All seeded demo passwords changed
- [ ] Custom domain configured in Vercel (Settings → Domains)

---

## Local development

```bash
# 1. Copy env template
cp .env.example .env
# Fill in .env values

# 2. Install dependencies
npm install

# 3. Set up database
npx prisma migrate dev
npx prisma db seed

# 4. Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Useful commands

```bash
npm run build          # Production build (test before deploying)
npm run lint           # ESLint check
npx prisma studio      # GUI database browser
npx prisma migrate dev # Create + apply new migration
npx prisma migrate deploy  # Apply migrations in production
```
