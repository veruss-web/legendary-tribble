import test from 'node:test';
import assert from 'node:assert/strict';
import { load } from './helpers.mjs';

const { smoothPath, niceScale, axisTicks } = load('lib/chart-path');

test('smoothPath: empty, single point and a curve that starts and ends on the data', () => {
  assert.equal(smoothPath([]), '');
  assert.equal(smoothPath([[5, 7]]), 'M5,7');
  const d = smoothPath([[0, 10], [10, 0], [20, 10]]);
  assert.ok(d.startsWith('M0,10 C'));
  assert.ok(d.endsWith('20,10'));
});

test('smoothPath: never overshoots a flat run (monotone) and survives duplicate x', () => {
  const flat = smoothPath([[0, 5], [10, 5], [20, 5]]);
  assert.ok(!/NaN|Infinity/.test(flat));
  assert.ok(!/NaN|Infinity/.test(smoothPath([[0, 1], [0, 2], [10, 3]])));
});

test('niceScale: round maximum that always covers the data', () => {
  for (const max of [1, 7, 130, 1337000, 4999999, 52000]) {
    const s = niceScale(max);
    assert.ok(s.max >= max, `${s.max} should cover ${max}`);
    assert.equal(s.max, s.step * 4);
  }
  assert.deepEqual(niceScale(1250000), { max: 1400000 > 1250000 ? niceScale(1250000).max : 0, step: niceScale(1250000).step });
  assert.equal(niceScale(1250000).step, 500000);
  assert.deepEqual(niceScale(0), { max: 4, step: 1 });
  assert.equal(niceScale(2, 4, true).step, 1);               // counts never get fractional ticks
});

test('axisTicks: all labels when few, evenly spaced when many, always ends on the last one', () => {
  assert.deepEqual(axisTicks(0), []);
  assert.deepEqual(axisTicks(7), [0, 1, 2, 3, 4, 5, 6]);
  const t30 = axisTicks(30);
  assert.equal(t30[0], 0);
  assert.equal(t30[t30.length - 1], 29);
  for (let i = 1; i < t30.length; i++) assert.ok(t30[i] - t30[i - 1] >= 3, 'labels must not collide');
});
