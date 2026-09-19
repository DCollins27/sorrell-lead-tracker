# ClosePilot

AI-powered lead pipeline for solo service businesses (consultants, coaches, agents,
contractors, freelancers). Drag-and-drop kanban pipeline, AI pipeline analysis, AI
note-to-lead extraction, per-user accounts, 14-day free trial, and Stripe subscription
billing at $29/month.

## Stack

Static HTML/CSS/JS frontend + Vercel serverless functions (Node, `@vercel/node`
zero-config). No build step. Postgres for storage (any provider works — Neon,
Supabase, Vercel Postgres, Railway).

## Pages

- `/index.html` — marketing/landing page
- `/signup.html`, `/login.html` — auth
- `/app.html` — the pipeline dashboard (requires login)

## API

- `POST /api/auth/signup|login|logout`, `GET /api/auth/me`
- `GET/POST /api/leads`, `PUT|PATCH|DELETE /api/leads/:id` — all scoped to the
  logged-in user and gated by trial/subscription status
- `POST /api/stripe/create-checkout-session`, `POST /api/stripe/create-portal-session`,
  `POST /api/stripe/webhook`
- `POST /api/claude` — AI assistant proxy (requires login + active trial/subscription)

## One-time setup

1. **Database**: create a free Postgres database (e.g. [Neon](https://neon.tech) or
   [Supabase](https://supabase.com)). Run `schema.sql` against it once.
2. **Stripe**:
   - Create a product "ClosePilot Pro" with a recurring $29/month price. Copy the
     Price ID.
   - Create a webhook endpoint pointing at `https://<your-domain>/api/stripe/webhook`
     listening for `checkout.session.completed`, `customer.subscription.updated`,
     and `customer.subscription.deleted`. Copy the signing secret.
3. **Anthropic**: create an API key at [console.anthropic.com](https://console.anthropic.com).
4. **Environment variables** (set in Vercel → Project → Settings → Environment Variables):

   | Variable | Description |
   |---|---|
   | `DATABASE_URL` | Postgres connection string |
   | `JWT_SECRET` | Any long random string, used to sign session cookies |
   | `ANTHROPIC_API_KEY` | For the AI assistant |
   | `STRIPE_SECRET_KEY` | Stripe secret key |
   | `STRIPE_PRICE_ID` | Price ID for the $29/mo plan |
   | `STRIPE_WEBHOOK_SECRET` | Signing secret from the webhook endpoint |
   | `APP_URL` | Your deployed URL, e.g. `https://closepilot.vercel.app` (used for Stripe redirect URLs) |

5. Deploy: `vercel --prod` (or connect the repo in the Vercel dashboard). No build
   command is needed — Vercel serves the HTML files as static assets and everything
   under `/api` as serverless functions automatically.

## Local development

```bash
npm install
vercel dev
```

`vercel dev` reproduces the serverless routing locally. You'll still need real
`DATABASE_URL` / `STRIPE_*` / `ANTHROPIC_API_KEY` values (a dev Stripe key + the
Stripe CLI for webhook forwarding is recommended for testing billing).

## Notes on the trial/subscription model

- New accounts get `subscription_status = 'trialing'` with `trial_ends_at` set 14
  days out.
- `lib/auth.js`'s `getUserWithAccess()` computes `hasAccess` (trial still active OR
  subscription active) and every write endpoint (`POST/PUT/PATCH /api/leads`,
  `/api/claude`) checks it and returns `402` once access has lapsed. Reading
  existing leads (`GET /api/leads`) always works so a lapsed user never loses data,
  they just can't add to it until they subscribe.
- The Stripe webhook is the source of truth for `subscription_status`; the checkout
  and portal endpoints only create sessions and redirect.
