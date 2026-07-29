# Spec — Standard "la doc" (passation) + pilote Amusoire

| | |
|---|---|
| **Projet** | Standard de doc de passation Coolbeans ("la doc") |
| **Propriétaire du doc** | Ludovic Bourgoin (Coolbeans) |
| **Version** | 0.1 (design) |
| **Dernière MAJ** | 2026-07-28 |
| **Statut** | Design — en relecture, avant plan d'implémentation |
| **Emplacement canonique (cible)** | Dashboard client Coolbeans (Astro), `/docs/<projet>/…`, protégé Cloudflare Access |

---

## 0. Contexte & problème

Coolbeans livre des sites web (Webflow, Shopify, Astro+Sanity) et fournit une **doc de
passation** par projet. L'existant Amusoire est un **Docsify** mono-fichier
(`docs/index.html` + `PASSATION.md`, déployé sur `amusoire.pages.dev`), centré Simulateur,
en une seule page.

**Objectif** : définir un **standard réutilisable** de doc de passation — un "document de
vérité" pour toutes les parties prenantes (client + Coolbeans + prestataires) — rendu dans
un layout 3 colonnes (nav pages à gauche, contenu, ancres H2 à droite), à la marque
Coolbeans, hébergeable dans le futur dashboard client.

**Contraintes dures**
- La doc Docsify live d'Amusoire (`amusoire.pages.dev`) **reste intouchée** (utilisée par la
  cliente). Le pilote Amusoire du nouveau format est **parallèle**, jamais un remplacement.
- Le nouveau format est livré **isolé** dans `coolbeans/_doc-standard/` (non branché), prêt
  à recopier dans `coolbeans/src/`.
- **Aucune publication en prod sans ordre explicite** (règle `/dev/CLAUDE.md`). Staging only.

---

## 1. Décisions verrouillées

1. **Socle** : le site **Coolbeans existant** (Astro 6 + Tailwind v4, Cloudflare). Pas de
   Starlight (il veut posséder tout le site et cohabite mal avec le marketing + futur
   dashboard). → **Layout maison réutilisable**.
2. **Contenu** : une **content collection Astro `docs`**, MDX portable, 1 dossier par projet.
   Les fichiers survivent à un changement de moteur de rendu (dashboard Clerk futur).
3. **Navigation** : gauche = **chapitres (1 seul niveau de groupement) × pages** ; droite =
   "Sur cette page" = **H2** de la page courante.
4. **Charte** : réutilise `src/styles/global.css` de Coolbeans (Geomanist, encre, cream,
   dark par classe `.dark`) + une **couche d'accent "docs"** (palette Folk) par-dessus.
5. **Accès** : **Cloudflare Access** sur `/docs/*` (mot de passe / email OTP, zéro code).
   Clerk plus tard, pour le dashboard multi-comptes.
6. **Multi-stack** : standard **agnostique** ; la couche "édition/CMS" est un **module par
   plateforme** (Webflow / Shopify / Astro+Sanity).
7. **Template** : la doc est livrée avec des **placeholders `(à compléter)`** assumés →
   réutilisable telle quelle.
8. **Fraîcheur** : chaque doc porte **propriétaire + version + date de MAJ** ; **un seul
   emplacement canonique**.

---

## 2. Modèle de contenu

Content collection `docs`, un dossier par projet :

```
src/content/docs/
  _template/            ← gabarit vierge (placeholders)
  amusoire/
    01-fiche-projet.mdx
    02-contexte.mdx
    …
```

Frontmatter minimal, **identique sur tous les projets** :

```yaml
---
project: "amusoire"                     # dossier / clé projet
chapter: "Cadre & pilotage"             # SEUL niveau de groupement (nav gauche)
title: "Parties prenantes & gouvernance"
order: 4                                # ordre dans le chapitre
status: "draft" | "review" | "final"    # optionnel
updated: 2026-07-28                      # date de MAJ de la page
---
```

Le **chapitre** est l'unique clé de groupement de la nav gauche ; l'`order` trie les pages
dans le chapitre. Les H2 du corps alimentent la nav droite.

---

## 3. Squelette standard (9 chapitres × pages)

