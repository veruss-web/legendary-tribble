import test from 'node:test';
import assert from 'node:assert/strict';
import { load } from './helpers.mjs';

const { digitsOnly, groupDigits, parseDraft, draftFromProduct, emptyDraft, MAX_MONEY_DIGITS } = load('lib/products');
const draft = (over = {}) => ({ ...emptyDraft(), name: 'Mie Ayam', price: '18000', ...over });

test('digitsOnly: strips formatting, leading zeros and anything past the column limit', () => {
  assert.equal(digitsOnly('Rp 12.500'), '12500');
  assert.equal(digitsOnly('007'), '7');
  assert.equal(digitsOnly('0'), '0');
  assert.equal(digitsOnly(null), '');
  assert.equal(digitsOnly('12345678901234').length, MAX_MONEY_DIGITS);
  assert.equal(digitsOnly('12345', 3), '123');
});

test('groupDigits: id-ID thousand separators, empty stays empty', () => {
  assert.equal(groupDigits('12500'), '12.500');
  assert.equal(groupDigits('1250000'), '1.250.000');
  assert.equal(groupDigits(''), '');
});

test('parseDraft: a valid draft becomes typed input with trimmed text and null for empty optional fields', () => {
  const { input, errors } = parseDraft(draft({ name: '  Mie Ayam  ', description: ' enak ', stock: '12', category_id: '' }));
  assert.deepEqual(errors, {});
  assert.deepEqual(input, { name: 'Mie Ayam', description: 'enak', price: 18000, stock: 12, image_url: null, category_id: null, is_active: true });
});

test('parseDraft: name and price are required, price 0 is allowed', () => {
  const empty = parseDraft(emptyDraft());
  assert.equal(empty.errors.name, 'Nama produk minimal 2 karakter.');
  assert.equal(empty.errors.price, 'Harga jual wajib diisi.');
  assert.equal(parseDraft(draft({ name: 'A' })).errors.name, 'Nama produk minimal 2 karakter.');
  const free = parseDraft(draft({ price: '0' }));
  assert.deepEqual(free.errors, {});
  assert.equal(free.input.price, 0);
});

test('draftFromProduct: null product gives an empty draft, nulls become empty strings, money is rounded', () => {
  assert.deepEqual(draftFromProduct(null), emptyDraft());
  const d = draftFromProduct({ name: 'Es Teh', description: null, price: 5000.4, stock: 7.9, image_url: null, category_id: null, is_active: false });
  assert.deepEqual(d, { name: 'Es Teh', description: '', price: '5000', stock: '7', image_url: null, category_id: '', is_active: false });
});

test('draft -> input round trip keeps an existing product unchanged', () => {
  const p = { name: 'Bakso Urat', description: 'Jumbo', price: 15000, stock: 9, image_url: 'https://x/y.webp', category_id: 'c3', is_active: true };
  assert.deepEqual(parseDraft(draftFromProduct(p)).input, p);
});

test('the product form has no cost field: input never carries `cost`, stray values are ignored', () => {
  const { input } = parseDraft({ ...draft(), cost: '9000' });
  assert.equal('cost' in input, false);
  assert.equal('cost' in emptyDraft(), false);
});
