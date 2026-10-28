/** Pure calculations behind the Analisa screen (unit-tested in tests/analytics.test.mjs). No React, no Supabase. */
import type { Order, OrderItem, Product } from './types';

export type RangePreset = '7' | '30' | '90' | 'custom';

/** One chart sample: a single day, or a few days folded together when the range is long. */
export type DayPoint = {
  key: string;
  /** Short axis label, e.g. "12 Okt". */
  label: string;
  /** Tooltip label, e.g. "Senin, 12 Okt 2026" or "12 Okt – 18 Okt". */
  long: string;
  revenue: number;
  orders: number;
  previousRevenue: number;
  previousOrders: number;
};
export type HourBucket = { hour: number; orders: number; revenue: number };
export type PaymentSlice = { method: string; orders: number; revenue: number; share: number };
export type ProductRank = { key: string; name: string; qty: number; revenue: number; category: string | null };

export type AnalyticsResult = {
  from: string;
  to: string;
  days: number;
  /** Days folded into one chart point (1 for ranges up to MAX_DAILY_POINTS days). */
  bucketDays: number;
  points: DayPoint[];
  revenue: number; previousRevenue: number;
  orders: number; previousOrders: number;
  avgOrder: number; previousAvgOrder: number;
  customers: number; previousCustomers: number;
  itemsSold: number;
  revenueDelta: number | null; orderDelta: number | null; avgDelta: number | null; customerDelta: number | null;
  cancelled: number;
  /** Completed / (completed + cancelled) in %, null when there are no orders at all. */
  successRate: number | null;
  avgPerDay: number;
  avgItemsPerOrder: number;
  bestDay: DayPoint | null;
  hours: HourBucket[];
  peakHour: HourBucket | null;
  payments: PaymentSlice[];
  products: ProductRank[];
};

const DAY = 86400000;
export const MAX_DAILY_POINTS = 62;
export const MAX_RANGE_DAYS = 366;

const pad = (n: number) => String(n).padStart(2, '0');
export const toIso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
/** "2026-10-25" -> local midnight (never UTC, so the day does not shift in the user's time zone). */
export const parseDay = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};
/** Whole days between two calendar days (DST-safe because it compares the y/m/d parts, not timestamps). */
const dayDiff = (a: Date, b: Date) => Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / DAY);
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

export const presetRange = (days: number, now: Date = new Date()) => ({ from: toIso(addDays(now, -(days - 1))), to: toIso(now) });

/** % change rounded to one decimal; null when there is nothing to compare with. */
export const pct = (current: number, previous: number) => (previous > 0 ? Math.round(((current - previous) / previous) * 1000) / 10 : null);

const monthDay = (d: Date) => d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
const fullDay = (d: Date) => d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });

