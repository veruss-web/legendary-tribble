# Database & Supabase Guide

## Purpose

Mie-kelar uses Supabase PostgreSQL as its persistent data layer. The application does not use browser `localStorage` for business data.

## Setup

1. Create or select the Supabase project that will own the data.
2. Open **SQL Editor** and run [`supabase/schema.sql`](../supabase/schema.sql). It is the only script a new project needs.
3. Authentication: the app uses email + password (`signUp`, `signInWithPassword`). If **Confirm email** is enabled in Supabase,
   new users must confirm their address before they can sign in.
4. Storage: `schema.sql` creates the `product-images` bucket and its policies (uploads are limited to the signed-in user's folder).
5. Put the **Project URL** and **publishable key** of this same project in the environment variables (see `.env.local.example`).
6. Sign in with a test account and run the verification checklist below.

`schema.sql` is idempotent (`create … if not exists`, `drop … if exists`). Re-running it on an existing project only adds what is missing.
One side effect to know about: rows that have no `owner_id` (data from before multi-user support) are assigned to the **oldest** account.
The end of the file contains a commented-out helper to hand such rows to a different account.

### SQL files

| File | Role |
|---|---|
| `supabase/schema.sql` | Canonical, idempotent setup: tables, owner backfill, indexes, RLS, Storage policies, notifications, payment constraint, `create_sale` |
| `supabase/migrations/001_drop_legacy_create_sale.sql` | Existing databases: drop the old 4-argument `create_sale` overload |
| `supabase/migrations/002_notifications.sql` | Existing databases created with an older `schema.sql`: add the `notifications` table |
| `supabase/legacy/` | Archived historical scripts, kept for reference only. Do not run them |

Details: [`supabase/README.md`](../supabase/README.md).

## Multi-user security model

Tenant isolation is by authenticated Supabase user:

```text
Authenticated user
        │
        └── auth.uid()
              │
              └── owner_id on every tenant-owned record
```

Row Level Security on every tenant-owned table restricts reads and writes to rows where `owner_id = auth.uid()`.
The `create_sale` function is `security definer`, so it re-checks ownership itself (products, customer) instead of relying on RLS.
Do not disable RLS to make the frontend work.

## Core data

| Table | Purpose |
|---|---|
| `categories` | Product categories. Name is unique per owner (`categories_owner_name_unique`) |
| `products` | Catalog and stock (`stock >= 0` is enforced by a check constraint). The `cost` column is kept (default 0) but no longer read or written by the app: there is no cost price in the UI |
| `customers` | Customers; `notes` also holds order targets (“Mie Level 3 10”) |
| `orders`, `order_items` | Transactions. Payment method is one of `cash`, `ewallet`, `atm` (old `qris` / `card` rows remain valid) |
| `stock_movements` | Audit trail of stock changes (sales and manual adjustments) |
| `notifications` | Notification center entries |
| `promotions` | Reserved for promotions |

Foreign keys use `ON DELETE SET NULL` for category → product, customer → order and product → order item, so history survives deletions.

## Checkout function

`public.create_sale(p_customer_id, p_payment_method, p_amount_paid, p_items, p_note)` creates the order, its items, the stock
movements and decrements stock in one transaction (rows are locked first). Only the 5-argument version exists.

## Verification checklist

- [ ] Sign-in and "Lupa password" (6-digit code mailed to the client, typed on the site, then the new-password form) work; accounts are created by the admin and public sign-up is disabled.
- [ ] Product, category and customer create / edit / delete work.
- [ ] Deleting a category or customer does not break existing products / orders.
- [ ] Inventory adjustments persist and are recorded in `stock_movements`.
- [ ] Checkout creates the order and its items and decrements stock.
- [ ] Transaction history and analytics show only the signed-in user's data.
- [ ] A second account sees none of the first account's data (RLS).
- [ ] Product image upload works.
- [ ] Notifications persist after a reload.

## Production safety

Test migrations on a backup or staging project first. Take a backup before running anything on production.
