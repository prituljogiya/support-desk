# Support Desk

Multi-tenant helpdesk with a Freshdesk-inspired agent desk, customer portal, SLA timers, macros, plan feature gates, and optional Freshdesk / Stripe integrations.

## Stack

Next.js (App Router) · TypeScript · Prisma · **PostgreSQL** · Tailwind · NextAuth / Auth.js (Credentials)

## Local setup

1. Create a free Postgres database ([Neon](https://neon.tech), [Supabase](https://supabase.com), or Docker).
2. Copy env and fill values:

```bash
cp .env.example .env
# DATABASE_URL=postgresql://...
# AUTH_SECRET=$(openssl rand -base64 32)
# AUTH_URL=http://localhost:3000
npm install
npx prisma migrate deploy
npm run db:seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Demo users (seed)

| Email | Password | Access |
| --- | --- | --- |
| `super@example.com` | `password123` | Platform super-admin (`/platform`) |
| `admin@example.com` | `password123` | Tenant owner |
| `manager@example.com` | `password123` | Helpdesk manager |
| `lead@example.com` | `password123` | Team lead / supervisor |
| `agent@example.com` | `password123` | Support agent |
| `junior@example.com` | `password123` | Junior agent (assigned tickets only) |
| `qa@example.com` | `password123` | QA analyst |
| `auditor@example.com` | `password123` | Read-only auditor |
| `customer@example.com` | `password123` | Customer portal |

Demo org slug: `acme-support` on **Pro** (SLA, macros, Freshdesk sync enabled).

## Deploy to Vercel (live site + API)

Frontend and API routes deploy together — no separate backend server.

### 1. Postgres

Create a Neon project (or Vercel Storage → Postgres) and copy the connection string.

### 2. Import the GitHub repo

1. [vercel.com/new](https://vercel.com/new) → Import `support-desk`
2. Framework: Next.js
3. Build command uses: `prisma generate && prisma migrate deploy && next build`

### 3. Environment variables

In Vercel → Project → Settings → Environment Variables (Production + Preview):

| Name | Example |
| --- | --- |
| `DATABASE_URL` | `postgresql://...?sslmode=require` |
| `AUTH_SECRET` | output of `openssl rand -base64 32` |
| `AUTH_URL` | `https://your-app.vercel.app` |
| `CRON_SECRET` | optional |
| `STRIPE_*` / `OPENAI_API_KEY` / Freshdesk | optional |

### 4. Deploy & seed

Push to `main` (or click Deploy). After the first successful deploy:

```bash
# With production DATABASE_URL available locally:
npx prisma migrate deploy   # already runs on build
DATABASE_URL="your-prod-url" npm run db:seed
```

Or use Neon SQL editor only for schema (migrate already applied on build); seed needs `npm run db:seed` once.

### 5. Custom domain (optional)

Vercel → Domains → add your domain → update `AUTH_URL` to `https://yourdomain.com`.

## Surfaces

| Route | Purpose |
| --- | --- |
| `/` | Marketing landing + CTA |
| `/signup` | Create account + organization (Free plan) |
| `/portal/*` | Customer tickets (tenant-scoped, branded) |
| `/desk/*` | Agent Kanban/list inbox + ticket workspace |
| `/desk/knowledge` | Knowledge base articles |
| `/desk/contacts` | Contacts + companies CRM |
| `/desk/analytics` | Enterprise analytics suite |
| `/desk/admin/*` | Invites, SLA, Freshdesk, billing, automations |
| `/platform/*` | Super-admin: orgs, plans, users |
| `/invite/[token]` | One-click invite accept (magic login) |

## Plans & feature gates

Seeded plans: `free`, `pro`, `enterprise`. Helper `can(org, feature)` gates features. Without Stripe, owners/platform admins assign plans in UI.

## Freshdesk sync

Configure per-org in Admin (Pro+), or set global `FRESHDESK_*` env vars.
