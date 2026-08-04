# Bascule déploiement Pages → Worker unique — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer les deux systèmes de déploiement concurrents (projet Cloudflare Pages `coolbeans` + Worker `coolbeans` déployé à la main) par un seul système : le Worker `coolbeans`, auto-déployé via Cloudflare Workers Builds, avec `main` → `coolbeans.cc` (prod) et `staging` → `staging.coolbeans.cc` (preview stable).

**Architecture:** Un Worker Cloudflare unique avec deux environnements Wrangler (`production` implicite, `staging` nommé), chacun avec ses propres Custom Domains déclarés dans `wrangler.jsonc` (clé `routes`, non héritée entre environnements). L'auto-déploiement est géré par Cloudflare Workers Builds (intégration Git native), qui remplace l'auto-deploy Git que Pages fournissait.

**Tech Stack:** Astro 6 (`@astrojs/cloudflare` adapter, mode Workers), Wrangler 4.118.0, Cloudflare Workers Builds, Cloudflare Custom Domains.

## Global Constraints

- Un `git push` doit suffire à déployer — pas de commande manuelle en usage courant (spec §1 décision 2).
- `staging` → `staging.coolbeans.cc` obligatoirement (pas d'URL à hash) (spec §1 décision 4).
- Toute étape qui touche le domaine `coolbeans.cc` en production, ou qui supprime une ressource Cloudflare, nécessite un feu vert explicite au moment de l'exécuter — ne jamais l'exécuter en enchaînement automatique même si le plan global a été approuvé (spec §3, règle projet sur les publications en production).
- Ne pas toucher au rendu SSR/statique existant (`/espace` et `/docs` en SSR, tout le reste prérendu) — hors périmètre (spec §4).
- ~~Ne pas fusionner `staging` dans `main` — hors périmètre~~ — **contrainte levée le
  2026-08-04** suite à l'incident documenté en spec §3bis (Task 5 a promu le contenu de
  `staging` en prod par effet de bord ; décision explicite de l'utilisateur d'assumer
  et de fusionner `staging` → `main` plutôt que de revenir en arrière).

## Résumé d'exécution (2026-08-04)

Tasks 1 à 5 exécutées et review-clean (voir ledger `.superpowers/sdd/` pour le détail
complet, non committé). Task 6 différée par décision explicite de l'utilisateur —
projet Pages `coolbeans-1ta.pages.dev` gardé en dormance comme filet de sécurité,
suppression prévue plus tard, pas de date fixée. Deux incidents découverts par la
review finale de branche et corrigés le jour même : voir spec §3bis (contenu `staging`
promu en prod par erreur d'exécution, pipeline `staging` cassé faute de variable de
build publique). État final vérifié : `coolbeans.cc` / `www.coolbeans.cc` (prod) et
`staging.coolbeans.cc` fonctionnels, `main` et `staging` alignés (fast-forward),
auto-déploiement opérationnel des deux côtés via deux connexions Workers Builds
séparées.

---

### Task 1: Config Wrangler — routes de domaines custom par environnement

**Files:**
- Modify: `wrangler.jsonc`

**Interfaces:**
- Produces: `wrangler.jsonc` avec un bloc top-level `routes` (production : `coolbeans.cc`, `www.coolbeans.cc`) et un bloc `env.staging.routes` (`staging.coolbeans.cc`), tous deux avec `custom_domain: true`. Les tasks suivantes déploient contre cette config via `wrangler deploy` / `wrangler deploy --env staging`.

- [x] **Step 1: Constater l'état actuel**

Run: `cat wrangler.jsonc`

Expected: pas de clé `routes`, pas de clé `env` — seulement `name`, `compatibility_date`, `compatibility_flags`.

- [x] **Step 2: Ajouter les routes de domaines custom**

Remplacer le contenu de `wrangler.jsonc` par :

