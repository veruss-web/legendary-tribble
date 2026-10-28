import test from 'node:test';
import assert from 'node:assert/strict';
import { load } from './helpers.mjs';

const { analyze, pct, presetRange, toCsv, toIso, parseDay } = load('lib/analytics');
let seq = 0;
const at = (d, h = 10) => new Date(2026, 9, d, h, 5).toISOString();            // October 2026, local time
const order = (total, created_at, extra = {}) => ({ id: `o${++seq}`, status: 'completed', payment_method: 'cash', customer_id: null, total, created_at, ...extra });
const line = (order_id, product_id, product_name, quantity, line_total) => ({ order_id, product_id, product_name, quantity, line_total });

test('pct: one-decimal change, null without a previous period', () => {
  assert.equal(pct(150, 100), 50);
  assert.equal(pct(123, 100), 23);
  assert.equal(pct(1, 3), -66.7);
  assert.equal(pct(10, 0), null);
});

test('toIso / parseDay round-trip in local time and presetRange is inclusive', () => {
  assert.equal(toIso(parseDay('2026-10-05')), '2026-10-05');
  assert.deepEqual(presetRange(7, new Date(2026, 9, 25)), { from: '2026-10-19', to: '2026-10-25' });
  assert.deepEqual(presetRange(1, new Date(2026, 9, 25)), { from: '2026-10-25', to: '2026-10-25' });
});

test('analyze: totals, per-day points and the previous period of equal length', () => {
  const orders = [
    order(10000, at(20), { customer_id: 'c1' }), order(30000, at(20, 15), { customer_id: 'c2' }), order(20000, at(22), { customer_id: 'c1' }),
    order(99999, at(21), { status: 'cancelled' }), order(5000, at(24), { status: 'pending' }),
    order(8000, at(16), { customer_id: 'c1' }), order(2000, at(18)), order(1, at(12)),               // previous window is 13..19 Oct; 12 Oct is two periods back
    order(7777, at(27)),                                                                              // after the range (ends 26 Oct)
  ];
  const a = analyze(orders, [], [], '2026-10-20', '2026-10-26');
  assert.equal(a.days, 7);
  assert.equal(a.points.length, 7);
  assert.equal(a.revenue, 10000 + 30000 + 20000);
  assert.equal(a.orders, 3);
  assert.equal(a.points[0].revenue, 40000);                       // 20 Oct
  assert.equal(a.points[0].orders, 2);
  assert.equal(a.points[2].revenue, 20000);                       // 22 Oct
  assert.equal(a.points[1].revenue, 0);                           // cancelled does not count
  assert.equal(a.cancelled, 1);
  assert.equal(a.previousRevenue, 10000);                         // 16 and 18 Oct
  assert.equal(a.points[3].previousRevenue, 8000);                // 16 Oct is day 3 of the previous window (13..19 Oct)
  assert.equal(a.points[5].previousRevenue, 2000);                // 18 Oct
});

test('analyze: previous points line up day by day with the current window', () => {
  const orders = [order(5000, at(13)), order(7000, at(15)), order(100, at(20))];
  const a = analyze(orders, [], [], '2026-10-20', '2026-10-26');
  assert.equal(a.points[0].previousRevenue, 5000);                // 13 Oct <-> 20 Oct
  assert.equal(a.points[2].previousRevenue, 7000);                // 15 Oct <-> 22 Oct
  assert.equal(a.previousOrders, 2);
  assert.equal(a.orderDelta, pct(1, 2));
});

test('analyze: averages, customers, success rate, best day and peak hour', () => {
  const orders = [
    order(10000, at(20, 12), { customer_id: 'c1' }), order(30000, at(20, 12), { customer_id: 'c2' }), order(20000, at(21, 9), { customer_id: 'c1' }),
    order(1, at(21), { status: 'cancelled' }),
  ];
  const a = analyze(orders, [], [], '2026-10-20', '2026-10-21');
  assert.equal(a.revenue, 60000);
  assert.equal(a.avgOrder, 20000);
  assert.equal(a.avgPerDay, 30000);
  assert.equal(a.customers, 2);
  assert.equal(a.successRate, 75);
  assert.equal(a.bestDay.revenue, 40000);
  assert.equal(a.peakHour.hour, 12);
  assert.equal(a.peakHour.orders, 2);
  assert.equal(a.hours[9].orders, 1);
  assert.equal(a.hours.length, 24);
});

