# Design system Geist monochrome — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer le design system cream/Geomanist de Coolbeans par un système monochrome bâti sur les tokens Geist de Vercel, en gardant Geomanist sur les h1/h2 comme signature.

**Architecture:** Deux couches CSS. `src/styles/geist-tokens.css` est une fondation *vendored* — les 10 échelles Geist, extraites de la feuille compilée de vercel.com, jamais éditées à la main. `src/styles/global.css` est la couche Coolbeans : elle mappe des noms sémantiques (`--surface`, `--ink`, `--accent`) sur les `--ds-*` et définit les primitives. Les `--ds-*` basculant seuls avec `.dark`, la couche Coolbeans n'a presque rien à redéclarer en sombre. Les composants Astro consomment les utilitaires Tailwind branchés sur ces tokens.

**Tech Stack:** Astro 7, Tailwind v4 (CSS-first, `@theme inline`), Node 22, polices variables woff2 self-hébergées, Cloudflare Pages.

## Global Constraints

- Spec de référence : `docs/superpowers/specs/2026-07-30-design-system-geist-design.md`. En cas de contradiction, la spec fait foi.
- Branche de travail : `staging`. **Aucune publication en production** sans ordre explicite.
- Aucune suppression ni renommage de fichier. `public/img/bg-texture.png` et les woff2 Geomanist inutilisés restent sur le disque.
- Aucune dépendance ajoutée à `package.json`. Les polices Geist sont vendored.
- `src/components/Flow.astro` garde son bloc `<style>` (exception GSAP actée). `LogoMarquee.astro` garde un `<style>` réduit au seul `@keyframes`.
- Convention CSS du projet : utilitaires Tailwind branchés sur les tokens ; `<style>` réservé à l'irréductible.
- Contrastes minimaux à tenir : `--ink`/`--surface` ≥ 15:1, `--mute`/`--surface` ≥ 7:1, en clair **et** en sombre.
- Transition des composants interactifs : `150ms ease-in-out`, coupée au focus.
- Toutes les valeurs Geist proviennent de l'extraction, jamais de mémoire.

---

## File Structure

| Fichier | Responsabilité |
|---|---|
| `scripts/extract-geist-tokens.js` | Régénère la fondation depuis vercel.com. Lancé à la main, quand Geist bouge. |
| `scripts/verify-design-system.js` | Harnais d'assertions. Remplace les tests unitaires absents. |
| `src/styles/geist-tokens.css` | Fondation vendored : 10 échelles, ombres, tailles, focus. Jamais éditée à la main. |
| `src/styles/global.css` | Couche Coolbeans : mapping sémantique, base, primitives, materials. |
| `src/components/GridBackdrop.astro` | Grille pointillée décorative des hero. |
| `src/components/Browser.astro` | Cadre de navigateur pour le portfolio. |
| `src/components/ui/Badge.astro` … | Bibliothèque, un fichier par composant. |
| `src/data/cases.ts` | Études de cas, extraites de `index.astro`. |

---

## Task 1: Fondation — polices, tokens Geist, harnais de vérification

**Files:**
- Create: `public/fonts/Geist-Variable.woff2`, `public/fonts/GeistMono-Variable.woff2`
- Create: `scripts/extract-geist-tokens.js`
- Create: `src/styles/geist-tokens.css`
- Create: `scripts/verify-design-system.js`
- Create: `scripts/package.json` — `{"type": "commonjs"}`, cf. étape 2

**Interfaces:**
- Consumes: rien.
- Produces: les custom properties `--ds-*` sous `:root` et `.dark` ; la commande `node scripts/verify-design-system.js` qui sort en code 1 si une assertion échoue.

- [ ] **Step 1: Écrire le harnais de vérification qui échoue**

Créer `scripts/verify-design-system.js` :

```js
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
```

- [ ] **Step 2: Lancer le harnais pour le voir échouer**

Run: `node scripts/verify-design-system.js`
Expected: FAIL, **9 assertions rouges sur 14**. Détail : les deux polices absentes, `geist-tokens.css` absent, et les cinq tokens morts (`surface-marque`, `card-frame`, `data-accent`, `bg-texture`, `accent-focus`) encore présents dans `src/`, plus les blocs `<style>` hors liste blanche.

Les sous-assertions B ne comptent pas encore : elles sont gardées par `if (geist)` et ne s'exécutent pas tant que le fichier n'existe pas. C'est normal.

> Le projet est en `"type": "module"` alors que ces deux scripts sont en CommonJS.
> Créer `scripts/package.json` contenant `{"type": "commonjs"}` — mécanisme Node
> documenté qui limite la portée au dossier, sans toucher au `package.json` racine.
> Sans lui, les scripts plantent avant de produire la moindre assertion.

- [ ] **Step 3: Installer les polices Geist**

```bash
cd /tmp && npm pack geist@1.7.2 --silent >/dev/null
tar -xzf geist-1.7.2.tgz package/dist/fonts/geist-sans/Geist-Variable.woff2 \
                          package/dist/fonts/geist-mono/GeistMono-Variable.woff2
cp package/dist/fonts/geist-sans/Geist-Variable.woff2 \
   package/dist/fonts/geist-mono/GeistMono-Variable.woff2 \
   ~/dev/coolbeans/public/fonts/
rm -rf /tmp/package /tmp/geist-1.7.2.tgz
```

Vérifier : `ls -la public/fonts/` doit montrer `Geist-Variable.woff2` (~68 Ko) et `GeistMono-Variable.woff2` (~70 Ko).

- [ ] **Step 4: Écrire le script d'extraction**

Créer `scripts/extract-geist-tokens.js`. Il télécharge `https://vercel.com/geist/button`, en tire les feuilles CSS liées, les concatène, puis parse les blocs porteurs de `--ds-*`.

Trois règles non négociables, chacune trouvée à la dure :

1. **Parseur conscient de l'imbrication.** Les valeurs `lab()` / `oklch()` vivent dans des `@supports`. Un regex plat les mélange aux valeurs hex.
2. **Deux passes.** Un bloc partagé (`:root,:host,.dark,…`) porte les tokens agnostiques et sert de socle ; un bloc spécifique à un thème doit toujours l'emporter, quel que soit son rang. Sinon le socle écrase les valeurs de thème.
3. **Résolution des indirections.** Le thème sombre passe par `hsla(var(--ds-x-value), 1)` où `--ds-x-value` est un triplet HSL. Sans résolution, on récupère des `var()` non résolubles.

```js
#!/usr/bin/env node
/* Extrait les tokens Geist (--ds-*) de la feuille compilée de vercel.com.
   Écrit src/styles/geist-tokens.css. À relancer quand Geist bouge. */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const UA = { 'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36' };

(async () => {
  const page = await (await fetch('https://vercel.com/geist/button', { headers: UA })).text();
  const hrefs = [...new Set([...page.matchAll(/href="([^"]*\.css[^"]*)"/g)].map(m => m[1]))];
  let css = '';
  for (const h of hrefs) css += await (await fetch('https://vercel.com' + h, { headers: UA })).text() + '\n';

  /* parseur conscient de l'imbrication */
  const rules = [];
  (function walk(src, at) {
    let i = 0, depth = 0, start = 0, prelude = '';
    while (i < src.length) {
      const c = src[i];
      if (c === '{') { if (depth === 0) { prelude = src.slice(start, i).trim(); start = i + 1; } depth++; }
      else if (c === '}') {
        depth--;
        if (depth === 0) {
          const body = src.slice(start, i);
          if (prelude.startsWith('@')) { if (/^@(supports|media|layer)/.test(prelude)) walk(body, at ? at + ' && ' + prelude : prelude); }
          else rules.push({ at: at || '', sel: prelude, decls: body });
          start = i + 1;
        }
      }
      i++;
    }
  })(css, '');

  const isLight = s => /(^|,)\s*(:root|:host|\.light-theme)\s*(,|$)/.test(s);
  const isDark  = s => /(^|,)\s*\.dark(-theme)?\s*(,|$)/.test(s);
  const isWide  = at => /lab\(|display-p3|oklch/i.test(at);
  const out = { light: {}, dark: {}, lightWide: {}, darkWide: {} };

  for (const pass of ['shared', 'specific'])
    for (const { at, sel, decls } of rules) {
      const L = isLight(sel), D = isDark(sel);
      if (!L && !D) continue;
      if ((pass === 'shared') !== (L && D)) continue;
      const wide = isWide(at), targets = [];
      if (D) targets.push(wide ? 'darkWide' : 'dark');
      if (L) targets.push(wide ? 'lightWide' : 'light');
      for (const m of decls.matchAll(/(--ds-[a-z0-9-]+)\s*:\s*([^;]+)/g))
        for (const t of targets) out[t][m[1]] = m[2].trim();
    }

  const hsl2hex = (h, s, l) => {
    s /= 100; l /= 100;
    const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
    const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    const to = v => Math.round(255 * v).toString(16).padStart(2, '0');
    return '#' + to(f(0)) + to(f(8)) + to(f(4));
  };
  const resolve = obj => {
    const res = {};
    for (const [name, raw] of Object.entries(obj)) {
      if (/-value$/.test(name)) continue;
      let v = raw;
      const ind = v.match(/^hsla?\(\s*var\((--ds-[a-z0-9-]+-value)\)\s*(?:,\s*([\d.]+)\s*)?\)$/);
      if (ind) {
        const triplet = obj[ind[1]];
        if (!triplet) continue;
        const n = triplet.match(/-?[\d.]+/g);
        if (!n || n.length < 3) continue;
        const hex = hsl2hex(+n[0], +n[1], +n[2]);
        const alpha = ind[2] !== undefined ? +ind[2] : 1;
        v = alpha === 1 ? hex : hex + Math.round(alpha * 255).toString(16).padStart(2, '0');
      }
      res[name] = v;
    }
    return res;
  };
  for (const k of Object.keys(out)) out[k] = resolve(out[k]);

  /* arbitrage documenté : la feuille de Vercel aplatit les deux fonds sombres
     à #000 dans la couche lab(), ce qui rend la paire inutilisable pour
     alterner des sections. On garde le système HSL (4% / 0%). */
  for (const k of ['dark', 'darkWide'])
    for (const [n, v] of Object.entries({ '--ds-background-100': '#0a0a0a', '--ds-background-200': '#000000' }))
      if (out[k][n] !== undefined) out[k][n] = v;

  const FAMS = ['background', 'gray', 'gray-alpha', 'blue', 'red', 'amber', 'green', 'teal', 'purple', 'pink'];
  const famOf = n => (n.match(/^--ds-([a-z]+(?:-alpha)?)-\d+$/) || [, 'divers'])[1];
  const emit = (obj, ind) => {
    const names = Object.keys(obj).sort((a, b) => {
      const fa = FAMS.indexOf(famOf(a)), fb = FAMS.indexOf(famOf(b));
      const sa = +(a.match(/-(\d+)$/) || [, 0])[1], sb = +(b.match(/-(\d+)$/) || [, 0])[1];
      return (fa < 0 ? 99 : fa) - (fb < 0 ? 99 : fb) || sa - sb || a.localeCompare(b);
    });
    let last = null, s = '';
    for (const n of names) {
      const f = famOf(n);
      if (f !== last) { s += (last ? '\n' : '') + ind + '/* ' + f + ' */\n'; last = f; }
      s += ind + n + ': ' + obj[n] + ';\n';
    }
    return s;
  };

  const stamp = new Date().toISOString().slice(0, 10);
  const file = `/* ============================================================================
   GEIST — tokens extraits de la feuille compilée de vercel.com
   Source : https://vercel.com/geist/colors  ·  capture ${stamp}
   NE PAS ÉDITER À LA MAIN. Régénérer : node scripts/extract-geist-tokens.js
   Base en hex sRGB ; lab()/oklch() derrière @supports pour le grand gamut.
   Thème piloté par la classe .dark sur <html>.
   ========================================================================== */

