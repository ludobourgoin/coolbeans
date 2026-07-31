# Spec — Standard "la doc" (passation) + pilote Amusoire

| | |
|---|---|
| **Projet** | Standard de doc de passation Coolbeans ("la doc") |
| **Propriétaire du doc** | Ludovic Bourgoin (Coolbeans) |
| **Version** | 0.4 (implémentation Astro livrée en bundle `src/`) |
| **Dernière MAJ** | 2026-07-31 |
| **Statut** | Design validé (`preview.html`) + implémentation livrée (`src/`, isolée) — intégration : voir README |
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
3. **Navigation** : gauche = **liste plate de pages par usage** (peu de pages, longues, à
   scroller) ; droite = "Sur cette page" = **H2** (ancres) de la page courante.
4. **Charte** : réutilise les tokens Coolbeans (Geomanist, encre, dark par classe `.dark`)
   mais en **noir & blanc pur** (pas de cream) ; couleurs Folk **réservées aux signaux
   contextuels** (admonitions, pastilles, badges). Voir §7.
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
    01-vue-densemble.mdx
    02-editer-le-site.mdx
    …
```

Frontmatter minimal, **identique sur tous les projets** :

```yaml
---
project: "amusoire"                     # dossier / clé projet
title: "Leads & formulaires"
order: 3                                # position dans la nav gauche
status: "draft" | "review" | "final"    # optionnel
updated: 2026-07-30                      # date de MAJ de la page
---
```

Pas de niveau de groupement : la nav gauche est la **liste plate des pages**, triée par
`order`. Les H2 du corps = sections de la page = ancres de la nav droite.

---

## 3. Squelette standard (6 pages par usage × sections H2)

> Page = entrée de la nav gauche, longue et scrollable ; section H2 = ancre de la nav
> droite. Rationalisé pour le lecteur réel (équipes marketing) : ce qu'il fait souvent en
> haut, la référence en bas. **Cœur** = quasi tous les projets ; **(opt)** = si pertinent.
> Chaque projet instancie le sous-ensemble utile (section non pertinente = supprimée).

**1. Vue d'ensemble** *(cœur)* — la porte d'entrée
- En bref — hero : identité, périmètre en 1 phrase, statut, **propriétaire + version +
  date MAJ du doc**, **Liens Rapides** (prod/staging/outils), stack + chiffres clés.
- Contexte & objectifs — enjeux business, cibles, périmètre in/out.
- Entités & marques — structure, marques (ou historique de renommage), établissements.
- Gouvernance & contacts *(opt)* — annuaire **client + Coolbeans + tiers**, qui valide quoi
  (prod, contenu, budget), **process de demande** (évolution / bug).

**2. Éditer le site** *(cœur)* — l'usage quotidien ; voir §4 (module plateforme)
- Les interdits (bloc rouge en tête de page).
- Gestes plateforme (publier un article, CMS/blog…) + principes agnostiques (nommage
  stable, médias, modèle éditorial).
- SEO on-page *(opt)*.

**3. Intégrations & leads** *(cœur)*
- Le flux en un coup d'œil — **le seul schéma de flux de la doc** (les autres pages y
  renvoient).
- Routage des formulaires · levier technique · pattern *Incident & correctif*.
- **Référentiels d'IDs** (tables) · tracking / provenance des leads *(opt)*.

**4. Features sur-mesure** *(cœur)*
- 1 section H2 par feature légère. Une feature à forte profondeur technique est **promue en
  page dédiée** avec ses propres ancres (ex. Amusoire : Simulateur ROI, Popup opt-in) — la
  page "Features sur-mesure" disparaît alors au profit des pages promues.

**5. Sécurité & conformité** *(opt)*
- Comptes & accès (qui accède à quoi) · **où vivent les secrets** (1Password/env, **jamais
  en clair**, jamais dans git) · posture (rotation) · RGPD / cookies / opt-in / rétention.

**6. Référence & support** *(cœur)* — ce qu'on consulte ponctuellement
- Stack & environnements · **HTML sitemap exhaustif** (toutes les pages, liens nouvel
  onglet, annotées formulaire → portail) + lien **sitemap XML** · sitemap de l'**ancien
  site** si des landings y restent actives (campagnes, calendriers).
- Maintenance & vigilance — rituel **staging → validation → prod + backup nommé**.
- Support & demandes — SAV inclus vs devis, **template de rapport de bug** (lien + device +
  navigateur + Loom), réflexe "cherche d'abord dans la doc".
- **Journal de modifications** (tenu par le client : `Date | Action | Impact | Backup ?`) +
  **Log des bugs corrigés** (`Bug | Cause racine | Correctif`).
- Liens · **propriété & droits** (qui possède code/design/comptes/domaine) · **glossaire**.

> Les do's & don'ts d'autonomie ne font **pas** l'objet d'une page dédiée "règles d'or" :
> ils vivent en admonitions `piège`/`danger` **au plus près** du geste concerné.

**Instanciation Amusoire** : les 6 pages s'appliquent (SEO/Tracking et RGPD inclus).

---

## 4. Couche "édition/CMS" — module par plateforme

La page **Éditer le site** superpose deux couches :

**Principes agnostiques** (valables partout) :
- convention de nommage **stable** (classes / composants / champs) — *ne jamais renommer
  sous peine de tout casser* ;
- seuils médias (poids/dimensions, OG image ~1200×630, alt text, nommage fichiers) ;
- modèle éditorial (titre → slug, catégorie, meta title/description) ;
- composant réutilisable = **source unique** (modif à un endroit → répercutée partout).

**Sections spécifiques plateforme** (on active la bonne) :
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
- **Cross-linking** entre pages (SEO ↔ CMS, Maintenance ↔ Backups…).

---

## 6. Admonitions (callouts) — 1re classe dans le layout

Composant `<Callout type="…">` :

| type | couleur | hex bord | hex fond (teinte) | usage |
|---|---|---|---|---|
| `note` | 🟦 bleu | `#94C4FF` | `#BED9EF` | information |
| `tip` | 🟩 vert (lime) | `#BDEE63` | `#E3EFDC` | astuce / OK |
| `warning` | 🟨 or | `#FFC53D` | `#FFF0BD` | attention |
| `danger` | 🔴 corail | `#F54E50` | `#FCE1E1` | risque de casse |
| `piège` | 🟪 iris | `#C1AAF9` | `#F6DFF6` | **contre-intuitif / ne-pas-« corriger » sans test** |

