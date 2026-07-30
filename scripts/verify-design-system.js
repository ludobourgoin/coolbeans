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

/* ── B2 · couche sémantique Coolbeans ──────────────────────────── */
const glob = read('src/styles/global.css');
check('global.css existe', !!glob);
if (glob) {
  check('importe la fondation', /@import\s+["']\.\/geist-tokens\.css["']/.test(glob));
  for (const t of ['--surface', '--surface-subtle', '--surface-raise', '--line', '--line-strong',
                   '--ink', '--mute', '--accent', '--accent-ink', '--accent-hover', '--focus'])
    check('token sémantique ' + t, new RegExp('\\' + t + ':').test(glob));
  check('--surface mappé sur background-100', /--surface:\s*var\(--ds-background-100\)/.test(glob));
  check('--mute mappé sur gray-900', /--mute:\s*var\(--ds-gray-900\)/.test(glob));
  check('bouton primaire ne s\'inverse pas',
    /\.btn:hover\s*\{[^}]*--btn-bg:\s*var\(--accent-hover\)/.test(glob),
    'le survol doit éclaircir, pas inverser');
  check('bordure de bouton en box-shadow',
    /\.btn\s*\{[^}]*border:\s*0/.test(glob) && /box-shadow:\s*0 0 0 1px var\(--btn-ring\)/.test(glob));
  check('transition Geist 150ms', glob.includes('150ms ease-in-out'));
  check('tailles de bouton 32/36/40',
    /height:\s*32px/.test(glob) && /height:\s*36px/.test(glob) && /height:\s*40px/.test(glob));
  check('corps à 16px', /font-size:\s*16px/.test(glob));
  /* l'exigence réelle n'est pas que la chaîne "geomanist-book"/"geomanist-medium"
     soit absente du fichier (un commentaire peut légitimement documenter ce qui
     a été retiré et pourquoi) — c'est qu'aucun @font-face ne charge plus ces
     fichiers. On teste donc l'url() réellement chargée, pas du texte libre. */
  for (const f of ['geomanist-book-webfont', 'geomanist-medium-webfont'])
    check('police ' + f + ' non chargée', !new RegExp('url\\(["\']?[^)]*' + f).test(glob));
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

/* ── E · contrastes (résolus depuis les fichiers réels, pas supposés) ──
   Les cinq paires ci-dessous ne sont plus des hex en dur : on lit
   global.css pour trouver la déclaration `--ink: var(--ds-gray-1000)`,
   puis geist-tokens.css pour résoudre --ds-gray-1000 (:root et .dark).
   Si l'indirection casse à un bout ou l'autre, l'assertion échoue avec
   un message qui dit pourquoi — jamais un pass silencieux. ────────── */
const rgb = h => { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join('');
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); };
const lum = c => { const a = c.map(v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; });
  return .2126 * a[0] + .7152 * a[1] + .0722 * a[2]; };
const ratio = (x, y) => { const a = lum(rgb(x)), b = lum(rgb(y));
  return (Math.max(a, b) + .05) / (Math.min(a, b) + .05); };

/* Extrait le contenu d'un bloc top-level "sélecteur { ... }" par comptage
   d'accolades. Suffisant ici : global.css et geist-tokens.css n'imbriquent
   pas de règles dans leurs blocs :root / .dark de base. */
const extractBlock = (css, selector) => {
  const start = css.indexOf(selector);
  if (start === -1) return null;
  const braceStart = css.indexOf('{', start);
  let depth = 0;
  for (let i = braceStart; i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}') {
      depth--;
      if (depth === 0) return css.slice(braceStart + 1, i);
    }
  }
  return null;
};
const declMap = block => {
  const map = {};
  if (!block) return map;
  for (const m of block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) map[m[1]] = m[2].trim();
  return map;
};
const HEX = /^#[0-9a-fA-F]{3,8}$/;

/* Résout un token sémantique de global.css vers une couleur hex, en suivant
   UNE indirection var(--ds-*) vers geist-tokens.css. Lève si l'indirection
   ne se résout pas (token absent, valeur ni hex ni var(--ds-*), ou --ds-*
   introuvable) : c'est le point de l'exercice, une assertion qui ne peut
   plus échouer ne teste rien. */
function resolveSemanticColor(tokenName, mode, semRoot, semDark, dsRoot, dsDark) {
  const raw = (mode === 'dark' && semDark[tokenName]) || semRoot[tokenName];
  if (!raw) throw new Error(tokenName + ' non déclaré dans global.css (mode ' + mode + ')');
  if (HEX.test(raw)) return raw;
  const m = raw.match(/^var\((--ds-[\w-]+)\)$/);
  if (!m) throw new Error(tokenName + ' = "' + raw + '" — ni hex ni var(--ds-*) : indirection non résolue');
  const dsName = m[1];
  const resolved = (mode === 'dark' && dsDark[dsName]) || dsRoot[dsName];
  if (!resolved) throw new Error(dsName + ' non défini dans geist-tokens.css (mode ' + mode + ')');
  if (!HEX.test(resolved)) throw new Error(dsName + ' = "' + resolved + '" — pas un hex direct (indirection à plus d\'un niveau)');
  return resolved;
}

if (glob && geist) {
  const semRoot = declMap(extractBlock(glob, ':root {'));
  const semDark = declMap(extractBlock(glob, '.dark {'));
  const dsRoot = declMap(extractBlock(geist, ':root {'));
  const dsDark = declMap(extractBlock(geist, '.dark {'));

  try {
    const inkLight = resolveSemanticColor('--ink', 'light', semRoot, semDark, dsRoot, dsDark);
    const inkDark = resolveSemanticColor('--ink', 'dark', semRoot, semDark, dsRoot, dsDark);
    const muteLight = resolveSemanticColor('--mute', 'light', semRoot, semDark, dsRoot, dsDark);
    const muteDark = resolveSemanticColor('--mute', 'dark', semRoot, semDark, dsRoot, dsDark);
    const surfaceLight = resolveSemanticColor('--surface', 'light', semRoot, semDark, dsRoot, dsDark);
    const surfaceDark = resolveSemanticColor('--surface', 'dark', semRoot, semDark, dsRoot, dsDark);
    const surfaceSubtleDark = resolveSemanticColor('--surface-subtle', 'dark', semRoot, semDark, dsRoot, dsDark);

    const PAIRS = [
      ['--ink sur --surface, clair', inkLight, surfaceLight, 15],
      ['--ink sur --surface, sombre', inkDark, surfaceDark, 15],
      ['--mute sur --surface, clair', muteLight, surfaceLight, 7],
      ['--mute sur --surface, sombre', muteDark, surfaceDark, 7],
      ['--mute sur --surface-subtle, sombre', muteDark, surfaceSubtleDark, 7],
    ];
    for (const [name, fg, bg, min] of PAIRS) {
      const r = ratio(fg, bg);
      check('contraste ' + name + ' (' + r.toFixed(2) + ':1)', r >= min, 'attendu ≥ ' + min);
    }
  } catch (e) {
    check('résolution des tokens de contraste', false, e.message);
  }
} else {
  check('résolution des tokens de contraste', false, 'global.css ou geist-tokens.css introuvable');
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