:root {
${emit(out.light, '  ')}}

.dark {
${emit(out.dark, '  ')}}

@supports (color: lab(0% 0 0)) {
  :root {
${emit(out.lightWide, '    ')}  }

  .dark {
${emit(out.darkWide, '    ')}  }
}
`;
  fs.writeFileSync(path.join(ROOT, 'src/styles/geist-tokens.css'), file);
  console.log('écrit : src/styles/geist-tokens.css — ' + (file.length / 1024).toFixed(1) + ' Ko');
})();
```

- [ ] **Step 5: Générer la fondation**

Run: `node scripts/extract-geist-tokens.js`
Expected: `écrit : src/styles/geist-tokens.css — ~20 Ko`

Contrôle manuel : `grep -c -- '--ds-' src/styles/geist-tokens.css` doit dépasser 400.

- [ ] **Step 6: Relancer le harnais**

Run: `node scripts/verify-design-system.js`
Expected: les assertions A et B passent. C échoue encore (tokens morts toujours dans `src/`), D peut échouer, E passe, F échoue (7 blocs `<style>`). C'est normal — ces assertions se résolvent aux tâches suivantes.

- [ ] **Step 7: Commit**

```bash
git add public/fonts/Geist-Variable.woff2 public/fonts/GeistMono-Variable.woff2 \
        scripts/extract-geist-tokens.js scripts/verify-design-system.js \
        src/styles/geist-tokens.css
git commit -m "feat(design): fondation Geist — polices variables et tokens extraits

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Couche Coolbeans — réécriture de `global.css`

**Files:**
- Modify: `src/styles/global.css` (réécriture complète)

**Interfaces:**
- Consumes: les `--ds-*` de la tâche 1.
- Produces: les tokens sémantiques `--surface`, `--surface-subtle`, `--surface-raise`, `--line`, `--line-strong`, `--ink`, `--mute`, `--accent`, `--accent-ink`, `--accent-hover`, `--focus`, `--info`, `--success`, `--warning`, `--error` ; l'échelle `--space-*` ; les utilitaires Tailwind `bg-surface`, `bg-surface-subtle`, `bg-surface-raise`, `text-ink`, `text-mute`, `border-line`, `bg-accent`, `font-sans`, `font-display`, `font-mono`, `rounded-control`, `rounded-card`, `max-w-site` ; les classes `.container-site`, `.btn` (+ `.btn-outline`, `.btn-ghost`, `.btn-sm`, `.btn-lg`), `.card`, `.field`, `.label`, `.link`, `.material-*`.

- [ ] **Step 1: Ajouter les assertions de la couche sémantique au harnais**

Dans `scripts/verify-design-system.js`, insérer avant le bloc `/* ── C · aucun token mort */` :

```js
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
  /* l'exigence est qu'aucun fichier Book/Medium ne soit chargé — pas que leur
     nom soit tabou. Le commentaire d'en-tête les cite légitimement pour
     documenter ce qui a été retiré : tester la chaîne libre interdirait de
     documenter la suppression. */
  for (const f of ['geomanist-book-webfont', 'geomanist-medium-webfont'])
    check('police ' + f + ' non chargée', !new RegExp('url\\(["\']?[^)]*' + f).test(glob));
}
```

- [ ] **Step 2: Lancer le harnais pour voir les nouvelles assertions échouer**

Run: `node scripts/verify-design-system.js`
Expected: FAIL sur « importe la fondation », « --surface mappé sur background-100 », « bouton primaire ne s'inverse pas », « geomanist-book non déclaré », etc.

- [ ] **Step 3: Réécrire `src/styles/global.css`**

Remplacer intégralement le contenu par :

```css
/* ============================================================================
   COOLBEANS — Design system (source de vérité unique)
   Couche sémantique posée sur la fondation Geist. Astro + Tailwind v4.
   Importer une seule fois dans le layout racine :
       import "../styles/global.css";
   Signature : Geomanist tient les h1/h2, Geist prend tout le reste.
   Dark mode : classe .dark sur <html>.
   ========================================================================== */

@import "tailwindcss";
@import "./geist-tokens.css";

@custom-variant dark (&:where(.dark, .dark *));

/* ----------------------------------------------------------------------------
   POLICES
   Geist Sans/Mono : variables, extraites de geist@1.7.2, self-hébergées.
   Geomanist : bold et black seulement — le corps et h3-h5 passent à Geist,
   donc geomanist-book et geomanist-medium ne sont plus chargés.
   -------------------------------------------------------------------------- */
@font-face {
  font-family: "Geist Sans";
  src: url("/fonts/Geist-Variable.woff2") format("woff2");
  font-weight: 100 900;
  font-display: swap;
}
@font-face {
  font-family: "Geist Mono";
  src: url("/fonts/GeistMono-Variable.woff2") format("woff2");
  font-weight: 100 900;
  font-display: swap;
}
@font-face {
  font-family: "Geomanist";
  src: url("/fonts/geomanist-bold-webfont.woff2") format("woff2");
  font-weight: 700;
  font-display: swap;
}
@font-face {
  font-family: "Geomanist";
  src: url("/fonts/geomanist-black-webfont.woff2") format("woff2");
  font-weight: 800;
  font-display: swap;
}

/* ----------------------------------------------------------------------------
   COUCHE SÉMANTIQUE
   Les --ds-* basculent seuls avec .dark : presque rien à redéclarer en sombre.
   Attention au sens du retrait : en clair la section alternée est plus CLAIRE
   que le contenu, en sombre elle est plus NOIRE. C'est la logique de Geist.
   -------------------------------------------------------------------------- */
:root {
  --surface: var(--ds-background-100);
  --surface-subtle: var(--ds-background-200);
  --surface-raise: var(--ds-gray-100);

  --line: var(--ds-gray-400);
  --line-strong: var(--ds-gray-500);

  --ink: var(--ds-gray-1000);
  --mute: var(--ds-gray-900);

  --accent: var(--ds-gray-1000);
  --accent-ink: var(--ds-background-100);
  --accent-hover: hsl(0 0% 22%);
  --focus: var(--ds-focus-color);

  /* états — seule couleur du système, réservée au fonctionnel.
     Jamais en fond de section, jamais en CTA. */
  --info: var(--ds-blue-700);
  --success: var(--ds-green-800);
  --warning: var(--ds-amber-800);
  --error: var(--ds-red-800);

  --radius-control: 6px;
  --radius-card: 8px;

  --space-2x: 8px;
  --space-3x: 12px;
  --space-4x: 16px;
  --space-6x: 24px;
  --space-8x: 32px;
  --space-10x: 40px;
  --space-16x: 64px;
  --space-24x: 96px;
  --space-32x: 128px;

  --container: 1280px;
  --gutter: 24px;

  --ease: cubic-bezier(0.2, 0.7, 0.2, 1);
  --dur: 0.15s;
}

/* le primaire s'éclaircit en clair, s'assombrit en sombre :
   dans les deux cas il se rapproche du fond au lieu de basculer dedans. */
.dark {
  --accent-hover: hsl(0 0% 80%);
}

@media (max-width: 1100px) {
  :root {
    --gutter: 16px;
  }
}

/* ----------------------------------------------------------------------------
   EXPOSITION AUX UTILITAIRES TAILWIND
   `inline` = Tailwind référence la variable, pas sa valeur figée.
   -------------------------------------------------------------------------- */
@theme inline {
  --color-surface: var(--surface);
  --color-surface-subtle: var(--surface-subtle);
  --color-surface-raise: var(--surface-raise);
  --color-line: var(--line);
  --color-line-strong: var(--line-strong);
  --color-ink: var(--ink);
  --color-mute: var(--mute);
  --color-accent: var(--accent);
  --color-accent-ink: var(--accent-ink);
  --color-info: var(--info);
  --color-success: var(--success);
  --color-warning: var(--warning);
  --color-error: var(--error);

  /* vignette toujours claire : les favicons des logos partenaires sont des
     marques encre sur fond transparent, invisibles sur surface sombre. */
  --color-tile: #fbfaf7;

  --font-sans: "Geist Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-display: "Geomanist", "Helvetica Neue", Arial, sans-serif;
  --font-mono: "Geist Mono", ui-monospace, SFMono-Regular, Menlo, monospace;

  --radius-control: 6px;
  --radius-card: 8px;
  --max-width-site: 1280px;
  --ease-brand: cubic-bezier(0.2, 0.7, 0.2, 1);

  --spacing-2x: 8px;
  --spacing-3x: 12px;
  --spacing-4x: 16px;
  --spacing-6x: 24px;
  --spacing-8x: 32px;
  --spacing-10x: 40px;
  --spacing-16x: 64px;
  --spacing-24x: 96px;
  --spacing-32x: 128px;
}

/* ----------------------------------------------------------------------------
   BASE
   -------------------------------------------------------------------------- */
@layer base {
  html {
    background: var(--surface);
    -webkit-text-size-adjust: 100%;
    scroll-behavior: smooth;
  }
  @media (prefers-reduced-motion: reduce) {
    html {
      scroll-behavior: auto;
    }
  }
  body {
    background: var(--surface);
    color: var(--ink);
    font-family: var(--font-sans);
    font-weight: 400;
    font-size: 16px;
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
    text-rendering: optimizeLegibility;
  }

  /* la signature : Geomanist sur h1/h2, Geist sur le reste */
  h1,
  h2 {
    font-family: var(--font-display);
    font-weight: 700;
    letter-spacing: -0.03em;
    line-height: 1.05;
    text-wrap: balance;
  }
  h3,
  h4,
  h5 {
    font-family: var(--font-sans);
    font-weight: 600;
    letter-spacing: -0.02em;
    line-height: 1.15;
    text-wrap: balance;
  }
  h1 {
    font-size: clamp(44px, 5vw, 72px);
  }
  h2 {
    font-size: clamp(28px, 3.2vw, 44px);
  }
  h3 {
    font-size: clamp(20px, 2vw, 26px);
  }
  h4 {
    font-size: 19px;
  }
  h5 {
    font-size: 16px;
  }

  a {
    color: inherit;
    text-decoration: none;
  }
  button {
    font: inherit;
    color: inherit;
    background: none;
    border: none;
    cursor: pointer;
  }
  hr {
    border: none;
    border-top: 1px solid var(--line);
    margin: 0;
  }
  ::selection {
    background: var(--ink);
    color: var(--surface);
  }

  a:focus-visible,
  button:focus-visible,
  input:focus-visible,
  textarea:focus-visible,
  select:focus-visible,
  [tabindex]:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
    border-radius: var(--radius-control);
  }
}

/* ----------------------------------------------------------------------------
   MATERIALS — l'élévation Geist.
   Pas du verre dépoli : aucun backdrop-filter. Une pile d'ombres dont un
   anneau de 1px qui remplace la bordure.
   -------------------------------------------------------------------------- */
