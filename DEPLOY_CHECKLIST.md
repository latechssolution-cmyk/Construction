# 🚀 Construction ERP — Pre-Deployment Checklist

**Project:** Construction ERP (Next.js 15 / Mongoose / MongoDB)
**Date:** 2026-07-09
**Deployer:** ___________________

> See [DEPLOY.md](./DEPLOY.md) for the full step-by-step Vercel + MongoDB Atlas guide. This file is
> the sign-off checklist to run through before/after each production deploy.

---

## 🔐 CRITICAL — Do Before Anything Else

- [ ] **Rotate AUTH_SECRET** — current value is a weak predictable string. Run:
  ```bash
  openssl rand -base64 32
  ```
  Copy output into Vercel env var `AUTH_SECRET`.

- [ ] **Set CRON_SECRET** — required for the Vercel Cron job (`vercel.json`) to authenticate
  against `/api/cron/daily-jobs` (equipment costing + overdue invoice sweep). Run:
  ```bash
  openssl rand -base64 32
  ```
  Copy output into Vercel env var `CRON_SECRET`.

- [ ] **Rotate GEMINI_API_KEY** — key in `.env` was exposed in session context. Go to https://aistudio.google.com and revoke + regenerate.

- [ ] **Rotate Google OAuth secret** — if `GOOGLE_CLIENT_SECRET` was ever in a committed file, regenerate at https://console.cloud.google.com.

- [ ] **Confirm `.gitignore` is active** — `.gitignore` was added in this session. Run `git status` and verify `.env` does NOT appear as a tracked/staged file. If it does:
  ```bash
  git rm --cached .env
  git commit -m "Remove .env from tracking"
  ```

- [ ] **Check git history for secrets** — if `.env` was previously committed, history must be purged with `git filter-repo` or BFG before pushing to GitHub.

---

## 📋 Pre-Deploy Checklist

### Environment Variables (Vercel → Settings → Environment Variables)

- [ ] `MONGODB_URI` — MongoDB Atlas connection string (`mongodb+srv://...`)
- [ ] `NEXTAUTH_URL` — Production URL exactly, e.g. `https://your-app.vercel.app`
- [ ] `AUTH_SECRET` — New random 32-byte secret (see above)
- [ ] `CRON_SECRET` — New random 32-byte secret (see above)
- [ ] `GOOGLE_CLIENT_ID` — From Google Cloud Console (OAuth 2.0, optional)
- [ ] `GOOGLE_CLIENT_SECRET` — From Google Cloud Console (rotated, optional)
- [ ] `GEMINI_API_KEY` — New key from Google AI Studio (rotated)
- [ ] `CLOUDINARY_CLOUD_NAME` — From Cloudinary dashboard
- [ ] `CLOUDINARY_API_KEY` — From Cloudinary dashboard
- [ ] `CLOUDINARY_API_SECRET` — From Cloudinary dashboard
- [ ] `NEXT_PUBLIC_APP_NAME` — e.g. `Construction ERP`

### Google OAuth Redirect URI

- [ ] In Google Cloud Console → Credentials → OAuth 2.0 Client → Authorized redirect URIs, add:
  ```
  https://your-app.vercel.app/api/auth/callback/google
  ```
  Remove `http://localhost:3000/api/auth/callback/google` from production client (or use a separate client for dev).

### Database

- [ ] MongoDB Atlas cluster is provisioned; Network Access allows Vercel's serverless functions
      (`0.0.0.0/0`, or the Atlas↔Vercel integration)
- [ ] Optionally seed initial admin user:
  ```bash
  MONGODB_URI="your-production-uri" npm run db:seed
  ```
  **IMPORTANT:** Change seeded passwords immediately after first login. Default seeds are `Admin@1234` etc. — these are publicly documented.
- [ ] Verify database connection: app boots and `/login` loads without a connection error in logs

### Cloudinary

- [ ] Account created at https://cloudinary.com (free tier is fine to start)
- [ ] Upload preset is `unsigned` OR using signed upload (current code uses signed — API secret required)
- [ ] Test upload via API: `POST /api/upload` with a test image returns a `secure_url`
- [ ] Folder `construction-erp` will be auto-created on first upload

### Build Verification

- [ ] `npm run build` completes with **zero errors** (warnings are okay)
- [ ] `npm run lint` returns no errors
- [ ] TypeScript: `npx tsc --noEmit` passes
- [ ] No `console.error` output during build for missing env vars

---

## 🚢 Deploy Steps

1. **Push to GitHub** (main/production branch)
   ```bash
   git add -A
   git commit -m "Production-ready: security hardening, Cloudinary uploads, rate limiting"
   git push origin main
   ```

