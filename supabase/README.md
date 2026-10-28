# supabase/

| Path | What it is | When to run it |
|---|---|---|
| `schema.sql` | Canonical, idempotent schema: tables, owner backfill, indexes, RLS, Storage policies, notifications, payment constraint, `create_sale` | New project, or to bring an existing project up to date |
| `migrations/001_drop_legacy_create_sale.sql` | Drops the old 4-argument `create_sale` overload (it can cause PostgREST `PGRST203` and still accepts retired payment values) | Existing project that was set up before v0.2.0 |
| `migrations/002_notifications.sql` | Creates the `notifications` table, which older copies of `schema.sql` did not include | Existing project where the notification center does not persist |
| `migrations/003_pos_stock_immediate.sql` | Adds `adjust_product_stock` (Kasir reserves stock the moment an item is added) and the matching `create_sale` that does not decrement or re-check stock | Existing project where checkout answers "Stok … tidak mencukupi" for an order that is larger than the remaining stock |
| `migrations/004_realtime_catalog.sql` | Adds products, categories, orders and order_items to the `supabase_realtime` publication | Existing project where changes from another device only show after a refresh |
| `email-templates/recovery.html` | "Reset Password" email that carries the 6-digit code (`{{ .Token }}`) the client types on the site | Every Supabase project, once: paste it in Authentication → Emails → Templates → Reset password (see `docs/CLIENT-ONBOARDING.md`) |
| `legacy/` | Archived earlier scripts (`schema-v5-original.sql`, `APPLY-FINAL-FIX.sql`) | Never, reference only |

Migrations are idempotent and numbered in the order they should be applied. `schema.sql` already contains everything migrations 001–003 do, so a new project does not need them.
Migration 004 (realtime publication) is not part of `schema.sql`; it is optional: without it the app re-reads the catalog when the tab regains focus.

Run scripts in the Supabase **SQL Editor** of the same project the app is configured with (`NEXT_PUBLIC_SUPABASE_URL`).
