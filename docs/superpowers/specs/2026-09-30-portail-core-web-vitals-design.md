# Analytics du portail : les Core Web Vitals mesurés chez les visiteurs

- Date : 2026-09-30
- Issue : COO-302, suite de COO-16
- Branche : `feat/core-web-vitals` (worktree `../coolbeans-core-web-vitals`)
- Statut : design validé par Ludo le 2026-09-30
- Complète `2026-09-29-portail-analytics-design.md`, sans le répéter.

## 1. Objectif

La page `/espace/analytics` montre au client si son site est rapide pour ses vrais
visiteurs : LCP, INP et CLS, notés « Bon », « À améliorer » ou « Mauvais » selon la
règle de Google, sur la période choisie, tous appareils confondus puis sur mobile et
sur ordinateur.

Réussi quand : un client raccordé voit la note de ses trois Core Web Vitals sur la
période, calculée à partir des mesures collectées chaque nuit, et un message clair
quand il n'y a pas assez de mesures.

Hors périmètre :

- le détail par page (1 à 28 mesures par jour réparties sur des dizaines de pages) ;
- l'élément fautif (`largestContentfulPaintElement` et suivants) ;
- FCP et TTFB, que la note de Google ignore ;
- une valeur en secondes (p75) : les percentiles ne s'additionnent pas d'un jour à
  l'autre, et un p75 calculé sur 3 mesures ne dit rien ;
- le verdict global de Google (« réussi » si les trois métriques sont bonnes) ;
- la comparaison avec la période précédente.

## 2. Source

Même compte, même jeton, même API que le trafic. Jeu `rumWebVitalsEventsAdaptiveGroups`,
champs vérifiés par introspection le 2026-09-30 :

- `sum` : `lcpGood`, `lcpNeedsImprovement`, `lcpPoor`, `lcpTotal`, et la même série
  pour `inp` et `cls`. Sur toutes les lignes sondées, `Total` = somme des trois.
- `avg { sampleInterval }` : 1 sur un jour isolé des 7 derniers jours.
- `dimensions { siteTag deviceType }`.

Réponse réelle du 2026-09-29 (extrait) : le salon a 22 mesures LCP sur mobile (19
bonnes, 3 à améliorer), 4 sur ordinateur, 2 sur tablette. Setencorpsmieux a 19 mesures
LCP sur mobile, 1 sur ordinateur. Rév'olutions Douces en a 1. Coolbeans et Scolies
n'en ont aucune. Une ligne a `inpTotal` à 0 et des compteurs LCP et CLS remplis.

## 3. Architecture

Aucune unité nouvelle côté collecte : les vitaux voyagent avec le trafic, dans la
même requête et le même batch D1. Une unité pure s'ajoute pour la notation.

| Unité | Changement |
|---|---|
| `types.ts` | `JourAnalytics` gagne `vitaux: VitauxAppareil[]` |
| `cloudflare.ts` | alias `vitaux` dans `REQUETE_JOUR`, mise au format |
| `collecte.ts` | aucun |
| `store.ts` | `ecrireJour` écrit les vitaux, nouvelle lecture `lireVitaux` |
| `vitaux.ts` (nouveau) | notation pure : `noter`, `construireVitesse` |
| `tableau.ts` | `Tableau` gagne `vitesse`, `chargerTableau` lit les vitaux |
| `VitesseSite.astro` (nouveau) | section de la page |

### 3.1 Types

```ts
export type Appareil = "mobile" | "desktop" | "tablet" | "autre";
export type Metrique = "lcp" | "inp" | "cls";

export interface Compteurs {
  bon: number;
  moyen: number;   // « needs improvement » chez Cloudflare
  mauvais: number;
}

export interface VitauxAppareil {
  appareil: Appareil;
  lcp: Compteurs;
  inp: Compteurs;
  cls: Compteurs;
}
```

### 3.2 Requête : un alias de plus

Ajouté à `REQUETE_JOUR`, à côté des quatre alias existants :

```graphql
vitaux: rumWebVitalsEventsAdaptiveGroups(limit: 1000, filter: { date_geq: $jour, date_leq: $jour }) {
  avg { sampleInterval }
  sum { lcpGood lcpNeedsImprovement lcpPoor inpGood inpNeedsImprovement inpPoor clsGood clsNeedsImprovement clsPoor }
  dimensions { siteTag deviceType }
}
```

Choix validé : aucun appel externe ni aucune requête D1 en plus. Le revers est
assumé : une erreur sur cet alias fait échouer le jour entier, trafic compris. Le
risque est faible, le jeu est servi par la même API avec la même permission.

