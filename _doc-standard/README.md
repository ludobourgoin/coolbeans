# `_doc-standard/` — Bundle "la doc" (standard de passation Coolbeans)

> **Statut : isolé, non branché.** Ce dossier est un bundle autonome. Rien ici n'est
> encore câblé au site Coolbeans (le préfixe `_` le tient hors du build tant que tu ne
> l'intègres pas). Tu le recopies dans `src/` quand tu veux le mettre en ligne.

## Ce que c'est

Le **standard "la doc"** : un modèle de documentation de passation réutilisable sur tous
tes projets web (Webflow, Shopify, Astro+Sanity…), destiné à être hébergé dans le futur
**dashboard client Coolbeans**, une page par projet, protégé par mot de passe.

Premier projet pilote : **Amusoire**.

## Ce que ce n'est PAS

- ❌ Ça **ne remplace pas** la doc Docsify live de la cliente Amusoire
  (`https://amusoire.pages.dev/#/`). Elle reste **intouchée** et à jour.
- ❌ Ce n'est pas encore intégré/déployé. C'est un livrable "prêt à poser".

## Contenu (au fil de l'implémentation)

```
_doc-standard/
  README.md   ← ce fichier
  SPEC.md     ← spécification de conception (à relire en premier)
  src/        ← scaffold à recopier dans coolbeans/src/ (ajouté à l'étape implémentation)
    layouts/DocLayout.astro
    components/doc/*
    content/docs/_template/*     ← gabarit vierge (placeholders "(à compléter)")
    content/docs/amusoire/*      ← pilote
    styles/doc-accent.css
    pages/docs/[project]/[...slug].astro
```

## Intégration dans `dev/coolbeans` (résumé — détaillé à l'implémentation)

1. Copier `_doc-standard/src/**` dans `coolbeans/src/**`.
2. Vérifier la content collection `docs` (config Astro).
3. Publier sur staging Cloudflare Pages (`https://staging.coolbeans-1ta.pages.dev/`).
4. Protéger `/docs/*` via **Cloudflare Access**.
5. Supprimer `_doc-standard/` une fois intégré.

Voir **`SPEC.md`** pour tout le détail.
