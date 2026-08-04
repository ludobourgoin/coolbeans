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

### 2.2 Réglages Cloudflare Workers Builds (dashboard, Worker `coolbeans` → Settings → Build)

**Découvert en exécutant le plan (Task 1, 2026-08-04) : l'adapter `@astrojs/cloudflare`
résout l'environnement — routes ET le nom du Worker lui-même (`coolbeans` →
`coolbeans-staging`) — au moment du *build*, via la variable `CLOUDFLARE_ENV`, pas au
moment du `wrangler deploy --env <x>`. Le flag `--env` sur `wrangler deploy` est un
no-op silencieux une fois que le build a déjà "aplati" la config
(`dist/server/wrangler.json`, mode "redirected configuration"). Vérifié empiriquement :
build nu → `name: "coolbeans"` + routes prod ; `CLOUDFLARE_ENV=staging` →
`name: "coolbeans-staging"` + routes `staging.coolbeans.cc` ; `CLOUDFLARE_ENV=production`
(non déclaré dans `wrangler.jsonc`) → erreur explicite. C'est cohérent avec le pattern
["Wrangler Environments" documenté par Cloudflare pour Workers
Builds](https://developers.cloudflare.com/workers/ci-cd/builds/advanced-setups/#wrangler-environments)
: un environnement nommé devient un Worker séparé `<nom>-<env>`. Le tableau ci-dessous
est corrigé en conséquence — c'est la commande de **build**, pas de déploiement, qui
doit varier selon la branche.**

| Réglage | Valeur |
|---|---|
| Git repository | `ludobourgoin/coolbeans` |
| Production branch | `main` |
| Build command | `if [ "$WORKERS_CI_BRANCH" = "main" ]; then npm run build; else CLOUDFLARE_ENV=staging npm run build; fi` |
| Deploy command | `npx wrangler deploy` (nu — le build a déjà figé la cible, `--env` serait un no-op) |
| Builds for non-production branches | activé |
| Non-production branch deploy command | `npx wrangler deploy` (nu, même raison) |

`WORKERS_CI_BRANCH` est une variable système injectée automatiquement par Workers
Builds à chaque build (nom de la branche du push). À vérifier lors de la Task 4 du plan
(premier build automatique réel) : que sa valeur est bien le nom court de branche
(`main`, `staging`) et non une forme du type `refs/heads/main` — la doc Cloudflare ne
le précise pas explicitement.

**Gotcha à connaître** : "non-production branches" désigne *toutes* les branches
autres que `main`, pas seulement `staging`. Avec la convention actuelle (`main` = prod,
`staging` = seule branche longue durée, pas de feature branches poussées sur le
remote), chaque push sur `staging` republie proprement `staging.coolbeans.cc` sans
collision. Si l'usage change un jour (ex. des branches `feat/*` poussées sur le repo
distant), elles écraseraient aussi `staging.coolbeans.cc` puisque le "non-production
branch deploy command" s'applique à toute branche non-prod indifféremment. Pas un
problème dans l'usage actuel — à surveiller si l'usage change.

## 3. Séquence de bascule

Ordre pensé pour valider la chaîne complète sur un domaine neuf avant de toucher au
domaine de production, avec possibilité de revenir en arrière à chaque étape tant que
l'étape 5 n'est pas exécutée.

1. Commit `wrangler.jsonc` (§2.1) sur `staging`.
2. Connecter le Worker `coolbeans` au repo GitHub dans le dashboard (réglages §2.2).
   Aucun domaine custom n'est encore attaché au Worker à ce stade — zéro impact
   visiteur.
3. Attacher `staging.coolbeans.cc` comme Custom Domain sur l'environnement `staging`
   du Worker. Domaine neuf, aucun conflit possible avec l'ancien Pages. Un push sur
   `staging` déploie automatiquement.
4. Vérification sur `staging.coolbeans.cc` : accueil, `/devis/en-haut`, `/espace`
   (doit rediriger vers le sign-in Clerk), `/docs/...` (idem).
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