Le type **`piège`** est le signal à plus haute valeur d'une passation (ex. Amusoire : "les
forms pro remontent sur AMUSOIRE, ne pas corriger" ; ex. O2 : "clé sans accent, ne pas
ajouter l'accent sans test").

---

## 7. Charte & palette

**Base** = tokens Coolbeans (`global.css`) : Geomanist (display) + Geomanist Book (corps),
JetBrains Mono (labels), dark par `.dark`, radius contrôle 6px.

**Surfaces : noir & blanc pur** (décision 2026-07-30 — exit le cream) : fond blanc
`#ffffff`, encre `#111010`, gris neutres pour filets et fonds légers (`--surface-2
#f7f7f7`, lignes `rgba(17,16,16,.1)`) ; dark inversé (`#0d0d0c` / `#f2f1ec`). **Aucune
surface beige/cream dans la doc** — la teinte marque reste réservée au site vitrine.

**Couche accent "docs"** = palette Folk, **réduite aux couleurs réellement employées** :

| rôle | hex | teinte claire (fonds) |
|---|---|---|
| Iris (lavande) | `#C1AAF9` | `#F6DFF6` |
| Or (jaune) | `#FFC53D` | `#FFF0BD` |
| Bleu (bleuet) | `#94C4FF` | `#BED9EF` |
| Vert (lime) | `#BDEE63` | `#E3EFDC` |
| Corail (rouge) | `#F54E50` | `#FCE1E1` |

