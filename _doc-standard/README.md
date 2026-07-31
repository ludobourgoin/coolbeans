# `_doc-standard/` — Bundle "la doc" (standard de passation Coolbeans)

> **Statut : implémentation livrée, isolée, non branchée.** Le préfixe `_` et le
> `@source not` de `global.css` tiennent ce dossier hors du build. Tu recopies
> `src/` dans `coolbeans/src/` quand tu veux monter la doc sur le site.

## Ce que c'est

Le **standard "la doc"** : documentation de passation réutilisable sur tous les projets
web (Webflow, Shopify, Astro+Sanity…), rendue par le site Coolbeans (Astro 7, tokens du
design system, dark mode). Premier projet pilote : **Amusoire** (7 pages, contenu complet).

- `SPEC.md` — spécification de conception (design validé sur `preview.html`).
- `preview.html` — maquette statique autonome (ouvre-la dans un navigateur).
- `src/` — le code à recopier, arborescence miroir de `coolbeans/src/` :

```
src/
  content.config.ts                      ← collection `docs` (fichier neuf à la racine src/)
  layouts/DocLayout.astro                ← 3 colonnes : nav+recherche / contenu / ancres H2
  components/doc/
    Callout.astro                        ← note / tip / warn / danger / piège
    Pill.astro                           ← pastilles ok / warn / bad
    Meta.astro                           ← statut + date de MAJ en tête de page
    SidebarNav.astro · TocRight.astro
  styles/doc.css                         ← couche docs N&B (scopée .doc-root)
  pages/docs/[project]/[...slug].astro   ← route /docs/<projet>/<page>
  content/docs/
    _template/*.mdx                      ← gabarit vierge (6 pages, placeholders)
    amusoire/*.mdx                       ← pilote (7 pages, contenu complet)
```

## Ce que ce n'est PAS

- ❌ Ça **ne remplace pas** la doc Docsify live de la cliente Amusoire
  (`https://amusoire.pages.dev/#/`). Elle reste intouchée tant que le nouveau format
  n'est pas servi.
- ❌ Ce n'est pas déployé. **Aucune publication en prod sans ordre explicite** — staging only.

## Intégration dans `dev/coolbeans` (checklist)

1. **MDX** : `npx astro add mdx` (installe `@astrojs/mdx` et le déclare dans
   `astro.config.mjs`).
2. **Coloration du code** : dans `astro.config.mjs`, ajouter :
   ```js
   markdown: { shikiConfig: { theme: "github-dark" } },
   ```
3. **Copier** `_doc-standard/src/**` dans `coolbeans/src/**` (fichiers neufs uniquement,
   rien à écraser — `content.config.ts` n'existe pas encore côté site).
4. `npm run dev` → vérifier `http://localhost:4321/docs/amusoire` : nav 7 pages,
   recherche ⌘K, ancres à droite, dark mode, boutons "Copier" sur les blocs de code,
   prev/next.
5. **Staging** : déployer sur l'environnement de staging habituel. Pas de prod.
6. **Accès** : protéger `/docs/*` via **Cloudflare Access** (Zero Trust → Access →
   Applications → self-hosted, domaine + path `/docs`, policy email OTP / mot de passe)
   **avant** de partager l'URL. Les pages sortent déjà avec `noindex`.
7. Une fois intégré : supprimer `_doc-standard/` (et la ligne
   `@source not "../../_doc-standard"` de `global.css`).

## Choix d'implémentation (écarts assumés vs SPEC)

- **CodeBlock.astro remplacé** par Shiki (natif Astro, thème `github-dark`) + un script
  du layout qui ajoute bandeau langage + bouton copier. Moins de code, même rendu.
- **Typo** : la doc suit les tokens actuels du site (corps Geist, titres Geomanist
  bold) — la maquette HTML utilisait encore Geomanist Book/JetBrains Mono.
- **Recherche** : index client-side (pages × sections H2 + texte brut) injecté en JSON
  à la build. Full-text serveur = hors périmètre v1.
- `/docs/_template/` **existe en route** (aperçu du gabarit) : c'est voulu ; Cloudflare
  Access couvre aussi ce chemin.
- **Mobile** : sous 860px la sidebar passe au-dessus du contenu (pas de tiroir en v1).

Voir **`SPEC.md`** pour la conception complète.