```jsonc
// Config Worker du site Coolbeans (adapter @astrojs/cloudflare, cible WORKERS).
// Déploiement : Cloudflare Workers Builds (Git) — main -> production,
// staging -> environnement `staging`. Voir docs/superpowers/specs/2026-08-04-deploy-workers-migration-design.md
// `nodejs_compat` est requis par @clerk/astro (node:async_hooks, node:fs).
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

- [x] **Step 3: Valider la config sans déployer**

Run: `npm run build && npx wrangler deploy --dry-run`

Expected: le build Astro réussit, puis Wrangler affiche un résumé de déploiement (routes `coolbeans.cc`, `www.coolbeans.cc` en Custom Domain) sans erreur de parsing JSONC et sans upload réel (`--dry-run`).

- [x] **Step 4: Valider la config de l'environnement staging**

⚠️ Correction post-review (voir spec §2.2) : `wrangler deploy --env staging` ne
valide **rien** ici — l'adapter `@astrojs/cloudflare` résout l'environnement au
moment du *build* (variable `CLOUDFLARE_ENV`), pas au moment du deploy ; le flag
`--env` sur `wrangler deploy` est alors un no-op silencieux. La vraie validation de
l'environnement staging se fait avec un build dédié :

Run: `CLOUDFLARE_ENV=staging npm run build && npx wrangler deploy --dry-run`

Expected: le build réussit, puis Wrangler affiche un résumé de déploiement pour un
Worker nommé `coolbeans-staging` avec la route `staging.coolbeans.cc` en Custom
Domain, sans upload réel. **Après ce step, rebuild en production avant de continuer** :
`npm run build` (sans `CLOUDFLARE_ENV`), pour ne pas laisser le répertoire `dist/`
dans un état "staging" avant la Task 2.

- [x] **Step 5: Commit**

```bash
git add wrangler.jsonc
git commit -m "$(cat <<'EOF'
feat(deploy): déclare les domaines custom par environnement dans wrangler.jsonc

Prépare la bascule Pages -> Worker unique (voir spec
2026-08-04-deploy-workers-migration-design.md) : production sur
coolbeans.cc/www, staging sur staging.coolbeans.cc.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Déployer l'environnement staging et vérifier le rattachement du domaine

**Files:** aucun (opération CLI/infra)

**Interfaces:**
- Consumes: `wrangler.jsonc` de la Task 1 (bloc `env.staging.routes`).
- Produces: `staging.coolbeans.cc` en ligne, servant le build actuel de la branche `staging`. Les tasks suivantes (auto-déploiement) redéploieront le même environnement automatiquement à chaque push.

Cette task est sans risque pour la prod : `coolbeans.cc` n'est pas touché, `staging.coolbeans.cc` est un domaine neuf.

Note d'ordonnancement : on déploie et vérifie `staging` à la main (CLI) *avant* de connecter Workers Builds (Task 3), volontairement dans un ordre différent de celui listé en prose dans la spec §3. Ça isole les problèmes de config (`wrangler.jsonc`) des problèmes de pipeline CI — si cette task échoue, on sait que c'est la config, pas l'intégration Git. Fonctionnellement équivalent au résultat visé par la spec.