(Magenta et cyan Folk : retirés en v0.2 — non employés.)

**Emplois — la couleur est un signal contextuel, jamais un décor** : admonitions (§6) ·
blocs de code · pastilles de statut sémantiques (ok/warn/bad) · badges de routage
(AMUSOIRE or / BLINDTEST bleu) · marqueur `(à compléter)` (fond or). **Tout le reste est
encre** : nav, liens, flèches de flux, hero, tableaux. Ces couleurs sont claires
(L ≈ 62–82 %) → texte **encre** dessus (contraste OK).

**Garde-fous lisibilité** (non négociables) : surface de lecture blanche/encre, **aérée**
(filet fin entre sections H2, largeur de lecture ~70ch, marges verticales généreuses,
tableaux sans cadre — filets horizontaux seulement) ; couleurs **aux bords** jamais
derrière le corps de texte ni le code ; fonds de callout en teinte légère (contraste AA) ;
**variantes dark** pour chaque couleur. Couche **séparée** des tokens marketing.

---

## 8. Layout maison — `DocLayout.astro`

**Structure 3 colonnes** (desktop ≥ ~1100px ; empilé/tiroir en mobile) :
- **Gauche** : recherche + **liste plate des pages** (triées `order`), sobre, sans
  couleur ; état actif = encre + fond `--tint`. Pas de carte projet : les métadonnées
  (statut/version/MAJ) vivent dans le `Meta` en tête de page.
- **Centre** : MDX rendu (prose Coolbeans, code, tables, diagrammes, admonitions) ; pages
  longues, filet fin entre sections H2, prev/next en pied de page.
- **Droite** : "Sur cette page" = H2 auto (ancres, actif au scroll, `text-mute`/`text-ink`).

**Route** : `src/pages/docs/[project]/[...slug].astro` → charge la collection, trie par
`order`, rend `DocLayout`.

**Composants** : `DocLayout.astro`, `SidebarNav.astro` (**recherche client-side** ⌘K :
index pages × sections H2, résultats ancrés), `TocRight.astro`,
`Callout.astro`, `StatusPill.astro`, `CodeBlock.astro` (**label langage + bouton copier +
coloration syntaxique légère**, thème sombre), `Meta.astro` (propriétaire/version/MAJ en
tête). `ScreenshotToggle.astro` reste au menu du standard — Amusoire ne l'utilise pas.