@layer components {
  .material-base {
    box-shadow: var(--ds-shadow-border-base);
  }
  .material-small {
    box-shadow: var(--ds-shadow-border-small);
  }
  .material-medium {
    box-shadow: var(--ds-shadow-border-medium);
  }
  .material-large {
    box-shadow: var(--ds-shadow-border-large);
  }
  .material-tooltip {
    box-shadow: var(--ds-shadow-tooltip);
  }
  .material-menu {
    box-shadow: var(--ds-shadow-menu);
  }
  .material-modal {
    box-shadow: var(--ds-shadow-modal);
  }

  /* conteneur de page */
  .container-site {
    width: 100%;
    max-width: var(--container);
    margin-inline: auto;
    padding-inline: var(--gutter);
  }

  /* ── BOUTON — spec Geist stricte (vercel.com/geist/button) ──────────────
     · la bordure est un box-shadow 1px, pas un border : elle ne participe
       pas au calcul de taille
     · transition 150ms ease-in-out, coupée au focus
     · aucun transform au survol ni au clic
     ------------------------------------------------------------------- */
  .btn {
    --btn-bg: var(--accent);
    --btn-fg: var(--accent-ink);
    --btn-ring: transparent;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5em;
    font-family: var(--font-sans);
    font-weight: 500;
    line-height: 1;
    height: 36px;
    padding-inline: 10px;
    font-size: 14px;
    border: 0;
    border-radius: var(--radius-control);
    cursor: pointer;
    background: var(--btn-bg);
    color: var(--btn-fg);
    box-shadow: 0 0 0 1px var(--btn-ring);
    transition:
      background 150ms ease-in-out,
      color 150ms ease-in-out,
      box-shadow 150ms ease-in-out;
  }
  .btn:hover {
    --btn-bg: var(--accent-hover);
    --btn-ring: var(--accent-hover);
  }

  .btn-outline {
    --btn-bg: var(--surface);
    --btn-fg: var(--ink);
    --btn-ring: var(--ds-gray-400);
  }
  .btn-outline:hover {
    --btn-bg: var(--ds-gray-100);
    --btn-ring: var(--ds-gray-200);
  }
  .dark .btn-outline:hover {
    --btn-bg: var(--ds-gray-200);
  }

  .btn-ghost {
    --btn-bg: transparent;
    --btn-fg: var(--ink);
    --btn-ring: transparent;
  }
  .btn-ghost:hover {
    --btn-bg: var(--ds-gray-alpha-200);
    --btn-ring: var(--ds-gray-alpha-200);
  }

  .btn-sm {
    height: 32px;
    padding-inline: 6px;
    font-size: 14px;
    border-radius: 6px;
  }
  .btn-lg {
    height: 40px;
    padding-inline: 14px;
    font-size: 16px;
    border-radius: 8px;
  }

  .btn:disabled {
    --btn-bg: var(--ds-gray-100);
    --btn-fg: var(--ds-gray-700);
    --btn-ring: var(--ds-gray-400);
    cursor: not-allowed;
  }

  .btn:focus-visible {
    outline: none;
    transition: none;
    box-shadow:
      0 0 0 1px var(--btn-ring),
      0 0 0 2px var(--surface),
      0 0 0 4px var(--focus);
  }

  .card {
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--radius-card);
    padding: var(--space-6x);
  }

  .field {
    width: 100%;
    height: 40px;
    background: var(--surface);
    color: var(--ink);
    border: 1px solid var(--ds-gray-400);
    border-radius: var(--radius-control);
    padding-inline: 14px;
    font: inherit;
    font-size: 15px;
    transition:
      border-color 150ms ease-in-out,
      box-shadow 150ms ease-in-out;
  }
  .field::placeholder {
    color: var(--mute);
  }
  .field:focus {
    outline: none;
    border-color: var(--accent);
    box-shadow:
      0 0 0 2px var(--surface),
      0 0 0 4px var(--focus);
  }

  .link {
    color: var(--accent);
    border-bottom: 1px solid var(--line-strong);
    transition: border-color 150ms ease-in-out;
  }
  .link:hover {
    border-color: var(--accent);
  }

  .label {
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--mute);
  }
}
```

- [ ] **Step 4: Relancer le harnais**

Run: `node scripts/verify-design-system.js`
Expected: toutes les assertions A, B, B2 et E passent. C et D échouent encore (les pages référencent toujours `surface-marque`, `card-frame`, `bg-texture`). F échoue (7 blocs `<style>`).

- [ ] **Step 5: Vérifier que le build passe**

Run: `npm run build`
Expected: build réussi. Les pages seront cassées visuellement (elles utilisent des tokens supprimés) — c'est attendu, la tâche 8 les répare.

- [ ] **Step 6: Commit**

```bash
git add src/styles/global.css scripts/verify-design-system.js
git commit -m "feat(design): couche semantique Coolbeans sur tokens Geist

Bouton aux specs Geist strictes : bordure en box-shadow, survol qui
eclaircit au lieu d'inverser, tailles 32/36/40.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: GridBackdrop

**Files:**
- Create: `src/utils/gridIdCounter.js`
- Create: `src/components/GridBackdrop.astro`

**Interfaces:**
- Consumes: `--line-strong` de la tâche 2.
- Produces: `<GridBackdrop />`, accepte les props `size` (nombre, défaut 64) et `class` (string, défaut `""`) ; et `getGridId(): string` depuis `src/utils/gridIdCounter.js`.

> Le reste de `src/` utilise `.ts` pour les modules hors composants (`src/data/*.ts`).
> Ce fichier est en `.js` — incohérence de convention relevée en revue, différée au
> passage final.

- [ ] **Step 1: Créer le compteur d'identifiants**

Le frontmatter d'un `.astro` est compilé en corps de fonction de rendu : une variable
qui y est déclarée est réinitialisée **à chaque instance**. Il faut donc un vrai module
ES, dont l'instance est unique par processus de build.

Sans ça, deux `<GridBackdrop />` sur une même page peuvent porter le même identifiant,
et la résolution des références SVG retient le **premier** `<pattern>` du DOM : la
seconde instance afficherait la grille de la première, avec la mauvaise valeur de `size`.

```js
/* Compteur à portée module : une seule instance par processus de build,
   donc des identifiants uniques sur toute la sortie.
   Portée build et non page — garantie plus forte que nécessaire. Les
   numéros dépendent en revanche de l'ordre de rendu des pages, donc ils
   peuvent se décaler si l'on ajoute une page en amont. L'unicité, elle,
   tient dans tous les cas. */
let counter = 0;

export function getGridId() {
  return `grid-${++counter}`;
}
```

- [ ] **Step 2: Créer le composant**

