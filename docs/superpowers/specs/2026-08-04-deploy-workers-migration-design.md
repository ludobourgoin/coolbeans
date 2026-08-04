# Spec — Bascule complète du déploiement : Cloudflare Pages → Worker unique

Date : 2026-08-04
Branche de travail : `staging` (fusionnée dans `main` le 2026-08-04, voir §3bis)
Statut : implémenté le 2026-08-04 — plan `docs/superpowers/plans/2026-08-04-deploy-workers-migration.md`

---

## 0. Contexte et problème

Le site tourne aujourd'hui sur deux systèmes de déploiement en parallèle, sans que
l'un des deux serve réellement le contenu à jour :

- **Projet Cloudflare Pages `coolbeans`** (`coolbeans-1ta.pages.dev`), connecté à
  GitHub en auto-deploy (`main` → prod, autres branches → preview). C'est lui qui
  détient aujourd'hui le domaine custom `coolbeans.cc` / `www.coolbeans.cc`.
- **Worker Cloudflare `coolbeans`**, cible introduite le 2026-07-31 quand
  `astro.config.mjs` est passé à l'adapter `@astrojs/cloudflare` (mode Workers),
  requis pour le rendu SSR de `/espace` et `/docs` (session Clerk — cf.
  `_doc-standard/SPEC.md`). Déployé pour l'instant à la main via `wrangler deploy`,
  sans intégration Git.

Conséquence observée le 2026-08-04 : la sortie de l'adapter Workers ne peut pas être
servie par un projet Pages classique, donc la quasi-totalité des builds `staging` sur
Pages échouent silencieusement (`Failure` dans `wrangler pages deployment list`), et
`coolbeans.cc` en prod ne sert que la page stub du dernier commit réel de `main`
("Update page title to Coolbeans") — jamais le site refondu, qui n'existe que sur
`staging`. Il n'existe aujourd'hui **aucune URL fonctionnelle** pour prévisualiser le
travail en cours (ex. la page de devis `/devis/en-haut`).

Rendu de page déjà tranché dans le code, non remis en cause par cette spec : tout le
site est prérendu statique par défaut ; seules `/espace` et `/docs` déclarent
`prerender = false` (SSR, requis par le middleware Clerk).

## 1. Décisions verrouillées

