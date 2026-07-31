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
  /* la portée compte : `font-size: 16px` apparaît aussi dans h5 et .btn-lg,
     et `150ms ease-in-out` apparaît aussi dans .field et .link. On teste
     les règles body{} et .btn{} précisément, pas le fichier entier. */
  const rule = (css, selector) => {
    const m = css.match(new RegExp('(^|\\})\\s*' + selector + '\\s*\\{([^}]*)\\}', 'm'));
    return m ? m[2] : '';
  };
  const bodyRule = rule(glob, 'body');
  check('corps à 16px', /font-size:\s*16px/.test(bodyRule), 'règle body{} introuvable ou taille différente');
  check('corps en weight 400', /font-weight:\s*400/.test(bodyRule));
  const btnRule = rule(glob, '\\.btn');
  check('transition Geist 150ms sur .btn', /transition:[^;]*150ms ease-in-out/.test(btnRule));
  /* même piège que body{} plus haut : `height: 40px` apparaît aussi dans
     .field, donc un test non ancré sur le fichier entier resterait vert
     même si .btn-lg régressait vers n'importe quelle autre valeur. On lit
     .btn, .btn-sm et .btn-lg précisément via rule(), pas le fichier entier. */
  const btnSmRule = rule(glob, '\\.btn-sm');
  const btnLgRule = rule(glob, '\\.btn-lg');
  check(
    'tailles de bouton 32/36/40',
    /height:\s*36px/.test(btnRule) && /height:\s*32px/.test(btnSmRule) && /height:\s*40px/.test(btnLgRule),
    'attendu .btn=36px, .btn-sm=32px, .btn-lg=40px',
  );
  /* l'exigence réelle n'est pas que la chaîne "geomanist-book"/"geomanist-medium"
     soit absente du fichier (un commentaire peut légitimement documenter ce qui
     a été retiré et pourquoi) — c'est qu'aucun @font-face ne charge plus ces
     fichiers. On teste donc l'url() réellement chargée, pas du texte libre. */
  for (const f of ['geomanist-book-webfont', 'geomanist-medium-webfont'])
    check('police ' + f + ' non chargée', !new RegExp('url\\(["\']?[^)]*' + f).test(glob));
}

/* ── C · aucun token mort dans src/ ────────────────────────────── */
const DEAD = ['surface-marque', 'card-frame', 'data-accent', 'bg-texture', 'accent-focus', 'surface-brand'];
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
/* Exception à la convention CSS, justifiée :
   Flow — ~270 lignes de CSS écrit à la main que les utilitaires Tailwind ne
   couvrent pas : un canvas à coordonnées fixes (positionnement absolu par
   px, recalé en JS au resize), des @keyframes (wire-flow, core-pulse), des
   tooltips en attr(data-tip)::after, et des surcharges :global(.dark) pour
   les boîtes qui doivent rester claires en sombre (logos partenaires
   lisibles). Pas de timeline GSAP ici — GSAP anime le sélecteur de mots du
   hero, dans src/pages/index.astro (script inline, pas de <style>).
   LogoMarquee n'a plus de <style> : son animation vit dans global.css
   (--animate-marquee-scroll), comme --animate-proof-marquee. */
const ALLOWED = ['src/components/Flow.astro'];
const styled = files.filter(f => f.endsWith('.astro') && (read(f) || '').includes('<style'));
const illegal = styled.filter(f => !ALLOWED.includes(f.split(path.sep).join('/')));
check('blocs <style> limités aux exceptions', illegal.length === 0, illegal.join(', '));

/* ── G · contraste des variantes de Badge (WCAG ≥ 4.5:1) ───────── */
/* On ne suppose jamais les paires fond/texte : on les LIT dans
   Badge.astro (les objets SOLID et SUBTLE), on résout chaque
   var(--ds-*) depuis geist-tokens.css (:root pour le clair, .dark
   avec repli sur :root pour le sombre — même règle qu'en section E),
   puis on calcule le ratio réel avec les fonctions déjà définies plus
   haut. Une variante mal assortie doit faire échouer cette section,
   pas juste se voir en dark mode. */
