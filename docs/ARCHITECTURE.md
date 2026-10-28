# Architecture

## Overview

```text
app/layout.tsx           fonts, metadata, global CSS
app/page.tsx             auth gate
   ├─ not configured  →  <ConfigError/>
   ├─ no session      →  <Login/>          sign in, or "Lupa password": email → emailed code
   ├─ recovery        →  <ResetPassword/>  code accepted, the client picks a new password
   └─ session         →  <Dashboard session=…/>
                            ├─ sidebar + top bar + universal search + notification center
                            └─ one screen at a time (components/screens/*)
```

The whole UI is a client-side application (`'use client'`) that talks to Supabase directly. There are no custom API routes:
authorization is enforced by Row Level Security and by the `create_sale` database function.

## Modules

| Path | Responsibility |
|---|---|
| `app/page.tsx` | Reads the Supabase session and chooses between Login, ConfigError, ResetPassword and Dashboard. Holds the "recovery" flag (mirrored in `sessionStorage`) so a client who typed the emailed code stays on the new-password form instead of reaching the dashboard |
| `components/auth/login.tsx` | Sign-in, forgot-password (email → 6-digit code, `resetPasswordForEmail` + `verifyOtp`) and the new-password form (`updateUser`) with its strength meter; the missing-configuration notice |
| `components/dashboard/dashboard.tsx` | Owns all domain state, loads data, subscribes to realtime changes, handles create/update/delete, notifications, navigation |
| `components/dashboard/global-search.tsx` | Results of the universal search in the top bar |
| `components/screens/*` | Presentational screens. They receive data and callbacks as props and hold only UI state |
| `components/overview/sales-chart.tsx` | SVG revenue chart of the Overview hero (monotone curve, previous period dashed; hover / click-to-pin / keyboard, revenue ↔ transactions) |
| `components/analytics/*` | Analisa parts: `trend-chart` (interactive area / bar chart), `widgets` (KPI card with sparkline, busy hours, payment donut, best sellers). Styles: `app/analisa.css` (prefix `an-`) |
| `components/pos/*` | Kasir parts: `menu-tile` (menu card with stepper), `ticket` (order ticket and payment), `receipt-sheet` (receipt after payment) |
| `components/screens/product-form.tsx` | Full-page add / edit product form (replaces the old modal): live preview, inline validation, local photo preview |
| `components/shared/modal.tsx` | Category / customer form dialog and the delete confirmation dialog |
| `components/shared/option-sheet.tsx` | Single-choice bottom sheet (period, payment method, status) used by Riwayat Transaksi |
| `components/shared/primitives.tsx` | `Kpi`, `Actions`, `Empty`, `Field` |
| `components/shared/customer-picker.tsx` | Searchable customer selector used at checkout |
| `lib/types.ts` | Domain types shared by every module |
| `lib/customers.ts` | Pure logic: parse customer order targets, match them to completed orders (unit-tested) |
| `lib/format.ts` | `money()` (IDR) |
| `lib/auth.ts` | Pure logic of the auth screens: `cleanCode` (keeps leading zeros), `passwordChecks` / `passwordStrength`, `formatCountdown`, `throttleSeconds`, `friendlyAuthError` (unit-tested) |
| `lib/products.ts` | Pure logic of the product form: money field, the single validator `parseDraft` (unit-tested) |
| `lib/inventory.ts` | `levelOf` / `LOW_STOCK` (the one definition of "menipis") and the sort comparator (unit-tested) |
| `lib/analytics.ts` | Pure logic of Analisa: `analyze` (range, previous period, buckets, hours, payments, products), `pct`, `presetRange`, `toCsv` (unit-tested) |
| `lib/chart-path.ts` | SVG helpers shared by both charts: `smoothPath`, `niceScale`, `axisTicks` (unit-tested) |
| `lib/overview.ts` | Sales series (running per hour / per day vs previous period), top products, restock list, `timeAgo` (unit-tested) |
| `lib/pos.ts` | Cart maths, change, `quickCashAmounts`, `filterMenu`, `menuCategories` (unit-tested) |
| `lib/receipt.ts` | `receiptCss()` (the only receipt stylesheet, used by the on-screen sheet and the print window) and `printReceipt()` |
| `lib/payments.ts` | Payment-method labels and tones, including the legacy `qris` / `card` values (unit-tested) |
| `lib/navigation.ts` | Sidebar items, page titles and descriptions |
| `lib/store.ts` | Receipt store profile (`NEXT_PUBLIC_STORE_*`) |
| `lib/product-images.ts` | Product photo upload to the `product-images` bucket |
| `lib/supabase.ts` | Supabase client, `ensureFreshSession`, `runWithAuthRetry`, `friendlySupabaseError` |

## Data flow