```astro
---
/* Grille pointillée décorative des hero. Le SVG utilise currentColor,
   donc la couleur suit le token via `color` — pas de valeur figée. */
import { getGridId } from "../utils/gridIdCounter";

interface Props {
  size?: number;
  class?: string;
}
const { size = 64, class: className = "" } = Astro.props;
const id = getGridId();
---

<div
  class:list={["pointer-events-none absolute inset-0", className]}
  style="color: var(--line-strong);
         -webkit-mask-image: radial-gradient(ellipse 75% 65% at 50% 45%, #000 25%, transparent 72%);
         mask-image: radial-gradient(ellipse 75% 65% at 50% 45%, #000 25%, transparent 72%);"
  aria-hidden="true"
>
  <svg class="block h-full w-full">
    <defs>
      <pattern id={id} width={size} height={size} patternUnits="userSpaceOnUse">
        <path
          d={`M${size} 0H0V${size}`}
          fill="none"
          stroke="currentColor"
          stroke-width="1"
          stroke-dasharray="4 5"
        />
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill={`url(#${id})`} />
  </svg>
</div>
```

- [ ] **Step 3: Vérifier le build**

Run: `npm run build`
Expected: build réussi, aucune erreur Astro.

- [ ] **Step 4: Commit**

```bash
git add src/utils/gridIdCounter.js src/components/GridBackdrop.astro
git commit -m "feat(design): composant GridBackdrop

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Browser et données des études de cas

**Files:**
- Create: `src/data/cases.ts`
- Create: `src/components/Browser.astro`
- Modify: `src/pages/index.astro` — retirer la constante `cases` locale, importer depuis `src/data/cases.ts`

**Interfaces:**
- Consumes: `--ds-background-100`, `--ds-background-200`, `--ds-gray-400`, `--ds-gray-1000`, `--ds-gray-700`, `.material-small`.
- Produces:
  - `src/data/cases.ts` exporte `export interface Case { num: string; tag: string; title: string; span: string; url?: string; shot?: string }` et `export const cases: Case[]`.
  - `<Browser url?={string} shot?={string} alt?={string} label?={string} />`. Sans `shot`, affiche un état vide portant `label`.

- [ ] **Step 1: Créer `src/data/cases.ts`**

Les quatre entrées sont reprises mot pour mot de `src/pages/index.astro`. `url` et `shot` sont optionnels : aucune URL n'est inventée, la seule vérifiable depuis le repo est `trigger.fr`.

```ts
export interface Case {
  num: string;
  tag: string;
  title: string;
  /** classe de placement dans la grille : "span-8", "span-4 tall", … */
  span: string;
  /** domaine affiché dans la barre d'adresse. Absent = « domaine à confirmer ». */
  url?: string;
  /** chemin de la capture sous /public. Absent = état vide. */
  shot?: string;
}

export const cases: Case[] = [
  {
    span: "span-8",
    num: "№ 040",
    tag: "amusoire : homepage",
    title: "refonte du site d'un acteur parisien de l'entertain tech",
  },
  {
    span: "span-4 tall",
    num: "№ 039",
    tag: "littlebox : produit",
    title: "boutique en ligne d'une marque lifestyle",
  },
  {
    span: "span-6",
    num: "№ 038",
    tag: "unlockbreath : landing",
    title: "plateforme d'une startup santé & bien-être",
  },
  {
    span: "span-6",
    num: "№ 037",
    tag: "tielle & popcorn : ciné-club",
    title: "site d'un ciné-club associatif",
  },
];
```

- [ ] **Step 2: Créer `src/components/Browser.astro`**

Le rayon suit la largeur du conteneur (`container-type: inline-size` + `1.5cqw`). C'est ce qui garde le cadre juste quelle que soit la colonne. Les pastilles gardent les vraies couleurs macOS : trois points gris ne se lisent plus comme un navigateur.

```astro
---
interface Props {
  url?: string;
  shot?: string;
  alt?: string;
  label?: string;
}
const { url, shot, alt = "", label = "" } = Astro.props;
---

<div
  class="material-small @container overflow-hidden rounded-[6px] bg-surface-subtle md:rounded-[1.5cqw]"
>
  <div
    class="flex items-center justify-between gap-4 bg-surface px-4 py-2 md:gap-6 md:px-5 md:py-2.5"
  >
    <div class="flex flex-none items-center gap-2">
      <span class="block size-3 rounded-full" style="background:#FE5F57"></span>
      <span class="block size-3 rounded-full" style="background:#FEBB2E"></span>
      <span class="block size-3 rounded-full" style="background:#26C941"></span>
    </div>

    <div class="flex min-w-0 flex-1 justify-center">
      <div
        class="flex w-full items-center justify-between gap-2 rounded-full border border-line bg-surface-subtle py-1 pl-4 pr-1 lg:max-w-xs"
      >
        <span
          class:list={[
            "min-w-0 flex-1 truncate text-center text-[13px]",
            url ? "text-ink" : "text-mute",
          ]}
        >
          {url ?? "domaine à confirmer"}
        </span>
      </div>
    </div>

    <div class="hidden flex-none md:block md:w-[140px]"></div>
  </div>

  <div class="relative flex aspect-[16/10] items-center justify-center bg-surface-subtle">
    {
      shot ? (
        <img src={shot} alt={alt} class="block h-full w-full object-cover object-top" />
      ) : (
        <p class="px-6 text-center font-mono text-[11px] uppercase tracking-[0.08em] text-mute">
          capture à fournir
          {label && (
            <span class="mt-1.5 block font-sans text-[13px] font-medium normal-case tracking-normal text-ink">
              {label}
            </span>
          )}
        </p>
      )
    }
  </div>
</div>

```

> Aucun `<style>`. `@container` est l'utilitaire natif de Tailwind v4 pour
> `container-type: inline-size`, et les valeurs arbitraires acceptent n'importe
> quelle unité — `rounded-[1.5cqw]` compile, avec préfixage responsive.

- [ ] **Step 3: Brancher `cases.ts` dans `index.astro`**

Dans le frontmatter de `src/pages/index.astro`, supprimer la constante `const cases = [ … ];` et ajouter en haut :

```ts
import { cases } from "../data/cases";
```

Le `cases.map(...)` existant continue de fonctionner : les champs `num`, `tag`, `title` et `span` sont inchangés.

- [ ] **Step 4: Vérifier le build**

Run: `npm run build`
Expected: build réussi.

Contrôle : `grep -n "const cases" src/pages/index.astro` ne doit plus rien retourner.

- [ ] **Step 5: Commit**

```bash
git add src/data/cases.ts src/components/Browser.astro src/pages/index.astro
git commit -m "feat(portfolio): composant Browser et extraction des etudes de cas

Le rayon du cadre suit la largeur du conteneur (1.5cqw).
url et shot sont optionnels : aucune URL inventee.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Bibliothèque — composants à emploi immédiat

**Files:**
- Create: `src/components/ui/Badge.astro`, `Avatar.astro`, `Breadcrumbs.astro`, `Description.astro`, `Banner.astro`, `Collapse.astro`, `CopyButton.astro`

**Interfaces:**
- Consumes: les tokens de la tâche 2.
- Produces:
  - `<Badge variant?="gray"|"blue"|"amber"|"red"|"purple" subtle?={boolean} size?="sm"|"md" />` avec slot par défaut.
  - `<Avatar size?={number} src?={string} alt?={string} initials?={string} loading?="lazy"|"eager" />` (`loading` ajouté en tâche 8, défaut `"lazy"`).
  - `<Breadcrumbs items={{ label: string; href?: string }[]} />`.
  - `<Description items={{ term: string; value: string }[]} />`.
  - `<Banner tone?="neutral"|"info"|"success"|"warning"|"error" />` avec slot.
  - `<Collapse question={string} open?={boolean} />` avec slot.
  - `<CopyButton value={string} label?={string} />`.

- [ ] **Step 1: Créer `src/components/ui/Badge.astro`**

Pilule. Medium 12px/24px, small 11px/20px avec 0,2px d'approche. Plein = fond `-800/-900` sur `--ds-contrast-fg` ; discret = fond `-200` sur texte `-900`.

```astro
---
interface Props {
  variant?: "gray" | "blue" | "amber" | "red" | "purple";
  subtle?: boolean;
  size?: "sm" | "md";
}
const { variant = "gray", subtle = false, size = "md" } = Astro.props;

/* Fond uniforme sur la marche -900, texte en --ds-background-100 qui bascule
   avec le thème (#fff en clair, #0a0a0a en sombre).

   NE PAS revenir à --ds-contrast-fg : il vaut #fff en dur et n'est jamais
   redéfini sous .dark, alors que les marches -800/-900 s'inversent vers le
   clair. Le premier jet appariait ainsi du blanc sur du clair — l'ambre plein
   tombait à 1,18:1 en sombre et 3,11:1 en clair. La section G du harnais
   vérifie désormais les dix paires dans les deux thèmes, seuil 4,5:1. */
const SOLID: Record<string, string> = {
  gray: "background:var(--ds-gray-900);color:var(--ds-background-100)",
  blue: "background:var(--ds-blue-900);color:var(--ds-background-100)",
  amber: "background:var(--ds-amber-900);color:var(--ds-background-100)",
  red: "background:var(--ds-red-900);color:var(--ds-background-100)",
  purple: "background:var(--ds-purple-900);color:var(--ds-background-100)",
};
const SUBTLE: Record<string, string> = {
  gray: "background:var(--ds-gray-200);color:var(--ds-gray-1000)",
  blue: "background:var(--ds-blue-200);color:var(--ds-blue-900)",
  amber: "background:var(--ds-amber-200);color:var(--ds-amber-900)",
  red: "background:var(--ds-red-200);color:var(--ds-red-900)",
  purple: "background:var(--ds-purple-200);color:var(--ds-purple-900)",
};
const style = subtle ? SUBTLE[variant] : SOLID[variant];
---

<span
  class:list={[
    "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full font-medium",
    size === "sm"
      ? "px-2 text-[11px]/[20px] tracking-[0.2px]"
      : "px-2.5 text-[12px]/[24px]",
  ]}
  style={style}
>
  <slot />
</span>
```

- [ ] **Step 2: Créer `src/components/ui/Avatar.astro`**

L'anneau vaut `0 0 0 1px var(--surface)` — la surface de page, pas un gris. C'est ce qui détoure proprement les piles superposées.

```astro
---
interface Props {
  size?: number;
  src?: string;
  alt?: string;
  initials?: string;
  loading?: "lazy" | "eager";
}
const { size = 32, src, alt = "", initials = "", loading = "lazy" } = Astro.props;
---

<span
  class="inline-block flex-none overflow-hidden rounded-full bg-surface-raise text-center font-medium text-mute"
  style={`width:${size}px;height:${size}px;font-size:${Math.round(size * 0.4)}px;line-height:${size}px;box-shadow:0 0 0 1px var(--surface)`}
>
  {
    src ? (
      <img src={src} alt={alt} loading={loading} class="block h-full w-full object-cover" />
    ) : (
      initials
    )
  }
</span>
```

> **Correction en cours d'exécution.** Prop `loading?: "lazy" | "eager"` ajoutée,
> défaut `"lazy"`, en tâche 8 (fix round 1, commits f141ad6..bc37880) — l'audit
> d'attributs qui a repris `index.astro` vérifiait href/alt/aria-*/role/id/tabindex/src
> mais pas `loading`, et les 11 portraits de la page d'accueil l'avaient perdu.
> Le défaut protège tous les appelants futurs sans qu'aucun ait à le répéter.

- [ ] **Step 3: Créer `src/components/ui/Breadcrumbs.astro`**

```astro
---
interface Props {
  items: { label: string; href?: string }[];
}
const { items } = Astro.props;
---

<nav class="flex flex-wrap items-center gap-2 text-sm" aria-label="Fil d'Ariane">
  {
    items.map((it, i) => (
      <>
        {i > 0 && <span class="text-mute" aria-hidden="true">/</span>}
        {it.href ? (
          <a
            href={it.href}
            class="text-mute transition-colors duration-150 ease-in-out hover:text-ink"
          >
            {it.label}
          </a>
        ) : (
          <span class="text-ink" aria-current="page">
            {it.label}
          </span>
        )}
      </>
    ))
  }
</nav>
```

- [ ] **Step 4: Créer `src/components/ui/Description.astro`**

`min-height` sur l'étiquette pour garder l'alignement quand une valeur est vide.

```astro
---
interface Props {
  items: { term: string; value: string }[];
}
const { items } = Astro.props;
---

<dl class="grid gap-6 sm:grid-cols-2">
  {
    items.map((it) => (
      <div>
        <dt class="mb-2 text-sm/[14px] text-mute">{it.term}</dt>
        {/* la garde va sur <dd>, pas sur <dt> : c'est la valeur qui peut être
            vide et effondrer sa ligne. min-h-5 = 20px = l'interligne de text-sm. */}
        <dd class="m-0 min-h-5 text-sm text-ink">{it.value}</dd>
      </div>
    ))
  }
</dl>
```

- [ ] **Step 5: Créer `src/components/ui/Banner.astro`**

```astro
---
interface Props {
  tone?: "neutral" | "info" | "success" | "warning" | "error";
}
const { tone = "neutral" } = Astro.props;
const DOT: Record<string, string> = {
  neutral: "var(--mute)",
  info: "var(--info)",
  success: "var(--success)",
  warning: "var(--warning)",
  error: "var(--error)",
};
---

<div
  class="material-small flex items-center gap-3 rounded-control bg-surface px-3 py-2.5 text-sm"
>
  <span class="block size-2 flex-none rounded-full" style={`background:${DOT[tone]}`}></span>
  <span><slot /></span>
</div>
```

- [ ] **Step 6: Créer `src/components/ui/Collapse.astro`**

`<details>` natif : aucun JS, l'accessibilité clavier est offerte.

```astro
---
interface Props {
  question: string;
  open?: boolean;
}
const { question, open = false } = Astro.props;
---

<details class="group border-t border-line last-of-type:border-b" open={open}>
  <summary
    class="flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-base font-medium text-ink [&::-webkit-details-marker]:hidden"
  >
    {question}
    <span
      class="font-mono text-mute after:content-['+'] group-open:after:content-['−']"
      aria-hidden="true"></span>
  </summary>
  <div class="max-w-[68ch] pb-5 text-[15px] text-mute"><slot /></div>
</details>
```

> Aucun `<style>` ici. `list-none` couvre `list-style`, la variante arbitraire
> `[&::-webkit-details-marker]:hidden` couvre le marqueur WebKit, et
> `after:content-['+']` avec `group-open:after:content-['−']` couvre le chevron —
> `group` sur le `<details>` permet à `group-open:` de réagir à l'attribut `open`.

- [ ] **Step 7: Créer `src/components/ui/CopyButton.astro`**

Tertiaire : transparent au repos, `--ds-gray-alpha-200` au survol, en fond comme en anneau.

```astro
---
interface Props {
  value: string;
  label?: string;
}
const { value, label = "copier" } = Astro.props;
---

<button
  class="btn btn-ghost btn-sm font-mono"
  data-copy={value}
  data-label={label}
  type="button"
>
  <span>{value}</span>
  <em class="not-italic text-mute" data-state>{label}</em>
</button>

<script>
  document.querySelectorAll<HTMLButtonElement>("[data-copy]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const state = btn.querySelector("[data-state]");
      if (!state) return;
      try {
        await navigator.clipboard.writeText(btn.dataset.copy ?? "");
        state.textContent = "copié";
      } catch {
        state.textContent = "échec";
      }
      setTimeout(() => (state.textContent = btn.dataset.label ?? "copier"), 2000);
    });
  });
</script>
```

- [ ] **Step 8: Vérifier le build et le harnais**

Run: `npm run build && node scripts/verify-design-system.js`
Expected: build réussi. Le harnais échoue encore sur C, D et F (les pages ne sont pas encore reprises).

- [ ] **Step 9: Commit**

```bash
git add src/components/ui scripts/verify-design-system.js
git commit -m "feat(ui): badge, avatar, breadcrumbs, description, banner, collapse, copy-button

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Bibliothèque — mobilier d'application

Ces quatre composants entrent dans la bibliothèque mais **ne sont posés sur aucune page**. Un command menu sur un site de trois pages coûte du JS, un piège à focus et un travail d'accessibilité pour remplacer une navigation qui tient en cinq liens.

**Files:**
- Create: `src/components/ui/Choicebox.astro`, `ClearableInput.astro`, `ContextCard.astro`, `CommandMenu.astro`

**Interfaces:**
- Consumes: les tokens de la tâche 2, `.material-menu`, `.material-modal`, `.field`.
- Produces:
  - `<Choicebox name={string} options={{ value: string; title: string; hint?: string; checked?: boolean }[]} />`
  - `<ClearableInput name={string} placeholder={string} />` (`placeholder` requis, pas optionnel — voir étape 2)
  - `<ContextCard label={string} href?={string} />` avec slot pour le contenu du popover ; l'`id` du popover est généré par `getGridId()` et relié au déclencheur via `aria-describedby`.
  - `<CommandMenu items={{ label: string; key?: string }[]} placeholder?={string} />`

