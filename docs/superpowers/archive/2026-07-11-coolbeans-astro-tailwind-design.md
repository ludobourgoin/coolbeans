# Coolbeans — Environnement Astro + Tailwind & 3 premières pages

**Date :** 2026-07-11
**Statut :** validé (design approuvé)

## Objectif

Rationaliser le handoff design `coolbeans-astro-handoff` en un environnement Astro +
Tailwind v4 propre, avec une **source de vérité CSS unique** (`global.css`), puis
reconstruire fidèlement les 3 premières pages : **home, about, tools**.

Le handoff remplace l'ancienne pile (`inline <style>` + `folk-skin.css` +
`system-2026.css`, empilées avec `!important`) par une seule couche.

## Contexte

- Repo cible : `dev/coolbeans` (repo git existant, Astro `^6.1.10`, aucune intégration
  installée, seulement `src/pages/index.astro` scaffold + favicons).
- Le repo contient une copie **identique** du handoff dans `coolbeans-astro-handoff/`
  (vérifié par `diff -rq` avec l'archive `~/Downloads/coolbeans-astro-handoff`).
- Source design : `~/Downloads/coolbeans-astro-handoff` (reste l'archive de référence).
- Contenu FR. Design monochrome (accent = encre), option accent bleu électrique via
  `[data-accent="electric"]`. Dark mode via classe `.dark` sur `<html>`.

## Décisions

1. **Cible** : intégrer dans `dev/coolbeans`. Extraire assets + `global.css`, brancher
   Tailwind v4, puis **supprimer** le dossier dupliqué `coolbeans-astro-handoff/` du repo
   (confirmation avant suppression). L'archive Downloads reste intacte.
2. **Tailwind v4 CSS-first** via `@tailwindcss/vite` (recommandation du handoff, Astro 6).
   `tailwind.config.mjs` (fallback v3) **non utilisé**.
3. **Fidélité** : mise en page fidèle au rendu de référence, mais animations gelées en v1 :
   - hero home **sans** typewriter (mot fixe : « agences créatives »)
   - marquees logos **statiques / CSS-only** (aucun JS de défilement en v1)
   - dropdown nav « Vous êtes » **retiré** (nav plate)
4. **Dark mode inclus** en v1 : script anti-flash + toggle dans la nav.
5. **Accent électrique** : mécanisme laissé en place (`data-accent`), pas d'UI de switch.
6. **Nav & footer** réduits aux 3 pages construites (home/about/tools) + un **CTA « contact »**
   présent dans la nav ET le footer, pointant vers `#` (page contact à venir).

## Environnement

- `astro.config.mjs` : ajouter le plugin Vite `@tailwindcss/vite`.
- `package.json` : deps ajoutées `tailwindcss` (v4), `@tailwindcss/vite`.
- `src/styles/global.css` : copié tel quel depuis le handoff (source de vérité).
- `public/fonts/` : Geomanist (book, medium, bold, black) `.woff2`.
- `public/img/` : `bg-texture.png`, `logos/*`, photos (`ludovic-home.jpg`,
  `ludovic-about.jpg`, `trigger-team.jpg`), icônes produits.
- `tailwind.config.mjs` (fallback v3) : ne pas copier.

## Architecture composants

```
src/
├── styles/global.css            source de vérité unique (import 1×)
├── layouts/BaseLayout.astro     <html>/<head>, meta+SEO (props title/description),
│                                import global.css, script anti-flash dark, <slot/>
├── components/
│   ├── Nav.astro                3 liens (home/about/tools) + CTA contact (#) + toggle dark
│   ├── Footer.astro             colonnes réduites aux pages réelles + CTA contact (#)
│   ├── CtaBand.astro            bande CTA finale partagée (props titre/CTA)
│   └── LogoMarquee.astro        bande logos statique CSS-only (props: liste, sens)
├── data/tools.ts                catégories d'outils (~11) en données typées
└── pages/
    ├── index.astro   home
    ├── about.astro   about
    └── tools.astro   tools
```

Les sections propres à une page (hero, bento « vous êtes », méthode, stats, intro,
approche, encart Trigger…) vivent dans le fichier de page, avec `<style>` scopé si un
layout bespoke le nécessite, en consommant tokens + primitives de `global.css`.

## Contenu des pages (d'après `reference/*.html`)

- **home** (`index.astro`) : nav · hero centré (h1 fixe) · proof marquee · bento
  « vous êtes… » · projets récents · témoignages · méthode (brief→prod) · stats ·
  about court · CTA final · footer.
- **about** (`about.astro`) : nav · hero « développement, stratégie, performance. » ·
  double marquee stack (stack tech) · intro Ludovic · approche (bénéfices) · encart
  Trigger (agence Toulouse) · CTA final · footer.
- **tools** (`tools.astro`) : nav · hero « tools. » · ~11 catégories de cartes d'outils
  (dev, cms/no-code, automatisation, hébergement, design, analyse & seo, email & crm,
  paiements, productivité, poste de travail, audio & vidéo) · footer.

Le markup de référence (`reference/01-home.html`, `05-about.html`, `08-tools.html`) est la
**cible visuelle** : lire le markup, le reconstruire en Astro consommant `global.css`.

## Dark mode

- Script inline dans `<head>` (BaseLayout) : lit `localStorage.theme` puis
  `prefers-color-scheme`, applique `.dark` sur `<html>` **avant** paint (anti-flash).
- Toggle dans la nav : bascule `.dark`, persiste dans `localStorage`.

## Rationalisation attendue

- Une seule couche CSS (fin de `folk-skin.css` + `system-2026.css` + inline `!important`).
- Tools data-driven (évite ~900 lignes de markup répété).
- Aucun CDN externe (logos rapatriés en local).

## Hors périmètre (v1)

- Pages contact/projets/blog (CTA → `#`).
- Typewriter du hero, marquees animés en JS, dropdown nav.
- UI de switch pour l'accent électrique.
- Favicons `ahrefs` / `gocardless` (à sourcer manuellement, non bloquant).

## Critères de succès

- `npm run build` passe sans erreur.
- Les 3 pages rendent fidèlement le design de référence (mise en page, typo, couleurs,
  dark mode).
- `bg-surface` / `text-ink` / `.btn` etc. basculent correctement clair↔sombre.
- Aucune référence à un CDN externe ni à l'ancienne pile CSS.
- Le dossier `coolbeans-astro-handoff/` dupliqué est retiré du repo.
