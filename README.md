# ClientHub

Premium client portal and internal operations hub for Voixly — billing, support, projects, files, and CRM in one place.

## Stack

- **Next.js 15** (App Router)
- **Prisma ORM** — SQLite locally, **MySQL** in production
- **Auth.js** (NextAuth v5) — credentials login
- **Stripe** — Checkout + webhooks
- **Resend** — transactional email
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