const badge = read('src/components/ui/Badge.astro');
check('Badge.astro existe', !!badge);
if (badge && geist) {
  const dsRoot = declMap(extractBlock(geist, ':root {'));
  const dsDark = declMap(extractBlock(geist, '.dark {'));

  const extractPairMap = name => {
    const m = badge.match(new RegExp(name + '\\s*:\\s*Record<string,\\s*string>\\s*=\\s*\\{([\\s\\S]*?)\\n\\s*\\};'));
    if (!m) return null;
    const map = {};
    for (const pm of m[1].matchAll(/(\w+):\s*"([^"]+)"/g)) map[pm[1]] = pm[2];
    return map;
  };
  const resolveDsColor = (token, mode) => {
    const raw = (mode === 'dark' && dsDark[token]) || dsRoot[token];
    if (!raw) throw new Error(token + ' non défini dans geist-tokens.css (mode ' + mode + ')');
    if (!HEX.test(raw)) throw new Error(token + ' = "' + raw + '" — pas un hex direct');
    return raw;
  };

  for (const [mapName, styleLabel] of [['SOLID', 'pleine'], ['SUBTLE', 'discrète']]) {
    const pairs = extractPairMap(mapName);
    if (!pairs) {
      check('Badge.astro : objet ' + mapName + ' lisible', false, 'introuvable ou format inattendu');
      continue;
    }
    for (const [variant, decl] of Object.entries(pairs)) {
      const m = decl.match(/background:var\((--ds-[\w-]+)\);color:var\((--ds-[\w-]+)\)/);
      if (!m) {
        check('Badge ' + styleLabel + ' ' + variant + ' : déclaration analysable', false, decl);
        continue;
      }
      const [, bgToken, fgToken] = m;
      for (const mode of ['light', 'dark']) {
        try {
          const bg = resolveDsColor(bgToken, mode);
          const fg = resolveDsColor(fgToken, mode);
          const r = ratio(fg, bg);
          check(
            'contraste Badge ' + styleLabel + ' ' + variant + ', ' + mode + ' (' + r.toFixed(2) + ':1)',
            r >= 4.5,
            'attendu ≥ 4.5 — ' + fgToken + ' sur ' + bgToken
          );
        } catch (e) {
          check('contraste Badge ' + styleLabel + ' ' + variant + ', ' + mode, false, e.message);
        }
      }
    }
  }
} else {
  check('résolution des contrastes Badge', false, 'Badge.astro ou geist-tokens.css introuvable');
}

/* ── H · la table SEMANTIC de /design-system correspond à global.css ──
   La page /design-system existe pour ne jamais mentir sur le système — mais
   sa constante SEMANTIC recopie en dur la correspondance token → source
   Geist (ex. --surface → --ds-background-100). Si un mapping change dans
   global.css, la page continue d'afficher l'ancien et rien ne le signale :
   même travers que la page existe pour éviter, appliqué aux tokens plutôt
   qu'au markup. Comme en section G, on ne recopie pas les valeurs
   attendues ici — on LIT la table réellement déclarée dans
   design-system.astro et on la compare aux déclarations réelles de
   global.css. ──────────────────────────────────────────────────────── */
