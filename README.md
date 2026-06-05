# ISP Billing & Customer Tracker

Web app for a local internet provider. Track every customer, their payments, and
free-text notes. Status auto-updates: record a payment → customer goes **Active** and
their "paid-until" date extends. A daily job flips anyone past due to **Overdue**, then
**Suspended** after the grace window.

Built for ~2000 customers across 2 panels. Phase 1 = full tracking + manual payment
entry. Phase 2 (later) = JazzCash/Easypaisa auto-detect + Mikrotik auto-suspend.

## Stack
- **Next.js 16** (full-stack: UI + API + cron)
- **PostgreSQL** via [Neon](https://neon.tech) (free, runs 24/7)
- **Prisma** ORM
- **Tailwind CSS**
- Cookie session auth (JWT, httpOnly)

---

## Features
- **Dashboard** — total / active / overdue / suspended counts, money collected this
  month, list of customers due in the next 7 days.
- **Customers** — searchable (name, phone, CNIC, area), filter by status + panel.
- **Customer detail** — all info editable, notes box (type anything), full payment
  history, manual status override.
- **Record payment** — amount, method (cash / JazzCash / Easypaisa / bank), months
  covered → auto-extends paid-until and flips status to Active.
- **Daily auto-update** — `/api/cron` recomputes every customer's status from their
  paid-until date. Runs nightly on Vercel.

---

## How the status logic works
Each customer has a `paidUntil` date.
- `today <= paidUntil` → **ACTIVE**
- past due but within `GRACE_DAYS` → **OVERDUE**
- past the grace window → **SUSPENDED**
- **DISCONNECTED** is manual-only (set by hand, never auto-changed).

Recording a payment extends `paidUntil` by the months covered (stacks if paid early)
and recomputes status immediately. The nightly cron catches everyone who simply
crossed their due date.

> Panels are **not** auto-suspended yet — the app tracks the truth, you toggle the
> customer on the panel. Panel API integration is Phase 2.

---

## Local setup (Windows)

1. **Get a free database** — make a project at https://neon.tech, copy the
   connection string.

2. **Create `.env`** (copy from `.env.example`):
   ```
   DATABASE_URL="postgresql://...neon connection string..."
   AUTH_SECRET="<long random string>"
   CRON_SECRET="<another long random string>"
   GRACE_DAYS="3"
   ```
   Generate a secret:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

3. **Install + create tables + seed the owner login:**
   ```bash
   npm install
   npm run db:push        # creates the tables in your Neon DB
   npm run db:seed        # creates owner login + 4 sample customers
   ```
   Default login printed by the seed: `owner@isp.local` / `changeme123`
   (override with `SEED_EMAIL` / `SEED_PASSWORD` env vars).

4. **Run it:**
   ```bash
   npm run dev
   ```
   Open http://localhost:3000 and log in.

Useful: `npm run db:studio` opens a visual DB browser.

---

## Deploy (so it runs 24/7 + cron fires)

1. Push this folder to a GitHub repo.
2. Import it at https://vercel.com.
3. In Vercel → Project → Settings → **Environment Variables**, add the same 4 vars
   from your `.env` (`DATABASE_URL`, `AUTH_SECRET`, `CRON_SECRET`, `GRACE_DAYS`).
4. Deploy. The first deploy runs `prisma generate && next build`.
5. After deploy, run `npm run db:push` and `npm run db:seed` once against the
   production `DATABASE_URL` (or do it locally pointed at the prod DB).
6. The nightly status job is already wired in `vercel.json` (runs 02:00 UTC daily).
   Vercel automatically sends the `CRON_SECRET` so only it can trigger `/api/cron`.

Test the cron manually:
```bash
curl -H "Authorization: Bearer <CRON_SECRET>" https://YOURAPP.vercel.app/api/cron
```

---

## Adding staff logins
There's no signup screen (deliberate — closed system). Add staff by editing
`prisma/seed.ts` or via `npm run db:studio`. Passwords are bcrypt-hashed; create one
with:
```bash
node -e "console.log(require('bcryptjs').hashSync('THE_PASSWORD',10))"
```

---

## Phase 2 ideas (not built yet)
- JazzCash / Easypaisa merchant webhook → auto-record incoming payments by phone/ref.
- Mikrotik / RADIUS API → actually suspend & reconnect on the panel automatically.
- SMS reminders to overdue customers.
- Bulk import existing 2000 customers from CSV/Excel.
- Import-from-CSV is the fastest way to load the current customer base — ask and I'll add it.