- [ ] **Step 1: Créer `src/components/ui/Choicebox.astro`**

Sélection via `:has(:checked)` — aucun JS.

```astro
---
interface Props {
  name: string;
  options: { value: string; title: string; hint?: string; checked?: boolean }[];
}
const { name, options } = Astro.props;
---

<div class="grid gap-3">
  {
    options.map((o) => (
      <label
        class="flex cursor-pointer items-start gap-3 rounded-card border border-line bg-surface px-4 py-3.5 transition-colors duration-150 ease-in-out hover:border-[var(--ds-gray-500)] hover:bg-[var(--ds-gray-100)] has-checked:border-[var(--ds-blue-600)] has-checked:bg-[var(--ds-blue-100)] hover:has-checked:bg-[var(--ds-blue-200)]"
      >
        <input
          type="radio"
          name={name}
          value={o.value}
          checked={o.checked}
          class="mt-0.5 accent-[var(--ds-blue-700)]"
        />
        <span>
          <span class="block text-sm font-medium text-ink">{o.title}</span>
          {o.hint && <span class="mt-0.5 block text-[13px] text-mute">{o.hint}</span>}
        </span>
      </label>
    ))
  }
</div>
```

> Aucun `<style>`. `has-checked:` est une variante native de Tailwind v4 : elle
> compile en `&:has(*:checked)`. Combinée à `hover:`, elle couvre les trois règles
> de l'ancien bloc. `accent-[…]` remplace l'attribut `style` sur l'input.

- [ ] **Step 2: Créer `src/components/ui/ClearableInput.astro`**

La croix n'apparaît qu'une fois le champ rempli, via `:not(:placeholder-shown)`.

```astro
---
interface Props {
  name: string;
  placeholder: string;
}
const { name, placeholder } = Astro.props;
---

<div class="relative flex items-center">
  <input class="field peer pr-10" name={name} placeholder={placeholder} />
  <button
    type="button"
    aria-label="Effacer"
    class="absolute right-1.5 hidden size-6 items-center justify-center rounded-full text-mute transition-colors duration-150 ease-in-out peer-not-placeholder-shown:flex hover:bg-[var(--ds-gray-alpha-200)] hover:text-ink"
    data-clear
  >
    ✕
  </button>
</div>

<script>
  document.querySelectorAll<HTMLButtonElement>("[data-clear]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const input = btn.previousElementSibling as HTMLInputElement | null;
      if (!input) return;
      input.value = "";
      input.focus();
    });
  });
</script>
```

> **Correction en cours d'exécution.** `placeholder` est passé de prop optionnelle
> (défaut `""`) à requise. Le mécanisme du bouton croix repose entièrement sur
> `:not(:placeholder-shown)` : sans placeholder, l'input n'a jamais d'état
> « placeholder affiché » à quitter, et le bouton reste soit toujours masqué,
> soit toujours visible selon le navigateur. Rendre la prop obligatoire force
> chaque appelant à fournir la valeur dont le sélecteur a besoin pour fonctionner.

- [ ] **Step 3: Créer `src/components/ui/ContextCard.astro`**

```astro
---
import { getGridId } from "../../utils/gridIdCounter.js";

interface Props {
  label: string;
  href?: string;
}
const { label, href = "#" } = Astro.props;
const id = getGridId();
---

<span class="group relative inline-block">
  <a href={href} class="border-b border-line" aria-describedby={id}>{label}</a>
  <span
    id={id}
    class="material-menu invisible absolute left-0 top-[calc(100%+8px)] z-20 w-70 -translate-y-1 rounded-card bg-surface p-4 opacity-0 transition-[opacity,transform,visibility] duration-150 ease-in-out group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100"
  >
    <slot />
  </span>
</span>
```

> Aucun `<style>`. `group` sur le parent, puis `group-hover:` et
> `group-focus-within:` sur le popover. `invisible` / `visible` couvrent
> `visibility`, et `transition-[opacity,transform,visibility]` porte les trois
> propriétés d'un coup.
>
> **Correction en cours d'exécution.** Le popover est relié au déclencheur par
> `aria-describedby`, sans quoi son contenu n'est jamais exposé aux lecteurs
> d'écran. L'`id` doit être unique par instance — le compteur `getGridId()` de
> la tâche 3 (`src/utils/gridIdCounter.js`) est réutilisé ici pour la même
> raison qu'il existe : un frontmatter Astro se réinitialise à chaque instance,
> il faut un compteur au périmètre du module pour éviter deux `id` identiques
> sur une même page.

- [ ] **Step 4: Créer `src/components/ui/CommandMenu.astro`**

```astro
---
interface Props {
  items: { label: string; key?: string }[];
  placeholder?: string;
}
const { items, placeholder = "Rechercher…" } = Astro.props;
---

<div class="material-modal max-w-110 overflow-hidden rounded-card bg-surface">
  <div class="flex h-12 items-center gap-2.5 border-b border-line px-4">
    <span class="text-mute" aria-hidden="true">⌘</span>
    <input
      class="w-full border-0 bg-transparent text-[15px] text-ink outline-none"
      placeholder={placeholder}
    />
  </div>
  <ul class="m-0 list-none p-1.5">
    {
      items.map((it) => (
        <li>
          <button
            type="button"
            class="flex h-9 w-full cursor-pointer items-center justify-between gap-3 rounded-control px-2.5 text-sm text-ink transition-colors duration-150 ease-in-out hover:bg-surface-raise"
          >
            {it.label}
            {it.key && (
              <kbd class="rounded border border-line bg-surface-subtle px-1.5 py-px font-mono text-[11px] text-mute">
                {it.key}
              </kbd>
            )}
          </button>
        </li>
      ))
    }
  </ul>
</div>
```

> **Correction en cours d'exécution.** Chaque `<li>` contient un vrai
> `<button type="button">`, pas une classe directement sur le `<li>` : un item
> de menu doit être focusable et activable au clavier, ce qu'un `<li>` seul
> n'offre pas. `w-full` sur le bouton pour qu'il occupe toute la largeur de
> la ligne.

- [ ] **Step 5: Vérifier le build**

Run: `npm run build && node scripts/verify-design-system.js`
Expected: build réussi ; C, D et F encore rouges.

- [ ] **Step 6: Commit**

```bash
git add src/components/ui scripts/verify-design-system.js
git commit -m "feat(ui): choicebox, clearable-input, context-card, command-menu

Construits mais non poses : mobilier d'application, sans usage sur un
site de trois pages.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Composants de chrome — Nav, Footer, CtaBand, LogoMarquee

**Files:**
- Modify: `src/components/Nav.astro`, `src/components/Footer.astro`, `src/components/CtaBand.astro`, `src/components/LogoMarquee.astro`

**Interfaces:**
- Consumes: les tokens et primitives de la tâche 2.
- Produces: rien de nouveau. Ces fichiers deviennent conformes à la convention CSS.

> **Avant de commencer :** lire chaque fichier en entier. Ces quatre composants
> contiennent du markup et du comportement qui ne doivent pas bouger — seul l'habillage
> change. `Nav.astro` fait 349 lignes et porte le toggle de thème ; ne pas le casser.
> Aucune structure DOM, aucun attribut d'accessibilité, aucun script ne doit être
> modifié dans cette tâche.

- [ ] **Step 1: Reprendre `Nav.astro`**

Supprimer le bloc `<style>`. Traduire chaque règle en utilitaires :

- barre collante : `sticky top-0 z-50 bg-surface`
- séparation : `shadow-[inset_0_-1px_0_var(--line)]` (pas une bordure — elle ne doit pas décaler la mise en page)
- rythme : `py-4` et le conteneur `.container-site`
- liens : `text-sm text-mute transition-colors duration-150 ease-in-out hover:text-ink`
- lien actif : `text-ink`
- CTA : `class="btn btn-sm"`
- toggle de thème : `class="btn btn-ghost btn-sm"`

Remplacer toute couleur en dur par un token. Le toggle `.dark` sur `<html>` et le script anti-flash de `BaseLayout.astro` ne changent pas.

- [ ] **Step 2: Reprendre `Footer.astro`**

Supprimer le `<style>`. La bande de marque perd `.surface-brand` (grain retiré) et devient `bg-surface-subtle`.

> **Structure revue en cours de chantier, sur décision du propriétaire —
> description ci-dessous mise à jour pour correspondre au fichier réel.**
> Le footer livré ne suit plus la disposition simple envisagée au départ
> (grille `sm:grid-cols-2 lg:grid-cols-5`, un seul niveau de liens). Il a été
> restructuré en cours d'exécution en :
> - une grille `grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1.6fr]` à
>   quatre zones : marque (wordmark + paragraphe, `dark:hidden`/`dark:block`
>   pour les deux variantes de logo), nav « explorer », nav « contact »,
>   newsletter ;
> - un formulaire newsletter non branché à un service d'envoi : soumission
>   native neutralisée par un `submit` listener avec `preventDefault()` (un
>   champ email seul ne déclenche pas la garde native « more than one
>   blocking field », donc une neutralisation explicite est nécessaire) ;
> - un sélecteur de thème à trois positions (clair / système / sombre), pas
>   un simple toggle deux états : `role="group"`, trois `<button
>   aria-pressed>`, script inline qui lit/écrit `localStorage` et reflète
>   l'état initial déjà posé par le script anti-flash de `BaseLayout.astro` ;
> - une ligne de bas de page séparée (copyright + lien LinkedIn en texte avec
>   icône SVG, `aria-label="linkedin"`) sous la grille principale, avec son
>   propre `border-t`.
>
> Se référer à `src/components/Footer.astro` pour le détail exact du markup
> plutôt qu'à un bloc de code figé ici : la surface de ce composant a bougé
> plusieurs fois pendant le chantier (voir commits `78d9495`, `43f8eae`,
> `42eee44`) et un extrait resterait périmé au prochain ajustement.

- [ ] **Step 3: Reprendre `CtaBand.astro`**

Supprimer le `<style>`. Fond `bg-surface-subtle`, padding `py-24x`, titre en `h2`, bouton `class="btn btn-lg"`.

- [ ] **Step 4: Reprendre `LogoMarquee.astro`**

Réduire le `<style>` au seul `@keyframes` du défilement. Tout le reste (gaps, opacité, tailles, couleurs) passe en utilitaires. Les logos gardent leur couleur — décision 5 de la spec, aucun filtre de désaturation.

Ajouter le respect du mouvement réduit :

```css
@media (prefers-reduced-motion: reduce) {
  .marquee-track {
    animation: none;
  }
}
```

- [ ] **Step 5: Vérifier**

Run: `npm run build && node scripts/verify-design-system.js`
Expected: build réussi. L'assertion F ne doit plus signaler que les fichiers de `ALLOWED`. Si `Nav.astro`, `Footer.astro` ou `CtaBand.astro` apparaissent encore, un `<style>` a été oublié.

- [ ] **Step 6: Commit**

```bash
git add src/components/Nav.astro src/components/Footer.astro \
        src/components/CtaBand.astro src/components/LogoMarquee.astro
git commit -m "refactor(chrome): nav, footer, cta et marquee en utilitaires Tailwind

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Page d'accueil

**Files:**
- Modify: `src/pages/index.astro`

**Interfaces:**
- Consumes: `<GridBackdrop />`, `<Browser />`, `cases`, les primitives de la tâche 2.

