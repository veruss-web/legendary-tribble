import test from 'node:test';
import assert from 'node:assert/strict';
import { load } from './helpers.mjs';

const { paymentLabel, paymentTone } = load('lib/payments');

test('paymentLabel: current and legacy values map to the three visible methods', () => {
  assert.deepEqual(['cash', 'ewallet', 'qris', 'atm', 'card'].map(paymentLabel), ['Tunai', 'E-Wallet', 'E-Wallet', 'ATM', 'ATM']);
  assert.equal(paymentLabel('voucher'), 'VOUCHER');
  assert.equal(paymentLabel(''), '');
});

test('paymentTone: matches the CSS tone classes', () => {
  assert.deepEqual(['cash', 'ewallet', 'qris', 'atm', 'card'].map(paymentTone), ['cash', 'qris', 'qris', 'card', 'card']);
  assert.equal(paymentTone('voucher'), 'ewallet');
});