test('analyze: payment mix is sorted by revenue and shares add up to 100', () => {
  const orders = [order(60000, at(20), { payment_method: 'cash' }), order(30000, at(20), { payment_method: 'qris' }), order(10000, at(20), { payment_method: 'qris' })];
  const a = analyze(orders, [], [], '2026-10-20', '2026-10-20');
  assert.deepEqual(a.payments.map((p) => p.method), ['cash', 'qris']);
  assert.equal(a.payments[0].share, 60);
  assert.equal(a.payments[1].orders, 2);
  assert.equal(a.payments.reduce((s, p) => s + p.share, 0), 100);
});

test('analyze: products only count items of orders inside the range, with category and items sold', () => {
  const orders = [{ ...order(54000, at(20)), id: 'in' }, { ...order(1000, at(1)), id: 'out' }];
  const items = [line('in', 'p1', 'Mie Ayam', 3, 54000), line('in', null, 'Menu Lama', 1, 9000), line('out', 'p1', 'Mie Ayam', 50, 900000)];
  const products = [{ id: 'p1', name: 'Mie Ayam', categories: { name: 'Mie' } }];
  const a = analyze(orders, items, products, '2026-10-20', '2026-10-20');
  assert.equal(a.itemsSold, 4);
  assert.equal(a.avgItemsPerOrder, 4);
  assert.deepEqual(a.products.map((p) => [p.name, p.qty, p.revenue, p.category]), [['Mie Ayam', 3, 54000, 'Mie'], ['Menu Lama', 1, 9000, null]]);
});

test('analyze: empty data is safe (no NaN, null deltas, no best day)', () => {
  const a = analyze([], [], [], '2026-10-20', '2026-10-26');
  assert.equal(a.revenue, 0);
  assert.equal(a.avgOrder, 0);
  assert.equal(a.revenueDelta, null);
  assert.equal(a.successRate, null);
  assert.equal(a.bestDay, null);
  assert.equal(a.peakHour, null);
  assert.deepEqual(a.payments, []);
  assert.ok(a.points.every((p) => p.revenue === 0 && p.orders === 0));
});

test('analyze: a reversed range is swapped and a huge range is capped to one year', () => {
  assert.equal(analyze([], [], [], '2026-10-26', '2026-10-20').days, 7);
  assert.equal(analyze([], [], [], '2020-01-01', '2026-10-20').days, 366);
  assert.equal(analyze([], [], [], 'oops', 'nope').days, 1);
});

test('analyze: long ranges are folded into buckets that still add up', () => {
  const orders = [order(1000, at(1)), order(2000, at(25))];
  const a = analyze(orders, [], [], '2026-07-01', '2026-10-25');            // 117 days
  assert.ok(a.bucketDays > 1);
  assert.ok(a.points.length <= 60);
  assert.equal(a.points.reduce((s, p) => s + p.revenue, 0), a.revenue);
  assert.equal(a.revenue, 3000);
  assert.match(a.points[0].long, /–/);
});

test('toCsv: header, one row per point, quotes cells that contain a comma', () => {
  const a = analyze([order(1500, at(20))], [], [], '2026-10-20', '2026-10-21');
  const rows = toCsv(a).split('\n');
  assert.equal(rows.length, 3);
  assert.equal(rows[0], 'Periode,Omzet,Transaksi,Omzet periode lalu,Transaksi periode lalu');
  assert.ok(rows[1].startsWith('"') && rows[1].includes(',1500,1,0,0'));      // long date label has a comma -> quoted
});