### 3.3 Mise au format

Dans `normaliserJour` :

- `deviceType` suit la règle du trafic : `mobile`, `desktop`, `tablet`, tout le
  reste devient `autre`. Deux groupes qui tombent sur le même appareil se cumulent.
- Un groupe dont les neuf compteurs valent 0 est écarté.
- Un site présent dans `vitaux` mais absent de `totaux` reçoit une entrée à 0 visite
  et 0 page vue. Cas supposé, jamais observé : un beacon de vitaux peut partir après minuit, alors que la page a été
  chargée la veille : ses mesures ne doivent pas se perdre.
- `echantillon` du site devient le maximum de celui du trafic et de l'arrondi
  supérieur du `sampleInterval` des vitaux. L'invariant de la collecte (une lecture
  échantillonnée n'écrase jamais un jour déjà collecté) couvre ainsi les vitaux sans
  code en plus. La note « Certains jours sont estimés par Cloudflare. » les couvre aussi.

### 3.4 Schéma D1, migration `0012_analytics_vitaux.sql`

```sql
CREATE TABLE analytics_vitaux (
  site_tag     TEXT NOT NULL,
  jour         TEXT NOT NULL,
  appareil     TEXT NOT NULL CHECK (appareil IN ('mobile', 'desktop', 'tablet', 'autre')),
  lcp_bon      INTEGER NOT NULL,
  lcp_moyen    INTEGER NOT NULL,
  lcp_mauvais  INTEGER NOT NULL,
  inp_bon      INTEGER NOT NULL,
  inp_moyen    INTEGER NOT NULL,
  inp_mauvais  INTEGER NOT NULL,
  cls_bon      INTEGER NOT NULL,
  cls_moyen    INTEGER NOT NULL,
  cls_mauvais  INTEGER NOT NULL,
  PRIMARY KEY (site_tag, jour, appareil)
);

CREATE INDEX analytics_vitaux_jour ON analytics_vitaux (jour);
```

- **Plafond de lignes** : le `CHECK` sur `appareil` et la clé primaire bornent la
  table à 4 lignes par site et par jour. Un appareil sans mesure n'a pas de ligne.
- **Index** : `jour` est en deuxième position de la clé, la suppression par jour ne
  s'en sert pas. Sans l'index, chaque réécriture nocturne parcourrait toute la table,
  et D1 Free compte chaque ligne lue.
- Le total n'est pas stocké : c'est la somme des trois compteurs.
- Volume : 6 sites × 4 appareils × 7 jours, soit 168 lignes au plus réécrites chaque
  nuit. Une page en 6 mois lit au plus 182 × 4 = 728 lignes, par la clé primaire.

`ecrireJour` ajoute, dans le même `db.batch` :

1. `DELETE FROM analytics_vitaux WHERE jour = ?` avec les deux suppressions existantes ;
2. un `INSERT` par entrée de `site.vitaux`.

### 3.5 Lecture

`lireVitaux(db, siteTag, du, au): Promise<VitauxAppareil[]>` : une ligne par appareil,
compteurs sommés sur la fenêtre (`GROUP BY appareil`), remise en forme
`VitauxAppareil`.

`chargerTableau` l'ajoute à son `Promise.all`. Un échec de lecture donne le même état
« Statistiques momentanément indisponibles » que le reste de la page.

## 4. Notation, `src/lib/analytics/vitaux.ts`

Fonctions pures.

```ts
export const MESURES_MIN = 20;

export type Note = "bon" | "moyen" | "mauvais";

export interface Evaluation {
  /** null sous MESURES_MIN mesures. */
  note: Note | null;
  mesures: number;
  /** Part des mesures bonnes, entre 0 et 1 (0 sans mesure). */
  partBonne: number;
}

export function noter(c: Compteurs): Evaluation;

export interface VitesseMetrique {
  global: Evaluation;
  mobile: Evaluation;
  ordinateur: Evaluation;
}

export type Vitesse = Record<Metrique, VitesseMetrique>;

/** null si aucune mesure, toutes métriques et tous appareils confondus. */
export function construireVitesse(lignes: VitauxAppareil[]): Vitesse | null;
```

Règle de `noter`, avec `total = bon + moyen + mauvais` :

1. `total < 20` : `note = null`.
2. `bon × 4 ≥ total × 3` (au moins 75 % de bonnes) : `"bon"`.
3. `(bon + moyen) × 4 ≥ total × 3` : `"moyen"`.
4. Sinon : `"mauvais"`.