const designSystemPage = read('src/pages/design-system.astro');
check('design-system.astro existe', !!designSystemPage);
if (designSystemPage && glob) {
  const tableMatch = designSystemPage.match(/const SEMANTIC = \[([\s\S]*?)\n\];/);
  if (!tableMatch) {
    check('table SEMANTIC lisible dans design-system.astro', false, 'introuvable ou format inattendu');
  } else {
    const rowRe = /\[\s*"(--[\w-]+)"\s*,\s*"(?:[^"\\]|\\.)*"\s*,\s*"((?:[^"\\]|\\.)*)"\s*\]/g;
    const rows = [...tableMatch[1].matchAll(rowRe)];
    check('lignes de la table SEMANTIC extraites', rows.length > 0, 'aucune ligne reconnue dans SEMANTIC');

    const semRoot = declMap(extractBlock(glob, ':root {'));
    const semDark = declMap(extractBlock(glob, '.dark {'));

    for (const [, token, source] of rows) {
      const declared = semRoot[token];
      if (declared === undefined) {
        check('SEMANTIC ' + token + ' : déclaré dans global.css', false, 'absent de :root dans global.css');
        continue;
      }
      const dsMatch = source.match(/^(--ds-[\w-]+)$/);
      if (dsMatch) {
        /* la page annonce une simple indirection var(--ds-*) : global.css doit
           déclarer très exactement ça, pas une autre source ou une valeur figée */
        const expected = 'var(' + dsMatch[1] + ')';
        check(
          'SEMANTIC ' + token + ' → ' + dsMatch[1],
          declared === expected,
          'global.css déclare "' + declared + '", la page annonce "' + expected + '"'
        );
      } else {
        /* source littérale (ex. --accent-hover: "hsl(0 0% 22%) · dark hsl(0 0% 80%)") :
           on extrait les hsl() cités et on vérifie clair (:root) puis, s'il y en a un
           second, sombre (.dark) contre les déclarations réelles. */
        const hsls = source.match(/hsl\([^)]*\)/g) || [];
        if (hsls.length === 0) {
          check('SEMANTIC ' + token + ' : source analysable', false, 'ni --ds-* ni hsl() reconnaissable dans "' + source + '"');
          continue;
        }
        check(
          'SEMANTIC ' + token + ' clair → ' + hsls[0],
          declared === hsls[0],
          'global.css déclare "' + declared + '" en clair, la page annonce "' + hsls[0] + '"'
        );
        if (hsls[1]) {
          const darkDeclared = semDark[token];
          check(
            'SEMANTIC ' + token + ' sombre → ' + hsls[1],
            darkDeclared === hsls[1],
            'global.css déclare "' + darkDeclared + '" en sombre, la page annonce "' + hsls[1] + '"'
          );
        }
      }
    }
  }
} else {
  check('résolution de la table SEMANTIC', false, 'design-system.astro ou global.css introuvable');
}

/* ── I · aucune couleur brute dans le markup (class=/style=) ──────
   Le bug qui a motivé cette section : la plus grosse tuile CTA de la home
   (src/pages/index.astro, la carte « agence créative ») utilisait
   `border-white/40` et `text-white/75` — des utilitaires de palette
   Tailwind qui ne s'inversent jamais avec .dark (--ink devient blanc en
   sombre : la carte elle-même s'inverse via bg-ink/text-surface, mais ce
   lien restait sur du blanc littéral → 1.13:1 de contraste mesuré). Rien
   dans le harnais ne regardait le markup pour de la couleur brute ; cette
   section comble le trou.

   Portée : class="…", class:list={[…]} et style="…"/style={`…`} dans
   src/components/ et src/pages/. On flague :
     - les utilitaires de palette Tailwind (bg-white, text-red-500,
       border-black…, variantes d'opacité /NN comprises — mais pas
       transparent/current/inherit, qui ne sont pas des couleurs figées) ;
     - les hex/rgb()/rgba()/hsl()/hsla() littéraux, mais seulement quand ils
       fixent une propriété de couleur visible de premier plan/fond/bordure
       (color, background[-color], border[-color], fill, stroke,
       outline-color, text-decoration-color) — en style="" comme dans un
       utilitaire arbitraire (bg-[#fff], [color:#fff]…).
   Volontairement hors-scope : mask-image (le hex n'y sert que de canal
   alpha — technique déjà utilisée ailleurs dans le projet, ex. les
   marquees) et box-shadow/drop-shadow (couleur d'élévation, jamais de
   texte ni de fond). Ni l'un ni l'autre n'est le bug que cette section
   existe pour attraper, et les flaguer aurait noyé le signal réel sous du
   bruit sans rapport avec l'inversion dark mode. */
const MARKUP_COLOR_ALLOW = [
  {
    file: 'src/components/Browser.astro',
    reason: 'les trois pastilles macOS (#FE5F57 rouge, #FEBB2E jaune, #26C941 vert) sont de ' +
      'la couleur par décision de spec : trois points gris cesseraient de se lire comme un navigateur.',
  },
];