export function analyze(orders: Order[], items: OrderItem[], products: Product[], fromIso: string, toIsoValue: string): AnalyticsResult {
  let start = parseDay(fromIso), end = parseDay(toIsoValue);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) { start = end = new Date(); }
  if (start > end) [start, end] = [end, start];
  let days = dayDiff(start, end) + 1;
  if (days > MAX_RANGE_DAYS) { start = addDays(end, -(MAX_RANGE_DAYS - 1)); days = MAX_RANGE_DAYS; }
  const prevStart = addDays(start, -days);
  const bucketDays = days <= MAX_DAILY_POINTS ? 1 : Math.ceil(days / 45);
  const n = Math.ceil(days / bucketDays);

  const points: DayPoint[] = Array.from({ length: n }, (_, i) => {
    const first = addDays(start, i * bucketDays), last = addDays(start, Math.min(days, (i + 1) * bucketDays) - 1);
    return {
      key: toIso(first), label: monthDay(first),
      long: bucketDays === 1 ? fullDay(first) : `${monthDay(first)} – ${monthDay(last)}`,
      revenue: 0, orders: 0, previousRevenue: 0, previousOrders: 0,
    };
  });

  const hours: HourBucket[] = Array.from({ length: 24 }, (_, hour) => ({ hour, orders: 0, revenue: 0 }));
  const pay = new Map<string, { orders: number; revenue: number }>();
  const ids = new Set<string>(), customers = new Set<string>(), prevCustomers = new Set<string>();
  let revenue = 0, count = 0, previousRevenue = 0, previousOrders = 0, cancelled = 0;

  orders.forEach((o) => {
    const when = new Date(o.created_at);
    if (Number.isNaN(when.getTime())) return;
    const offset = dayDiff(start, when), total = Number(o.total) || 0;
    if (offset >= 0 && offset < days) {
      if (o.status === 'cancelled') { cancelled += 1; return; }
      if (o.status !== 'completed') return;
      const p = points[Math.floor(offset / bucketDays)];
      p.revenue += total; p.orders += 1;
      revenue += total; count += 1; ids.add(o.id);
      if (o.customer_id) customers.add(o.customer_id);
      hours[when.getHours()].orders += 1; hours[when.getHours()].revenue += total;
      const slice = pay.get(o.payment_method) || { orders: 0, revenue: 0 };
      slice.orders += 1; slice.revenue += total; pay.set(o.payment_method, slice);
    } else if (o.status === 'completed' && offset < 0 && offset >= -days) {
      const p = points[Math.floor((offset + days) / bucketDays)];
      p.previousRevenue += total; p.previousOrders += 1;
      previousRevenue += total; previousOrders += 1;
      if (o.customer_id) prevCustomers.add(o.customer_id);
    }
  });

  const category = new Map(products.map((p) => [p.id, p.categories?.name || null]));
  const rows = new Map<string, ProductRank>();
  let itemsSold = 0;
  items.forEach((it) => {
    if (!ids.has(it.order_id)) return;
    const key = it.product_id || it.product_name, qty = Number(it.quantity) || 0;
    const row = rows.get(key) || { key, name: it.product_name, qty: 0, revenue: 0, category: (it.product_id && category.get(it.product_id)) || null };
    row.qty += qty; row.revenue += Number(it.line_total) || 0; rows.set(key, row);
    itemsSold += qty;
  });

  const payments = [...pay.entries()]
    .map(([method, v]) => ({ method, orders: v.orders, revenue: v.revenue, share: revenue ? (v.revenue / revenue) * 100 : 0 }))
    .sort((a, b) => b.revenue - a.revenue);
  const bestDay = points.reduce<DayPoint | null>((best, p) => (p.revenue > (best?.revenue ?? 0) ? p : best), null);
  const peakHour = hours.reduce<HourBucket | null>((best, h) => (h.orders > (best?.orders ?? 0) ? h : best), null);
  const avgOrder = count ? revenue / count : 0, previousAvgOrder = previousOrders ? previousRevenue / previousOrders : 0;
  const all = count + cancelled;

  return {
    from: toIso(start), to: toIso(end), days, bucketDays, points,
    revenue, previousRevenue, orders: count, previousOrders,
    avgOrder, previousAvgOrder, customers: customers.size, previousCustomers: prevCustomers.size, itemsSold,
    revenueDelta: pct(revenue, previousRevenue), orderDelta: pct(count, previousOrders),
    avgDelta: pct(avgOrder, previousAvgOrder), customerDelta: pct(customers.size, prevCustomers.size),
    cancelled, successRate: all ? Math.round((count / all) * 1000) / 10 : null,
    avgPerDay: revenue / days, avgItemsPerOrder: count ? itemsSold / count : 0,
    bestDay, hours, peakHour, payments,
    products: [...rows.values()].sort((a, b) => b.revenue - a.revenue || b.qty - a.qty || a.name.localeCompare(b.name, 'id')),
  };
}

const csvCell = (v: string | number) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));

/** Daily (or bucketed) series as CSV, Excel-friendly (comma separated, quoted when needed). */
export const toCsv = (a: AnalyticsResult) =>
  ['Periode,Omzet,Transaksi,Omzet periode lalu,Transaksi periode lalu', ...a.points.map((p) => [p.long, p.revenue, p.orders, p.previousRevenue, p.previousOrders].map(csvCell).join(','))].join('\n');
