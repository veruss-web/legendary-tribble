/** Pure inventory helpers (unit-tested in tests/inventory.test.mjs). */
import type { Product } from '@/lib/types';

export type Level = 'good' | 'low' | 'out';
export type Sort = 'low' | 'high' | 'name';

/** Below this many units a product counts as "menipis". */
export const LOW_STOCK = 5;
export const levelOf = (stock: number): Level => (stock <= 0 ? 'out' : stock < LOW_STOCK ? 'low' : 'good');

/** Comparator for the three sort modes; `stockOf` lets the caller sort on a frozen snapshot instead of live stock. */
export const compareBy = (sort: Sort, stockOf: (p: Product) => number) => (a: Product, b: Product) =>
  sort === 'name' ? a.name.localeCompare(b.name, 'id')
  : sort === 'high' ? stockOf(b) - stockOf(a)
  : stockOf(a) - stockOf(b) || a.name.localeCompare(b.name, 'id');
