import test from 'node:test';
import assert from 'node:assert/strict';
import { load } from './helpers.mjs';

const { cartTotal, cartCount, changeDue, shortBy, quickCashAmounts, filterMenu, menuCategories, availableStock, stockLevel, menuStats } = load('lib/pos');
const P = (name, price, stock, cat, over = {}) => ({ id: name, name, price, stock, description: null, is_active: true, categories: cat ? { name: cat } : null, ...over });

test('cart maths', () => {
  const cart = [{ price: 18000, qty: 2 }, { price: '5000', qty: 3 }];
  assert.equal(cartTotal(cart), 51000);
  assert.equal(cartCount(cart), 5);
  assert.equal(cartTotal([]), 0);
});

test('changeDue / shortBy never go negative and accept the raw input string', () => {
  assert.equal(changeDue('100000', 85000), 15000);
  assert.equal(changeDue('', 85000), 0);
  assert.equal(shortBy('50000', 85000), 35000);
  assert.equal(shortBy('100000', 85000), 0);
});

test('quickCashAmounts: exact total first, then up to three rounded-up bills', () => {
  assert.deepEqual(quickCashAmounts(85000), [85000, 90000, 100000]);
  assert.deepEqual(quickCashAmounts(18000), [18000, 20000, 50000, 100000]);
  assert.deepEqual(quickCashAmounts(100000), [100000, 105000, 110000, 120000]);
  assert.deepEqual(quickCashAmounts(0), []);
});

test('filterMenu: every active product (sold-out stay, inactive go), by category and search text', () => {
  const list = [P('Mie Ayam', 18000, 5, 'Mie'), P('Es Teh', 5000, 9, 'Minuman'), P('Habis', 1, 0, 'Mie'), P('Nonaktif', 1, 5, 'Mie', { is_active: false })];
  assert.deepEqual(filterMenu(list, 'Semua', '').map((p) => p.name), ['Mie Ayam', 'Es Teh', 'Habis']);
  assert.deepEqual(filterMenu(list, 'Mie', '').map((p) => p.name), ['Mie Ayam', 'Habis']);
  assert.deepEqual(filterMenu(list, 'Semua', ' TEH ').map((p) => p.name), ['Es Teh']);
  assert.deepEqual(filterMenu(list, 'Semua', '18000').map((p) => p.name), ['Mie Ayam']);
});

test('menuCategories: counts active menu items per category, "Semua" first', () => {
  const list = [P('Mie Ayam', 1, 5, 'Mie'), P('Habis', 1, 0, 'Mie'), P('Es Teh', 1, 9, 'Minuman'), P('Nonaktif', 1, 5, 'Minuman', { is_active: false })];
  const cats = menuCategories(list, [{ name: 'Mie', color: '#f00' }, { name: 'Minuman', color: '#00f' }, { name: 'Kosong', color: '#0f0' }]);
  assert.deepEqual(cats.map((c) => [c.name, c.count]), [['Semua', 3], ['Mie', 2], ['Minuman', 1], ['Kosong', 0]]);
});

test('availableStock: database stock plus the calls still on their way, never below 0', () => {
  assert.equal(availableStock(10), 10);
  assert.equal(availableStock(10, -3), 7);   // three portions just added, answers not back yet
  assert.equal(availableStock(10, 2), 12);   // two portions just taken back
  assert.equal(availableStock(1, -4), 0);
  assert.equal(availableStock(undefined, undefined), 0);
  assert.equal(availableStock('7', -1), 6);
});

test('stockLevel: out at 0, low below the threshold, good otherwise', () => {
  assert.equal(stockLevel(0), 'out');
  assert.equal(stockLevel(-2), 'out');
  assert.equal(stockLevel(1), 'low');
  assert.equal(stockLevel(4), 'low');
  assert.equal(stockLevel(5), 'good');
  assert.equal(stockLevel(7, 8), 'low');
});

test('menuStats: ready / thin / out, using the corrected stock', () => {
  const list = [P('A', 1, 9, 'x'), P('B', 1, 3, 'x'), P('C', 1, 0, 'x'), P('D', 1, 2, 'x')];
  assert.deepEqual(menuStats(list, (p) => p.stock), { ready: 3, thin: 2, out: 1 });
  // the same list while two portions of A are in the order and unconfirmed
  assert.deepEqual(menuStats(list, (p) => availableStock(p.stock, p.name === 'D' ? -2 : 0)), { ready: 2, thin: 1, out: 2 });
});
