# Pilotage tarifaire et devis publiés — design

Date : 2026-08-11 · Statut : validé en brainstorming, en attente de relecture finale

## 1. Contexte et objectif

Coolbeans a besoin de deux surfaces liées :

1. **`/espace/chiffrages/*`** — outil interne où Ludo construit ses chiffrages (calculs, catalogue, historique). Réservé au rôle admin, invisible pour les clients du portail.
2. **`/devis/[client]/[projet]-[id]`** — la version présentable d'un chiffrage publié, envoyée au prospect. Publique par lien, non indexée, sans aucun détail de calcul : un seul total HT.

Référence de comportement : le prototype `pilotage-tarifaire.html` (logique et formules uniquement, pas l'UI) et `devis-client-exemple.md` (règles de contenu du devis client). Ces deux fichiers ont été fournis en brief ; les formules et le modèle de données sont repris intégralement dans cette spec pour qu'elle soit autonome.

## 2. Décisions actées

| Sujet | Décision |
|---|---|
| Rendu de la page publique | Réutiliser `DevisCorps.astro` : la publication convertit le chiffrage en snapshot au format `DevisData` de la collection `devis` existante. Même look que `/devis/en-haut`, formulaire de réponse inclus. |
| Structure de l'espace | Sous-pages : `/espace/chiffrages` (liste + stats), `/espace/chiffrages/nouveau` et `/espace/chiffrages/[id]` (éditeur), `/espace/chiffrages/reglages` (catalogue). |
| Stockage | Cloudflare KV, namespace **`PORTAL_KV`** (créé maintenant, prévu par le doc master portail, partagé avec le futur portail), clés préfixées. Pas de D1. |
| UI de l'éditeur | **Preact** via `@astrojs/preact` (nouvelle intégration, premier framework UI du repo — choix assumé). |
| Couche API | **Astro Actions** (`defineAction` + Zod). |
| ID de devis | Numéro généré automatiquement à la création, 4 ou 5 chiffres. |
| Versioning public | Onglets V1/V2/V3 sur la page publique ; chaque republication ajoute une version immuable, le prospect garde l'historique. |
| Accès | Admin uniquement (Ludo). L'espace admin suit par ailleurs la même structure que le portail client (Ludo = client zéro) ; les pages Chiffrages sont une entrée **additive** réservée au rôle admin. |
| Segments | Plus de multiplicateur de prix par cible : une cible ne fait que cocher « Gestion de projet » par défaut et afficher une note contextuelle. Le levier de remise est la « Réduction exceptionnelle » (nom + montant en euros). |

## 3. Architecture

- **Espace admin** : pages SSR (`export const prerender = false`) sous `/espace/chiffrages/*`, couvertes par le middleware Clerk existant (`src/middleware.ts`, matcher `/espace`). Layout : `EspaceLayout.astro`.
- **Page publique** : `src/pages/devis/[client]/[projetId].astro`, SSR, `noindex`, lit le snapshot en KV et le rend avec `DevisCorps`. Pas de conflit avec `/devis/[slug].astro` statique (profondeur d'URL différente) ; les devis YAML faits main continuent de fonctionner tels quels — les deux systèmes coexistent.
- **Mutations** : Astro Actions dans `src/actions/index.ts` — CRUD chiffrages, sauvegarde catalogue, publication, suppression.
- **Accès KV** : `import { env } from "cloudflare:workers"` (pattern de `api/devis-reponse.ts`). Binding `PORTAL_KV` à ajouter dans `wrangler.jsonc` (prod + env staging) après création des namespaces via wrangler.

### Sécurité — trois niveaux, non négociables

1. Middleware Clerk : `/espace/*` exige une session.
2. Chaque page `/espace/chiffrages/*` vérifie `publicMetadata.role === "admin"` (pattern de `espace/index.astro`), sinon redirection vers `/espace`.
3. Chaque Action vérifie côté serveur session + rôle admin avant toute lecture/écriture KV.

L'entrée « Chiffrages » dans `/espace` n'est rendue que pour le rôle admin. La page publique `/devis/...` ne requiert aucune authentification mais n'expose que le snapshot client (aucun jour, aucun coefficient, un seul total HT).

## 4. Modèle de données KV

| Clé | Contenu |
|---|---|
| `pilotage:catalog` | `{ settings, catalog, segments }` (voir §5). Un seul document JSON, éditable depuis Réglages. Initialisé avec les valeurs par défaut du prototype à la première lecture. |
| `chiffrage:{id}` | Le chiffrage de travail, modifiable. `id` = numéro à 4-5 chiffres généré à la création (re-tirage en cas de collision). |
| `devis:{clientSlug}:{projetSlug}-{id}` | Document publié : `{ clientSlug, projetSlug, id, versions: [{ n, publishedAt, data: DevisData }] }`. Chaque version est un snapshot **immuable**. |

- Historique : `PORTAL_KV.list({ prefix: "chiffrage:" })` + gets en parallèle. Volumétrie faible (page admin), pas de clé d'index.
- Un `chiffrage` porte `clientSlug`, `projetSlug`, `mode: "configurateur" | "libre"` et la référence de sa clé `devis:` publiée le cas échéant (`publishedKey`, `publishedVersions: number`).
- Supprimer un chiffrage ne supprime **pas** son document `devis:` publié (le prospect garde son lien). La liste signale les devis publiés orphelins.

### Champs d'un chiffrage (mode configurateur)

```json
{
  "id": "8432", "date": "2026-08-11", "nom": "Nom client / projet",
  "clientSlug": "atelier-vasseur", "projetSlug": "refonte-site",
  "segment": "pme", "objectif": "Texte libre rédigé pour ce devis",
  "pages": [{ "label": "Accueil", "niveau": "complexe", "ux": true, "ui": true, "integ": true }],
  "devLines": [{ "label": "Scénario Make / n8n", "level": "pack2" }],
  "autres": [{ "label": "Migration des contenus", "jours": 1 }],
  "setupCms": true, "setupMultilingue": false, "setupHebergement": true, "setupDomaine": true,
  "affinite": "neutre", "gestionProjet": true, "urgence": false,
  "margePct": 0, "reductionNom": "", "reductionMontant": 0,
  "prixRetenu": 15030,
  "mode": "configurateur",
  "publishedKey": null, "publishedVersions": 0
}
```

Les jours et montants dérivés (`jours` par ligne, `gestionJours`, `totalJours`, `totalSuggere`, `tjmVendu`...) ne sont **pas** stockés : ils sont recalculés par le moteur (§6) à partir du catalogue courant. Seul le snapshot publié fige des valeurs. Le mode « libre » remplace `pages/devLines/setup*` par `postes: [{label, jours}]` + `strategique: boolean`, `raison: string`.

## 5. Catalogue et réglages (`pilotage:catalog`)

Structure et valeurs par défaut reprises du brief :

- `settings` : `tjm` 600, `demi` 300, `marcheBas` 450, `marcheHaut` 650, `joursSemaine` 3, `semainesMarge` 1, `chargesPct` 26.
- `catalog.design` : simple 0.5 / standard 1 / complexe 2 ; `portee.ux` 40 %, `portee.ui` 70 %.
- `catalog.integration` : simple 0.5 / standard 1 / complexe 1.5.
- `catalog.dev` : pack1 0.5 → pack4 2 (demi-journées).
- `catalog.setup.{cms,multilingue,hebergement,domaine}` : `{ jours, clientLabel }` (0.5 / 2 / 0.25 / 0.25 ; libellés client du brief).
- `catalog.gestion` : `coefHebdo` 0.15, `forfaitCMS` 0.5, `forfaitMultilingue` 1, `forfaitHebergement` 0, `forfaitDomaine` 0.25, `urgencePct` 20.
- `catalog.affinite` : baisse 20 %, hausse 20 %.
- `catalog.devisTexts` : `stackTechnique`, `conditionsReglement`, `ceQueCaComprend` (une ligne par item), `horsPerimetre` (une ligne par item).
- `segments` : agence, designer, pme, tpe, association — chacun `{ label, desc, gestionProjet, note }`. **Aucun champ multiplier.**

Tout est éditable depuis `/espace/chiffrages/reglages`.

## 6. Moteur de calcul — `src/lib/chiffrage/calc.ts`

Module TypeScript **pur** (zéro DOM, zéro Preact), source de vérité unique, utilisé par l'éditeur (recalcul live) et par l'Action de publication côté serveur. Formules exactes :

```
# Pages (par ligne)
base = catalog.design[niveau]
designJours = (UX et UI) ? base : (UX seul) ? base × portee.ux/100 : (UI seul) ? base × portee.ui/100 : 0
integJours  = intégration cochée ? catalog.integration[niveau] : 0
joursLigne  = designJours + integJours

# Production
totalJoursProduction = Σ(pages) + Σ(devLines: catalog.dev[level]) + Σ(setup cochés: catalog.setup.*.jours) + Σ(autres.jours)
sousTotal = totalJoursProduction × settings.tjm

# Affinité (neutre / envie −baisse% / pasenvie +hausse%)
ajusteAffinite = sousTotal × (1 ∓ catalog.affinite.*/100)

# Délai (avant gestion de projet, qui en dépend)
semainesBase  = totalJoursProduction > 0 ? arrondi_sup(totalJoursProduction / settings.joursSemaine, 0.5) : 0
semainesTotal = totalJoursProduction > 0 ? semainesBase + settings.semainesMarge : 0

# Gestion de projet (case cochée par défaut selon segment.gestionProjet)
gestionJours = semainesTotal × coefHebdo + Σ(forfaits des setup cochés)
gestionMontant = gestionJours × settings.tjm

# Urgence
sousTotalAvantUrgence = ajusteAffinite + (gestion cochée ? gestionMontant : 0)
majorationUrgence = urgence cochée ? sousTotalAvantUrgence × urgencePct/100 : 0

# Marge Coolbeans (0/10/20/30 %)
margeMontant = (sousTotalAvantUrgence + majorationUrgence) × margePct/100

# Réduction exceptionnelle (dernière étape)
totalSuggere = max(0, sousTotalAvantUrgence + majorationUrgence + margeMontant − reductionMontant)

# Prix retenu : champ éditable, pré-rempli avec totalSuggere
tva = prixRetenu × 0.20 ; ttc = prixRetenu × 1.20 ; net = prixRetenu × (1 − chargesPct/100)
tjmVendu = (prixRetenu − margeMontant) / totalJoursProduction   # badge vert si ≥ settings.tjm
```

Le bloc de calcul de l'éditeur affiche **chaque étape en clair** avec son montant HT (pas seulement le résultat), dans l'ordre : sous-total production → affinité → gestion de projet (détail par composant ; message d'invite si 0 j) → urgence → marge → réduction → total suggéré. Rappel « Tous les montants sont HT » en tête de l'outil.

## 7. Conversion en devis client — `src/lib/chiffrage/toDevis.ts`

`(chiffrage, catalog) → DevisData` (le type de `src/lib/devis.ts`), exécutée à la publication et pour l'aperçu live. Règles de contenu non négociables :

- **Jamais** de prix par ligne, de jours ou d'heures. Un seul total HT (section budget avec une ligne unique portant `prixRetenu`), suivi des conditions de règlement (`devisTexts.conditionsReglement`).
- Ordre fixe des sections : Objectif, Pages, Fonctionnalités, Stack technique, Budget, Ce que ça comprend, Planning, Hors périmètre.
- **Une section vide n'apparaît pas du tout** (pas de placeholder). Stack technique ne s'affiche que s'il y a ≥ 1 page.
- Objectif : texte libre rédigé par Ludo (`chiffrage.objectif`), jamais généré.
- Pages : libellés des lignes pages à jours > 0. Fonctionnalités : libellés des devLines + lignes libres.
- Ce que ça comprend = base fixe (`devisTexts.ceQueCaComprend`, une ligne par item) + `clientLabel` des setup cochés + « Suivi de projet : points hebdomadaires jusqu'à la livraison, comptes-rendus, planning à jour » si gestion activée.
- Hors périmètre = base fixe + une ligne par page UX-sans-UI (« Le design UI de la page « X » (fourni par un tiers) ») ou UI-sans-UX (wireframes fournis par un tiers).
- Planning : une seule ligne, « Livraison estimée à N semaines à réception de l'acompte. » (via `semainesTotal`). Pas de calendrier détaillé.
- Langage orienté résultat client (jamais « Setup CMS », toujours le `clientLabel`).

Le mode « Chiffrage libre » ne produit pas de devis client (pas de bouton Publier dans ce mode).

## 8. Publication et versions

- Bouton « Publier » dans l'éditeur → Action `publierDevis` : recalcule via `calc.ts`, construit le `DevisData` via `toDevis.ts`, l'ajoute comme version `n+1` dans `devis:{clientSlug}:{projetSlug}-{id}` (création du document à la première publication), renvoie l'URL publique.
- `clientSlug` et `projetSlug` sont **figés à la première publication** (l'URL ne bouge plus) ; l'éditeur verrouille ces champs ensuite.
- Page publique : rendu SSR d'**une seule** version à la fois. S'il y a plusieurs versions, une rangée d'onglets V1/V2/V3 (liens `?v=n`, `aria-current` sur l'actif) au-dessus du devis ; **dernière version par défaut**. `DevisCorps` reste intact.
- Le formulaire de réponse existant (`/api/devis-reponse`) fonctionne tel quel ; le champ `slug` envoyé inclut le chemin complet et la version affichée (ex. `atelier-vasseur/refonte-site-8432 (V2)`).
- Modifier le chiffrage après publication ne change **rien** à la page publique tant qu'on ne republie pas.

## 9. Routes de l'espace

- **`/espace/chiffrages`** — table de tous les chiffrages (date, client, mode/segment, jours, prix HT, TJM effectif, badge de statut vert/orange/rouge, lien vers la version publiée, suppression avec confirmation). Stats en tête : nombre de chiffrages, TJM effectif moyen, tarif plein vs remise. Boutons « Nouveau chiffrage » et « Réglages ».
- **`/espace/chiffrages/nouveau`** / **`/espace/chiffrages/[id]`** — l'éditeur (îlot Preact `client:load`) : sélecteur de cible (5 cartes ; effet = coche gestion de projet par défaut + note), lignes Pages (niveau + cases UX/UI/Intégration indépendantes ; hint explicite : section vide = cas normal pour une mission sans pages), Développement sur mesure (packs + chips de suggestion : scénario Make/n8n, connexion API tierce, script JS custom, automatisation email/CRM), Setup (4 cases, avertissement visible sur le multilingue historiquement sous-estimé), Lignes libres, bloc de calcul détaillé, aperçu Devis client en direct, bouton Publier. Bascule « Chiffrage libre » : postes libres (libellé + jours + montant HT par ligne), badge de statut vs TJM cible et fourchette marché, case « remise stratégique assumée » + raison, net après charges — sans aperçu devis ni publication. À la première sauvegarde, l'Action crée l'`id` et l'URL passe de `/nouveau` à `/[id]` (`history.replaceState`).
- **`/espace/chiffrages/reglages`** — édition de tout `pilotage:catalog` (§5).

Style : composants et classes du design system existant (`.field`, `.btn`, `.card`, `.label`, `Badge`, `Banner`, `font-mono tabular-nums`, tokens sémantiques). **Ne pas reprendre le CSS du prototype.**

## 10. Erreurs et cas limites

- Chiffrage ou devis introuvable → 404.
- Sauvegarde/publication sans nom, sans ligne de production ou sans prix retenu → erreur de validation Zod, message dans l'éditeur.
- Collision d'`id` à la création → re-tirage (boucle bornée).
- KV éventuellement consistant : la liste peut retarder de quelques secondes après une écriture — acceptable pour un outil mono-utilisateur.
- Échec d'écriture KV → l'Action renvoie une erreur structurée, l'éditeur affiche un message et conserve l'état local (pas de perte de saisie).

## 11. Tests

- **Vitest** (à ajouter au repo, première infra de test) sur `calc.ts` et `toDevis.ts` : formules du §6 (dont arrondi 0.5 des semaines, portée UX/UI, ordre des étapes), règles de contenu du §7 (sections omises, ajouts automatiques, lignes hors périmètre UX/UI). C'est là que vit la logique métier, c'est là qu'on teste.
- Les pages Astro et Actions sont vérifiées manuellement en local (`npm run dev` avec `wrangler` pour le binding KV) puis sur staging.

## 12. Hors périmètre de cette itération

- Pas d'envoi par email (circuit : publier, puis envoyer l'URL manuellement).
- Pas de portail client pour les prospects ; Clerk sert uniquement au gate admin.
- Pas de D1, pas de connexion Asana/CRM, pas d'export PDF.
- Le chantier portail client (S0-S4, doc master) reste séparé ; cette spec n'implémente que l'entrée admin « Chiffrages », intégrée dans `EspaceLayout` en attendant le portail V1.
- **Aucun déploiement en production sans ordre explicite** (règle absolue du CLAUDE.md) : développement en local, validation sur staging.
