# Operations & Release Checklist

Use this checklist before presenting Mie-kelar to a client or promoting a release to production.

## Code quality

- [ ] `npm install` completes without fatal errors.
- [ ] `npm run verify` passes (typecheck, lint, tests, build) and CI is green.
- [ ] No real `.env` secrets are committed.
- [ ] Historical fix notes are not used as the primary deployment instructions.

## POS workflow

- [ ] Products load correctly.
- [ ] POS search returns the expected products.
- [ ] Cart quantity changes correctly.
- [ ] Totals/subtotals are correct.
- [ ] Payment methods match the current product requirement: Cash, E-Wallet, ATM.
- [ ] Checkout creates the expected transaction.
- [ ] Transaction number opens the correct transaction/history record.
- [ ] Successful payment produces the expected notification/toast behavior.
- [ ] Receipt contains the required transaction and item information.

## Master data

- [ ] Products CRUD
- [ ] Categories CRUD
- [ ] Customers CRUD
- [ ] Inventory adjustment
- [ ] Inventory adjustment on two devices at once: the second one shows “stok sudah berubah di perangkat lain” and refreshes the number instead of overwriting
- [ ] Deleting a category / customer / product updates every screen immediately (no stale label until reload)
- [ ] Product image upload

## Reporting

- [ ] Dashboard totals are calculated from database records.
- [ ] Analytics filters operate correctly.
- [ ] Transaction history search/filter/pagination work as intended.

## Responsive QA

Test at least one small phone, one tablet, and one desktop viewport.

Check:

- [ ] Sidebar/navigation
- [ ] Global search
- [ ] POS catalog and checkout
- [ ] Product forms
- [ ] Inventory forms
- [ ] Transaction history
- [ ] Tables/cards
- [ ] Dialogs and dropdowns
- [ ] Receipt/print layout

## Security QA

- [ ] RLS is enabled for tenant-owned tables.
- [ ] User A cannot read User B's business records.
- [ ] User A cannot modify User B's records.
- [ ] Storage access follows the intended ownership model.
- [ ] Production credentials are stored only in environment configuration.

## Client handover

Provide the client with:

- production URL
- admin/test account procedure
- Supabase project ownership/access arrangement
- backup/migration procedure
- short user guide
- known limitations, if any