- [ ] **Step 1: Retirer le bloc `<style>`**

Supprimer le `<style>` (ligne ~405 avant modifications). Chaque règle passe en utilitaires branchés sur les tokens.

- [ ] **Step 2: Reprendre le hero**

- `.surface-brand` → `bg-surface-subtle` (grain retiré)
- ajouter `<GridBackdrop />` en enfant d'un conteneur `relative overflow-hidden`
- le contenu du hero passe en `relative` pour rester au-dessus de la grille
- surtitre en `class="label"`, titre en `h1`, accroche en `text-mute text-[19px]`
- CTA : `class="btn btn-lg"` et `class="btn btn-lg btn-outline"`

- [ ] **Step 3: Reprendre la section des études de cas avec `<Browser />`**

Remplacer le `.case-img` à placeholder texte par le composant :

```astro
{
  cases.map((c) => (
    <article class:list={["case-card", ...c.span.split(" ")]}>
      <Browser url={c.url} shot={c.shot} alt={c.title} label={c.tag} />
      <div class="mt-4">
        <span class="label mb-1.5 block">{c.num}</span>
        <h4 class="text-[17px] leading-tight">{c.title}</h4>
        <a class="link mt-2 inline-block text-sm" href="#">
          lire l'étude →
        </a>
      </div>
    </article>
  ))
}
```

Importer en haut du frontmatter :

```ts
import Browser from "../components/Browser.astro";
import GridBackdrop from "../components/GridBackdrop.astro";
```

- [ ] **Step 4: Reprendre les témoignages**

Les portraits passent par `<Avatar src={t.photo} alt={t.name} size={48} />`. Les photos gardent leur couleur — aucun filtre.

- [ ] **Step 5: Nettoyer les tokens morts**

Remplacer dans le fichier : `bg-surface-marque` → `bg-surface-subtle`, `border-card-frame` → `border-line`, toute référence à `bg-texture.png` supprimée.

- [ ] **Step 6: Vérifier**

Run: `npm run build && node scripts/verify-design-system.js`
Expected: build réussi. Les assertions C et D doivent passer **pour `index.astro`** ; `about.astro` et `tools.astro` peuvent encore les faire échouer.

- [ ] **Step 7: Commit**

```bash
git add src/pages/index.astro
git commit -m "refactor(home): monochrome, GridBackdrop et cadres Browser

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Pages À propos et Outils

**Files:**
- Modify: `src/pages/about.astro`, `src/pages/tools.astro`

- [ ] **Step 1: Reprendre `about.astro`**

Supprimer le `<style>`. Les trois `.surface-brand` deviennent `bg-surface-subtle` ; les deux `bg-surface-raise` restent valides (le token existe toujours, sa valeur a changé). Ajouter `<GridBackdrop />` au hero. La photo de Ludovic garde sa couleur.

- [ ] **Step 2: Reprendre `tools.astro`**

La page a déjà été passée en utilitaires (commit `f275f3e`). Il ne reste qu'à vérifier les deux `bg-surface-raise` et à remplacer d'éventuelles couleurs en dur par des tokens. Les vignettes de logos gardent `bg-tile`, qui reste clair en sombre par conception.

- [ ] **Step 3: Vérifier**

Run: `npm run build && node scripts/verify-design-system.js`
Expected: **toutes les assertions vertes**, y compris C, D et F.

- [ ] **Step 4: Commit**

```bash
git add src/pages/about.astro src/pages/tools.astro
git commit -m "refactor(pages): about et tools en monochrome

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: Page `/design-system` — vitrine vivante, non indexable

Une page de référence qui consomme les **vrais** composants Astro. Si elle recopiait
le markup, elle divergerait en trois semaines et deviendrait un mensonge : c'est
précisément ce qu'on ne veut pas d'une page destinée à durer.

**Files:**
- Create: `src/pages/design-system.astro`
- Create: `public/robots.txt`
- Modify: `src/layouts/BaseLayout.astro` — prop `noindex`

**Interfaces:**
- Consumes: tous les composants des tâches 3 à 6, toutes les primitives de la tâche 2.
- Produces: la route `/design-system`, exclue de l'indexation.

- [ ] **Step 1: Ajouter la prop `noindex` au layout**

Dans `src/layouts/BaseLayout.astro`, étendre l'interface et le destructuring :

```ts
interface Props {
  title: string;
  description?: string;
  noindex?: boolean;
}

const {
  title,
  description = "Studio web indépendant basé à Sète. Design, développement et maintenance de sites performants, pensés pour vos objectifs et prêts pour l'ère de l'IA.",
  noindex = false,
} = Astro.props;
```

Puis, dans le `<head>`, juste après la balise `<meta name="description" …>` :

```astro
{noindex && <meta name="robots" content="noindex, nofollow" />}
```

- [ ] **Step 2: Créer `public/robots.txt`**

Le site n'en a pas aujourd'hui : tout est crawlable par défaut. Ce fichier garde ce
comportement et n'exclut que la page de référence. Ceinture et bretelles avec le
`<meta robots>` — les deux sont nécessaires, le meta pour les moteurs qui ignorent
robots.txt sur les pages déjà connues, robots.txt pour éviter le crawl tout court.

```
User-agent: *
Allow: /
Disallow: /design-system

Sitemap: https://coolbeans.cc/sitemap.xml
```

> Si aucun `sitemap.xml` n'est généré aujourd'hui, retirer la dernière ligne plutôt
> que de pointer vers une 404.

- [ ] **Step 3: Créer `src/pages/design-system.astro`**

