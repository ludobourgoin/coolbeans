# Refonte du gabarit des documents client

Date : 2026-09-22
Portée : `cadrage`, `devis`, `livrable`, `temoignage`

## Le défaut à corriger

Sur un document à versions, l'en-tête complet change quand on bascule d'onglet : titre, objet, date, libellé du bouton. Le lecteur ne sait plus s'il a changé d'onglet ou de page. Relevé par Ludo le 2026-09-22 sur le livrable CAFA.

La cause est structurelle. Les quatre gabarits posent le titre de version DANS la zone qui surmonte les onglets, et placent la barre d'onglets SOUS le contenu qu'elle commande.

### La règle qui en sort

> **Dans un document à onglets, ce qui est au-dessus des onglets identifie le document et ne change jamais d'un onglet à l'autre. Ce qui appartient à une version vit sous les onglets.**

Elle est reprise en commentaire d'en-tête du composant partagé. Un document sans version suit la même grammaire, simplement sans barre d'onglets.

## Ce qui est décidé

### 1. La frise des étapes

Un document ne porte plus une étiquette de type mais **la frise des cinq étapes du projet**, en pastilles. Seule l'étape du document est colorée, les quatre autres sont grises. Le client situe le document dans le déroulé, sans quitter la page.

| Étape | Teinte `Badge` | Gabarit naturel |
|---|---|---|
| Cadrage | `amber` | `cadrage` |
| Proposition | `blue` | `devis` |
| Production | jamais colorée | aucun |
| Livraison | `green` | `livrable` |
| Suivi | `purple` | `temoignage` |

`Production` n'a pas de document et reste grise partout. C'est voulu : elle montre au client qu'une phase de travail existe entre la signature et la livraison.

**Les pastilles sont un composant neuf, pas une extension de `Badge`.** `Badge subtle` utilise `--ds-*-200` et mesure 24 px de haut avec 8 px de padding. L’image OG de Coolbeans, qui fait référence, utilise `--ds-*-100` et des pastilles bien plus aérées. Mesures relevées au pixel dans le fichier source :

| | Valeur |
|---|---|
| Fond | `--ds-<teinte>-100` |
| Texte | `--ds-<teinte>-900` |
| Hauteur | 32 px (échelle dense retenue ; 42 px dans l’OG) |
| Padding horizontal | 16 px |
| Gouttière | 9 px |
| Texte | 14 px, graisse 500 |
| Rayon | plein |

Chaque pastille porte **son numéro d’étape, de 1 à 5**, en chiffre monospace atténué devant le libellé. Le numéro dit la séquence, ce qui rend inutile toute distinction visuelle entre étapes passées et à venir : les quatre non courantes restent identiques, sur `--surface-raise`.

`Badge` garde son rôle pour les petites étiquettes. Les paires `-100`/`-900` sont à ajouter à la section G de `scripts/verify-design-system.js`, qui ne vérifie aujourd’hui que les `-200`.

**La frise situe le document, pas l'avancement réel du projet.** Un client qui rouvre la proposition en janvier voit `Proposition` colorée même si le projet est en production. Porte laissée ouverte : brancher la frise sur un état réel demanderait une source de vérité par projet, Linear par exemple. Hors périmètre ici.

### 2. L'étape est un champ, pas une déduction

Première version de ce design : déduire l'étape de la collection. **Faux**, et corrigé par Ludo. Les deux documents de domaine CAFA (`nom-de-domaine-9042`, `achat-domaine-4520`) utilisent le gabarit cadrage alors que le devis était signé et le projet en production. Le gabarit est un outil, l'étape est un moment.

```yaml
etape: production   # facultatif ; défaut = l'étape naturelle de la collection
```

26 documents sur 28 n'en auront jamais besoin.

### 3. Le sujet, stable

Un champ porté par le **document racine seulement**, qui nomme le projet et vaut pour toutes ses versions.

```yaml
sujet: Site web du CAFA Toulouse Occitanie
```

Le schéma le refuse sur une version : l'y autoriser rouvrirait exactement le bug qu'on ferme. `linear.projet` ne sert pas de repli, il contient tantôt un nom tantôt une URL Linear brute sur les 35 documents existants.

### 4. La structure de l'en-tête

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  filet 3px, teinte de l'étape
 coolbeans                        [connexion]   DocumentTopbar
───────────────────────────────────────────────
 Cadrage Proposition PRODUCTION Livraison Suivi  ZONE STABLE
                                                 alignée à gauche
 Site web du CAFA Toulouse Occitanie             = sujet, h1

 ( V1 · 17 sept. )  ( V2 · 22 sept. )            onglets
───────────────────────────┬───────────────────
 Vos retours sont intégrés │ SUR CETTE PAGE      ZONE VERSION
 Ce que vous avez demandé… │ Comparer…           titre = h2
 VERSION 2 DU 22 SEPT.     │ L'écriture
 [ Ouvrir la version ]     │ Les photos
                           │ ↑ collant
 contenu du document…      │
 ←──── 880px ────→         │ ←─ 264px ─→
