import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { load } from './helpers.mjs';
import { build } from '../scripts/generate-dark-theme.mjs';

const { parseThemeMode, resolveTheme } = load('lib/theme');

test('parseThemeMode accepts the three modes and falls back to light', () => {
  assert.equal(parseThemeMode('dark'), 'dark');
  assert.equal(parseThemeMode('system'), 'system');
  assert.equal(parseThemeMode('light'), 'light');
  for (const bad of [null, undefined, '', 'Dark', 'blue', 1, {}]) assert.equal(parseThemeMode(bad), 'light');
});

test('resolveTheme follows the system only in system mode', () => {
  assert.equal(resolveTheme('light', true), 'light');
  assert.equal(resolveTheme('dark', false), 'dark');
  assert.equal(resolveTheme('system', true), 'dark');
  assert.equal(resolveTheme('system', false), 'light');
});

const gen = (css) => build(css).split('/* ---- tokens ---- */')[0];

test('dark generator: light backgrounds become dark, text becomes light, brand colors stay', () => {
  const out = gen('.card { background: #fff; color: #1c2330; border: 1px solid #e8ecf2; } .cta { background: #ff5a2c; color: #fff; }');
  assert.match(out, /\.dark \.card \{[^}]*background: #[0-9a-f]{6}/);
  const bg = out.match(/background: (#[0-9a-f]{6})/)[1];
  const lum = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).reduce((a, b) => a + b, 0) / 3;
  assert.ok(lum(bg) < 60, `background should be dark, got ${bg}`);
  const text = out.match(/color: (#[0-9a-f]{6})/)[1];
  assert.ok(lum(text) > 170, `text should be light, got ${text}`);
  assert.ok(!/\.dark \.cta/.test(out), 'orange button with white text needs no dark rule');
});

test('dark generator: keeps !important, media queries, and skips opted-out and already-dark rules', () => {
  const out = gen('@media (max-width: 700px) { .a { background: #f6f7fb !important; } } .theme-preview .x { background: #fff; } .dark .y { background: #fff; }');
  assert.match(out, /@media \(max-width: 700px\) \{\n\.dark \.a \{\n  background: #[0-9a-f]{6} !important;/);
  assert.ok(!out.includes('theme-preview'));
  assert.ok(!out.includes('.dark .dark'));
});

test('dark generator: page background uses the --bg token; hover tints and scrims are handled', () => {
  const out = gen('.main { background: #f6f7fb; } .row:hover { background: rgba(16,24,40,.04); } .scrim { background: rgba(10,14,22,.5); }');
  assert.match(out, /\.dark \.main \{\n  background: var\(--bg\);/);
  assert.match(out, /rgba\(255,255,255,0\.04\)/);
  assert.ok(!/\.dark \.scrim/.test(out), 'dark scrim must stay dark');
});

test('app/dark-theme.generated.css is up to date with app/globals.css (run: npm run theme:build)', () => {
  const committed = readFileSync(new URL('../app/dark-theme.generated.css', import.meta.url), 'utf8');
  assert.equal(committed, build());
});

test('dark generator: gradient text (background-clip: text) keeps its gradient', () => {
  const out = gen('.title { background: linear-gradient(180deg,#fff,#c9d0dc); -webkit-background-clip: text; color: transparent; }');
  assert.ok(!out.includes('.dark .title'), 'a light gradient clipped to text must not be turned dark');
});
