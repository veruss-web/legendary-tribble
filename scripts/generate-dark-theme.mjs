#!/usr/bin/env node
/**
 * Dark theme generator.
 *
 * app/globals.css is the light design and uses many hard-coded colors, so a dark theme cannot be done with a handful of
 * variables. This script reads globals.css and writes app/dark-theme.generated.css: for every rule that sets a light
 * color it emits the same rule scoped to `.dark` (the class on <html>) with the color mapped to the dark palette.
 *
 *   node scripts/generate-dark-theme.mjs          # (re)generate
 *   node scripts/generate-dark-theme.mjs --check  # exit 1 if the committed file is out of date (used by the tests)
 *
 * Re-run it after every change to globals.css. Hand-written dark tweaks live in app/dark-overrides.css (never edited here).
 * Rules of the mapping (by property type, so a light color is never turned into a light-on-light mismatch):
 *   background*  light neutral  -> dark surface (lighter than white-in-light = "more raised"), tinted pastel -> muted dark tint
  *   color, fill, stroke  dark   -> light text (hue kept); mid and light colors (brand orange, white) stay
 *   border and outline   light    -> dark hairline
 *   box-shadow         only light ring colors are mapped; dark shadows stay
 *   rgba(white, <=.35) overlays stay; rgba(dark, <=.2) hover tints become rgba(white, same alpha); scrims stay dark
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'app/globals.css');
const OUT = join(ROOT, 'app/dark-theme.generated.css');

/* ---------------------------------------------------------------- palette */
export const HUE = 216;           // cool blue-grey, matches the brand's dark navy (#101419)
const SURFACE_L = 0.115;          // what pure white becomes
export const TOKENS = {
  bg: hslHex(HUE, 0.2, 0.058),
  surface: hslHex(HUE, 0.18, SURFACE_L),
  surface2: hslHex(HUE, 0.17, 0.15),
  line: hslHex(HUE, 0.14, 0.17),
  ink: '#eef1f6',
  muted: '#8f98a9',
};