```astro
---
import BaseLayout from "../layouts/BaseLayout.astro";
import Browser from "../components/Browser.astro";
import GridBackdrop from "../components/GridBackdrop.astro";
import Badge from "../components/ui/Badge.astro";
import Avatar from "../components/ui/Avatar.astro";
import Breadcrumbs from "../components/ui/Breadcrumbs.astro";
import Description from "../components/ui/Description.astro";
import Banner from "../components/ui/Banner.astro";
import Collapse from "../components/ui/Collapse.astro";
import CopyButton from "../components/ui/CopyButton.astro";
import Choicebox from "../components/ui/Choicebox.astro";
import ClearableInput from "../components/ui/ClearableInput.astro";
import ContextCard from "../components/ui/ContextCard.astro";
import CommandMenu from "../components/ui/CommandMenu.astro";

const SCALES = [
  { key: "background", label: "Backgrounds", steps: [100, 200] },
  { key: "gray", label: "Gray", steps: [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000] },
  { key: "gray-alpha", label: "Gray alpha", steps: [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000] },
  { key: "blue", label: "Blue", steps: [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000] },
  { key: "red", label: "Red", steps: [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000] },
  { key: "amber", label: "Amber", steps: [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000] },
  { key: "green", label: "Green", steps: [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000] },
  { key: "teal", label: "Teal", steps: [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000] },
  { key: "purple", label: "Purple", steps: [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000] },
  { key: "pink", label: "Pink", steps: [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000] },
];

const SEMANTIC = [
  ["--surface", "surface de contenu", "--ds-background-100"],
  ["--surface-subtle", "sections en retrait", "--ds-background-200"],
  ["--surface-raise", "cartes, chips, encarts", "--ds-gray-100"],
  ["--line", "filet fin", "--ds-gray-400"],
  ["--line-strong", "filet appuyé", "--ds-gray-500"],
  ["--ink", "texte principal", "--ds-gray-1000"],
  ["--mute", "texte secondaire", "--ds-gray-900"],
  ["--accent", "CTA, liens, états actifs", "--ds-gray-1000"],
  ["--accent-ink", "texte sur aplat accent", "--ds-background-100"],
  ["--accent-hover", "survol du bouton primaire", "hsl(0 0% 22 / 80%)"],
  ["--focus", "anneau de focus", "--ds-focus-color"],
];

const SPACE = [
  ["2x", 8], ["3x", 12], ["4x", 16], ["6x", 24], ["8x", 32],
  ["10x", 40], ["16x", 64], ["24x", 96], ["32x", 128],
];

const MATERIALS = [
  ["base", "Anneau seul", "1px, sans ombre portée. Le filet par défaut."],
  ["small", "Carte posée", "Anneau + 2px d'ombre. Cartes, cadre Browser."],
  ["medium", "Intermédiaire", "Ombre à 8px."],
  ["large", "Carte détachée", "Ombre à 16px. Éléments qui flottent."],
  ["tooltip", "Infobulle", "Court, net, proche de la surface."],
  ["menu", "Menu", "Popovers, listes déroulantes."],
  ["modal", "Modale", "Le plus haut de la pile."],
];

const BTN_TYPES = [
  ["", "Primaire"],
  ["btn-outline", "Secondaire"],
  ["btn-ghost", "Tertiaire"],
];
const BTN_SIZES = [["btn-sm", "Small · 32"], ["", "Medium · 36"], ["btn-lg", "Large · 40"]];
---

<BaseLayout
  title="Design system — Coolbeans"
  description="Référence interne du design system Coolbeans."
  noindex
>
  <header class="sticky top-0 z-50 bg-surface py-4 shadow-[inset_0_-1px_0_var(--line)]">
    <div class="container-site flex flex-wrap items-center gap-6">
      <strong class="font-display text-[19px] font-extrabold tracking-[-0.03em]">
        design system
      </strong>
      <nav class="flex flex-1 flex-wrap gap-6 text-sm">
        {
          [
            ["couleurs", "Couleurs"],
            ["typo", "Typo"],
            ["rythme", "Rythme"],
            ["materials", "Materials"],
            ["boutons", "Boutons"],
            ["browser", "Browser"],
            ["biblio", "Bibliothèque"],
          ].map(([id, label]) => (
            <a
              href={`#${id}`}
              class="text-mute transition-colors duration-150 ease-in-out hover:text-ink"
            >
              {label}
            </a>
          ))
        }
      </nav>
      <button class="btn btn-ghost btn-sm" data-theme-toggle>Clair / sombre</button>
    </div>
  </header>

  <section class="relative overflow-hidden bg-surface-subtle py-32x">
    <GridBackdrop />
    <div class="container-site relative">
      <p class="label mb-6x">Référence interne · non indexée</p>
      <h1 class="max-w-[18ch]">Le système, pas la page.</h1>
      <p class="mt-6x max-w-[52ch] text-[19px] text-mute">
        Cette page consomme les composants réels. Si un composant change, elle change
        avec lui — elle ne peut pas mentir.
      </p>
    </div>
  </section>

  <!-- COULEURS -->
  <section id="couleurs" class="border-t border-line py-24x">
    <div class="container-site">
      <p class="label">01</p>
      <h2 class="mb-3x mt-3x">Couleurs</h2>
      <p class="mb-10x max-w-[62ch] text-mute">
        Le système Geist complet : dix échelles, hex en base et <code class="font-mono"
          >lab()</code
        > derrière <code class="font-mono">@supports</code>. L'identité reste monochrome ;
        les échelles colorées ne servent qu'aux états fonctionnels.
      </p>

      {
        SCALES.map((s) => (
          <div class="grid grid-cols-1 items-center gap-4x py-1.5 md:grid-cols-[110px_1fr]">
            <div class="font-mono text-xs text-mute">{s.label}</div>
            <div
              class="grid overflow-hidden rounded-card border border-line"
              style={`grid-template-columns:repeat(${s.steps.length},1fr)`}
            >
              {s.steps.map((n) => (
                <div
                  class="flex h-14 items-end p-1.5 font-mono text-[9px] text-mute"
                  style={`background:var(--ds-${s.key}-${n})`}
                  title={`--ds-${s.key}-${n}`}
                >
                  {n}
                </div>
              ))}
            </div>
          </div>
        ))
      }

      <p class="label mb-3x mt-16x">Couche sémantique</p>
      <div>
        {
          SEMANTIC.map(([tok, role, src]) => (
            <div class="grid items-center gap-4x border-t border-line py-3x font-mono text-[12.5px] md:grid-cols-[150px_1fr_170px_auto]">
              <span>{tok}</span>
              <span class="text-mute">{role}</span>
              <span class="text-[11.5px] text-mute">{src}</span>
              <span
                class="h-6 w-11 rounded border border-line-strong"
                style={`background:var(${tok})`}
              />
            </div>
          ))
        }
      </div>

      <p class="label mb-3x mt-16x">États fonctionnels</p>
      <div class="grid gap-6x sm:grid-cols-2 lg:grid-cols-4">
        {
          [
            ["info", "Info", "--ds-blue-700"],
            ["success", "Succès", "--ds-green-800"],
            ["warning", "Alerte", "--ds-amber-800"],
            ["error", "Erreur", "--ds-red-800"],
          ].map(([tok, label, src]) => (
            <div class="card">
              <span
                class="mb-4x block h-11 w-full rounded-control"
                style={`background:var(--${tok})`}
              />
              <h4>{label}</h4>
              <p class="font-mono text-xs text-mute">{src}</p>
            </div>
          ))
        }
      </div>
      <p class="mt-8x max-w-[70ch] border-l-2 border-line-strong pl-4x text-[15px] text-mute">
        Jamais en fond de section, jamais en CTA. Uniquement sur du signal — un message
        d'erreur en gris n'est pas un message d'erreur.
      </p>
    </div>
  </section>

  <!-- TYPO -->
  <section id="typo" class="border-t border-line py-24x">
    <div class="container-site">
      <p class="label">02</p>
      <h2 class="mb-3x mt-3x">Typographie</h2>
      <p class="mb-10x max-w-[62ch] text-mute">
        Geomanist tient les h1/h2, Geist prend tout le reste. Une display ronde sur un
        système froid — c'est la signature.
      </p>

      <div class="card mb-4x">
        <div class="mb-6x flex flex-wrap justify-between gap-4x">
          <span class="label">Display · Geomanist 700 / 800</span>
          <span class="font-mono text-xs text-mute">h1 · h2 uniquement</span>
        </div>
        <div
          class="font-display font-bold leading-[1.02] tracking-[-0.03em]"
          style="font-size:clamp(40px,6vw,76px)"
        >
          Un studio qui livre
        </div>
      </div>

      <div class="card mb-4x">
        <div class="mb-6x flex flex-wrap justify-between gap-4x">
          <span class="label">Corps &amp; UI · Geist Sans 400–600</span>
          <span class="font-mono text-xs text-mute">h3-h5 · p · boutons · nav</span>
        </div>
        <h3 class="mb-3x">Titre de carte en Geist SemiBold</h3>
        <p class="max-w-[64ch] text-mute">
          Le corps passe en Geist Sans 400 à 16px sur une interligne de 1,5. La police est
          dessinée pour l'écran et disparaît derrière le texte, ce qui est exactement ce
          qu'on lui demande.
        </p>
      </div>

      <div class="card">
        <div class="mb-6x flex flex-wrap justify-between gap-4x">
          <span class="label">Mono · Geist Mono 500 / 700</span>
          <span class="font-mono text-xs text-mute">labels · eyebrows · code</span>
        </div>
        <p class="label text-[13px]">SURTITRE EN GEIST MONO</p>
        <p class="mt-3x font-mono text-sm text-mute">--surface-subtle: #fafafa;</p>
      </div>
    </div>
  </section>

  <!-- RYTHME -->
  <section id="rythme" class="border-t border-line py-24x">
    <div class="container-site">
      <p class="label">03</p>
      <h2 class="mb-3x mt-3x">Rythme</h2>
      <p class="mb-10x max-w-[62ch] text-mute">
        Base 4px, gap par défaut à 24px, container 1280px.
      </p>
      <div class="grid gap-6x md:grid-cols-2">
        <div>
          {
            SPACE.map(([n, v]) => (
              <div class="grid grid-cols-[110px_1fr] items-center gap-4x py-1.5">
                <span class="font-mono text-xs text-mute">--space-{n} · {v}</span>
                <span class="block h-3.5 rounded-sm bg-ink" style={`width:${v}px`} />
              </div>
            ))
          }
        </div>
        <div class="card bg-surface-raise font-mono text-[13px]">
          <div>--container : <strong>1280px</strong></div>
          <div class="mt-3x">--gutter : <strong>24px</strong></div>
          <div class="mt-3x">--radius-control : <strong>6px</strong></div>
          <div class="mt-3x">--radius-card : <strong>8px</strong></div>
        </div>
      </div>
    </div>
  </section>

  <!-- MATERIALS -->
  <section id="materials" class="border-t border-line py-24x">
    <div class="container-site">
      <p class="label">04</p>
      <h2 class="mb-3x mt-3x">Materials</h2>
      <p class="mb-10x max-w-[62ch] text-mute">
        Pas du verre dépoli : aucun <code class="font-mono">backdrop-filter</code> chez
        Geist. Une échelle d'élévation en ombres empilées, dont un anneau de 1px qui
        remplace la bordure.
      </p>
      <div class="grid gap-6x sm:grid-cols-2 lg:grid-cols-3">
        {
          MATERIALS.map(([key, title, desc]) => (
            <div class={`card material-${key} border-0`}>
              <span class="label">{key}</span>
              <h4 class="mt-2x">{title}</h4>
              <p class="mt-2x text-sm text-mute">{desc}</p>
            </div>
          ))
        }
      </div>
    </div>
  </section>

  <!-- BOUTONS -->
  <section id="boutons" class="border-t border-line py-24x">
    <div class="container-site">
      <p class="label">05</p>
      <h2 class="mb-3x mt-3x">Boutons</h2>
      <p class="mb-10x max-w-[62ch] text-mute">
        Le primaire n'inverse pas au survol : il s'éclaircit en clair, s'assombrit en
        sombre. Bordure en <code class="font-mono">box-shadow</code>, transition 150ms,
        coupée au focus. Survole-les, puis tabule.
      </p>
      <div class="card">
        <div
          class="grid items-center gap-4x"
          style="grid-template-columns:auto repeat(3,1fr)"
        >
          <div></div>
          {BTN_SIZES.map(([, label]) => <div class="label text-[10px]">{label}</div>)}
          {
            BTN_TYPES.map(([variant, label]) => (
              <>
                <div class="label text-[10px]">{label}</div>
                {BTN_SIZES.map(([size]) => (
                  <div>
                    <button class:list={["btn", variant, size]}>Déployer</button>
                  </div>
                ))}
              </>
            ))
          }
          <div class="label text-[10px]">Inactif</div>
          {
            BTN_SIZES.map(([size]) => (
              <div>
                <button class:list={["btn", size]} disabled>
                  Déployer
                </button>
              </div>
            ))
          }
        </div>
      </div>

      <div class="mt-6x grid gap-6x md:grid-cols-2">
        <div class="card">
          <p class="label mb-4x">Champ</p>
          <input class="field" placeholder="vous@exemple.fr" />
          <p class="mt-4x text-sm text-mute">
            Même anneau de focus que les boutons : 2px de fond puis 2px de couleur.
          </p>
        </div>
        <div class="card font-mono text-[12.5px] leading-[1.8]">
          <p class="label mb-4x font-sans">Ce que fait le survol</p>
          <div><strong>Primaire</strong></div>
          <div><span class="text-mute">clair</span> #171717 → <strong>hsl(0 0% 22%)</strong></div>
          <div><span class="text-mute">sombre</span> #ededed → <strong>hsl(0 0% 80%)</strong></div>
          <div class="mt-2x"><strong>Secondaire</strong> → --ds-gray-100 / 200</div>
          <div class="mt-2x"><strong>Tertiaire</strong> → --ds-gray-alpha-200</div>
        </div>
      </div>
    </div>
  </section>

  <!-- BROWSER -->
  <section id="browser" class="border-t border-line py-24x">
    <div class="container-site">
      <p class="label">06</p>
      <h2 class="mb-3x mt-3x">Browser</h2>
      <p class="mb-10x max-w-[62ch] text-mute">
        Le rayon du cadre suit la largeur du conteneur (<code class="font-mono"
          >1.5cqw</code
        >). Redimensionne la fenêtre, il s'ajuste. Sans <code class="font-mono">shot</code
        >, l'état vide est explicite.
      </p>
      <div class="grid gap-6x md:grid-cols-2">
        <Browser url="trigger.fr" label="trigger" />
        <Browser label="amusoire : homepage" />
      </div>
    </div>
  </section>

  <!-- BIBLIOTHÈQUE -->
  <section id="biblio" class="border-t border-line py-24x">
    <div class="container-site">
      <p class="label">07</p>
      <h2 class="mb-3x mt-3x">Bibliothèque</h2>
      <p class="mb-10x max-w-[62ch] text-mute">
        Les composants réels, importés. Ceux du bas sont du mobilier d'application :
        présents dans la bibliothèque, posés sur aucune page.
      </p>

      <div class="grid gap-6x md:grid-cols-2">
        <div class="card">
          <p class="label mb-6x">Badge</p>
          <div class="flex flex-wrap items-center gap-3x">
            <Badge>Livré</Badge>
            <Badge subtle>Brouillon</Badge>
            <Badge variant="blue">Astro</Badge>
            <Badge variant="blue" subtle>Sanity</Badge>
          </div>
          <div class="mt-3x flex flex-wrap items-center gap-3x">
            <Badge size="sm" variant="amber" subtle>En cours</Badge>
            <Badge size="sm" variant="red" subtle>Bloqué</Badge>
            <Badge size="sm" variant="purple" subtle>Maintenance</Badge>
          </div>
        </div>

        <div class="card">
          <p class="label mb-6x">Avatar</p>
          <div class="flex flex-wrap items-center gap-6x">
            <div class="flex">
              <Avatar size={36} initials="MC" />
              <span class="-ml-2"><Avatar size={36} initials="OC" /></span>
              <span class="-ml-2"><Avatar size={36} initials="TM" /></span>
              <span class="-ml-2"><Avatar size={36} initials="+8" /></span>
            </div>
            <Avatar size={48} initials="GC" />
            <Avatar size={24} initials="AM" />
          </div>
          <p class="mt-6x text-sm text-mute">
            L'anneau vaut <code class="font-mono">0 0 0 1px var(--surface)</code> — la
            surface de page, pas un gris.
          </p>
        </div>

        <div class="card">
          <p class="label mb-6x">Breadcrumbs</p>
          <Breadcrumbs
            items={[
              { label: "coolbeans", href: "/" },
              { label: "réalisations", href: "#" },
              { label: "amusoire" },
            ]}
          />
        </div>

        <div class="card">
          <p class="label mb-6x">Description</p>
          <Description
            items={[
              { term: "Client", value: "Amusoire" },
              { term: "Année", value: "2026" },
              { term: "Stack", value: "Astro · Sanity · Cloudflare" },
              { term: "Durée", value: "6 semaines" },
            ]}
          />
        </div>

        <div class="card">
          <p class="label mb-6x">Banner</p>
          <div class="grid gap-3x">
            <Banner tone="info">Le site est en préproduction sur staging.</Banner>
            <Banner tone="success">Déploiement terminé.</Banner>
            <Banner tone="warning">Certificat SSL à renouveler sous 14 jours.</Banner>
          </div>
        </div>

        <div class="card">
          <p class="label mb-6x">Copy button</p>
          <div class="grid justify-items-start gap-3x">
            <CopyButton value="ludo@coolbeans.cc" />
            <CopyButton value="npm create astro@latest" />
          </div>
        </div>
      </div>

      <div class="card mt-6x">
        <p class="label mb-4x">Collapse</p>
        <Collapse question="Combien de temps prend un site ?" open>
          Entre quatre et huit semaines selon le périmètre.
        </Collapse>
        <Collapse question="Qui écrit les contenus ?">
          Vous, sauf mention contraire. Je fournis la structure et les gabarits.
        </Collapse>
        <Collapse question="Que se passe-t-il après la mise en ligne ?">
          Maintenance mensuelle et un point trimestriel sur les performances.
        </Collapse>
      </div>

      <p class="label mb-4x mt-16x">Mobilier d'application · non posé sur le site</p>
      <div class="grid gap-6x lg:grid-cols-3">
        <div class="card">
          <p class="label mb-6x">Context card</p>
          <p>
            Réalisé avec <ContextCard label="Astro">
              <strong class="text-sm">Astro</strong>
              <p class="mt-2x text-[13px] text-mute">Zéro JS par défaut, îlots à la demande.</p>
            </ContextCard> et hébergé sur Cloudflare.
          </p>
        </div>
        <div class="card">
          <p class="label mb-6x">Clearable input</p>
          <ClearableInput name="q" placeholder="Rechercher un projet" />
        </div>
        <div class="card">
          <p class="label mb-6x">Choicebox</p>
          <Choicebox
            name="offre"
            options={[
              { value: "vitrine", title: "Site vitrine", hint: "4 à 6 semaines", checked: true },
              { value: "ecommerce", title: "E-commerce", hint: "8 à 12 semaines" },
            ]}
          />
        </div>
      </div>

      <div class="mt-6x">
        <p class="label mb-4x">Command menu</p>
        <CommandMenu
          items={[
            { label: "Réalisations", key: "R" },
            { label: "Outils", key: "O" },
            { label: "À propos", key: "A" },
            { label: "Écrire à Ludovic", key: "⌘ E" },
          ]}
          placeholder="Rechercher une page, un projet…"
        />
      </div>
    </div>
  </section>

  <footer class="border-t border-line py-16x">
    <div class="container-site">
      <p class="label">
        Page de référence interne · <code class="font-mono">noindex, nofollow</code> ·
        non listée dans la navigation du site
      </p>
    </div>
  </footer>