2. **Import project on Vercel**
   - Go to https://vercel.com/new
   - Connect GitHub repository
   - Framework preset: **Next.js** (auto-detected)
   - Root directory: `/` (leave default)
   - Set all environment variables (from list above)
   - Click **Deploy**

3. **Watch build logs** for any errors:
   - Red "Build Failed" → check TypeScript errors in logs
   - "Missing environment variable" warnings → add to Vercel env vars

4. **First-time post-deploy**
   - Visit `https://your-app.vercel.app/` — should redirect to `/login`
   - Log in with seeded admin credentials
   - **Immediately change all seeded user passwords**
   - Verify Google OAuth login works end-to-end

---

## ✅ Post-Deploy Verification

### Auth & Security

- [ ] `/login` page loads with password visibility toggle working
- [ ] Email/password login works for admin, CEO, manager, accountant roles
- [ ] Google OAuth flow completes without error
- [ ] Rate limiting active — 10+ rapid failed login attempts show 429 error
- [ ] Security headers present — run:
  ```
  https://securityheaders.com/?q=https://your-app.vercel.app
  ```
  Should show B+ or higher rating.
- [ ] `/api/users` returns 401 when not authenticated (try in incognito)

### Core Flows

- [ ] Dashboard loads with real statistics (not placeholder zeros)
- [ ] Create a new Project → appears in project list
- [ ] Upload a document (PDF or image) → file appears in Cloudinary dashboard
- [ ] Create a ledger entry → finance summary updates
- [ ] Create an invoice → invoice list shows new entry with correct status
- [ ] Mark a task complete → status badge updates
- [ ] AI assistant (`/ai-assistant`) responds to a query (test Gemini API key)

### Role-Based Access

- [ ] **Manager** cannot access `/admin/users` → redirected or 403 shown
- [ ] **Accountant** can view finance but not edit projects
- [ ] **Employee-level user** can only update `status` and `notes` on their own assigned tasks

### Performance

- [ ] Dashboard initial load < 3 seconds on a fast connection
- [ ] Loading skeletons appear while data fetches (refresh page on `/projects`)
- [ ] Mobile layout: sidebar collapses to hamburger menu on screens < 768px
- [ ] Tables switch to card layout on mobile (Materials, Finance tabs in project detail)

### Error Pages

- [ ] Navigate to `/nonexistent-route` → custom 404 page with "Back to Dashboard" link
- [ ] Error boundary: intentionally trigger an error to verify `error.tsx` catches it

---

## 🔁 Rollback Plan

**Trigger rollback if:**
- Authentication completely broken (users cannot log in)
- Database connection failures > 5 minutes
- File uploads returning 500 errors consistently
- Critical data loss or corruption detected

**How to rollback on Vercel:**
1. Go to Vercel Dashboard → Deployments
2. Find the last known-good deployment
3. Click `···` → **Promote to Production**
4. Rollback takes effect in ~30 seconds

**Database rollback:**
MongoDB/Mongoose has no migration-history concept — schema changes are additive/optional fields by
convention in this codebase, so there is normally nothing to roll back. For a destructive data
issue, restore from the most recent Atlas automated backup (Atlas → Cluster → Backup →
Point-in-Time Restore).

---

## 🔍 Known Issues & Limitations (Before First Release)

| Issue | Severity | Notes |
|-------|----------|-------|
| In-memory rate limiter | Medium | Resets on server restart; each Vercel instance has separate state. For strict rate limiting, add Redis/Upstash. |
| No email verification flow | Low | `emailVerified` column exists in schema but verification emails are not sent. Users can register without verification. |
| PDF/doc preview | Low | Documents are uploaded but there's no inline viewer — files open in new tab. |
| No soft delete | Low | Records are hard-deleted; there's no trash/recovery. |
| Attendance lacks bulk import | Low | Attendance must be entered one record at a time. |

---

## 📞 Emergency Contacts

| Role | Contact |
|------|---------|
| Database Admin | _______________ |
| Vercel Account Owner | latechssolution@gmail.com |
| Cloudinary Account Owner | _______________ |

---

## 🔒 Security Checklist (Final Sign-off)

- [ ] All default/seeded passwords changed on first login
- [ ] NEXTAUTH_SECRET is a random 32+ byte string
- [ ] GEMINI_API_KEY rotated
- [ ] No `.env` file in git history (verified with `git log --all -- .env`)
- [ ] `public/uploads/` directory is in `.gitignore` (no local uploads committed)
- [ ] Production database has a unique password (not `postgres:postgres`)
- [ ] Google OAuth restricted to production domain only in Cloud Console
- [ ] Vercel environment variables set to **Production** scope only (not Preview) for secrets

---

*Checklist generated by Claude Code — Construction ERP deployment audit 2026-06-26*
