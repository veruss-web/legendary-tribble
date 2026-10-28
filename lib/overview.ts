/** Pure calculations behind the Overview screen (unit-tested in tests/overview.test.mjs). */
import type { Order, OrderItem, Product } from './types';
import { levelOf } from './inventory';

export type Period = 'today' | '7' | '30';
export type SalesPoint = {
  label: string; value: number | null; previous: number; count: number;
  /** Order count on the same footing as `value` (running total for "today", per day otherwise); null for hours that have not happened yet. */
  orders: number | null; previousOrders: number;
};
export type SalesSeries = {
  points: SalesPoint[];
  /** "today" plots running revenue per hour; 7 / 30 days plot revenue per day. */
  cumulative: boolean;
  total: number; previousTotal: number;
  count: number; previousCount: number;
  /** % change against the previous period, null when there is nothing to compare with. */
  delta: number | null;
  /** Completed orders inside the current window (used for items sold and top products). */
  orderIds: Set<string>;
};
export type TopProduct = { key: string; name: string; qty: number; revenue: number };

const DAY = 86400000;
const dayStart = (base: Date, offsetDays: number) => new Date(base.getFullYear(), base.getMonth(), base.getDate() + offsetDays);
const sum = (list: number[]) => list.reduce((a, b) => a + b, 0);
export const isCompleted = (o: Order) => o.status === 'completed';

export const deltaPct = (current: number, previous: number) => (previous > 0 ? Math.round(((current - previous) / previous) * 100) : null);

export function salesSeries(orders: Order[], period: Period, now: Date = new Date()): SalesSeries {
  const done = orders.filter(isCompleted);
  const when = (o: Order) => new Date(o.created_at);
  const within = (o: Order, from: Date, to: Date) => { const d = when(o); return d >= from && d < to; };

  if (period === 'today') {
    const today = dayStart(now, 0), tomorrow = dayStart(now, 1), yesterday = dayStart(now, -1);
    const bucket = (from: Date, to: Date) => {
      const revenue: number[] = Array(24).fill(0), count: number[] = Array(24).fill(0);
      done.forEach((o) => { if (within(o, from, to)) { const h = when(o).getHours(); revenue[h] += Number(o.total); count[h] += 1; } });
      return { revenue, count };
    };
    const cur = bucket(today, tomorrow), prev = bucket(yesterday, today);
    const running = (list: number[]) => { let s = 0; return list.map((x) => (s += x)); };
    const curRun = running(cur.revenue), prevRun = running(prev.revenue), hour = now.getHours();
    const curOrdersRun = running(cur.count), prevOrdersRun = running(prev.count);
    const total = curRun[hour], previousTotal = prevRun[hour]; // yesterday only up to the same hour: a fair comparison
    return {
      points: Array.from({ length: 24 }, (_, h) => ({ label: `${String(h).padStart(2, '0')}:00`, value: h <= hour ? curRun[h] : null, previous: prevRun[h], count: cur.count[h], orders: h <= hour ? curOrdersRun[h] : null, previousOrders: prevOrdersRun[h] })),
      cumulative: true, total, previousTotal,
      count: sum(cur.count.slice(0, hour + 1)), previousCount: sum(prev.count.slice(0, hour + 1)),
      delta: deltaPct(total, previousTotal),
      orderIds: new Set(done.filter((o) => within(o, today, tomorrow)).map((o) => o.id)),
    };
  }

  const n = period === '7' ? 7 : 30;
  const from = dayStart(now, -(n - 1)), to = dayStart(now, 1), prevFrom = dayStart(now, -(2 * n - 1));
  const revenue: number[] = Array(n).fill(0), count: number[] = Array(n).fill(0), prevRevenue: number[] = Array(n).fill(0), prevCount: number[] = Array(n).fill(0);
  const ids = new Set<string>();
  done.forEach((o) => {
    const d = when(o);
    if (d >= from && d < to) { const i = Math.floor((d.getTime() - from.getTime()) / DAY); revenue[i] += Number(o.total); count[i] += 1; ids.add(o.id); }
    else if (d >= prevFrom && d < from) { const i = Math.floor((d.getTime() - prevFrom.getTime()) / DAY); prevRevenue[i] += Number(o.total); prevCount[i] += 1; }
  });
  const total = sum(revenue), previousTotal = sum(prevRevenue);
  return {
    points: revenue.map((value, i) => ({ label: dayStart(from, i).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }), value, previous: prevRevenue[i], count: count[i], orders: count[i], previousOrders: prevCount[i] })),
    cumulative: false, total, previousTotal, count: sum(count), previousCount: sum(prevCount), delta: deltaPct(total, previousTotal), orderIds: ids,
  };
}

export const itemsSold = (items: OrderItem[], orderIds: Set<string>) => items.reduce((a, i) => a + (orderIds.has(i.order_id) ? Number(i.quantity) || 0 : 0), 0);

/** Best sellers by quantity; a product is keyed by id (or name once the product row was deleted). */
export function topProducts(items: OrderItem[], orderIds: Set<string>, limit = 5): TopProduct[] {
  const rows = new Map<string, TopProduct>();
  items.forEach((i) => {
    if (!orderIds.has(i.order_id)) return;
    const key = i.product_id || i.product_name, row = rows.get(key) || { key, name: i.product_name, qty: 0, revenue: 0 };
    row.qty += Number(i.quantity) || 0; row.revenue += Number(i.line_total) || 0; rows.set(key, row);
  });
  return [...rows.values()].sort((a, b) => b.qty - a.qty || b.revenue - a.revenue || a.name.localeCompare(b.name, 'id')).slice(0, limit);
}

export const recentOrders = (orders: Order[], limit = 6) =>
  orders.filter(isCompleted).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, limit);

/** Products that are low or out of stock, emptiest first. */
export const needsRestock = (products: Product[]) => products.filter((p) => levelOf(p.stock) !== 'good').sort((a, b) => a.stock - b.stock || a.name.localeCompare(b.name, 'id'));

export function timeAgo(iso: string, now: Date = new Date()) {
  const minutes = Math.floor((now.getTime() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return 'Baru saja';
  if (minutes < 60) return `${minutes} mnt lalu`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} jam lalu`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'Kemarin' : `${days} hari lalu`;
}

export const greeting = (now: Date = new Date()) => {
  const h = now.getHours();
  return h < 11 ? 'Selamat pagi' : h < 15 ? 'Selamat siang' : h < 18 ? 'Selamat sore' : 'Selamat malam';
};