| # | Décision | Motif |
|---|---|---|
| 1 | Un seul système de déploiement : le Worker `coolbeans`, plus de projet Pages | Élimine la confusion et les builds fantômes |
| 2 | Auto-déploiement via **Cloudflare Workers Builds** (intégration Git native) | Retrouve le confort de Pages : un `git push` suffit, pas de commande manuelle |
| 3 | `main` → environnement `production` (`coolbeans.cc`, `www.coolbeans.cc`) | Convention existante, inchangée |
| 4 | `staging` → environnement nommé `staging` (`staging.coolbeans.cc`) | Sous-domaine dédié plutôt qu'une URL de preview à hash — présentable à un client si besoin (ex. lien de devis) |
| 5 | ~~Ancien projet Pages `coolbeans` supprimé une fois la bascule validée~~ → **révisé** : gardé en dormance (déconnecté d'usage, non supprimé), filet de sécurité le temps de confirmer que le Worker tient dans la durée. Suppression prévue "un jour prochain", décision de l'utilisateur, pas de date fixée | Coût de garder le projet ≈ nul, réversibilité en cas de souci imprévu sur le Worker |
| 6 | ~~La fusion `staging` → `main` est hors périmètre~~ → **révisée** : faite le 2026-08-04, voir §3bis | Un effet de bord de la Task 5 (détaillé en §3bis) a mis le contenu réel de `staging` en production de fait, avant toute décision explicite sur ce point. Plutôt que de revenir en arrière, l'utilisateur a choisi d'assumer et d'aligner `main` sur la réalité — décision explicite, prise après coup, pas la décision par défaut de cette spec |

## 2. Architecture cible

### 2.1 `wrangler.jsonc`

```jsonc
{
  "name": "coolbeans",
  "compatibility_date": "2026-07-01",
  "compatibility_flags": ["nodejs_compat"],
  "observability": { "enabled": true },
  "workers_dev": false,
  "routes": [
    { "pattern": "coolbeans.cc", "custom_domain": true },
    { "pattern": "www.coolbeans.cc", "custom_domain": true }
  ],
  "env": {
    "staging": {
      "workers_dev": false,
      "routes": [
        { "pattern": "staging.coolbeans.cc", "custom_domain": true }
      ]
    }
  }
}
```

`observability` est une clé héritée (s'applique aux deux environnements depuis la
déclaration top-level) — ajoutée après coup car son absence a rendu le diagnostic de
l'incident §3bis plus lent qu'il n'aurait dû (erreurs 500 sans détail exploitable).
`workers_dev` est non hérité (comme `routes`) donc déclaré aux deux niveaux : les
Custom Domains couvrent tous les cas d'usage désormais, plus besoin d'exposer aussi
les URLs `*.workers.dev`.

`routes` est une clé non héritée par les environnements (comme les bindings) : chaque
environnement déclare ses propres domaines, `staging` ne peut jamais hériter par
accident des domaines de prod.

### 2.2 Réglages Cloudflare Workers Builds (dashboard, **deux connexions séparées**)

**Historique de cette section (deux corrections successives, découvertes en exécutant
le plan le 2026-08-04) :**

1. **Task 1** : l'adapter `@astrojs/cloudflare` résout l'environnement — routes ET le
   nom du Worker lui-même (`coolbeans` → `coolbeans-staging`) — au moment du *build*,
   via `CLOUDFLARE_ENV`, pas au moment du `wrangler deploy --env <x>` (no-op silencieux
   une fois la config "redirected" déjà aplatie). Ça a mené à une première version de
   cette section avec une commande de build conditionnelle sur `WORKERS_CI_BRANCH`,
   sur une connexion Git unique — **remplacée par la version ci-dessous**.
2. **Task 4** : cette première version a échoué en pratique. Workers Builds **verrouille
   une connexion Git sur un seul nom de Worker cible** (celui du projet connecté dans
   le dashboard) et **écrase de force** tout nom différent produit par le build — log
   observé : *"Failed to match Worker name. Your config file is using the Worker name
   'coolbeans-staging', but the CI system expected 'coolbeans'. Overriding using the CI
   provided Worker name."* Un build déclenché par une branche non-`main` a ainsi
   déployé sur `coolbeans` (production) avec les routes de `staging.coolbeans.cc`,
   volant temporairement le Custom Domain à `coolbeans-staging` (reclaim manuel fait
   via `wrangler deploy` en CLI, voir rapport Task 4).

**Architecture retenue : deux connexions Git séparées, une par Worker**, conforme au
pattern ["Wrangler Environments" documenté par
Cloudflare](https://developers.cloudflare.com/workers/ci-cd/builds/advanced-setups/#wrangler-environments)
pour Workers Builds — que la première version de cette section avait à tort écarté au
profit d'un unique projet avec build conditionnel. Chaque connexion ne construit jamais
que pour son propre nom de Worker, donc plus de conflit possible.

**Connexion 1 — Worker `coolbeans` (production), Settings → Build :**

| Réglage | Valeur |
|---|---|
| Git repository | `ludobourgoin/coolbeans` |
| Production branch | `main` |
| Build command | `npm run build` (nu, plus de conditionnel) |
| Deploy command | `npx wrangler deploy` |
| Builds for non-production branches | **désactivé** (staging a sa propre connexion) |

**Connexion 2 — Worker `coolbeans-staging`, Settings → Build (nouvelle connexion, sur
le même repo) :**

| Réglage | Valeur |
|---|---|
| Git repository | `ludobourgoin/coolbeans` |
| Production branch | `staging` (oui — le champ s'appelle "Production branch" côté Cloudflare quelle que soit la branche choisie ; ici il désigne la branche que *cette* connexion déploie) |
| Build command | `CLOUDFLARE_ENV=staging npm run build` (fixe, plus de conditionnel) |
| Deploy command | `npx wrangler deploy` |
| Builds for non-production branches | désactivé (pas nécessaire, une seule branche à surveiller pour cette connexion) |

**Ancien gotcha, devenu sans objet** : la version précédente de cette section mettait en
garde contre "non-production branches" désignant *toutes* les branches hors `main`
(risque qu'une branche `feat/*` écrase `staging.coolbeans.cc`). Avec deux connexions
séparées, chacune dédiée à une seule branche précise, ce risque disparaît.

## 3. Séquence de bascule (exécutée le 2026-08-04)

Ordre pensé pour valider la chaîne complète sur un domaine neuf avant de toucher au
domaine de production, avec possibilité de revenir en arrière à chaque étape tant que
l'étape 5 n'est pas exécutée. Toutes les étapes ci-dessous ont été menées à bien ; les
incidents rencontrés en cours de route sont détaillés en §3bis.

1. Commit `wrangler.jsonc` (§2.1) sur `staging`.
2. Connecter **les deux Workers séparément** au repo GitHub dans le dashboard, chacun
   avec sa propre connexion Build (réglages §2.2 — Connexion 1 sur `coolbeans` pour
   `main`, Connexion 2 sur `coolbeans-staging` pour `staging`). Une connexion Git
   unique avec build conditionnel a été essayée et a échoué (§2.2, historique) — les
   deux connexions sont nécessaires, pas optionnelles. Aucun domaine custom n'est
   encore attaché à ce stade — zéro impact visiteur.
3. Attacher `staging.coolbeans.cc` comme Custom Domain sur le Worker `coolbeans-staging`
   (le premier `wrangler deploy`, manuel ou via la Connexion 2, le fait automatiquement
   grâce aux routes déclarées en §2.1). Domaine neuf, aucun conflit possible avec
   l'ancien Pages. Une fois la Connexion 2 en place, un push sur `staging` redéploie
   automatiquement.
4. Vérification sur `staging.coolbeans.cc` : accueil, `/devis/en-haut`, `/espace`
   (doit rediriger vers le sign-in Clerk), `/docs/...` (idem). **`coolbeans.cc` n'est à
   aucun moment de ces étapes attaché à un Worker ni modifié** — le build "aplati"
   (§2.1, §2.2 point 1) confine chaque déploiement à un seul nom de Worker et un seul
   jeu de routes ; même l'incident de vol temporaire de domaine (§2.2 point 2) est resté
   circonscrit à `staging.coolbeans.cc` entre les deux Workers déjà en place, sans
   jamais toucher `coolbeans.cc`/`www.coolbeans.cc` ni le projet Pages encore actif.
5. **Bascule de la prod — nécessite un feu vert explicite au moment de l'exécuter** :
   détacher `coolbeans.cc` + `www.coolbeans.cc` du projet Pages, puis les attacher
   comme Custom Domains sur l'environnement `production` du Worker. Les deux domaines
   étant Cloudflare-natifs des deux côtés, la coupure se compte en secondes à
   quelques minutes, pas un changement DNS externe classique.
6. Vérification prod identique à l'étape 4, sur `coolbeans.cc`.
7. Suppression de l'ancien projet Pages `coolbeans-1ta.pages.dev` — seulement une fois
   l'étape 6 validée, avec feu vert explicite.

Les étapes 5 et 7 sont les seules qui touchent la prod ou suppriment une ressource ;
elles ont chacune été reconfirmées individuellement au moment de l'exécution (étape 5
le 2026-08-04 ; étape 7 différée, voir décision 5 révisée en §1), conformément à la
règle du projet sur les publications en production.

## 3bis. Incidents rencontrés et résolus (review finale, 2026-08-04)

Deux problèmes réels ont été découverts par la review finale de branche, après
l'exécution des étapes 1 à 7 ci-dessus, et corrigés le jour même.

**Incident A — promotion involontaire du contenu de `staging` en production.** L'étape
5 (`npm run build && npx wrangler deploy`) a été exécutée depuis un worktree Git dont
le code source était celui de `staging`, pas celui de `main`. Le build "sans
`CLOUDFLARE_ENV`" cible bien la config de production (nom du Worker, domaines — voir
§2.2 point 1), mais ça ne dit rien du *contenu* buildé, qui dépend du code source
présent sur la machine qui build, indépendamment de la variable d'environnement.
Résultat : `coolbeans.cc` s'est mis à servir le vrai site (y compris la page de devis
client `/devis/en-haut`) au lieu du stub de `main`, sans qu'aucune décision explicite
de publication de contenu n'ait été prise à ce moment — alors que la décision 6
originale de cette spec plaçait justement cette publication hors périmètre.

Décision prise avec l'utilisateur une fois l'écart constaté : assumer l'état de fait
plutôt que revenir en arrière, et **fusionner `staging` dans `main`** (fast-forward
pur, `main` n'avait aucun commit que `staging` n'avait pas) pour que la branche
`main` corresponde enfin à ce qui tourne réellement en prod. Poussé, un build
automatique déclenché sur la Connexion 1 (`main` → `coolbeans`) a reconstruit et
redéployé la prod depuis la vraie source — vérifié : `coolbeans.cc` et
`www.coolbeans.cc` servent le site refondu, `/espace` et `/docs/<projet>` redirigent
vers Clerk. Ceci **annule et remplace la décision 6** de cette spec (voir §1).

**Incident B — pipeline CI de `staging` cassé (500 sur `/espace`, `/docs`) après le
premier déploiement automatique.** Le secret `CLERK_SECRET_KEY` avait été posé
correctement sur le Worker (Task 2 du plan), mais `PUBLIC_CLERK_PUBLISHABLE_KEY`
(clé publique, inlinée dans le bundle client au *moment du build* par Astro) n'était
disponible que dans un `.env` local — jamais transmis au runner Workers Builds, qui
n'a pas accès aux fichiers gitignorés d'une machine de développement. Le premier
déploiement automatique après la correction du secret runtime a donc reconstruit sans
cette clé publique, cassant les routes protégées. Fix : `PUBLIC_CLERK_PUBLISHABLE_KEY`
ajoutée comme **variable de build** (non-secrète, assumée publique) dans le panneau
"Variables and secrets" des deux connexions Workers Builds (§2.2) — pas seulement dans
`.env` local. Revérifié après un rebuild déclenché : `307` sur `/espace` et
`/docs/<projet>`, staging comme prod.

## 4. Hors périmètre

- Revoir la répartition SSR/statique par route (déjà correcte : seuls `/espace` et
  `/docs` sont SSR).
- Le différend `_doc-standard/SPEC.md` (qui mentionne Cloudflare Access sur `/docs/*`)
  vs l'implémentation actuelle (Clerk sur `/espace` et `/docs`) — l'implémentation
  fait foi, la spec `_doc-standard` semble ne pas avoir été mise à jour après le choix
  de Clerk. À signaler séparément si besoin de nettoyer la doc.
- **Instance Clerk de production.** `coolbeans.cc` redirige aujourd'hui vers une
  instance Clerk de **développement** (`*.accounts.dev`, limites et bannières propres
  au mode dev) — la seule qui existe à ce jour (`clerk doctor` confirme l'absence
  d'instance "production"). Acceptable tant que le site est en phase de rodage, mais à
  traiter avant un vrai lancement public : créer l'instance Clerk production, poser ses
  clés (`CLERK_SECRET_KEY` runtime + `PUBLIC_CLERK_PUBLISHABLE_KEY` build) sur le
  Worker `coolbeans` uniquement. Tâche séparée, pas de la plomberie de déploiement.
- **Nettoyage de `dist/` après un build local.** Un build fait sur une machine avec
  `.env` local inline la valeur du secret Clerk directement dans le bundle serveur
  buildé (`dist/server/**/*.mjs`). `dist/` est gitignoré donc rien ne fuite dans le
  repo, mais c'est un rappel que le Worker actuellement déployé en prod contient une
  copie figée de la clé de dev utilisée au moment du build CI — une rotation du secret
  runtime seule ne la remplace pas, il faut un nouveau déploiement.
