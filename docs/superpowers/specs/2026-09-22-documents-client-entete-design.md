# Refonte du gabarit des documents client

Date : 2026-09-22
Portée : les quatre collections `cadrage`, `devis`, `livrable`, `temoignage`
Aperçu ayant servi aux arbitrages : `src/pages/apercu-gabarit.astro`, page jetable

## Le défaut à corriger

Sur un document à versions, l'en-tête complet change quand on bascule d'onglet : titre, objet, date, libellé du bouton. Le lecteur ne sait plus s'il a changé d'onglet ou de page. Relevé par Ludo le 2026-09-22 sur le livrable CAFA.

La cause est structurelle. Les quatre gabarits posent le titre de version DANS la zone qui surmonte les onglets, et placent la barre d'onglets SOUS le contenu qu'elle commande.

### La règle qui en sort

> **Ce qui est au-dessus d'une barre d'onglets identifie la page et ne change jamais d'un onglet à l'autre. Ce qui appartient à un onglet vit sous la barre.**

Elle est reprise en commentaire d'en-tête du composant partagé, et vaut pour tout composant à onglets, pas seulement ces documents.

## 1. La structure de l'en-tête

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  filet 3px, teinte de l'étape
 coolbeans                        [connexion]   DocumentTopbar
───────────────────────────────────────────────
                                                ZONE STABLE
 Site web du CAFA Toulouse Occitanie            nom du projet, h1

 1 Cadrage  2 Proposition  3 Production         frise, navigue entre
 4 Livraison  5 Suivi                           les documents du projet

 ( V1 · 17 sept. )  ( V2 · 22 sept. )           onglets de version
───────────────────────────────────────────────
 COMPARER · L'ÉCRITURE · LES PHOTOS             nav des sections, collante
───────────────────────────────────────────────
 Vos retours sont intégrés                      ZONE ONGLET
 Ce que vous avez demandé le 18 septembre…      titre en h2
 VERSION 2 DU 22 SEPTEMBRE 2026
 [ Ouvrir la nouvelle version ]

 contenu du document…