/* ---------------------------------------------------------------- color utils */
function clamp(n, a = 0, b = 1) { return Math.min(b, Math.max(a, n)); }
function hslHex(h, s, l) {
  const { r, g, b } = hslToRgb(h, s, l);
  return '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
}
function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return { h, s, l };
}
function hslToRgb(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0]; else if (h < 120) [r, g, b] = [x, c, 0]; else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c]; else if (h < 300) [r, g, b] = [x, 0, c]; else [r, g, b] = [c, 0, x];
  return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 };
}
function parseColor(tok) {
  const t = tok.trim().toLowerCase();
  if (t === 'white') return { r: 255, g: 255, b: 255, a: 1 };
  if (t === 'black') return { r: 0, g: 0, b: 0, a: 1 };
  let m = t.match(/^#([0-9a-f]{3,8})$/);
  if (m) {
    let h = m[1];
    if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join('');
    if (h.length !== 6 && h.length !== 8) return null;
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), a: h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1 };
  }
  m = t.match(/^rgba?\(\s*([\d.]+)\s*[, ]\s*([\d.]+)\s*[, ]\s*([\d.]+)\s*(?:[,/]\s*([\d.]+%?)\s*)?\)$/);
  if (m) {
    let a = m[4] === undefined ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
    return { r: +m[1], g: +m[2], b: +m[3], a };
  }
  return null; // hsl(), var(), color-mix() ... are left alone
}
function fmt({ r, g, b }, a) {
  const hex = '#' + [r, g, b].map((v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');
  if (a >= 0.999) return hex;
  return `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${+a.toFixed(3)})`;
}

/* ---------------------------------------------------------------- mappings */
/** each returns a new color string, or null to keep the original */
function chroma(c) { return (Math.max(c.r, c.g, c.b) - Math.min(c.r, c.g, c.b)) / 255; }
/** HSL saturation of pastels is misleadingly high, so tints are judged by RGB chroma and kept subtle. */
function darkTint(c, nl, maxChroma) {
  const { h } = rgbToHsl(c.r, c.g, c.b);
  const cd = Math.min(maxChroma, chroma(c) * 1.1 + 0.01);
  return fmt(hslToRgb(h, clamp(cd / (1 - Math.abs(2 * nl - 1)), 0, 0.6), nl), c.a);
}
function mapBg(c) {
  const { l } = rgbToHsl(c.r, c.g, c.b);
  if (c.a < 1 && l >= 0.9 && c.a <= 0.35) return null;                       // white highlight overlay stays
  if (c.a < 1 && l < 0.3) return c.a <= 0.2 ? fmt({ r: 255, g: 255, b: 255 }, c.a) : null; // dark hover tint -> white tint; scrim stays
  if (l < 0.78) return null;
  if (chroma(c) < 0.05) return fmt(hslToRgb(HUE, 0.18, clamp(SURFACE_L + (1 - l) * 1.0, 0.1, 0.34)), c.a);
  return darkTint(c, clamp(0.15 + (1 - l) * 0.45, 0.14, 0.3), 0.2);
}
function mapText(c) {
  const { h, s, l } = rgbToHsl(c.r, c.g, c.b);
  if (l >= 0.5) return null;
  const nl = clamp(0.98 - l * 0.95, 0.5, 0.96);
  return fmt(hslToRgb(s < 0.12 ? HUE : h, s < 0.12 ? 0.14 : s * 0.6, nl), c.a);
}
function mapBorder(c) {
  const { l } = rgbToHsl(c.r, c.g, c.b);
  if (c.a < 1 && l < 0.3) return c.a <= 0.2 ? fmt({ r: 255, g: 255, b: 255 }, c.a) : null; // rgba(17,24,39,.08) hairline
  if (c.a < 1 && l >= 0.9 && c.a <= 0.5) return null;
  if (l < 0.8) return null;
  if (chroma(c) < 0.05) return fmt(hslToRgb(HUE, 0.14, clamp(0.16 + (1 - l) * 0.5, 0.15, 0.3)), c.a);
  return darkTint(c, 0.25, 0.14);
}
function mapShadow(c) {
  const { l, s } = rgbToHsl(c.r, c.g, c.b);
  if (c.a >= 0.999 && l >= 0.8 && s < 0.25) return mapBorder(c); // light ring such as 0 0 0 1px #e8ecf2
  return null;
}

const COLOR_RE = /#[0-9a-fA-F]{8}\b|#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3,4}\b|rgba?\([^)]*\)|\bwhite\b|\bblack\b/g;

function propKind(prop) {
  const p = prop.toLowerCase();
  if (p.startsWith('--')) {
    if (/(shadow|gradient|font|radius|size|width|height|space|gap|ease|duration)/.test(p)) return null;
    if (/(ink|text|muted|fg|foreground)/.test(p)) return 'text';
    if (/(line|border|edge|ring|stroke)/.test(p)) return 'border';
    return 'bg';
  }
  if (p === 'background' || p === 'background-color' || p === 'background-image') return 'bg';
  if (p === 'color' || p === 'fill' || p === 'stroke' || p === '-webkit-text-fill-color' || p === 'text-decoration-color' || p === 'caret-color') return 'text';
  if (p.startsWith('border') || p.startsWith('outline') || p === 'column-rule' || p === 'column-rule-color') return 'border';
  if (p === 'box-shadow') return 'shadow';
  return null;
}
function transformValue(prop, value) {
  const kind = propKind(prop);
  if (!kind) return null;
  const fn = { bg: mapBg, text: mapText, border: mapBorder, shadow: mapShadow }[kind];
  let changed = false;
  const out = value.replace(COLOR_RE, (tok) => {
    const c = parseColor(tok);
    if (!c) return tok;
    const n = fn(c);
    if (n === null) return tok;
    changed = true;
    return n;
  });
  return changed ? out : null;
}

/* ---------------------------------------------------------------- css parsing */
function findBlockEnd(s, open) {
  let depth = 0;
  for (let j = open; j < s.length; j++) {
    const ch = s[j];
    if (ch === '/' && s[j + 1] === '*') { j = s.indexOf('*/', j + 2) + 1; continue; }
    if (ch === '"' || ch === "'") { const q = ch; j++; while (s[j] !== q) { if (s[j] === '\\') j++; j++; } continue; }
    if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) return j; }
  }
  throw new Error('unbalanced CSS');
}
function splitTop(s, sep) {
  const parts = []; let depth = 0, cur = '';
  for (const ch of s) {
    if (ch === '(' || ch === '[') depth++;
    else if (ch === ')' || ch === ']') depth--;
    if (ch === sep && depth === 0) { parts.push(cur); cur = ''; } else cur += ch;
  }
  parts.push(cur);
  return parts;
}
function parseDecls(body) {
  const clean = body.replace(/\/\*[\s\S]*?\*\//g, '');
  return splitTop(clean, ';').map((d) => d.trim()).filter(Boolean).map((d) => {
    const i = d.indexOf(':');
    return i < 0 ? null : { prop: d.slice(0, i).trim(), value: d.slice(i + 1).trim() };
  }).filter(Boolean);
}

// Rules that must look the same in both themes (e.g. the Settings theme previews).
const KEEP_AS_IS = /\.theme-preview\b|\.keep-light\b/;
const PAGE_BG = /^(html|body|\.shell|\.main)$/;
function darkSelector(sel) {
  const s = sel.trim().replace(/\s+/g, ' ');
  if (/\.dark\b/.test(s) || KEEP_AS_IS.test(s)) return null; // already a dark rule / opted out
  if (s === ':root' || s === 'html') return 'html.dark';
  if (/^html[\s.:#[]/.test(s)) return s.replace(/^html/, 'html.dark');
  return `.dark ${s}`;
}

function processBlock(text, stats) {
  const out = [];
  let i = 0;
  while (i < text.length) {
    const ws = /^(\s+|\/\*[\s\S]*?\*\/)/.exec(text.slice(i));
    if (ws) { i += ws[0].length; continue; }
    const open = text.indexOf('{', i);
    if (open < 0) break;
    const end = findBlockEnd(text, open);
    const prelude = text.slice(i, open).replace(/\/\*[\s\S]*?\*\//g, '').trim();
    const body = text.slice(open + 1, end);
    i = end + 1;
    if (prelude.startsWith('@')) {
      const name = prelude.split(/\s/)[0].toLowerCase();
      if (['@media', '@supports', '@container', '@layer'].includes(name)) {
        const inner = processBlock(body, stats);
        if (inner.length) out.push(`${prelude} {\n${inner.join('\n')}\n}`);
      }
      continue; // @keyframes / @font-face are not themed
    }
    const decls = [];
    const parsed = parseDecls(body);
    // gradient text (background-clip: text) is painted by the background: leave its colors alone or the text would vanish
    const gradientText = parsed.some((d) => /background-clip$/i.test(d.prop) && /\btext\b/i.test(d.value));
    for (const d of parsed) {
      if (gradientText && /^background/i.test(d.prop)) continue;
      const important = /\s*!important\s*$/i.test(d.value);
      const raw = d.value.replace(/\s*!important\s*$/i, '');
      const next = transformValue(d.prop, raw);
      if (next !== null) decls.push(`  ${d.prop}: ${next}${important ? ' !important' : ''};`);
    }
    if (!decls.length) continue;
    const selectors = splitTop(prelude, ',').map(darkSelector).filter(Boolean);
    if (!selectors.length) continue;
    // Page background is a token, so overscroll/safe areas match too.
    const isPage = splitTop(prelude, ',').every((x) => PAGE_BG.test(x.trim()));
    const finalDecls = isPage
      ? decls.map((d) => d.replace(/^(\s*background(?:-color)?:)[^;!]*/, '$1 var(--bg)'))
      : decls;
    out.push(`${selectors.join(',\n')} {\n${finalDecls.join('\n')}\n}`);
    stats.rules++;
  }
  return out;
}

/* ---------------------------------------------------------------- output */
export function build(css = readFileSync(SRC, 'utf8')) {
  const stats = { rules: 0 };
  const rules = processBlock(css, stats);
  const header = `/* GENERATED by scripts/generate-dark-theme.mjs from app/globals.css — DO NOT EDIT BY HAND.
 * Re-run \`npm run theme:build\` after changing globals.css. Hand-written tweaks go in app/dark-overrides.css. */\n`;
  const tokens = `html.dark {
  color-scheme: dark;
  --bg: ${TOKENS.bg};
  --surface: ${TOKENS.surface};
  --surface-2: ${TOKENS.surface2};
  --ink: ${TOKENS.ink};
  --muted: ${TOKENS.muted};
  --line: ${TOKENS.line};
  --premium-bg: ${TOKENS.bg};
  --premium-surface: ${TOKENS.surface};
  --premium-ink: ${TOKENS.ink};
  --premium-muted: ${TOKENS.muted};
  --premium-line: ${TOKENS.line};
  --premium-shadow: 0 14px 40px rgba(0,0,0,.45);
  --ref-orange-soft: rgba(255,91,25,.14);
  --ref-line: ${TOKENS.line};
  --ref-text: ${TOKENS.ink};
  --ref-muted: ${TOKENS.muted};
  --topbar-glass: rgba(13,16,21,.72);
  --topbar-edge: rgba(255,255,255,.08);
  --topbar-shadow: 0 10px 30px rgba(0,0,0,.4);
}
`;
  // tokens come last so they win over mapped :root token rules
  return `${header}\n${rules.join('\n\n')}\n\n/* ---- tokens ---- */\n${tokens}`;
}

if (process.argv[1] && process.argv[1].endsWith('generate-dark-theme.mjs')) {
  const next = build();
  if (process.argv.includes('--check')) {
    const current = existsSync(OUT) ? readFileSync(OUT, 'utf8') : '';
    if (current !== next) {
      console.error('app/dark-theme.generated.css is out of date. Run: npm run theme:build');
      process.exit(1);
    }
    console.log('dark theme is up to date');
  } else {
    writeFileSync(OUT, next);
    console.log(`wrote app/dark-theme.generated.css (${next.split('\n').length} lines)`);
  }
}