**Comportements** : dark mode hérité (anti-flash déjà dans `BaseLayout`) ; ancres H2
cliquables ; topbar minimale (logo seul + toggle thème, pas de fil d'ariane ni badge
d'accès) ; liens externes = flèche ↗ discrète en CSS (`::after`), jamais dans le texte ;
responsive (nav gauche en tiroir sous 1100px, TOC droite masquée sous ~1280px).

---

## 9. Accès & sécurité

- **Cloudflare Access** sur `/docs/*` (ou `/docs/amusoire/*`) : mot de passe / email OTP au
  niveau edge, **zéro code applicatif**, gratuit ≤ 50 users. Indépendant du rendu.
- Secrets : **jamais** dans le contenu MDX ni dans git. La page Sécurité documente **où** ils
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
- Pages instanciées : **7** — les 6 du standard avec Features sur-mesure éclatée en 2 pages
  dédiées (**Simulateur ROI**, **Popup opt-in**). Module édition = **Webflow**.
- **Simulateur** : la doc technique de `PASSATION.md` (repo amusoire, version racine à jour)
  est reprise **en entier** dans la page Simulateur ROI (flow/stack, calculs, hidden inputs,
  DOM, pipeline Make + Resend, CTA dynamique, mail, bundle JS, vigilance) — pas un simple
  lien vers la Docsify. Les annexes code (`calculator.ts`…) restent dans le repo, la page y
  renvoie. La Docsify live reste en ligne pour la cliente tant que le nouveau format n'est
  pas servi.
- **Marque** : pas deux marques qui cohabitent — un **renommage** (ThisIsBlindTest →
  Amusoire). Les 2 portails HubSpot en sont l'héritage. Sections retirées à la demande du
  client (2026-07-30) : Gouvernance & contacts, Propriété & droits, toggles screenshots,
  badge Cloudflare Access et fil d'ariane du header.
- **Code de référence in-doc** : sources complètes du bundle (`src/index.ts`,
  `calculator.ts`, `validation.ts`, `conditionalDisplay.ts`, `progressBar.ts`,
  `index.css`) et script popup embarquées dans les pages en blocs code pliables — plus un
  simple renvoi au repo. `dist/` (généré) non reproduit.
- Section **Sitemap** (page Référence & support) : HTML sitemap **exhaustif** du nouveau
  site (39 pages publiées + gabarits CMS, une page par ligne, segmenté par catégories,
  liens nouvel onglet, badges formulaire → portail, source : API Webflow 2026-07-28) +
  **landing pages héritées** `lp.pro.thisisblindtest.com` : l'ancien site
  `thisisblindtest.com` est **supprimé** (remplacé par amusoire.com) ; ce site LP (home +
  5 landings campagnes, robots.txt bloquant, pas de sitemap.xml) reste en ligne jusqu'à la
  bascule des campagnes, ses pages étant migrées sur le nouveau site. Les calendriers
  HubSpot Meetings restent servis sur `pro.thisisblindtest.com/meetings/*` (cibles du CTA
  mail). Le sitemap XML amusoire n'expose que 33 URLs — plusieurs pages publiées sont hors
  sitemap. (Pas de visuel Claude Design pour l'instant.)
- **Chemin simulateur** : `/pro/simulateur` (vérifié API Webflow). `PASSATION.md` racine
  mentionne `/simulateur` — chemin périmé à corriger côté repo amusoire.

---

## 12. Packaging & intégration dans Coolbeans

Livré isolé dans `coolbeans/_doc-standard/` (non branché, préfixe `_`). Miroir de l'arbo
cible :

```
_doc-standard/src/
  content.config.ts                      ← collection `docs` (glob loader, schéma zod)
  layouts/DocLayout.astro
  components/doc/{Callout,Pill,Meta,SidebarNav,TocRight}.astro
  styles/doc.css                         ← couche docs N&B, scopée .doc-root
  pages/docs/[project]/[...slug].astro
  content/docs/_template/*               ← gabarit 6 pages (placeholders)
  content/docs/amusoire/*                ← pilote 7 pages (contenu complet)
```

Intégration (checklist détaillée dans le README) : `npx astro add mdx` + `shikiConfig`
→ recopier `src/**` dans `coolbeans/src/**` → vérifier `/docs/amusoire` en dev →
**staging** → Cloudflare Access sur `/docs/*` → supprimer `_doc-standard/`.
Écarts assumés : CodeBlock.astro remplacé par Shiki + script (label langage + copier) ;
typo alignée sur les tokens actuels (corps Geist) ; recherche = index JSON à la build.

---

## 13. Hors périmètre (YAGNI)

Clerk / comptes multi-clients · dashboard complet · recherche full-text **serveur** (la v1
embarque une recherche client-side, index en mémoire) · migration des autres projets
(coolbeans, promologis…) · visuel Claude Design du sitemap (à reprendre plus tard) ·
**toute publication en prod** (staging only, sur ordre explicite).

---

## 14. Questions ouvertes / (à compléter)

- ~~Hex exacts de la palette Folk~~ ✅ résolu (§7, palette exacte pinnée 2026-07-28).
- ~~Recherche~~ ✅ résolu : recherche client-side intégrée au layout (2026-07-30) ; le
  full-text serveur reste hors périmètre.
- Modules Shopify / Astro+Sanity : gabarits à écrire au premier projet concerné (Amusoire =
  Webflow d'abord).