> Chapitre = groupe de nav ; chaque chapitre porte 1..N pages. **Cœur** = quasi tous les
> projets ; **(opt)** = activé si pertinent. Chaque projet instancie le sous-ensemble utile.

**1. Cadre & pilotage** *(cœur)*
- Fiche projet — carte d'identité : client, entité(s), périmètre en 1 phrase, statut, dates
  clés, **propriétaire + version + date MAJ du doc**, URLs prod/staging, **Liens Rapides**.
- Contexte & objectifs — description, enjeux business, cibles/personae, périmètre in/out.
- L'entreprise & ses marques — structure, entités/marques, établissements.
- **Parties prenantes & gouvernance** — annuaire contacts **client + Coolbeans + tiers**,
  décisionnaires (qui valide quoi : prod, contenu, budget, design), **RACI léger**, canaux
  & rituels, **process de demande** (évolution / bug).

> Les do's & don'ts d'autonomie ne font **pas** l'objet d'une page dédiée "règles d'or" :
> ils vivent en admonitions `piège`/`danger` **au plus près** du geste concerné.

**2. Architecture** *(cœur)*
- Vue technique — stack, environnements (prod/staging), **écosystème & schéma de flux**.
- Sitemap — **HTML sitemap** (liste de pages liées, nouvel onglet) + lien **sitemap XML**.

**3. Intégrations & automatisations** *(cœur)*
- 1 page par intégration (ex. Forms → Make → HubSpot) · **référentiels d'IDs** (tables).

**4. Fonctionnalités sur-mesure** *(cœur)*
- 1 page par feature (ex. Simulateur, Popup opt-in, scripts custom).

**5. Contenu & édition** *(cœur)* — voir §4 (module plateforme)
- Principes agnostiques + pages spécifiques plateforme.

**6. SEO, Tracking & conformité** *(opt)*
- SEO on-page & sitemap · Analytics / tracking (provenance des leads) · RGPD / cookies /
  opt-in / rétention.

**7. Accès, secrets & sécurité** *(opt)*
- Comptes & accès (qui accède à quoi) · **où vivent les secrets** (1Password/env, **jamais
  en clair**, jamais dans git) · posture sécu (whitelisting, rotation).

**8. Exploitation & mémoire** *(cœur)*
- Maintenance & vigilance (pièges + pattern *Incident & correctif*).
- **Collaboration & support** — SAV inclus vs devis, **template de rapport de bug** (lien +
  device + navigateur + Loom), réflexe "cherche d'abord dans la doc", quotas/alertes
  hébergement, rituel **staging → validation → prod + backup nommé**.
- **Journal de modifications** (tenu par le client : `Date | Action | Impact | Backup ?`) +
  **Log des bugs corrigés** (`Bug | Cause racine | Correctif`).

**9. Ressources** *(cœur)*
- Liens (repos, dashboards, Figma, analytics, drive) · **propriété & droits** (qui possède
  code/design/comptes/domaine) · **glossaire** métier.

**Instanciation Amusoire** : les 9 chapitres s'appliquent (SEO/Tracking et RGPD pertinents).

---

## 4. Couche "édition/CMS" — module par plateforme

Le chapitre 5 se scinde en deux :

**Principes agnostiques** (valables partout) :
- convention de nommage **stable** (classes / composants / champs) — *ne jamais renommer
  sous peine de tout casser* ;
- seuils médias (poids/dimensions, OG image ~1200×630, alt text, nommage fichiers) ;
- modèle éditorial (titre → slug, catégorie, meta title/description) ;
- composant réutilisable = **source unique** (modif à un endroit → répercutée partout).

**Pages spécifiques plateforme** (on active la bonne) :
- `Éditer (Webflow)` — Client-First, Designer, Assets, panneau Properties/Components, CMS.
- `Éditer (Shopify)` — thème, sections/blocks, metafields, Online Store editor.
- `Éditer (Astro + Sanity)` — Studio, schémas, Portable Text, déploiement.