⚠️ Prérequis découvert en exécutant cette task : `/espace` et `/docs/<projet>` dépendent
de Clerk, qui n'avait aucun secret configuré sur aucun Worker (`coolbeans` ni
`coolbeans-staging` — `wrangler secret list` renvoyait `[]` sur les deux, alors que
`astro.config.mjs:22` documentait déjà que ça devait être fait). Fait une fois pour
`coolbeans-staging` pendant cette task, avec l'accord de l'utilisateur :
`clerk env pull --file .env` (clés de dev Clerk — aucune instance Clerk "production"
n'existe à ce jour, `clerk doctor` le confirme), puis
`grep '^CLERK_SECRET_KEY=' .env | cut -d= -f2- | npx wrangler secret put CLERK_SECRET_KEY --name coolbeans-staging`
(secret runtime du Worker) — `PUBLIC_CLERK_PUBLISHABLE_KEY` n'a pas besoin d'un secret
Worker, il doit juste être présent dans `.env` **au moment du build** (Astro l'inline
dans le bundle client). **Ce même prérequis s'appliquera à la Task 5** (bascule prod)
pour le Worker `coolbeans` — la spec ne le couvrait pas, à traiter au même endroit :
`grep '^CLERK_SECRET_KEY=' .env | cut -d= -f2- | npx wrangler secret put CLERK_SECRET_KEY --name coolbeans` avant le `wrangler deploy` de production. Provisionner une vraie
instance Clerk "production" reste hors périmètre de ce plan de déploiement.

- [x] **Step 1: Builder pour l'environnement staging, puis déployer**

⚠️ Pas de `--env staging` sur le deploy (voir spec §2.2 et correction Task 1 Step 4) —
c'est le **build** qui doit cibler staging, le deploy reste nu :

Run: `CLOUDFLARE_ENV=staging npm run build && npx wrangler deploy`

Expected: build réussi (le Worker résultant s'appelle `coolbeans-staging`, pas
`coolbeans` — c'est normal, voir spec §2.2), déploiement réussi, Wrangler confirme la
création du Custom Domain `staging.coolbeans.cc` (première exécution : provisionnement
du certificat, peut prendre jusqu'à quelques minutes avant que le HTTPS soit pleinement
actif).

- [x] **Step 1bis: Rebuild en production pour ne pas polluer les tasks suivantes**

Run: `npm run build`

Expected: build réussi, `dist/` reflète à nouveau la config de production
(`name: "coolbeans"`), pas celle de staging.

- [x] **Step 2: Vérifier la page d'accueil**

Run: `curl -s -o /dev/null -w "%{http_code}\n" https://staging.coolbeans.cc/`

Expected: `200`

- [x] **Step 3: Vérifier la page de devis (le cas qui a déclenché ce chantier)**

Run: `curl -s https://staging.coolbeans.cc/devis/en-haut/ | grep -io "en haut" | head -1`

Slash final obligatoire — sans lui, Astro renvoie un `307` de canonicalisation vers
l'URL avec slash, sans corps exploitable, et la commande ne matchera rien.

Expected: une ligne contenant `en haut` (ou `En Haut`) — preuve que c'est bien la vraie page de devis et pas un shell par défaut.

- [x] **Step 4: Vérifier que les routes protégées redirigent vers Clerk**

Nécessite que `CLERK_SECRET_KEY` et `PUBLIC_CLERK_PUBLISHABLE_KEY` soient configurés
(secret Worker + `.env` au build — voir note ci-dessous si absent).

Run: `curl -s -o /dev/null -w "%{http_code}\n" https://staging.coolbeans.cc/espace`

Expected: `307` (Clerk redirige vers son sign-in hébergé, ex.
`https://<instance>.accounts.dev/sign-in?redirect_url=...`) — pas `200` ni `404`, ni
`500`. Un `500` ici signale des secrets Clerk manquants sur le Worker.

- [x] **Step 5: Même vérification pour `/docs`, sur un vrai chemin de projet**

⚠️ Tester avec un slug de projet réel (ex. `/docs/amusoire/`), pas `/docs/` nu — ce
dernier ne correspond à aucune route Astro (`src/pages/docs/[project]/[...slug].astro`
exige un segment `[project]`) et Cloudflare sert le 404 statique directement sans
passer par le Worker/middleware, donc sans redirection Clerk. C'est un comportement
préexistant du routing Astro (hors périmètre de ce plan), pas un défaut de cette task.

Run: `curl -s -o /dev/null -w "%{http_code}\n" https://staging.coolbeans.cc/docs/amusoire/`

Expected: `307`, même logique qu'à l'étape 4.

---

### Task 3: Connecter le Worker à GitHub via Cloudflare Workers Builds

**Files:** aucun (config dashboard Cloudflare — nécessite une action manuelle dans le navigateur, l'OAuth GitHub ne peut pas être scripté)

**Interfaces:**
- Consumes: le Worker `coolbeans` et le Worker `coolbeans-staging`, tous deux déjà déployés au moins une fois (Task 2).
- Produces: un push sur `main` déclenche un build + déploiement automatique de `coolbeans` ; un push sur `staging` déclenche un build + déploiement automatique de `coolbeans-staging`, chacun via sa propre connexion Git. Les tasks suivantes vérifient ce comportement.

⚠️ **Révision post-diagnostic (Task 4)** : la version initiale de cette task
(commande de build conditionnelle sur `WORKERS_CI_BRANCH`, une seule connexion Git)
a été testée et a échoué — Workers Builds verrouille une connexion sur un seul nom de
Worker cible et écrase de force tout nom différent produit par le build. Un push de
test sur une branche non-`main` a déployé sur `coolbeans` (production) avec les routes
de staging, volant temporairement le Custom Domain à `coolbeans-staging` (sans impact
visiteur — reclaim fait en Task 4 via `wrangler deploy` en CLI). Voir spec §2.2 pour le
détail complet. Cette task est réécrite ci-dessous avec l'architecture corrigée :
**deux connexions Git séparées**, une par Worker.

**⚠️ Action manuelle requise (dashboard Cloudflare) — à faire par l'utilisateur, ou à guider pas-à-pas en partageant l'écran :**

- [x] **Step 1: Simplifier la connexion existante sur `coolbeans` (production)**

Dashboard Cloudflare → **Workers & Pages** → Worker `coolbeans` → **Settings** → **Build**.
Si une connexion Git existe déjà (Git repository = `ludobourgoin/coolbeans`), éditer :

- **Production branch** → `main`
- **Build command** → `npm run build` (nu, retirer le conditionnel s'il est présent)
- **Deploy command** → `npx wrangler deploy`
- **Builds for non-production branches** → **désactiver** (décoché)

Enregistrer.

- [x] **Step 2: Créer la seconde connexion sur `coolbeans-staging`**

Dashboard Cloudflare → **Workers & Pages** → Worker `coolbeans-staging` → **Settings** →
**Build** → **Connect** (ou équivalent) → sélectionner le même repo
`ludobourgoin/coolbeans`.

- [x] **Step 3: Configurer la connexion `coolbeans-staging`**

- **Production branch** → `staging` (le champ s'appelle "Production branch" côté
  Cloudflare quelle que soit la branche choisie — ici il désigne simplement la branche
  que *cette* connexion surveille et déploie)
- **Build command** → `CLOUDFLARE_ENV=staging npm run build` (fixe, pas de conditionnel)
- **Deploy command** → `npx wrangler deploy`
- **Builds for non-production branches** → laisser désactivé (une seule branche à
  surveiller pour cette connexion)

Enregistrer.

- [x] **Step 4: Vérifier les deux connexions**

Confirmer sur chaque page Settings → Build que les valeurs des Steps 1 et 3 sont bien
enregistrées (Git repository, branche, build/deploy commands, toggle non-production
branches).

---

### Task 4: Vérifier que l'auto-déploiement fonctionne réellement

**Files:** aucun

**Interfaces:**
- Consumes: la connexion Git de la Task 3.
- Produces: preuve que le pipeline `push → build → deploy` fonctionne sans intervention manuelle, pour `staging` comme pour `main`, chacun sur le bon Worker.

**Résumé du diagnostic déjà mené (2026-08-04)** — à ne pas rejouer, juste pour mémoire :
deux pushs de test sur la branche du worktree (`staging-deploy-workers-migration`, qui
compte comme "non-production" pour Cloudflare) ont tous les deux déployé sur `coolbeans`
au lieu de `coolbeans-staging`, à cause du verrou "un nom de Worker par connexion" —
voir spec §2.2 et Task 3. Le Custom Domain `staging.coolbeans.cc` a été reclaimé
manuellement (`wrangler deploy` en CLI) après chaque incident, sans impact visiteur.
La Task 3 a depuis été réécrite avec deux connexions séparées. Ce qui suit est la
vérification à mener **une fois la Task 3 (révisée) confirmée faite**.

- [x] **Step 1: Fusionner ce travail sur `staging` et pousser**

Le worktree tourne sur `staging-deploy-workers-migration`, une branche de travail
isolée — pas la vraie branche `staging` que Workers Builds surveille désormais.
Fusionner et pousser depuis le checkout principal (pas le worktree) :

```bash
cd /Users/ludovicbourgoin/dev/coolbeans
git fetch origin staging-deploy-workers-migration
git checkout staging
git merge --ff-only origin/staging-deploy-workers-migration
git push origin staging
```

Si le `--ff-only` échoue (historique divergent), s'arrêter et regarder avant de forcer
quoi que ce soit — ne pas utiliser `--no-ff` ni résoudre les conflits sans comprendre
pourquoi `staging` a avancé de son côté.

- [x] **Step 2: Vérifier que `coolbeans-staging` (et lui seul) a reçu un build automatique**

Run: `npx wrangler deployments list --name=coolbeans-staging`

Expected: une nouvelle entrée apparaît avec un Version ID récent correspondant au
commit de l'étape 1 (pas de champ "Source" fiable dans cette CLI pour distinguer
Git/manuel — croiser avec `gh api repos/ludobourgoin/coolbeans/commits/<sha>/check-runs`
qui doit lister un check-run `Workers Builds: coolbeans-staging` avec
`conclusion: success`).

Run aussi : `npx wrangler deployments list --name=coolbeans` — **aucune nouvelle entrée
ne doit apparaître** ici suite à ce push sur `staging` (sinon la Task 3 n'est pas
correctement configurée : la connexion `coolbeans` réagit encore à autre chose que
`main`).

- [x] **Step 3: Revérifier `staging.coolbeans.cc`**

Run: `curl -s -o /dev/null -w "%{http_code}\n" https://staging.coolbeans.cc/`

Expected: `200`, avec un contenu à jour (le déploiement automatique a bien remplacé celui de la Task 2).

---

### Task 5: [GATÉ — feu vert explicite requis] Bascule du domaine de production

**Files:** aucun (dashboard Cloudflare pour le détachement Pages, CLI pour le rattachement Worker)

**Interfaces:**
- Consumes: le Worker `coolbeans` avec routes de production déclarées (Task 1), auto-déploiement fonctionnel (Task 4).
- Produces: `coolbeans.cc` et `www.coolbeans.cc` servis par le Worker au lieu du projet Pages.

**⚠️ NE PAS EXÉCUTER cette task sans confirmation explicite de l'utilisateur au moment de le faire, même si ce plan a été approuvé dans son ensemble.** C'est le seul moment où du trafic de production change de destination.

- [x] **Step 0: Demander confirmation explicite avant de continuer**

Ne pas passer à l'étape 1 sans un message clair de l'utilisateur du type « go », « lance la bascule prod », etc., obtenu dans la conversation au moment de l'exécution.

- [x] **Step 1: Détacher les domaines custom du projet Pages (dashboard, manuel)**

Dashboard Cloudflare → **Workers & Pages** → projet Pages `coolbeans` → **Custom domains** → retirer `coolbeans.cc` et `www.coolbeans.cc`.

- [x] **Step 1bis: Provisionner le secret Clerk sur le Worker de production**

Même prérequis que la Task 2 (voir sa note), pas encore fait pour `coolbeans` :

Run: `grep '^CLERK_SECRET_KEY=' .env | cut -d= -f2- | npx wrangler secret put CLERK_SECRET_KEY --name coolbeans`

Si `.env` n'existe pas dans ce répertoire de travail, `clerk env pull --file .env`
d'abord. Sans ce secret, `/espace` et `/docs/<projet>` répondront `500` en prod au lieu
de rediriger vers Clerk.

- [x] **Step 2: Rebuild en production (sécurité) puis rattacher les domaines au Worker**

Run: `npm run build && npx wrangler deploy`

Le `npm run build` sans `CLOUDFLARE_ENV` garantit que `dist/` cible bien la production
(name `coolbeans`) et pas un reliquat d'un build staging précédent — voir spec §2.2.

Expected: build réussi, déploiement réussi, Wrangler confirme la création des Custom Domains `coolbeans.cc` et `www.coolbeans.cc` sur le Worker `coolbeans`.

⚠️ **Piège rencontré en exécutant cette task** : le premier `wrangler deploy` a échoué
avec `Hostname 'coolbeans.cc' already has externally managed DNS records`. Cause :
`coolbeans.cc` et `www.coolbeans.cc` avaient chacun un enregistrement **CNAME manuel**
vers `coolbeans-1ta.pages.dev` (créé à l'origine hors du flux "Custom Domain" traçé par
Cloudflare, donc invisible/non réutilisable par le système de Custom Domain du Worker).
La suppression du Custom Domain côté Pages (Step 1) ne supprime pas ce CNAME. Fix :
dans le dashboard, **DNS → Records**, supprimer les deux enregistrements `CNAME` vers
`coolbeans-1ta.pages.dev` (repérables aussi car ils n'ont pas le Type "Worker" ni le
cadenas qu'a par exemple `staging.coolbeans.cc`), puis relancer `wrangler deploy` — il
recrée alors les Custom Domains proprement en Type "Worker".

- [x] **Step 3: Vérifier la prod**

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://coolbeans.cc/
curl -s -o /dev/null -w "%{http_code}\n" https://coolbeans.cc/espace
```

Expected : `200` sur `/`. Sur `/espace`, `307` seulement si `main` contient déjà le
site refondu (middleware Clerk) au moment du test ; tant que `main` reste sur la page
stub (voir note ci-dessous), `/espace` renvoie `200` (même contenu stub que `/`) — pas
un défaut, juste l'absence de la route protégée sur ce contenu-là.

~~Note : à ce stade `main` contient toujours la page stub...~~ — **périmé** : `staging` a
été fusionnée dans `main` le jour même suite à l'incident documenté en spec §3bis
(Incident A). `main` sert désormais le même contenu que la prod, la note ci-dessus
décrivait l'état attendu *avant* cet incident, pas l'état final.

---

### Task 6: [GATÉ — feu vert explicite requis] Suppression de l'ancien projet Pages

**Files:** aucun

**Interfaces:**
- Consumes: Task 5 validée (domaines bascule sur le Worker et vérifiés fonctionnels).
- Produces: fin de la coexistence des deux systèmes.

**⚠️ NE PAS EXÉCUTER sans confirmation explicite de l'utilisateur au moment de le faire.**

- [ ] **Step 0: Demander confirmation explicite avant de continuer**

Ne pas passer à l'étape 1 sans un message clair de l'utilisateur au moment de l'exécution.

- [ ] **Step 1: Confirmer une dernière fois que la prod tourne sur le Worker**

Run: `curl -s -o /dev/null -w "%{http_code}\n" https://coolbeans.cc/`

Expected: `200`. Si ce n'est pas le cas, **s'arrêter et ne pas supprimer le projet Pages.**

- [ ] **Step 2: Supprimer le projet Pages**

Run: `npx wrangler pages project delete coolbeans`

Confirmer l'invite interactive quand elle apparaît.

- [ ] **Step 3: Vérifier qu'il n'y a plus de confusion possible**

Run: `npx wrangler pages project list`

Expected: le projet `coolbeans` n'apparaît plus dans la liste.