```

Deux niveaux de navigation, de poids décroissant. La frise change de document, les onglets changent de version. La barre des sections trace la frontière entre l'identité et le contenu.

## 2. La frise des étapes

Cinq pastilles, toujours les cinq, numérotées de 1 à 5. Seule celle du document courant est colorée. **Le numéro dit la séquence**, ce qui rend inutile toute distinction visuelle entre étapes passées et à venir.

| N° | Étape | Teinte | Gabarit habituel |
|---|---|---|---|
| 1 | Cadrage | `amber` | `cadrage` |
| 2 | Proposition | `blue` | `devis` |
| 3 | Production | `gray` | variable |
| 4 | Livraison | `green` | `livrable` |
| 5 | Suivi | `purple` | `temoignage` |

Les pastilles **naviguent** entre les documents du projet. Survol teinté, page active teintée, les autres grises. Une étape dont le document n'existe pas est estompée et non cliquable.

### Les pastilles sont un composant neuf

`Badge subtle` ne convient pas : `--ds-*-200`, 24 px de haut, 8 px de padding. L'image OG de Coolbeans fait référence et utilise `--ds-*-100` avec des pastilles bien plus aérées. Mesures relevées au pixel dans le fichier source :

| | Image OG | Retenu ici |
|---|---|---|
| Fond | `--ds-<teinte>-100` | idem |
| Texte | `--ds-<teinte>-900` | idem |
| Hauteur | 42 px | **32 px** |
| Padding horizontal | 25 px | 16 px |
| Gouttière | 12 px | 9 px |
| Texte | 17 px | 14 px, graisse 500 |
| Rayon | plein | plein |

Le numéro se place devant le libellé, en chiffre monospace à 11 px et 55 % d'opacité. Les pastilles inactives sont sur `--surface-raise`.

`Badge` garde son rôle pour les petites étiquettes. Les paires `-100`/`-900` sont à ajouter à la section G de `scripts/verify-design-system.js`, qui ne vérifie aujourd'hui que les `-200`.

## 3. L'étape est un champ, pas une déduction

Première version de ce design : déduire l'étape de la collection. **Faux.** Les deux documents de domaine CAFA utilisent le gabarit `cadrage` alors que le devis était signé et le projet en production. Le document `sites-relais` de Rév'olutions Douces est un `livrable` qui sert la phase production.

Le gabarit est un outil, l'étape est un moment.

```yaml
etape: production   # défaut = l'étape habituelle de la collection
```

## 4. Le nom du projet vient de Linear

Pas de champ `sujet`. `linear.projet` porte le nom exact du projet Linear et devient le titre affiché. Un seul endroit fait autorité, aucune dérive possible.

État actuel à reprendre : sur 35 documents, cinq contiennent une URL Linear collée au lieu du nom, un n'a rien, et Amusoire cite un nom qui n'existe pas dans Linear.

**Huit projets Linear sont à renommer avant de pouvoir s'afficher devant un client** : `Refonte site Internet`, `Refonte Astro`, `Refonte du site : Webflow vers Astro`, `LP Anti-crise`, `Migration UK / Music Quiz`, `Intégration Shopify`, `Scolies V1`, le projet Osmose, dont le nom Linear contient un tiret cadratin que la règle maison interdit, et que le devis orthographie avec un point médian. Les deux projets de Mathilde Chevalier sont à fusionner.

## 5. La coquille

Reprise de la structure des pages de `my.coolbeans.cc`, sans la navigation globale que ces documents n'ont pas.

- colonne de contenu : `max-width: 880px`, **centrée** dans la page
- texte **aligné à gauche** dans cette colonne, jamais centré
- nav des sections : horizontale, collante, pleine largeur, **ses liens calés sur le bord gauche de la colonne**
- pas de colonne d'ancres à droite

> [!warning] Le piège d'alignement de la nav
> La liste porte `width: max-content` pour déborder et déclencher le défilement latéral. Elle ne peut donc PAS porter `margin-inline: auto`, qui centrerait la liste au lieu de l'aligner. La colonne est portée par un bloc parent, la liste part de son bord gauche. Erreur commise deux fois pendant la conception, vérifiée depuis par mesure : tous les éléments partent à la même abscisse.

Le filet de 3 px se colle **sous** la barre Coolbeans, il ne flotte pas au-dessus. Un bandeau flottant se lirait comme une alerte. En développement et en préproduction, `EnvBanner` occupe déjà cette place, les deux se superposeront : à traiter.

## 6. Les URLs

```
avant : coolbeans.cc/livrable/cafa/site-web-8791
après : coolbeans.cc/caf/site-web-879/livraison
```

`coolbeans.cc/<client>/<projet>-<3 chiffres>/<étape>`

- **client** : trois lettres, comme la clé de team Linear (`caf`, `amu`, `rev`)
- **projet** : nom raccourci, suivi d'une référence de **trois chiffres**
- **étape** : le mot de l'étape, en minuscules

Trois règles sur ces chemins :

**Une référence par projet, pas par document.** Aujourd'hui `serial-generations` porte trois références pour un seul projet.

**La référence du document est celle de la racine.** Une version n'a jamais d'URL propre, elle vit sous l'onglet de sa racine.

**Le nom du fichier n'arbitre rien.** Le champ `etape` est la seule source de vérité de la frise. Les fichiers restent dans `src/content/<collection>/`, seules les routes changent.

Les anciennes URLs sont redirigées en 301. Ludo accepte de les casser, mais une ligne par document évite de renvoyer des liens à sept clients.

> [!danger] Ce que trois chiffres protègent, et ce qu'ils ne protègent pas
> Mille combinaisons arrêtent la découverte accidentelle, pas quelqu'un qui cherche : un script les épuise en quelques secondes. Ces pages sont `noindex`, donc hors de Google, mais `noindex` n'a jamais protégé de quelqu'un qui tape une adresse.
>
> Arbitrage de Ludo du 2026-09-22, en connaissance de cause. Il en découle que **la proposition commerciale, qui porte le prix, est à considérer comme semi-publique.**

## 7. Les onglets ne sont plus seulement des versions

Deux documents peuvent partager une page sans être deux versions l'un de l'autre. Les deux documents de domaine CAFA sont deux chapitres : choisir le nom, puis l'acheter.

```yaml
# production, premier onglet
onglet: Choisir le nom