```

Le filet de 3 px se colle **sous** la barre Coolbeans, il ne flotte pas au-dessus. Un bandeau flottant se lirait comme une alerte ou un artefact de navigateur. À 3 px la teinte saturée reste sobre, et la couleur ne porte jamais l'information seule puisque les pastilles gardent leur texte.

### 5. La coquille, reprise du portail

Les documents abandonnent le centrage et adoptent la structure des pages de `my.coolbeans.cc` : largeur maximale, contenu aligné à gauche, ancres à droite sous « Sur cette page ».

- contenu : `max-width: 880px`, la largeur que les documents utilisent déjà
- ancres : `--portal-col`, 264px, collantes, construites depuis les `h2`
- en dessous de 1100 px, la colonne de droite disparaît au profit de **la nav horizontale de `DevisCorps`**, déjà en place et qui défile latéralement. Rien à inventer, elle est reprise telle quelle
- pas de navigation globale à gauche : `DocumentTopbar` documente pourquoi ces pages n'ont pas la Nav du site, et ça ne change pas

Le sommaire horizontal collant de `DevisCorps` ne disparaît pas, il devient la forme mobile de la colonne de droite. Sur grand écran c’est la colonne qui sert, en dessous de 1100 px c’est lui. Les `scroll-mt-16.5` calés dessus restent valables en mobile et sont à recalculer sur grand écran, où plus rien ne colle au sommet.

### 6. Les URLs

```
avant :  coolbeans.cc/livrable/cafa/site-web-8791
après :  coolbeans.cc/cafa/site-web-8791/livraison-4210
```

`coolbeans.cc/<client>/<projet>/<document>`. Les documents d'un même projet sont enfin groupés, ce que l'ancien schéma ne permettait pas.

Deux règles sur ces chemins, faute de quoi on rouvre le bug qu'on ferme.

**La référence du document est celle de la racine.** Une version n'a jamais d'URL propre, elle vit sous l'onglet de sa racine. Le `6317` du fichier `site-web-v2-6317.yaml` n'apparaît donc nulle part dans une adresse.

**Le nom du fichier n'arbitre rien.** Un document peut s'appeler `cadrage-1234` et porter `etape: production`, c'est même exactement le cas des deux documents de domaine CAFA. Le champ `etape` est la seule source de vérité de la frise, le nom de fichier n'est qu'une commodité de lecture dans le dépôt.

Les fichiers ne changent pas de collection. `src/content/<collection>/` reste l'organisation sur disque, seules les routes bougent.

Ludo accepte de casser les liens envoyés. On pose quand même les redirections 301 des anciennes URLs vers les nouvelles : une ligne par document, et ça évite de renvoyer des liens à sept clients.

**Conséquence à surveiller :** les quatre collections perdent leur préfixe d'URL, donc la route ne peut plus déduire le gabarit du chemin. Le gabarit vient de la collection dans laquelle le fichier vit, la route les balaye toutes les quatre.

### 7. L'ouverture depuis le portail

Chaque document doit être accessible depuis l'espace du client, même si son URL reste publique.

L'entrée se déclare dans `src/lib/portail/nav.ts`, registre central de la barre latérale, sous une section `Documents`. Elle liste les documents du client courant, groupés par projet et ordonnés par étape.

**Les liens sont absolus vers `coolbeans.cc`.** Le portail vit sur `my.coolbeans.cc` ; un lien relatif tomberait sur la page de connexion, le même piège que `DocumentTopbar` documente pour son logotype.

Visibilité : la section n'apparaît que si le client a au moins un document, selon le mécanisme à deux étages déjà en place dans ce fichier.

## Reprise de l'existant

35 documents, dont 7 versions. **28 racines à reprendre :**

| Collection | Documents |
|---|---|
| `devis` | 23 (dont 5 versions) |
| `cadrage` | 7 |
| `livrable` | 4 (dont 2 versions) |
| `temoignage` | 1 |

Sur chaque racine : ajouter `sujet`, poser la redirection depuis l’ancienne URL. Le fichier reste dans sa collection, seule sa route change. `etape` seulement sur les deux documents de domaine CAFA.

## Hors périmètre

- Brancher la frise sur l'avancement réel du projet.
- Rendre les pastilles cliquables vers les documents frères du même projet. Le nouveau schéma d'URL le permettra ; c'est une deuxième passe.
- Toucher au fond des documents. Seuls l'en-tête, la coquille et les chemins bougent.

## Critères de recette

- [ ] Basculer d'onglet ne change rien au-dessus de la barre d'onglets, sur `devis` et `livrable`
- [ ] Les quatre gabarits partagent le même composant d'en-tête
- [ ] La frise affiche cinq pastilles, une seule colorée, sur les quatre gabarits
- [ ] `Production` n'est colorée sur aucun document
- [ ] Les deux documents de domaine CAFA affichent `Production` colorée
- [ ] Le filet reprend la teinte de l'étape et suit le thème clair comme sombre
- [ ] `verify-design-system.js` passe, `green` compris
- [ ] Les 28 anciennes URLs redirigent en 301 vers les nouvelles
- [ ] Un client connecté ouvre chacun de ses documents depuis sa barre latérale
- [ ] Vérifié sur desktop, tablette et mobile : pas de débordement, ancres utilisables ou repliées
