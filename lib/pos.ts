/** Pure helpers of the Kasir screen (unit-tested in tests/pos.test.mjs). */
import type { Category, Product } from './types';

type Line = { price: number | string; qty: number };

export const cartTotal = (cart: Line[]) => cart.reduce((a, p) => a + Number(p.price) * p.qty, 0);
export const cartCount = (cart: Line[]) => cart.reduce((a, p) => a + p.qty, 0);
export const changeDue = (paid: number | string, total: number) => Math.max(0, Number(paid || 0) - total);
export const shortBy = (paid: number | string, total: number) => Math.max(0, total - Number(paid || 0));

/** Cash shortcuts: the exact total first, then up to three bills above it (85.000 -> 85.000, 90.000, 100.000; a round 100.000 -> 100.000, 105.000, 110.000, 120.000). */
export function quickCashAmounts(total: number): number[] {
  if (!(total > 0)) return [];
  const above = new Set<number>();
  [5000, 10000, 20000, 50000, 100000].forEach((step) => above.add(Math.floor(total / step) * step + step)); // next multiple strictly above the total
  return [total, ...[...above].sort((a, b) => a - b).slice(0, 3)];
}

/** Menu shown in Kasir: every active product (sold-out ones stay on the grid, marked "Habis", so a line that took the last portion can still be stepped back), narrowed by category name and the search text. */
export function filterMenu(products: Product[], category: string, query: string) {
  const q = (query || '').trim().toLowerCase();
  return products.filter((p) =>
    p.is_active && (category === 'Semua' || p.categories?.name === category)
    && (!q || [p.name, p.description || '', p.categories?.name || '', String(p.stock), String(p.price)].join(' ').toLowerCase().includes(q)));
}

/** Pill counts for the category rail ("Semua" plus every category; counts menu items, sold-out ones included). */
export function menuCategories(products: Product[], categories: Category[]) {
  const menu = products.filter((p) => p.is_active);
  return [
    { name: 'Semua', color: null as string | null, count: menu.length },
    ...categories.map((c) => ({ name: c.name, color: c.color as string | null, count: menu.filter((p) => p.categories?.name === c.name).length })),
  ];
}

/** Stock the cashier can still sell right now: the database stock plus reservations that are still on their way to it
 *  (`pending` is the net stock change of unconfirmed calls per product: -1 for a portion just added, +1 for one just removed). Never below 0. */
export const availableStock = (stock: number, pending: number = 0) => Math.max(0, Math.floor(Number(stock) || 0) + (Number(pending) || 0));

export type StockLevel = 'good' | 'low' | 'out';
/** Same thresholds as the Inventory screen: out at 0, "menipis" below `low`. */
export const stockLevel = (stock: number, low: number = 5): StockLevel => (stock <= 0 ? 'out' : stock < low ? 'low' : 'good');

/** Header numbers of the menu: items on sale, thin stock, sold out (stock already corrected for pending reservations). */
export function menuStats(products: Product[], stockOf: (p: Product) => number, low: number = 5) {
  let ready = 0, thin = 0, out = 0;
  for (const p of products) {
    const level = stockLevel(stockOf(p), low);
    if (level === 'out') out++; else { ready++; if (level === 'low') thin++; }
  }
  return { ready, thin, out };
}