Amusoire = module **Webflow** (reprend l'esprit du Playbook Notion existant).

---

## 5. Bibliothèque de patterns de contenu

> **Principe : clarté > exhaustivité.** C'est un **menu**, pas une checklist à empiler. On
> ne reprend **pas** les micro-gestes plateforme (scories du Playbook Webflow) ; on garde ce
> qui rend le doc navigable et actionnable. Chaque page doit se lire sans effort.

Composants/gabarits que le standard fournit et documente :

- **Règle d'or → Pourquoi → Interdits** — chaque convention explique la conséquence si on
  la casse + liste d'interdits explicites. Cœur de l'autonomie client.
- **Tableau 3 colonnes** `Quoi | Règle·Action | Impact·Conseil` (la 3ᵉ colonne = le pourquoi).
- **Checklist `[ ]`** · **step-by-step numéroté** · **toggle "voir screenshot"** (`<details>`
  pour garder la page compacte).
- **Incident & correctif** : `Symptôme → Cause racine → Correctif (diff) → Comment étendre`.
- **Référentiel / registre** : table de correspondance qui évolue (ex. ajouter une ligne).
- **Migration "zéro perte"** : nouvelle version en parallèle, bascule sans perte.
- **Placeholders `(à compléter)`** assumés dans le gabarit.
- **Cross-linking** entre chapitres (SEO ↔ CMS, Maintenance ↔ Backups…).

---

## 6. Admonitions (callouts) — 1re classe dans le layout

Composant `<Callout type="…">` :

| type | couleur | hex bord | hex fond (teinte) | usage |
|---|---|---|---|---|
| `note` | 🟦 bleu | `#94C4FF` | `#BED9EF` | information |
| `tip` | 🟩 vert (lime) | `#BDEE63` | `#E3EFDC` | astuce / OK |
| `warning` | 🟨 or | `#FFC53D` | `#FFF0BD` | attention |
| `danger` | 🔴 corail | `#F54E50` | `#F6DFF6` | risque de casse |
| `piège` | 🟪 iris | `#C1AAF9` | `#F6DFF6` | **contre-intuitif / ne-pas-« corriger » sans test** |

Le type **`piège`** est le signal à plus haute valeur d'une passation (ex. Amusoire : "les
forms pro remontent sur AMUSOIRE, ne pas corriger" ; ex. O2 : "clé sans accent, ne pas
ajouter l'accent sans test").

---

## 7. Charte & palette

**Base** = tokens Coolbeans (`global.css`) : Geomanist (display) + Geomanist Book (corps),
JetBrains Mono (labels), surfaces cream/encre, dark par `.dark`, radius contrôle 6px.

**Couche accent "docs"** = palette Folk **exacte** (source : folk.app/fr/products/dashboards) :

| rôle | hex | teinte claire (fonds) |
|---|---|---|
| Iris (lavande) | `#C1AAF9` | `#F6DFF6` |
| Or (jaune) | `#FFC53D` | `#FFF0BD` |
| Magenta (rose) | `#F59BF8` | `#F6DFF6` |
| Bleu (bleuet) | `#94C4FF` | `#BED9EF` |
| Vert (lime) | `#BDEE63` | `#E3EFDC` |
| Corail (rouge) | `#F54E50` | — |
| Cyan (secondaire) | — | `#C4EAEE` |

> **Harmonie native** : le cream Folk `#F7F3EF` = exactement `--surface-marque` de Coolbeans.
> Les deux chartes s'accordent sans réglage.

**Emplois — la couleur est un signal, pas un décor** : admonitions (§6) · blocs de code ·
pastilles de statut **sémantiques** (ex. AMUSOIRE / BLINDTEST). **Pas** de couleur par
chapitre, **pas** de hero multicolore, **pas** de fond de page décoratif — la nav et la
surface de lecture restent sobres (encre/cream). Ces couleurs sont claires (L ≈ 62–82 %) →
texte **encre** dessus (contraste OK).

**Garde-fous lisibilité** (non négociables) : surface de lecture calme (cream/blanc clair,
encre sombre) ; couleurs **aux bords** jamais derrière le corps de texte ni le code ; fonds
de callout en teinte légère (low-alpha, contraste AA) ; **variantes dark** pour chaque
couleur. Couche **séparée** des tokens marketing (le site vitrine reste mono encre).

---

## 8. Layout maison — `DocLayout.astro`

**Structure 3 colonnes** (desktop ≥ ~1100px ; empilé/tiroir en mobile) :
- **Gauche** : nav des chapitres (`.label` mono) → pages (triées `order`), **sobre, sans
  couleur** ; état actif = filet encre.
- **Centre** : MDX rendu (prose Coolbeans, code, tables, diagrammes, admonitions).
- **Droite** : "Sur cette page" = H2 auto (ancres, actif au scroll, `text-mute`/`text-ink`).

**Route** : `src/pages/docs/[project]/[...slug].astro` → charge la collection, groupe par
`chapter`, rend `DocLayout`.

**Composants** : `DocLayout.astro`, `SidebarNav.astro`, `TocRight.astro`, `Callout.astro`,
`StatusPill.astro`, `ScreenshotToggle.astro`, `Meta.astro` (propriétaire/version/MAJ en tête).

**Comportements** : dark mode hérité (anti-flash déjà dans `BaseLayout`) ; ancres H2
cliquables ; responsive (nav gauche en tiroir sous 1100px, TOC droite masquée sous ~1280px).

---

## 9. Accès & sécurité

- **Cloudflare Access** sur `/docs/*` (ou `/docs/amusoire/*`) : mot de passe / email OTP au
  niveau edge, **zéro code applicatif**, gratuit ≤ 50 users. Indépendant du rendu.
- Secrets : **jamais** dans le contenu MDX ni dans git. Le chapitre 7 documente **où** ils
  sont (1Password/env), pas **quoi**.

---

## 10. Fraîcheur & gouvernance du doc

1. **Propriétaire** nommé (Fiche projet).
2. **Version + date de dernière MAJ** visibles en tête (composant `Meta`).
3. **Emplacement canonique unique** (dashboard Coolbeans) — pas de copies éparpillées.
4. Doc = **template** : le `_template/` porte les placeholders `(à compléter)`.

---

## 11. Instanciation Amusoire (pilote)

- **Coexistence** : la Docsify live (`amusoire.pages.dev`) reste la doc active de la
  cliente. Le pilote nouveau format est **parallèle** (futur dashboard), on ne migre
  personne, on ne supprime rien.
- **Sources de contenu** à reprendre (réécrites en MDX propre) : le `PASSATION.md` actuel
  (Simulateur, popup, blog…), le **Playbook Webflow Notion** (Structure/classes, Contenu &
  média, Composants, CMS, SEO, Publication & sécurité, Maintenance, Intégration forms), et
  notre cartographie **forms → Make → HubSpot** (déjà vérifiée : AMUSOIRE portal `25692189`
  / BLINDTEST `147562037`, routage par champ caché `account_target`).
- Chapitres activés : les 9 (dont SEO/Tracking + RGPD). Module édition = **Webflow**.
- Page **Architecture** : HTML sitemap des 43 pages (liens nouvel onglet) + lien vers
  `https://www.amusoire.com/sitemap.xml`. (Pas de visuel Claude Design pour l'instant.)

---

## 12. Packaging & intégration dans Coolbeans

Livré isolé dans `coolbeans/_doc-standard/` (non branché, préfixe `_`). Miroir de l'arbo
cible :

```
_doc-standard/src/
  layouts/DocLayout.astro
  components/doc/*
  content/docs/_template/*
  content/docs/amusoire/*
  styles/doc-accent.css
  pages/docs/[project]/[...slug].astro
```

Intégration (à l'implémentation) : recopier `src/**` dans `coolbeans/src/**` → vérifier la
collection → **staging** Cloudflare Pages → Cloudflare Access → supprimer `_doc-standard/`.

---

## 13. Hors périmètre (YAGNI)

Clerk / comptes multi-clients · dashboard complet · recherche full-text · migration des
autres projets (coolbeans, promologis…) · visuel Claude Design du sitemap (à reprendre plus
tard) · **toute publication en prod** (staging only, sur ordre explicite).

---

## 14. Questions ouvertes / (à compléter)

- ~~Hex exacts de la palette Folk~~ ✅ résolu (§7, palette exacte pinnée 2026-07-28).
- Recherche full-text : hors périmètre v1, à confirmer pour v2.
- Modules Shopify / Astro+Sanity : gabarits à écrire au premier projet concerné (Amusoire =
  Webflow d'abord).
