# Support Desk

Multi-tenant helpdesk with a Freshdesk-inspired agent desk, customer portal, SLA timers, macros, plan feature gates, and optional Freshdesk / Stripe integrations. Local SQLite is the source of truth for v1.

## Stack

Next.js (App Router) · TypeScript · Prisma · SQLite · Tailwind · NextAuth / Auth.js (Credentials)

## Setup

```bash
cp .env.example .env
# set AUTH_SECRET (required). Add Freshdesk / Stripe vars when ready.
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

### Roles & permissions

15 roles (plus platform super-admin) with granular permissions in `src/lib/permissions.ts` (`tickets.*`, `users.*`, `sla.*`, `ai.*`, etc.). Nav and APIs check permissions; invite form can assign any invitable role. Super admin console: tenants, plans/coupons, users, system config JSON, audit logs, role matrix.

## Surfaces

| Route | Purpose |
| --- | --- |
| `/` | Marketing landing + CTA |
| `/signup` | Create account + organization (Free plan) |
| `/portal/*` | Customer tickets (tenant-scoped, branded) |
| `/desk/*` | Agent Kanban/list inbox + ticket workspace |
| `/desk/knowledge` | Knowledge base articles |
| `/desk/contacts` | Contacts + companies CRM |
| `/desk/analytics` | Enterprise analytics suite (20+ dashboards, filters, CSV/PDF export) |
| `/desk/reports` | Redirects to analytics |
| `/desk/admin/*` | Invites, smart support, SLA, Freshdesk, billing, automations |
| `/platform/*` | Super-admin: orgs, force plan, disable |
| `/invite/[token]` | Accept membership invite |

## Extra SaaS features

- **Kanban board** — drag tickets across status columns
- **Bulk actions** — multi-select status/priority/assignee/tags (list view)
- **Saved views** — save current filters
- **CSV export** — `/api/tickets/export`
- **Automations** — keyword → assign/tag/priority on ticket create (Pro+)
- **In-app alerts** — assignment notifications in the desk header
- **Knowledge base** — publish & search help articles
- **Analytics center** — Executive, SLA, CSAT, agents, channels, AI, geo, custom widgets, CSV/PDF export

## Plans & feature gates

Seeded plans: `free`, `pro`, `enterprise`. Helper `can(org, feature)` gates:

- **Free:** canned responses, contacts, saved views
- **Pro+:** SLA, macros, Freshdesk sync

Without `STRIPE_*`, org owners and platform admins can assign plans in UI. With Stripe, Checkout updates `organization.planId` via `/api/webhooks/stripe`.

## Freshdesk sync

Priority for credentials:

1. Organization Admin → Freshdesk domain + API key (Pro+)
2. Else env `FRESHDESK_DOMAIN` / `FRESHDESK_API_KEY`

Webhook: `POST /api/webhooks/freshdesk`  
Optional org resolution: header `x-organization-slug` or `?org=<slug>` plus org or env webhook secret.

Retry: `GET`/`POST /api/sync/retry` (staff session or `Authorization: Bearer $CRON_SECRET`).

If Freshdesk is not configured, tickets/messages save locally with `syncStatus: skipped`.

## Auth / tenancy

JWT session carries `userId`, active `organizationId`, and `membershipRole`. Switch orgs with `POST /api/orgs/switch` then `session.update({ organizationId })`. All ticket APIs filter by the active organization.
