import test from 'node:test';
import assert from 'node:assert/strict';
import { load } from './helpers.mjs';

const { levelOf, compareBy, LOW_STOCK } = load('lib/inventory');
const P = (name, stock) => ({ id: name, name, stock });
const names = (list) => list.map((p) => p.name);

test('levelOf: out at 0 (or below), low under LOW_STOCK, good from LOW_STOCK up', () => {
  assert.equal(LOW_STOCK, 5);
  assert.deepEqual([-1, 0, 1, 4, 5, 6, 60].map(levelOf), ['out', 'out', 'low', 'low', 'good', 'good', 'good']);
});

test('compareBy: the three sort modes, ties broken by name', () => {
  const list = [P('Kopi', 18), P('Es Jeruk', 2), P('Bakso', 2), P('Mie', 60)];
  const live = (p) => p.stock;
  assert.deepEqual(names([...list].sort(compareBy('low', live))), ['Bakso', 'Es Jeruk', 'Kopi', 'Mie']);
  assert.deepEqual(names([...list].sort(compareBy('high', live))), ['Mie', 'Kopi', 'Es Jeruk', 'Bakso']);
  assert.deepEqual(names([...list].sort(compareBy('name', live))), ['Bakso', 'Es Jeruk', 'Kopi', 'Mie']);
});

test('compareBy: sorting on a frozen snapshot ignores later stock changes (rows must not jump after +10)', () => {
  const list = [P('A', 0), P('B', 2), P('C', 5)];
  const frozen = new Map(list.map((p) => [p.id, p.stock]));
  const orderBefore = names([...list].sort(compareBy('low', (p) => frozen.get(p.id))));
  list[1].stock += 10;                                               // "+10" on B
  const stillFrozen = names([...list].sort(compareBy('low', (p) => frozen.get(p.id))));
  const live = names([...list].sort(compareBy('low', (p) => p.stock)));
  assert.deepEqual(stillFrozen, orderBefore);
  assert.notDeepEqual(live, orderBefore);                            // sorting on live stock is what used to move the row
});
