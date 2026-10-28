# Deployment Guide

## Supported deployment model

Mie-kelar can be deployed as a Next.js application on Vercel or another compatible hosting platform, with Supabase providing authentication, PostgreSQL, and Storage services.

## Environment variables

Configure these variables in the hosting provider:

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
```

Use values from the **same Supabase project**. Mixing a URL from one project with a key from another is a common source of connection and data-loading failures.

Optional:

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_STORE_NAME`, `NEXT_PUBLIC_STORE_ADDRESS`, `NEXT_PUBLIC_STORE_PHONE`, `NEXT_PUBLIC_STORE_FOOTER` | Store profile printed on receipts |
| `NEXT_PUBLIC_SITE_URL` | Public URL of the deployment (page metadata) |
| `STRICT_BUILD=1` | `next build` fails on TypeScript errors (see below) |

For local development, keep secrets and local configuration in `.env.local`. Do not commit real credentials to Git.

## Vercel procedure

1. Import the Git repository into Vercel.
2. Open **Project Settings → Environment Variables**.
3. Add the required Supabase variables.
4. Enable the variables for the environments you use: Production, Preview, and Development.
5. Deploy the project.
6. Open the newly created deployment URL.
7. Sign in with a test account.
8. Run the verification checklist in `docs/OPERATIONS.md`.

## Local release validation

Run:

```bash
npm install
npm run verify      # typecheck + lint + tests + build
```

If any step fails, fix the underlying error before treating the deployment as ready. CI (`.github/workflows/ci.yml`) runs the same checks.

### Build gates

By default `next build` does not fail on type errors, so a hotfix can never be blocked by a diagnostic.
After `npm run verify` has passed once, add `STRICT_BUILD=1` to the Vercel environment variables so that production deploys are gated by the
same TypeScript check as CI. Linting is a separate gate (`npm run lint`).

### Production-only behavior

- Security headers (`X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`) are sent only in production builds,
  so embedded development previews keep working.
- The app ships a web manifest and icons (`public/manifest.webmanifest`, `app/icon.svg`, `app/apple-icon.png`), so it can be added to a phone or tablet home screen.
- Pages are marked `noindex`: this is a back-office application behind a login.

## Post-deployment smoke test

At minimum verify:

1. Login/logout
2. Product listing
3. Product create/edit/delete
4. Category management
5. Customer management
6. Inventory adjustment
7. POS search and cart
8. Checkout and payment method
9. Transaction history
10. Receipt workflow
11. Analytics
12. Mobile/tablet layout
13. Cross-user data isolation

## Rollback

If a deployment introduces a regression:

1. Keep the failing deployment available for investigation.
2. Reassign the production deployment to the last known-good build using the hosting provider's deployment controls.
3. Record the cause and corrective change.
4. Re-test in Preview before promoting the fix.
