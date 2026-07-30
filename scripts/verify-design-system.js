#!/usr/bin/env node
/* Harnais d'assertions du design system. Sort en 1 si une règle est violée.
   Remplace les tests unitaires : le projet n'a pas de runner. */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const fail = [];
const ok = [];
const check = (name, cond, detail = '') =>
  (cond ? ok : fail).push(name + (detail && !cond ? ' → ' + detail : ''));

const read = p => fs.existsSync(path.join(ROOT, p)) ? fs.readFileSync(path.join(ROOT, p), 'utf8') : null;
const walk = (dir, acc = []) => {
  const d = path.join(ROOT, dir);
  if (!fs.existsSync(d)) return acc;
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const rel = path.join(dir, e.name);
    if (e.isDirectory()) walk(rel, acc);
    else if (/\.(astro|css|ts)$/.test(e.name)) acc.push(rel);
  }
  return acc;
};

/* ── A · polices présentes ─────────────────────────────────────── */
for (const f of ['public/fonts/Geist-Variable.woff2', 'public/fonts/GeistMono-Variable.woff2'])
  check('police ' + path.basename(f), fs.existsSync(path.join(ROOT, f)));

/* ── B · fondation Geist présente et structurée ────────────────── */
const geist = read('src/styles/geist-tokens.css');
check('geist-tokens.css existe', !!geist);
if (geist) {
  check('bloc :root', /(^|\n):root \{/.test(geist));
  check('bloc .dark', /(^|\n)\.dark \{/.test(geist));
  check('couche @supports lab()', geist.includes('@supports'));
  for (const t of ['--ds-gray-1000', '--ds-background-100', '--ds-background-200',
                   '--ds-blue-700', '--ds-focus-color', '--ds-shadow-border-small'])
    check('token ' + t, geist.includes(t + ':'));
  check('background sombre distinct de la page',
    /\.dark \{[\s\S]*?--ds-background-100: #0a0a0a;[\s\S]*?\n\}/.test(geist),
    'background-100 sombre doit valoir #0a0a0a, pas #000');
}

/* ── C · aucun token mort dans src/ ────────────────────────────── */
const DEAD = ['surface-marque', 'card-frame', 'data-accent', 'bg-texture', 'accent-focus'];
const files = walk('src');
for (const tok of DEAD) {
  const hits = files.filter(f => (read(f) || '').includes(tok));
  check('token mort « ' + tok +' » absent', hits.length === 0, hits.join(', '));
}

/* ── D · tout --ds-* référencé est défini ──────────────────────── */
if (geist) {
  const used = new Set();
  for (const f of files) for (const m of (read(f) || '').matchAll(/var\((--ds-[a-z0-9-]+)/g)) used.add(m[1]);
  const undef = [...used].filter(n => !geist.includes(n + ':'));
  check('tout --ds-* référencé est défini', undef.length === 0, undef.join(', '));
}

/* ── E · contrastes ────────────────────────────────────────────── */
const rgb = h => { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join('');
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); };
const lum = c => { const a = c.map(v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; });
  return .2126 * a[0] + .7152 * a[1] + .0722 * a[2]; };
const ratio = (x, y) => { const a = lum(rgb(x)), b = lum(rgb(y));
  return (Math.max(a, b) + .05) / (Math.min(a, b) + .05); };
const PAIRS = [
  ['ink/surface clair', '#171717', '#ffffff', 15],
  ['mute/surface clair', '#4d4d4d', '#ffffff', 7],
  ['ink/surface sombre', '#ededed', '#0a0a0a', 15],
  ['mute/surface sombre', '#a0a0a0', '#0a0a0a', 7],
  ['mute/subtle sombre', '#a0a0a0', '#000000', 7],
];
for (const [name, fg, bg, min] of PAIRS) {
  const r = ratio(fg, bg);
  check('contraste ' + name + ' (' + r.toFixed(2) + ':1)', r >= min, 'attendu ≥ ' + min);
}

/* ── F · blocs <style> limités aux exceptions ──────────────────── */
const ALLOWED = ['src/components/Flow.astro', 'src/components/LogoMarquee.astro'];
const styled = files.filter(f => f.endsWith('.astro') && (read(f) || '').includes('<style'));
const illegal = styled.filter(f => !ALLOWED.includes(f.split(path.sep).join('/')));
check('blocs <style> limités aux exceptions', illegal.length === 0, illegal.join(', '));

/* ── sortie ────────────────────────────────────────────────────── */
console.log(ok.map(s => '  ok    ' + s).join('\n'));
if (fail.length) {
  console.log('\n' + fail.map(s => '  ÉCHEC ' + s).join('\n'));
  console.log('\n' + fail.length + ' assertion(s) en échec sur ' + (ok.length + fail.length) + '.');
  process.exit(1);
}
console.log('\n' + ok.length + ' assertions, toutes vertes.');
