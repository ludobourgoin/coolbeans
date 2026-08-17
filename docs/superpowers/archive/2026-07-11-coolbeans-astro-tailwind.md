# Coolbeans — Astro + Tailwind v4 & 3 pages — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rationaliser le handoff design en un environnement Astro 6 + Tailwind v4 CSS-first à source de vérité unique, et reconstruire fidèlement les pages home / about / tools.

**Architecture:** Tailwind v4 branché via `@tailwindcss/vite`. `src/styles/global.css` (copié du handoff) porte tous les tokens (`@theme`), le dark mode (`.dark`) et les primitives (`.btn/.card/.field/.link/.label/.surface-brand`). Un `BaseLayout.astro` importe le CSS une fois et gère l'anti-flash dark. Nav/Footer/CtaBand/LogoMarquee sont des composants partagés ; les sections propres à chaque page vivent dans le fichier de page. Les outils sont data-driven (`src/data/tools.ts`).

**Tech Stack:** Astro `^6.1.10`, Tailwind CSS v4, `@tailwindcss/vite`, Geomanist (woff2).

## Global Constraints

- Node `>=22.12.0` (déjà dans `package.json`).
- Tailwind **v4 CSS-first** uniquement — ne PAS créer/utiliser `tailwind.config.mjs`.
- `global.css` = **source de vérité unique** : ne pas dupliquer de tokens ailleurs.
- Dark mode piloté par classe `.dark` sur `<html>`. Anti-flash obligatoire.
- Contenu FR, fidèle aux pages `reference/*.html`.
- Nav/footer : liens réels = home/about/tools ; CTA « contact » présent (nav + footer) → `#`.
- Animations gelées en v1 : pas de typewriter, marquees CSS-only statiques, pas de dropdown.
- Aucun CDN externe (assets locaux uniquement).
- Vérification par tâche = `npm run build` passe (+ contrôle visuel `npm run dev`).

---

### Task 1: Brancher Tailwind v4 + assets + source de vérité CSS

**Files:**
- Modify: `astro.config.mjs`
- Modify: `package.json` (deps)
- Create: `src/styles/global.css` (copie du handoff)
- Create: `public/fonts/*.woff2`, `public/img/**` (copie du handoff)

**Interfaces:**
- Produces: utilitaires Tailwind + primitives (`bg-surface`, `text-ink`, `.btn`, `.card`,
  `.field`, `.link`, `.label`, `.container-site`, `.surface-brand`, `font-display`,
  `rounded-control`, `max-w-site`) disponibles dès qu'un composant importe `global.css`.

- [ ] **Step 1:** Copier `public/fonts/` et `public/img/` du handoff vers `public/` du repo.
- [ ] **Step 2:** Copier `src/styles/global.css` du handoff vers `src/styles/global.css`.
- [ ] **Step 3:** Installer `npm i tailwindcss @tailwindcss/vite`.
- [ ] **Step 4:** Modifier `astro.config.mjs` :

```js
// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  vite: { plugins: [tailwindcss()] },
});
```

- [ ] **Step 5:** `npm run build`. Attendu : build OK (page scaffold encore présente).

---

### Task 2: BaseLayout (head, SEO, import CSS, anti-flash dark)

**Files:**
- Create: `src/layouts/BaseLayout.astro`

**Interfaces:**
- Consumes: `src/styles/global.css`.
- Produces: `BaseLayout` avec props `{ title: string; description?: string }` et un `<slot />`.
  Applique `.dark` sur `<html>` avant paint. Expose `window`-level toggle non requis ici
  (le toggle vit dans Nav).

- [ ] **Step 1:** Créer `BaseLayout.astro` : `<html lang="fr">`, `<head>` (charset, viewport,
  favicons `/favicon.svg` + `/favicon.ico`, `<title>{title}</title>`, meta description,
  `og:title`/`og:description`), import `../styles/global.css`, `<slot />`.
- [ ] **Step 2:** Ajouter dans `<head>` le script anti-flash (inline, avant le body) :

```html
<script is:inline>
  const t = localStorage.getItem('theme');
  const dark = t === 'dark' || (!t && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
</script>
```

- [ ] **Step 3:** `npm run build`. Attendu : OK.

---

### Task 3: Nav (3 liens + CTA contact + toggle dark)

**Files:**
- Create: `src/components/Nav.astro`

**Interfaces:**
- Consumes: primitives `global.css`, `Astro.url.pathname` pour l'état actif.
- Produces: `<Nav />` (pas de props). Barre : wordmark (logo), liens home/about/tools,
  bouton toggle dark (id `theme-toggle`), CTA « contact » (`.btn .btn-sm`, `href="#"`).

- [ ] **Step 1:** Markup nav dans `.container-site`, liens actifs via `pathname`.
  Logo = `/img/coolbeans-wordmark.svg` (clair) / `-white.svg` (dark) OU mark ; classes tokens.
- [ ] **Step 2:** Bouton toggle : script `is:inline` qui bascule `.dark` sur `<html>` et
  écrit `localStorage.theme`.

```html
<script is:inline>
  document.getElementById('theme-toggle')?.addEventListener('click', () => {
    const d = document.documentElement.classList.toggle('dark');
    localStorage.setItem('theme', d ? 'dark' : 'light');
  });
</script>
```

- [ ] **Step 3:** `npm run build`. Attendu : OK.

---