La comparaison se fait en entiers pour qu'un cas limite (15 sur 20) ne dépende pas
d'un arrondi flottant. « Au moins 75 % de mesures bonnes » équivaut à « p75 sous le
seuil bon », ce qui fait de cette règle celle de Google.

`construireVitesse` : `global` somme les quatre appareils, `mobile` lit `mobile`,
`ordinateur` lit `desktop`. Tablette et « autre » ne comptent que dans le global.

## 5. Page

Section « Vitesse du site », composant `src/components/portail/VitesseSite.astro`,
placée sous les trois listes et au-dessus de la note « Certains jours sont estimés ».
Elle suit le sélecteur de site et de période. Sous-titre : « Mesurée chez vos
visiteurs, selon les critères de Google. »

Trois cartes, dans cet ordre :

| Carte | Sigle | Description | Aide |
|---|---|---|---|
| Affichage | LCP | Temps pour afficher le contenu principal. | Bon sous 2,5 s, mauvais au-delà de 4 s. |
| Réactivité | INP | Délai de réaction à un clic ou une touche. | Bon sous 200 ms, mauvais au-delà de 500 ms. |
| Stabilité | CLS | Mouvements de la page pendant le chargement. | Bon sous 0,1, mauvais au-delà de 0,25. |

Dans chaque carte :

- la note globale en pastille : « Bon » (token `success`), « À améliorer »
  (`warning`), « Mauvais » (`error`). Le libellé porte le sens, la couleur ne fait
  que le doubler ;
- avec une note : « 82 % de mesures bonnes sur 140 » ;
- sans note : pastille neutre « Pas assez de mesures », puis « 12 mesures sur les 20
  nécessaires » ;
- deux lignes, Mobile et Ordinateur : la note et le nombre de mesures, ou « pas assez
  de mesures (8) » ;
- la ligne d'aide.

Si `construireVitesse` rend `null` : la phrase « Aucune mesure de vitesse sur la
période. » remplace les cartes, le titre reste.

**Design.** Relire `/design-system` avant de coder (`.label` pour un titre de
section, tokens de `global.css`, cartes comme `ClassementAnalytics`).

## 6. Tests (vitest)

- `cloudflare.test.ts` : réponse réelle du 2026-09-29 enregistrée ; tablette et type
  inconnu ; groupe à zéro écarté ; site présent seulement dans les vitaux ;
  `echantillon` au maximum des deux jeux. Les réponses déjà enregistrées gagnent
  `vitaux: []`.
- `store.test.ts` : migrations 0011 et 0012 rejouées sur SQLite ; réécriture d'un jour
  qui efface ses anciens vitaux ; `CHECK` qui refuse un appareil inconnu ;
  `lireVitaux` qui somme par appareil sur la fenêtre et ignore les autres sites.
- `vitaux.test.ts` : 19 mesures sans note, 20 avec ; 15 bonnes sur 20 donne « bon »,
  14 sur 20 non ; bornes de « moyen » ; tablette dans le global seulement ; `null`
  sans aucune mesure.
- `tableau.test.ts` : `vitesse` présente dans le tableau, `chargerTableau` lit les
  vitaux.
- `collecte.test.ts` : un jour écrit porte ses vitaux.

`d1-sqlite.testutil.ts` rejoue 0011 et 0012 par défaut.

## 7. Documentation

- `src/content/docs/coolbeans/04-portail.mdx`, section Analytics : les vitaux, la
  règle de notation, le seuil de 20 mesures.
- `2026-09-29-portail-analytics-design.md`, §1 : les Core Web Vitals sortent du hors
  périmètre, renvoi vers cette spec.

## 8. Mise en service

Aucune publication en production sans ordre de Ludo.

1. **Appliquer `0012_analytics_vitaux.sql` à `coolbeans-portal` et à
   `coolbeans-portal-staging` avant de pousser sur `staging`**, sur ordre de Ludo.
   Avec l'approche retenue, du code sans sa table fait échouer toute la collecte, trafic
   compris, dès qu'une autre session merge `staging` dans `main`. La migration est
   additive (`CREATE TABLE`), sans effet sur le code en place.
2. Le lendemain de la mise en ligne, vérifier que `analytics_vitaux` contient des
   lignes pour les 7 derniers jours.

## 9. Risques connus

- Les jours collectés avant la mise en service n'ont pas de vitaux. Sur la période,
  le nombre de mesures affiché le rend visible.
- La note tous appareils confondus n'est pas celle de Google, qui note mobile et
  ordinateur séparément. Les lignes Mobile et Ordinateur donnent cette lecture.
- Une panne du jeu `rumWebVitalsEventsAdaptiveGroups` bloque aussi la collecte du
  trafic (§3.2).
