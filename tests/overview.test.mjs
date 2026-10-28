import test from 'node:test';
import assert from 'node:assert/strict';
import { load } from './helpers.mjs';

const { salesSeries, deltaPct, itemsSold, topProducts, recentOrders, needsRestock, timeAgo, greeting } = load('lib/overview');
const NOW = new Date(2026, 9, 22, 14, 30);               // Thu 22 Oct 2026, 14:30 (local time)
const at = (dayOffset, h, m = 0) => new Date(2026, 9, 22 + dayOffset, h, m).toISOString();
let seq = 0;
const order = (total, created_at, status = 'completed') => ({ id: `o${++seq}`, status, total, created_at });
const line = (order_id, product_id, product_name, quantity, line_total) => ({ order_id, product_id, product_name, quantity, line_total });

test('deltaPct: rounded % change, null when the previous period is empty', () => {
  assert.equal(deltaPct(150, 100), 50);
  assert.equal(deltaPct(50, 100), -50);
  assert.equal(deltaPct(100, 0), null);
});

test('salesSeries today: running revenue per hour, future hours are null, yesterday compared up to the same hour', () => {
  const orders = [order(10000, at(0, 9, 10)), order(20000, at(0, 13, 5)), order(99999, at(0, 12), 'cancelled'), order(5000, at(-1, 10)), order(7000, at(-1, 16))];
  const s = salesSeries(orders, 'today', NOW);
  assert.equal(s.points.length, 24);
  assert.equal(s.cumulative, true);
  assert.equal(s.points[8].value, 0);
  assert.equal(s.points[9].value, 10000);
  assert.equal(s.points[14].value, 30000);
  assert.equal(s.points[15].value, null);                    // after "now"
  assert.equal(s.points[10].previous, 5000);
  assert.equal(s.points[16].previous, 12000);                // yesterday's full day still drawn
  assert.equal(s.total, 30000);
  assert.equal(s.previousTotal, 5000);                       // yesterday until 14:xx only (16:00 sale not counted)
  assert.equal(s.delta, 500);
  assert.equal(s.count, 2);
  assert.equal(s.orderIds.size, 2);
});

test('salesSeries 7 days: one point per day, last point is today, previous is the week before', () => {
  const orders = [order(10000, at(0, 9)), order(4000, at(0, 11)), order(6000, at(-6, 8)), order(8000, at(-7, 8)), order(2000, at(-13, 8)), order(1, at(-14, 8))];
  const s = salesSeries(orders, '7', NOW);
  assert.equal(s.points.length, 7);
  assert.equal(s.cumulative, false);
  assert.equal(s.points[6].value, 14000);
  assert.equal(s.points[6].count, 2);
  assert.equal(s.points[0].value, 6000);
  assert.equal(s.points[0].previous, 2000);                  // -13 days: the same weekday one week before day -6
  assert.equal(s.points[6].previous, 8000);                  // -7 days: today's weekday last week
  assert.equal(s.total, 20000);
  assert.equal(s.previousTotal, 10000);                      // -7 and -13 days; -14 is two periods back
  assert.equal(s.delta, 100);
  assert.equal(s.orderIds.size, 3);
});

test('salesSeries 30 days has 30 points', () => {
  assert.equal(salesSeries([], '30', NOW).points.length, 30);
  assert.equal(salesSeries([], '30', NOW).delta, null);
});

test('itemsSold / topProducts only count orders of the current window', () => {
  const ids = new Set(['a', 'b']);
  const items = [line('a', 'p1', 'Mie Ayam', 3, 54000), line('b', 'p1', 'Mie Ayam', 2, 36000), line('a', 'p2', 'Es Teh', 4, 20000), line('b', null, 'Menu Lama', 1, 9000), line('x', 'p3', 'Lain', 99, 1)];
  assert.equal(itemsSold(items, ids), 10);
  const top = topProducts(items, ids, 2);
  assert.deepEqual(top.map((t) => [t.name, t.qty, t.revenue]), [['Mie Ayam', 5, 90000], ['Es Teh', 4, 20000]]);
  assert.equal(topProducts(items, ids, 10).some((t) => t.name === 'Menu Lama'), true);   // deleted product keeps its name
});

test('recentOrders: newest completed first', () => {
  const list = [order(1, at(0, 9)), order(2, at(0, 13)), order(3, at(0, 14), 'cancelled'), order(4, at(-1, 20))];
  assert.deepEqual(recentOrders(list, 2).map((o) => o.total), [2, 1]);
});

test('needsRestock: low and out of stock, emptiest first', () => {
  const p = (name, stock) => ({ name, stock });
  assert.deepEqual(needsRestock([p('A', 9), p('B', 3), p('C', 0), p('D', 5)]).map((x) => x.name), ['C', 'B']);
});

test('timeAgo and greeting', () => {
  assert.equal(timeAgo(at(0, 14, 30), NOW), 'Baru saja');
  assert.equal(timeAgo(at(0, 14, 5), NOW), '25 mnt lalu');
  assert.equal(timeAgo(at(0, 11, 30), NOW), '3 jam lalu');
  assert.equal(timeAgo(at(-1, 14, 30), NOW), 'Kemarin');
  assert.equal(timeAgo(at(-4, 14, 30), NOW), '4 hari lalu');
  assert.deepEqual([8, 12, 16, 21].map((h) => greeting(new Date(2026, 9, 22, h))), ['Selamat pagi', 'Selamat siang', 'Selamat sore', 'Selamat malam']);
});

test('salesSeries exposes order counts on the same footing as revenue (running for today, per day otherwise)', () => {
  const today = salesSeries([order(10000, at(0, 9)), order(20000, at(0, 13)), order(5000, at(-1, 10))], 'today', NOW);
  assert.equal(today.points[9].orders, 1);
  assert.equal(today.points[14].orders, 2);
  assert.equal(today.points[15].orders, null);               // future hour
  assert.equal(today.points[10].previousOrders, 1);
  const week = salesSeries([order(10000, at(0, 9)), order(4000, at(0, 11)), order(8000, at(-7, 8))], '7', NOW);
  assert.equal(week.points[6].orders, 2);
  assert.equal(week.points[6].previousOrders, 1);
});