1. `Dashboard` calls `load()` once after mount. Every query is filtered with `owner_id = <user id>`; RLS enforces the same on the server.
2. Relations are joined **on the client** (category → product, customer → order) from the freshly loaded lists.
3. Realtime subscribes to `orders` and `order_items`, and (in a separate channel) to `products` and `categories`. A catalog change from Produk/Kasir or another device re-reads products + categories, so the customer form's menu picker always shows the current menu. The catalog is also re-read when the tab regains focus and when the customer form opens, so this works even if Realtime is not enabled for those tables (migration `004_realtime_catalog.sql` enables it). Other tables are refreshed by `load()` or by the local update that follows each write.
4. Writes go through `runWithAuthRetry`, which refreshes the session and retries once when an auth-looking error occurs.
5. After a **delete**, local state mirrors the database's `ON DELETE SET NULL`: deleting a category clears `category_id` on its
   products, deleting a customer clears `customer_id` on their orders, deleting a product clears `product_id` on its order items.
   Without this, stale labels would remain until the next reload.

## Checkout

`POS` calls the `create_sale` RPC with the cart. The function runs in one transaction: it locks the product rows, checks ownership,
stock and the paid amount, creates the order and its items, decrements stock, and writes stock movements. The client then
fetches the order items and opens the receipt sheet. Valid payment methods are `cash`, `ewallet` and `atm`.

The cart is state of `Dashboard`, not of `POS`: adding an item already takes its stock (`adjust_product_stock`), so a cart that disappeared when you left Kasir
would leave that stock missing. `create_sale` therefore neither decrements stock nor compares it with the order size.

## CSS gotchas

- Never put `overflow-x: hidden` on an ancestor of a sticky element: it turns the other axis into `auto` and silently disables `position: sticky`. Use `overflow-x: clip`.
- `.open` and `.danger` are global classes with rules (and `!important`). Prefix state classes (`ks-open`, `pf-…`).
- Do not wrap fixed / mobile-drawer content in `<aside>`: the mobile sidebar rules hit every `aside` inside `.shell`.

## Stock adjustments

`Inventory` updates stock with a compare-and-swap (`update … where stock = <value shown on screen>`). If another device changed the
stock in the meantime, nothing is written, the screen is refreshed with the latest value and the user is asked to repeat the
adjustment. This prevents a manual adjustment from overwriting a sale.

The Inventory list does **not** re-sort when a stock number changes: row order and the "Perlu perhatian" strip are frozen on a snapshot
(`useFrozenIds`) that is recomputed only when the filter, sort, search or product list changes, or when the user presses *Perbarui urutan*.
Numbers, bars and status badges stay live. Sorting on live stock made a row jump away from under the cursor after +1 / +10.

## Product form

`Dashboard` keeps `productForm: { product: Product | null } | null`. While it is set, `renderPage()` shows `ProductForm` instead of the current page
(the sidebar and the `page` state are untouched, so closing the form returns to where it was opened: Produk or Inventory). The form validates with
`parseDraft` (`lib/products.ts`) and hands typed `ProductInput` to `saveProduct`. A picked photo is compressed in the browser and kept as a local WebP
data URL; `saveProduct` uploads it only on save, so cancelling never leaves files in the bucket. Errors thrown by `saveProduct` are shown inside the form.

## Styling

`app/globals.css` is a single ordered cascade of refinements. Later rules override earlier ones on purpose, so the file must not be
reordered or split without re-checking every screen. When changing a style, edit the **last** rule that matches the selector rather
than appending another override. The v0.2.0 clean-up and the one after the product-form change removed rules that could never match and declarations that were always overridden;
see the [changelog](../CHANGELOG.md) for how rendering equivalence was verified. New styles for the product form use the `pf-` prefix and the shared `--pm-*` tokens.

The stylesheet also respects `prefers-reduced-motion` and provides a keyboard focus ring for controls without their own focus style.

## Conventions

- Props are typed where a contract matters (`lib/types.ts`); screens that predate the split still accept `any` props. Tighten them when you touch them.
- Never spread form state into a database write. Build an explicit payload (see `save()` in the dashboard).
- Never use `alert()`; surface errors through the dashboard's `error` banner.
- Keep pure logic in `lib/` without React or Supabase imports so it can be unit-tested (`scripts/run-tests.mjs` compiles `lib/customers.ts` and `lib/format.ts`).

### Adding a screen

1. Create `components/screens/<name>.tsx` exporting the component.
2. Add the page key to `Page` in `lib/types.ts` and an entry in `lib/navigation.ts` (`nav`, `pageTitle`, `pageDescription`).
3. Render it in the dashboard's page switch and pass the data and callbacks it needs.

## Known limitations and next steps

- `dashboard.tsx` is still large (data loading, handlers and layout in one component). Extract hooks (`useDashboardData`, `useNotifications`) when it next changes.
- Source files keep their dense one-line style. Run `npx prettier --write "{app,components,lib}/**/*.{ts,tsx}"` once (`.prettierrc.json` is included);
  Prettier does not change behavior, but commit the result separately.
- About 330 selectors in `globals.css` are still declared in more than one place (partial overrides, not exact duplicates). Merging them is only safe with a
  cascade-aware tool; verify any such change by comparing computed styles of every element across the UI states (see the changelog).
- `@next/swc-wasm-nodejs` is listed in `package.json` but never imported. Remove it unless you build on a platform without native SWC binaries.
- Next.js 13.5.1 predates several security advisories. Run `npm audit` and upgrade to the latest patched release of your major line.
- Spaced teen numbers in customer targets (“dua belas”) are not converted to digits; only “duabelas” is.