</BaseLayout>

<script>
  document.querySelector("[data-theme-toggle]")?.addEventListener("click", () => {
    const dark = document.documentElement.classList.toggle("dark");
    try {
      localStorage.setItem("theme", dark ? "dark" : "light");
    } catch {}
  });
</script>
```

- [ ] **Step 4: Vérifier**

Run: `npm run build && node scripts/verify-design-system.js`
Expected: build réussi, toutes les assertions vertes. La page ne doit ajouter aucun
bloc `<style>` — elle n'utilise que des utilitaires et les composants.

Contrôle du noindex :

Run: `grep -A1 'name="robots"' dist/design-system/index.html`
Expected: `<meta name="robots" content="noindex, nofollow">`

Contrôle que les autres pages ne l'ont pas :

Run: `grep -c 'name="robots"' dist/index.html`
Expected: `0`

- [ ] **Step 5: Vérifier visuellement**

Run: `npm run dev` puis ouvrir `http://localhost:4321/design-system`

La page doit basculer clair/sombre au bouton, et tous les composants doivent
répondre au survol et à la tabulation.

- [ ] **Step 6: Commit**

```bash
git add src/pages/design-system.astro public/robots.txt src/layouts/BaseLayout.astro
git commit -m "feat(design): page /design-system non indexable

Consomme les composants reels : elle ne peut pas diverger du systeme.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 11: Vérification finale et preview

**Files:**
- Modify: `package.json` — ajouter le script de vérification
- Modify: `docs/superpowers/specs/2026-07-30-design-system-geist-design.md` — marquer implémenté

- [ ] **Step 1: Exclure `docs/` du scan de contenu Tailwind**

Tailwind v4 détecte ses sources automatiquement et scanne le dépôt, `docs/` compris.
Les noms de classes cités **en prose** dans la spec et le plan sont donc compilés en
règles réelles : le bundle livré contient aujourd'hui `has-checked`,
`peer-not-placeholder-shown`, `group-focus-within`, `material-modal` et `btn-lg` alors
qu'aucun composant ne les utilisait encore au moment du constat. C'est du CSS mort
expédié en production, et il grossit à chaque ligne de documentation écrite.

Dans `src/styles/global.css`, juste après `@import "tailwindcss";` :

```css
/* La détection automatique de sources de Tailwind scanne aussi docs/, où les
   noms de classes sont cités en prose. Sans cette exclusion, chaque classe
   mentionnée dans la spec ou le plan est compilée en règle morte. */
@source not "../../docs";
@source not "../../_doc-standard";
```

Vérification — la classe doit disparaître du bundle :

Run: `npm run build && grep -c 'peer-not-placeholder-shown' dist/_astro/*.css`
Expected: `0` si aucun composant ne l'utilise ; sinon uniquement les occurrences réelles.

- [ ] **Step 2: Resserrer les assertions non ancrées du harnais**

Deux assertions de la section B2 cherchent une chaîne **n'importe où** dans
`global.css` au lieu de la portée qui les concerne. `check('corps à 16px')` teste
`font-size: 16px` sur tout le fichier, or `h5` et `.btn-lg` l'utilisent aussi : elle
resterait verte si le corps régressait. Même défaut pour `check('transition Geist 150ms')`.

C'est la même famille que le défaut de contraste corrigé en tâche 2 : une assertion
qui ne peut plus échouer ne teste rien.

Réécris-les pour qu'elles portent sur la règle visée. Extrais d'abord le bloc
concerné, puis teste dedans :

```js
/* la portée compte : `font-size: 16px` apparaît aussi dans h5 et .btn-lg.
   On teste la règle body{}, pas le fichier entier. */
const rule = (css, selector) => {
  const m = css.match(new RegExp('(^|\\})\\s*' + selector + '\\s*\\{([^}]*)\\}', 'm'));
  return m ? m[2] : '';
};
const bodyRule = rule(glob, 'body');
check('corps à 16px', /font-size:\s*16px/.test(bodyRule), 'règle body{} introuvable ou taille différente');
check('corps en weight 400', /font-weight:\s*400/.test(bodyRule));
const btnRule = rule(glob, '\\.btn');
check('transition Geist 150ms sur .btn', /transition:[^;]*150ms ease-in-out/.test(btnRule));
```

Prouve que chacune mord : casse temporairement la valeur dans `global.css`, constate
l'échec, remets en état.

- [ ] **Step 3: Ancrer la table sémantique de `/design-system` au harnais**

La page `/design-system` recopie en dur, dans sa constante `SEMANTIC`, la correspondance
entre les tokens Coolbeans et leur source Geist (`--surface` → `--ds-background-100`, etc.).
C'est précisément le travers que cette page existe pour éviter — appliqué aux valeurs de
tokens plutôt qu'au markup. Si un mapping change dans `global.css`, la page continue
d'afficher l'ancien, et rien ne le signale.

Ajoute une section `H` à `scripts/verify-design-system.js`, sur le modèle de la section G
qui vérifie déjà les paires de Badge : elle lit la table `SEMANTIC` **réellement déclarée**
dans `src/pages/design-system.astro`, lit les déclarations correspondantes dans
`src/styles/global.css`, et vérifie que chaque paire annoncée correspond à la réalité.

Ne recopie pas la table dans le harnais — ce serait déplacer le problème d'un fichier.
Parse les deux sources et compare.

Prouve qu'elle mord : change temporairement un mapping dans `global.css` sans toucher à
la page, constate l'échec, remets en état.

- [ ] **Step 4: Compléter la liste des tokens morts**

La liste `DEAD` du harnais ne contient pas `surface-brand`. Un reliquat de l'ancienne
classe de bande de marque passerait donc la vérification sans être vu. Ajoute-le.

Vérifie que l'assertion reste verte — plus aucun fichier de `src/` ne doit le référencer.

- [ ] **Step 5: Câbler le harnais dans les scripts npm**

Dans `package.json`, section `scripts`, ajouter :

```json
"verify": "node scripts/verify-design-system.js",
"tokens": "node scripts/extract-geist-tokens.js"
```

- [ ] **Step 6: Passe complète**

Run: `npm run build && npm run verify`
Expected: build réussi, toutes les assertions vertes.

- [ ] **Step 7: Contrôle visuel en local**

Run: `npm run dev`

Parcourir les trois pages et vérifier, en clair **et** en sombre :

1. Aucun reste de beige nulle part.
2. Le survol du bouton primaire **éclaircit** en clair et **assombrit** en sombre — il n'inverse pas.
3. L'anneau de focus (bleu) apparaît à la tabulation sur boutons, liens et champs.
4. En sombre, les sections alternées sont **plus noires** que le contenu.
5. Les cadres Browser gardent un rayon juste quand la fenêtre est redimensionnée.
6. Les logos partenaires, les portraits et les photos ont gardé leur couleur.
7. Le grain a disparu du hero et du pied de page.
8. Les h1/h2 sont bien en Geomanist, tout le reste en Geist.
9. `/design-system` répond, bascule de thème, et n'est liée depuis aucune navigation.

- [ ] **Step 8: Vérifier le poids des polices chargées**

Dans l'onglet Réseau du navigateur, filtrer sur `font`. Attendu : `Geist-Variable.woff2`, `GeistMono-Variable.woff2`, `geomanist-bold-webfont.woff2` et éventuellement `geomanist-black-webfont.woff2`. **`geomanist-book` et `geomanist-medium` ne doivent plus être chargées.**

- [ ] **Step 9: Resynchroniser le plan et marquer la spec implémentée**

Dans l'en-tête de la spec, remplacer la ligne `Statut :` par :

```markdown
Statut : implémenté le 2026-07-30 — plan `docs/superpowers/plans/2026-07-30-design-system-geist.md`
```

- [ ] **Step 10: Commit et push sur staging**

```bash
git add package.json docs/superpowers/specs/2026-07-30-design-system-geist-design.md
git commit -m "chore(design): scripts verify et tokens, spec marquee implementee

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
git push origin staging
```

- [ ] **Step 11: Contrôler la preview Cloudflare**

Le push sur `staging` déclenche un déploiement de preview. Repasser les neuf points de l'étape 5 sur l'URL de preview, sur un vrai mobile si possible — le gutter à 24px et le rayon en `cqw` méritent un contrôle sur petit écran.

**Ne pas déployer en production.** La mise en ligne attend un ordre explicite.

---

## Notes de reprise

**Si le gutter à 24px pince trop sur grand écran** — remonter `--gutter` à `32px` dans `global.css`. Un seul token, aucun autre effet.

**Si le corps à 16px paraît trop petit** — repasser `body { font-size }` à 17px. Le rythme vertical n'en dépend pas.

**Si le contraste entre Geomanist et Geist est trop discret** — la solution n'est pas de basculer les titres en Geist, c'est d'assumer davantage Geomanist : passer les h1 en poids 800 et augmenter le `clamp`.

**Quand les captures des sites clients arrivent** — les déposer dans `public/img/cases/`, puis renseigner `url` et `shot` dans `src/data/cases.ts`. Aucun autre fichier à toucher : `Browser.astro` bascule seul de l'état vide à l'image.
