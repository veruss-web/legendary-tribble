import test from 'node:test';
import assert from 'node:assert/strict';
import { load } from './helpers.mjs';

const { BRANCHES, hostOf, currentBranch } = load('lib/branches');

test('there are three websites: pusat, cabang 1 and cabang 2, each with its own https link', () => {
  assert.deepEqual(BRANCHES.map((b) => b.id), ['pusat', 'cabang-1', 'cabang-2']);
  assert.deepEqual(BRANCHES.map((b) => b.name), ['E-Commerce Pusat', 'Cabang 1', 'Cabang 2']);
  for (const b of BRANCHES) assert.match(b.url, /^https:\/\/[a-z0-9-]+\.vercel\.app\/$/);
  assert.equal(new Set(BRANCHES.map((b) => b.url)).size, 3);
});

test('hostOf extracts the lower-case hostname and tolerates garbage', () => {
  assert.equal(hostOf('https://Expert-System-Azure.vercel.app/'), 'expert-system-azure.vercel.app');
  assert.equal(hostOf('not a url'), '');
  assert.equal(hostOf(null), '');
  assert.equal(hostOf(undefined), '');
});

test('currentBranch recognises the open website by hostname', () => {
  assert.equal(currentBranch('legendary-tribble-eta.vercel.app')?.id, 'pusat');
  assert.equal(currentBranch('fictional-octo-tribble-delta.vercel.app')?.id, 'cabang-1');
  assert.equal(currentBranch('  EXPERT-SYSTEM-AZURE.vercel.app ')?.id, 'cabang-2');
});

test('currentBranch is null for localhost, other domains and empty input', () => {
  assert.equal(currentBranch('localhost'), null);
  assert.equal(currentBranch('toko-saya.example.com'), null);
  assert.equal(currentBranch(''), null);
  assert.equal(currentBranch(undefined), null);
});
