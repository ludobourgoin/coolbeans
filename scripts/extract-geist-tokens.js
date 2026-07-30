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