# production, second onglet
versionDe: caf/site-web-879/production
onglet: Acheter le nom
```

Champ `onglet` facultatif. Renseigné, la pastille affiche son libellé et la ligne de date perd sa mention de version. Absent, elle retombe sur `V2 · 22 sept. 2026`.

`versionDe` conserve son nom bien qu'il signifie désormais « partage la page de » plutôt que « est une version de ».

## 8. L'ouverture depuis le portail

Chaque document est accessible depuis l'espace du client, même si son URL reste publique. L'entrée se déclare dans `src/lib/portail/nav.ts`, registre central de la barre latérale, sous une section `Documents`, groupée par projet et ordonnée par étape.

**Les liens sont absolus vers `coolbeans.cc`.** Le portail vit sur `my.coolbeans.cc`, un lien relatif tomberait sur la page de connexion.

## 9. Confidentialité

Ces documents ne portent **ni information confidentielle ni élément stratégique**. Tout ce qui l'est reste sur le workspace `my.coolbeans.cc`.

Cette règle ne peut pas s'appliquer uniformément : la proposition commerciale doit porter le prix, et rester publique pour qu'un prospect sans compte portail puisse la valider. Ce qu'elle interdit en revanche : marges, coûts internes, charge en jours, notes sur le client, éléments de concurrence.

Une revue des quatre gabarits, champ par champ, reste à faire avant l'implémentation.

## 10. La nomenclature client / projet

Tranché le 2026-09-22 :

| Client | Projet | Remarque |
|---|---|---|
| `cafa` | site web | Les deux documents de domaine deviennent le document de production, à deux onglets |
| `amusoire` | refonte | Linear fait foi : « Refonte Webflow et intégration technique » |
| `aurelie-malbec` | site vitrine, précommande du livre | deux projets |
| `setencorpsmieux` | refonte site, **osmose** | `osmose` n'est pas un client, c'est un projet |
| `universite-montpellier` | **serial-generations** | `serial-generations` n'est pas un client, c'est le projet de site web de l'université |
| `revolutions-douces` | salon Construire et Habiter Autrement | `sites-relais` n'est pas un projet, c'est un document de la phase production de ce projet |
| `danae` | page vitrine Vice Versa | |
| `littlebox` | site vitrine | |
| `miharu` | plaquette Agen, formulaire brochures | deux projets |
| `veronique-berthet` | manuscrit | aucun projet Linear correspondant, à créer ou à assumer |
| `fylgo`, `oide`, `unlockbreath`, `mathilde-chevalier` | un projet chacun | |

La même nomenclature servira au rangement de `/dev`, suivi dans **COO-232**.

## Reprise de l'existant

35 documents, dont 7 versions, soit **28 racines**.

| Collection | Documents |
|---|---|
| `devis` | 23, dont 5 versions |
| `cadrage` | 7 |
| `livrable` | 4, dont 2 versions |
| `temoignage` | 1 |

Sur chaque racine : vérifier `linear.projet`, poser `etape` si l'étape diffère de l'habituelle, poser la redirection depuis l'ancienne URL.

## Hors périmètre

- Le rangement de `/dev` en dossiers client, suivi dans **COO-232**
- Brancher la frise sur l'avancement réel du projet, qui demanderait une source de vérité par projet
- Toucher au fond des documents, seuls l'en-tête, la coquille et les chemins bougent

## Critères de recette

- [ ] Basculer d'onglet ne change rien au-dessus de la barre d'onglets, sur `devis` et `livrable`
- [ ] Les quatre gabarits partagent le même composant d'en-tête
- [ ] La frise affiche cinq pastilles numérotées, une seule colorée, et navigue entre les documents du projet
- [ ] Une étape sans document est estompée et non cliquable
- [ ] Les deux documents de domaine CAFA vivent sous une seule page de production, onglets « Choisir le nom » et « Acheter le nom »
- [ ] Titre, pastilles, onglets, liens de nav et paragraphes partent tous de la même abscisse, vérifié par mesure
- [ ] Le filet reprend la teinte de l'étape dans les deux thèmes
- [ ] `verify-design-system.js` passe, paires `-100` comprises
- [ ] Les 28 anciennes URLs redirigent en 301
- [ ] Un client connecté ouvre chacun de ses documents depuis sa barre latérale
- [ ] Vérifié sur desktop, tablette et mobile, la nav des sections défilant latéralement sur petit écran
