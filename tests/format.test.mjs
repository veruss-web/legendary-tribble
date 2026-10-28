import test from 'node:test';
import assert from 'node:assert/strict';
import { load } from './helpers.mjs';

const { money, compactNumber } = load('lib/format');
const hasIndonesianLocale = Intl.NumberFormat.supportedLocalesOf('id-ID').length > 0;
const plain = (text) => text.replace(/\s/g, ' ');   // Intl uses a non-breaking space after "Rp"

test('money formats rupiah without decimals', { skip: !hasIndonesianLocale && 'id-ID locale data not available' }, () => {
  assert.equal(plain(money(1500)), 'Rp 1.500');
  assert.equal(plain(money(1234567)), 'Rp 1.234.567');
  assert.equal(plain(money(18000.4)), 'Rp 18.000');
});

test('money treats empty values as zero', { skip: !hasIndonesianLocale && 'id-ID locale data not available' }, () => {
  assert.equal(plain(money(0)), 'Rp 0');
  assert.equal(plain(money(null)), 'Rp 0');
  assert.equal(plain(money(undefined)), 'Rp 0');
});

test('compactNumber shortens thousands, millions and billions', () => {
  assert.equal(compactNumber(0), '0');
  assert.equal(compactNumber(850), '850');
  assert.equal(compactNumber(4500), '5 rb');
  assert.equal(compactNumber(1250000), '1,3 jt');
  assert.equal(compactNumber(2000000), '2 jt');
  assert.equal(compactNumber(3400000000), '3,4 M');
  assert.equal(compactNumber(NaN), '0');
});