### Task 4: Footer + CtaBand + LogoMarquee (partagés)

**Files:**
- Create: `src/components/Footer.astro`
- Create: `src/components/CtaBand.astro`
- Create: `src/components/LogoMarquee.astro`

**Interfaces:**
- Produces:
  - `<Footer />` — `.surface-brand`, colonnes réduites aux pages réelles + CTA contact (`#`),
    mentions. Basé sur `footer.site-footer` de `reference/`.
  - `<CtaBand title="…" cta="…" href="#" />` — bande CTA finale partagée.
  - `<LogoMarquee logos={string[]} reverse?={boolean} />` — bande de logos **statique**
    (flex wrap ou piste CSS non animée), source `/img/logos/*.svg`.

- [ ] **Step 1:** Écrire les 3 composants d'après le markup `reference/` (footer, `.cta`, `.proof-marquee`).
- [ ] **Step 2:** `npm run build`. Attendu : OK.

---

### Task 5: Page home (`index.astro`)

**Files:**
- Modify: `src/pages/index.astro` (remplace le scaffold)
- Reference: `~/Downloads/coolbeans-astro-handoff/reference/01-home.html`

**Interfaces:**
- Consumes: `BaseLayout`, `Nav`, `Footer`, `CtaBand`, `LogoMarquee`.

- [ ] **Step 1:** Lire `reference/01-home.html`. Reconstruire en Astro dans `BaseLayout`
  (title « Coolbeans — studio web ») : hero centré (h1 **fixe** « Le studio web des agences
  créatives »), proof `LogoMarquee`, bento « vous êtes… », projets récents, témoignages,
  méthode, stats, about court, `CtaBand`, `Footer`. Sections uniques = markup local +
  `<style>` scopé si besoin, consommant tokens/primitives. Pas de canvas/typewriter/JS d'anim.
- [ ] **Step 2:** `npm run build` puis `npm run dev`, contrôle visuel vs `01-home.html`
  (clair + dark). Attendu : mise en page fidèle, bascule dark OK.

---

### Task 6: Page tools (`tools.astro`) data-driven

**Files:**
- Create: `src/data/tools.ts`
- Create: `src/pages/tools.astro`
- Reference: `~/Downloads/coolbeans-astro-handoff/reference/08-tools.html`

**Interfaces:**
- Produces: `tools.ts` exporte `categories: { id: string; title: string; items: {
  name: string; logo?: string; desc?: string; href?: string }[] }[]`.
- Consumes: `BaseLayout`, `Nav`, `Footer`.

- [ ] **Step 1:** Extraire de `08-tools.html` les ~11 catégories (dev, cms, automation,
  hosting, design, analytics, email, payments, productivity, workstation, audio) et leurs
  cartes vers `src/data/tools.ts` (typé).
- [ ] **Step 2:** `tools.astro` : hero « tools. », `map` sur `categories` → `.cat` + cartes
  (`.card`/`.label`), logos `/img/logos/*`. `Footer`.
- [ ] **Step 3:** `npm run build` + contrôle visuel vs `08-tools.html`. Attendu : fidèle.

---

### Task 7: Page about (`about.astro`)

**Files:**
- Create: `src/pages/about.astro`
- Reference: `~/Downloads/coolbeans-astro-handoff/reference/05-about.html`

**Interfaces:**
- Consumes: `BaseLayout`, `Nav`, `Footer`, `CtaBand`, `LogoMarquee`.

- [ ] **Step 1:** Reconstruire d'après `05-about.html` : hero « développement, stratégie,
  performance. », double `LogoMarquee` stack (2e `reverse`), intro Ludovic
  (photo `ludovic-about.jpg`), approche (bénéfices), encart Trigger (`trigger-team.jpg`),
  `CtaBand`, `Footer`.
- [ ] **Step 2:** `npm run build` + contrôle visuel vs `05-about.html` (clair + dark). Attendu : fidèle.

---

### Task 8: Cleanup + build final

**Files:**
- Delete: `coolbeans-astro-handoff/` (dossier dupliqué dans le repo — **confirmer avant**)
- Modify: `README.md` (note d'install courte : Tailwind v4, global.css)

- [ ] **Step 1:** Confirmer la suppression, puis `rm -rf coolbeans-astro-handoff/` (archive
  Downloads conservée).
- [ ] **Step 2:** Vérifier qu'aucune référence à `folk-skin.css` / `system-2026.css` /
  CDN externe ne subsiste (`grep -r`).
- [ ] **Step 3:** `npm run build` final. Attendu : OK, 3 pages générées.
- [ ] **Step 4 (optionnel) :** brancher + commit si l'utilisateur le demande.

## Self-Review

- **Spec coverage :** env (T1) · BaseLayout/dark (T2) · Nav+toggle+CTA (T3) · Footer/CTA/marquee (T4) · home (T5) · tools (T6) · about (T7) · cleanup+build (T8). Toutes les sections du spec sont couvertes.
- **Placeholders :** les tâches pages référencent le markup source `reference/*.html` (volumineux, non réinliné) — c'est intentionnel, pas un placeholder : la source est fournie.
- **Types :** `tools.ts` `categories[]` cohérent entre T6 step 1 et 2. Props `BaseLayout {title, description?}`, `CtaBand {title, cta, href}`, `LogoMarquee {logos, reverse?}` cohérentes entre définition et usage.
