# ClientHub

Premium client portal and internal operations hub for Voixly — billing, support, projects, files, and CRM in one place.

## Stack

- **Next.js 15** (App Router) on **Node.js 22** (Hostinger default)
- **Prisma ORM** — SQLite locally, **MySQL** in production
- **Auth.js** (NextAuth v5) — credentials login
- **Stripe** — Checkout + webhooks
- **Resend** — invoices and ticket notifications
- **Tailwind CSS v4** + **shadcn-style** UI components

## Brand

Voixly colors (from voixly.com branding):

- Primary coral: `#FF6B4A`
- Secondary teal: `#6699AA`
- Logos: `public/brand/`

## Quick start

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

For local dev, `DATABASE_URL="file:./dev.db"` (SQLite) is all you need, plus `NEXTAUTH_SECRET`.

### 3. Database (local)

```bash
npm run db:setup   # creates the SQLite database + seeds demo data
```

### 4. Run locally

```bash
npm run dev
```

Open [http://localhost:3010](http://localhost:3010)

## Deploy on Hostinger (Node.js 22 + MySQL + Resend)

There is no Next.js 22 — Hostinger’s default runtime is **Node.js 22**, which this app targets.

1. In hPanel: **Websites → Add Website → Node.js web app → Import Git repository**  
   Repo: `Voixly-Webmaster/Voixly-App`, branch `main`.
2. Confirm settings:
   - Application type: **next**
   - Node.js version: **22**
   - Build command: **build**
   - Output directory: **`.next`**
3. Add environment variables (see table below) **before** the first deploy.  
   Hostinger injects them at both build and runtime.
4. Deploy. The `build` script generates the MySQL Prisma client, pushes schema (never drops rows), creates the first admin if the DB is empty, then runs `next build`.
5. In [Resend](https://resend.com): verify `voixly.com`, then paste `RESEND_API_KEY` and `RESEND_FROM_EMAIL`. After login, **Settings → Email → Send test email**.
6. Stripe webhook URL: `https://app.voixly.com/api/webhooks/stripe`  
   Events: `checkout.session.completed`, `checkout.session.expired`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`.
7. Optional daily Autopay sweep: `GET https://app.voixly.com/api/cron/autopay` with `Authorization: Bearer CRON_SECRET`.

### Hostinger environment variables

| Variable | Required | Example / notes |
|----------|----------|-----------------|
| `NODE_ENV` | Yes | `production` |
| `DATABASE_URL` | One of | Full URL **or** the `MYSQL_*` fields below (easier on Hostinger) |
| `MYSQL_HOST` | Recommended | `localhost` |
| `MYSQL_PORT` | Optional | `3306` |
| `MYSQL_USER` | Recommended | `u935498615_34982458_4645` |
| `MYSQL_PASSWORD` | Recommended | The **database user** password from hPanel → Databases (reset it if unsure) |
| `MYSQL_DATABASE` | Recommended | `u935498615_34982458_4678` |
| `AUTH_SECRET` | Yes | Long random string (e.g. `openssl rand -base64 32`) |
| `NEXTAUTH_SECRET` | Yes | Same value as `AUTH_SECRET` |
| `AUTH_URL` | Yes | `https://app.voixly.com` (no trailing slash) |
| `NEXTAUTH_URL` | Yes | `https://app.voixly.com` |
| `APP_URL` | Yes | `https://app.voixly.com` — emails and Stripe redirects |
| `BOOTSTRAP_ADMIN_EMAIL` | First deploy | Your login email. Only used when the users table is empty. |
| `BOOTSTRAP_ADMIN_PASSWORD` | First deploy | At least 8 characters |
| `BOOTSTRAP_ADMIN_NAME` | Optional | Defaults to `Admin` |
| `RESEND_API_KEY` | For email | `re_...` from resend.com |
| `RESEND_FROM_EMAIL` | For email | `Voixly <notifications@your-verified-domain.com>` |
| `STRIPE_SECRET_KEY` | For payments | `sk_live_...` (or set later in Settings → Payments) |
| `STRIPE_PUBLISHABLE_KEY` | For payments | `pk_live_...` |
| `STRIPE_WEBHOOK_SECRET` | For payments | `whsec_...` from the Stripe webhook |
| `GOOGLE_CLIENT_ID` | For Insights | Or set later in Settings → Integrations |
| `GOOGLE_CLIENT_SECRET` | For Insights | Or set later in Settings → Integrations |
| `UPLOAD_DIR` | Optional | Defaults to `storage/uploads` (redeploys can wipe files — keep this if Hostinger gives you a persistent path) |
| `CRON_SECRET` | Optional | Protects `/api/cron/autopay` |

You can also paste Stripe / Resend / Google keys later in **Admin → Settings**. Values in Settings override `.env`.

### If deploy fails with `P1000` (MySQL authentication)

The app reached MySQL; the password was rejected. Prefer **separate fields** instead of one URL:

1. hPanel → **Databases** → user `u935498615_34982458_4645` → **Change password**. Copy the new password.
2. Confirm that user is assigned to `u935498615_34982458_4678`.
3. In Environment variables, set (no quotes):

| Key | Value |
|-----|--------|
| `MYSQL_HOST` | `localhost` |
| `MYSQL_USER` | `u935498615_34982458_4645` |
| `MYSQL_PASSWORD` | the new password you just set |
| `MYSQL_DATABASE` | `u935498615_34982458_4678` |

4. You can leave `DATABASE_URL` blank, or delete it so it does not override a bad URL.
5. Save — Hostinger redeploys.

## Deploying to production (MySQL)

The app uses two Prisma schemas:

| File | Provider | Used for |
|------|----------|----------|
| `prisma/schema.prisma` | SQLite | Local development |
| `prisma/schema.mysql.prisma` | MySQL | Live site |

**If you change one schema, make the same change in the other.**

### First-time setup on the server

1. Create a MySQL database and set `DATABASE_URL` in the server's `.env`:

```
DATABASE_URL="mysql://USER:PASSWORD@HOST:3306/DATABASE"
```

2. Install, sync the schema, build, and start:

```bash
npm install
npm run db:deploy      # creates tables in MySQL (safe — never drops data)
npm run build:prod     # generates the MySQL Prisma client + builds Next.js
npm start
```

3. (Optional, first deploy only) seed a starter admin account:

```bash
npx tsx prisma/seed.ts
```

### Every deploy after that

```bash
git pull
npm install
npm run db:deploy      # applies any new schema changes without touching existing rows
npm run build:prod
# restart the app (pm2 restart / systemctl restart / etc.)
```

`npm run db:deploy` uses `prisma db push`, which only **adds** missing tables/columns.
If a change would ever delete data (e.g. removing a column that has values), Prisma
**refuses to run** and tells you — it will never silently wipe the database. Never use
`--accept-data-loss` or `prisma migrate reset` against the live database.

### Demo accounts (after seed)

| Role   | Email              | Password     |
|--------|--------------------|--------------|
| Admin  | admin@voixly.com   | password123  |
| Staff  | staff@voixly.com   | password123  |
| Client | client@acme.com    | password123  |

## Admin settings

Admins (not staff) get a **Settings** section at `/admin/settings`:

- **General** — app name, public URL, support email
- **Users** — create admin/staff/client accounts, change roles, reset passwords, deactivate/reactivate
- **Payments** — Stripe API keys and webhook secret
- **Email** — Resend API key and from address
- **Integrations** — Google OAuth credentials for the Insights tab

Values saved here live in the database (secrets encrypted with a key derived
from `AUTH_SECRET`) and override the matching `.env` variables. Anything not
set in the UI falls back to `.env`, so either place works.

## Stripe webhooks (local)

```bash
stripe listen --forward-to localhost:3010/api/webhooks/stripe
```

Copy the webhook signing secret into `STRIPE_WEBHOOK_SECRET`.

## Project structure

```
src/
  app/
    portal/          # Client portal
    admin/           # Staff & admin dashboard
    api/             # Auth + Stripe webhooks
  actions/           # Server actions
  components/        # UI + layouts
  lib/               # Auth, DB, permissions, email, stripe
prisma/
  schema.prisma        # SQLite (local dev)
  schema.mysql.prisma  # MySQL (production)
docs/
  ARCHITECTURE.md    # Full product & technical spec
```

## Documentation

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for database design, routes, permissions, Stripe flow, wireframes, and development plan.
