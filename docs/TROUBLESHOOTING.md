# Troubleshooting

## Build fails because dependencies are missing

Run:

```bash
rm -rf node_modules
npm install
npm run typecheck
npm run build
```

If the error lists missing type definitions or packages that are already present in `package.json`, verify that installation completed successfully before changing application code.

## Supabase connection fails

Check:

- `NEXT_PUBLIC_SUPABASE_URL` belongs to the intended project.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` belongs to the same project.
- Vercel environment variables are enabled for the environment being deployed.
- A new deployment was created after changing environment variables.

## Data is missing after login

Check:

1. The user is authenticated.
2. The database contains records for that user.
3. `owner_id` values are correct.
4. RLS policies permit the authenticated user to read the records.
5. The frontend is connected to the expected Supabase project.

## One user can see another user's data

Treat this as a **security issue**, not merely a UI bug.

Review the affected table's RLS policies and ownership columns. Do not solve the problem by filtering only in the frontend; database-level authorization must enforce tenant isolation.

## Checkout fails

Check:

- product records exist and are accessible to the current user
- required customer/order fields match the current schema
- payment method values match the application's allowed values
- inventory constraints are satisfied
- the relevant RPC/function and RLS policies are present

## Images do not load

Check:

- Supabase Storage bucket exists
- Storage policies permit the intended operation
- the stored image URL/path is valid
- the application is connected to the same Supabase project containing the bucket

## Deployment warnings

Warnings such as package deprecation notices do not automatically mean a deployment failed. Focus first on the final fatal error in the build log.

However, warnings should still be reviewed periodically so the dependency stack can be upgraded safely.

## Notifications disappear after reload

The `notifications` table is missing (older copies of `schema.sql` did not create it; the app then keeps working but cannot persist notifications).
Run `supabase/migrations/002_notifications.sql` (or the current `supabase/schema.sql`) in the SQL Editor.

## “Could not choose the best candidate function” (PGRST203)

Two `create_sale` overloads exist in the database. Run `supabase/migrations/001_drop_legacy_create_sale.sql`.

## “Stok produk ini sudah berubah di perangkat lain”

This is intentional. The stock changed (for example by a sale on another device) between loading the page and pressing +/−.
Nothing was written; the screen now shows the latest number. Repeat the adjustment.

## `npm run typecheck` reports errors

Fix them rather than silencing them: `npm run verify` and CI use the same check. Until it is green, leave `STRICT_BUILD` unset in the hosting
environment so a deploy is not blocked. Missing-module errors usually mean `npm install` did not finish.

## Customer targets are not recognised

Targets are read from the customer's notes, one per line (or separated by commas / semicolons), with the **last number** as the quantity:
`Mie Ayam Level 3 10`, `Es Teh x 5`. Lines without a trailing quantity are ignored. Spaced teen numbers (“dua belas”) are not converted; write `12` or `duabelas`.

## Historical fixes

Older troubleshooting notes are stored in `docs/archive/`. They describe previous project states and should not automatically be applied to the current release.
