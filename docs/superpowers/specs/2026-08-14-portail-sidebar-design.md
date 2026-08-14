# Portail myCoolbeans — Refonte navigation : sidebar unique, structure Geist

Date : 2026-08-14 · Statut : validé en brainstorm avec Ludo (session du 2026-08-14)
Révoque la décision « Navigation : nav haute » du doc master (`ee024e91`, §01/§03, 2026-08-06).

## 1. Objectif

Le portail se navigue exclusivement dans une **sidebar gauche**. La topbar ne porte
plus d'entrées de navigation. La structure visuelle copie **exactement** la page du
design system Geist (Vercel) : zone logo de la topbar alignée sur la largeur de la
sidebar, bordures verticales continues, 3 colonnes séparées par un trait fin.

## 2. Structure de navigation

Titre de section : **bold, non cliquable**, icône à gauche. Liens en dessous :
`text-mute`, hover **souligné sobre**, page active `text-ink` + medium (sans fond).

```
◈ Bienvenue
    Introduction          → /espace (home : bienvenue, pourquoi cet espace, bloc A2HS)
    Liens utiles          → /espace/liens (staging, prod, admin CMS…)
◈ Mon site
    Monitoring  ●         → /espace/monitoring (pastille ronde 7px verte/orange/rouge
                            selon statut UptimeRobot, grise si donnée absente)
    SEO                   → /espace/seo (mini-audit Ahrefs hebdo + date dernière màj)
    Analytics             → /espace/analytics
◈ Documentation
    (pages docs/<client>) → à plat, JAMAIS repliées, ordre du frontmatter
◈ Projets
    Actifs                → /espace/projets
    Terminés              → /espace/projets/termines
    Documents             → /espace/projets/documents (COO-70)
◈ Aide
    Ressources            → /espace/ressources
    Support               → /espace/support
    Disponibilités        → /espace/disponibilites (planning Coolbeans)
──────────────────────────  (fin trait horizontal, admin seulement)
ADMIN
    Mes clients           → /espace/clients (tableau, tag vert « projets actifs »,
                            clic sur un nom = bascule dans le portail du client)
    Chiffrages            → simulateur de chiffrage (en construction)
```

Slugs existants conservés (`/espace/projets`, `/espace/ressources`, `/espace/support`) :
aucune redirection à poser.

## 3. Règle de visibilité (deux étages)

Chaque entrée du registre de nav déclare :

1. **Flag global de lancement** : `live` ou `wip`.
2. **Condition par client** : donnée/config présente (ex. monitors UptimeRobot
   configurés, `linearTeamId` posé, collection doc non vide).

- **Portail client** : entrée visible seulement si `live` **et** condition remplie.
- **Portail admin (Ludo, client zéro)** : tout est toujours visible ; les entrées
  non lancées portent un badge `wip` discret.

Analytics suit cette règle comme les autres (décision du 2026-08-14) : masquée chez
les clients tant que la feature n'est pas opérationnelle, visible `wip` côté admin.
Le teaser commercial « parlons-en » de COO-36 n'a plus de destinataire — la page
devient la structure de la future vraie page (COO-16).

## 4. Layout

```
┌──────────────┬──────────────────────────────────┐
│ ● my coolbeans│  🔍 ⌘K   [Client ▾]   ☾   Hello ◉│  ← topbar h-14, border-b
├──────────────┼────────────────────────┬─────────┤
│   SIDEBAR    │       CONTENU          │ ANCRES  │
│   ~240px     │   (conteneur Geist,    │ ~200px  │
│   sticky     │        COO-12)         │ sticky  │
└──────────────┴────────────────────────┴─────────┘
```

- **Topbar** : lockup logo (COO-14) dans une zone de largeur **exactement égale à
  la sidebar**, avec border-right continue de haut en bas (structure Geist).
  À droite : recherche ⌘K · **dropdown client admin (juste à droite de la
  recherche)** · bascule thème · « Hello {prénom} » + menu compte Clerk.
- **3 colonnes globales** sur TOUTES les pages du portail, doc comprise :
  sidebar | contenu | colonne d'ancres générée depuis les **H2** de la page.
  Trait fin entre chaque colonne (le trait contenu/ancres est nouveau).
  Pages sans H2 : colonne réservée mais vide (le contenu ne saute pas).
