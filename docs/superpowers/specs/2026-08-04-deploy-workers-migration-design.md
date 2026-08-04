# Spec — Bascule complète du déploiement : Cloudflare Pages → Worker unique

Date : 2026-08-04
Branche de travail : `staging`
Statut : design validé, en attente d'implémentation

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
| 5 | Ancien projet Pages `coolbeans` **supprimé** une fois la bascule validée | Plus de risque de confusion entre les deux systèmes |
| 6 | La fusion `staging` → `main` (contenu réel en prod) est **hors périmètre** de cette spec | Décision de publication de contenu, distincte de la plomberie de déploiement — reste soumise à l'accord explicite du client avant toute mise en prod |

## 2. Architecture cible

### 2.1 `wrangler.jsonc`

```jsonc
{
  "name": "coolbeans",
  "compatibility_date": "2026-07-01",
  "compatibility_flags": ["nodejs_compat"],
  "routes": [
    { "pattern": "coolbeans.cc", "custom_domain": true },
    { "pattern": "www.coolbeans.cc", "custom_domain": true }
  ],
  "env": {
    "staging": {
      "routes": [
        { "pattern": "staging.coolbeans.cc", "custom_domain": true }
      ]
    }
  }
}
```

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

## 3. Séquence de bascule

Ordre pensé pour valider la chaîne complète sur un domaine neuf avant de toucher au
domaine de production, avec possibilité de revenir en arrière à chaque étape tant que
l'étape 5 n'est pas exécutée.

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
elles seront reconfirmées individuellement au moment de l'implémentation, conformément
à la règle du projet sur les publications en production.

## 4. Hors périmètre

- Fusionner `staging` dans `main` pour publier le contenu réel du site (décision de
  contenu séparée).
- Revoir la répartition SSR/statique par route (déjà correcte : seuls `/espace` et
  `/docs` sont SSR).
- Le différend `_doc-standard/SPEC.md` (qui mentionne Cloudflare Access sur `/docs/*`)
  vs l'implémentation actuelle (Clerk sur `/espace` et `/docs`) — l'implémentation
  fait foi, la spec `_doc-standard` semble ne pas avoir été mise à jour après le choix
  de Clerk. À signaler séparément si besoin de nettoyer la doc.