const MC_PREFIXES = 'bg|text|border|ring|fill|stroke|decoration|outline|accent|caret|divide|from|via|to';
const MC_PALETTE = 'slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black';
const MC_UTILITY_RE = new RegExp('(?:^|[^\\w-])(?:' + MC_PREFIXES + ')-(?:' + MC_PALETTE + ')(?:-[0-9]{2,3})?(?:/[0-9]{1,3})?\\b', 'g');
const MC_COLOR_PROPS = ['color', 'background', 'background-color', 'border', 'border-color', 'fill', 'stroke', 'outline-color', 'text-decoration-color'];
const MC_HEX_RE = /#[0-9a-fA-F]{3,8}\b/;
const MC_FUNC_RE = /\b(?:rgb|rgba|hsl|hsla)\(/;

const stripStyleTags = src => src.replace(/<style[\s\S]*?<\/style>/g, '');

function findMarkupColorHits(src) {
  const hits = [];
  const body = stripStyleTags(src);

  const classChunks = [];
  for (const m of body.matchAll(/\bclass="([^"]*)"/g)) classChunks.push(m[1]);
  for (const m of body.matchAll(/\bclass:list=\{/g)) {
    let depth = 1, i = m.index + m[0].length;
    const start = i;
    while (i < body.length && depth > 0) {
      if (body[i] === '{') depth++;
      else if (body[i] === '}') depth--;
      i++;
    }
    classChunks.push(body.slice(start, i - 1));
  }
  for (const chunk of classChunks) {
    for (const hit of chunk.matchAll(MC_UTILITY_RE))
      hits.push('utilitaire de palette « ' + hit[0].trim() + ' »');
    for (const br of chunk.matchAll(/(?:([a-zA-Z-]+)-)?\[([^\]]+)\]/g)) {
      const prefix = br[1];
      const inner = br[2];
      const isColorPrefixed = !!prefix && new RegExp('^(?:' + MC_PREFIXES + ')$').test(prefix);
      const propMatch = inner.match(/^([a-zA-Z-]+)\s*:/);
      const isColorProp = !!propMatch && MC_COLOR_PROPS.includes(propMatch[1].toLowerCase());
      if (isColorPrefixed || isColorProp) {
        if (MC_HEX_RE.test(inner)) hits.push('hex brut dans un utilitaire arbitraire « ' + br[0] + ' »');
        if (MC_FUNC_RE.test(inner)) hits.push('rgb()/hsl() brut dans un utilitaire arbitraire « ' + br[0] + ' »');
      }
    }
  }

  const styleChunks = [];
  for (const m of body.matchAll(/\bstyle="([^"]*)"/g)) styleChunks.push(m[1]);
  for (const m of body.matchAll(/\bstyle=\{`([^`]*)`\}/g)) styleChunks.push(m[1]);
  for (const chunk of styleChunks) {
    for (const decl of chunk.split(';')) {
      const dm = decl.match(/^\s*([a-zA-Z-]+)\s*:\s*(.+)$/);
      if (!dm) continue;
      const prop = dm[1].toLowerCase();
      const val = dm[2];
      if (!MC_COLOR_PROPS.includes(prop)) continue;
      if (MC_HEX_RE.test(val)) hits.push('hex brut sur `' + prop + '` en style inline (« ' + val.trim() + ' »)');
      if (MC_FUNC_RE.test(val)) hits.push('rgb()/hsl() brut sur `' + prop + '` en style inline (« ' + val.trim() + ' »)');
    }
  }
  return hits;
}

const MARKUP_TARGETS = files.filter(f => {
  const norm = f.split(path.sep).join('/');
  return norm.endsWith('.astro') && (norm.startsWith('src/components/') || norm.startsWith('src/pages/'));
});
const mcAllowedFiles = new Set(MARKUP_COLOR_ALLOW.map(e => e.file));
const markupColorFailures = [];
for (const f of MARKUP_TARGETS) {
  const norm = f.split(path.sep).join('/');
  if (mcAllowedFiles.has(norm)) continue;
  const hits = findMarkupColorHits(read(f) || '');
  if (hits.length) markupColorFailures.push(norm + ' → ' + hits.join(' ; '));
}
check(
  'aucune couleur brute dans class=/style= (src/components, src/pages)',
  markupColorFailures.length === 0,
  markupColorFailures.join(' | '),
);
for (const entry of MARKUP_COLOR_ALLOW)
  check('exception couleur brute justifiée : ' + entry.file, !!entry.reason && entry.reason.length > 20);

/* ── sortie ────────────────────────────────────────────────────── */
console.log(ok.map(s => '  ok    ' + s).join('\n'));
if (fail.length) {
  console.log('\n' + fail.map(s => '  ÉCHEC ' + s).join('\n'));
  console.log('\n' + fail.length + ' assertion(s) en échec sur ' + (ok.length + fail.length) + '.');
  process.exit(1);
}
console.log('\n' + ok.length + ' assertions, toutes vertes.');