- **La barre admin fixée en bas de viewport disparaît** (remplacée par le dropdown
  topbar + la page Mes clients). Le padding-bottom 110px réservé dans doc.css saute.
- **Mobile** : sidebar en drawer (hamburger dans la topbar), colonne d'ancres
  masquée, contenu pleine largeur. Dropdown client admin reste en topbar.

## 5. Icônes

Pack **Iconoir** (MIT, 1188 icônes, trait 1.5px) : le plus proche de Geist parmi
les candidats évalués (Tabler trop épais, Feather trop limité). Embarquées en
**SVG inline** dans les composants — aucune dépendance npm.

## 6. Pages nouvelles ou refondues

- **Introduction** (`/espace`) : message de bienvenue, pourquoi cet espace,
  bloc A2HS dismissible (localStorage). Remplace la grille de cartes de COO-38.
- **Liens utiles** : liste sobre de liens par client (staging, prod, admin CMS…).
  Source : registre client YAML.
- **Ressources** (restyle de COO-37) : cards **fines sur 1 colonne**, catégories
  en H2 (donc reprises dans la colonne d'ancres), **favicon du site source** sur
  chaque card. Favicons **téléchargés en local au build** (script), zéro requête
  tierce au runtime.
- **Mes clients** (admin) : tableau des clients, tag vert « projets actifs »
  (données Linear), clic = bascule de contexte. Coexiste avec le dropdown topbar.
- **Disponibilités** (alpha rapide, recadre COO-11) : planning **3 mois**,
  **lundi-vendredi**, affiche les vacances de Ludo (fichier YAML édité à la main
  dans le repo) + **jours fériés français** (calculés).
- **Menu compte Clerk** : entrée « Support » insérée entre « Gérer mon compte »
  et « Se déconnecter » (custom menu items du UserButton — syntaxe Astro à
  vérifier à l'implémentation).
- Monitoring, SEO, Documents : entrées `wip` réservées, contenus portés par leurs
  tickets propres (COO-15, COO-55, COO-70).

## 7. Code touché

- `EspaceLayout` + `DocLayout` → **fusion en une coquille unique** 3 colonnes.
- `PortalNav` : refonte topbar (zone logo alignée sidebar, dropdown client,
  suppression de la nav horizontale et de la barre du bas).
- Nouveaux : `PortalSidebar`, `PortalToc`, icônes Iconoir inline.
- `src/lib/portail/nav.ts` : registre central sections/pages + visibilité.
- `doc.css` : démantelé en grande partie. Attention au piège de spécificité
  connu (`.doc-root .card` bat les utilitaires Tailwind).
- `ClientSwitcher` : adapté en dropdown topbar.
- `design-system.astro` : Bibliothèque mise à jour (DoD transverse, esprit COO-39).

## 8. Phases (chacune livrable seule sur staging)

1. **Coquille** : sidebar + topbar Geist + 3 colonnes + registre de visibilité
   + fusion doc. Le gros morceau.
2. **Pages** : Introduction + A2HS, Liens utiles, Mes clients, restyle Ressources.
3. **Disponibilités alpha** : planning 3 mois + YAML vacances + fériés FR.

Plan d'implémentation détaillé : **dans Linear** (une issue par phase, projet
Portail myCoolbeans), pointant vers cette spec. Pas de plan doc dans le repo.

## 9. Ménage Linear & doc master

- Nouvelle issue (ou 3) pour ce chantier — voir phases.
- COO-38 recadrée : home = Introduction, grille de cartes abandonnée.
- COO-36 recadrée : plus de teaser client, page = structure de la future Analytics.
- COO-68 annotée : découpage Actifs/Terminés tranché ici.
- COO-11 recadrée : 3 mois, lun-ven, vacances + fériés, alpha rapide.
- COO-13 : mécanisme remplacé (dropdown topbar) — simple note, le ticket reste Done.
- Doc master `ee024e91` : amender §01 (décision Navigation révoquée) et §03.

## 10. Points de vigilance

- La recherche ⌘K reste portée sur la doc (inchangé dans ce chantier).
- Fusion des layouts : vérifier chaque page `/espace/*` et `/docs/*` après bascule.
- Le badge `wip` ne doit jamais fuiter côté client (test avec un compte non admin).
- SEO/Ahrefs : la source de données (cron hebdo → KV) sera spécifiée dans COO-55 ;
  ici on ne réserve que l'entrée de nav et la page `wip`.
