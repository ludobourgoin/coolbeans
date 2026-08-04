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
- Ne pas fusionner `staging` dans `main` — hors périmètre (spec §1 décision 6, spec §4).

---

### Task 1: Config Wrangler — routes de domaines custom par environnement

**Files:**
- Modify: `wrangler.jsonc`

**Interfaces:**
- Produces: `wrangler.jsonc` avec un bloc top-level `routes` (production : `coolbeans.cc`, `www.coolbeans.cc`) et un bloc `env.staging.routes` (`staging.coolbeans.cc`), tous deux avec `custom_domain: true`. Les tasks suivantes déploient contre cette config via `wrangler deploy` / `wrangler deploy --env staging`.

- [ ] **Step 1: Constater l'état actuel**

Run: `cat wrangler.jsonc`

Expected: pas de clé `routes`, pas de clé `env` — seulement `name`, `compatibility_date`, `compatibility_flags`.

- [ ] **Step 2: Ajouter les routes de domaines custom**

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

- [ ] **Step 3: Valider la config sans déployer**

Run: `npm run build && npx wrangler deploy --dry-run`

Expected: le build Astro réussit, puis Wrangler affiche un résumé de déploiement (routes `coolbeans.cc`, `www.coolbeans.cc` en Custom Domain) sans erreur de parsing JSONC et sans upload réel (`--dry-run`).

- [ ] **Step 4: Valider la config de l'environnement staging**

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

- [ ] **Step 5: Commit**

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

- [ ] **Step 1: Builder pour l'environnement staging, puis déployer**

⚠️ Pas de `--env staging` sur le deploy (voir spec §2.2 et correction Task 1 Step 4) —
c'est le **build** qui doit cibler staging, le deploy reste nu :

Run: `CLOUDFLARE_ENV=staging npm run build && npx wrangler deploy`

Expected: build réussi (le Worker résultant s'appelle `coolbeans-staging`, pas
`coolbeans` — c'est normal, voir spec §2.2), déploiement réussi, Wrangler confirme la
création du Custom Domain `staging.coolbeans.cc` (première exécution : provisionnement
du certificat, peut prendre jusqu'à quelques minutes avant que le HTTPS soit pleinement
actif).

- [ ] **Step 1bis: Rebuild en production pour ne pas polluer les tasks suivantes**

Run: `npm run build`

Expected: build réussi, `dist/` reflète à nouveau la config de production
(`name: "coolbeans"`), pas celle de staging.

- [ ] **Step 2: Vérifier la page d'accueil**

Run: `curl -s -o /dev/null -w "%{http_code}\n" https://staging.coolbeans.cc/`

Expected: `200`

- [ ] **Step 3: Vérifier la page de devis (le cas qui a déclenché ce chantier)**

Run: `curl -s https://staging.coolbeans.cc/devis/en-haut/ | grep -io "en haut" | head -1`

Slash final obligatoire — sans lui, Astro renvoie un `307` de canonicalisation vers
l'URL avec slash, sans corps exploitable, et la commande ne matchera rien.

Expected: une ligne contenant `en haut` (ou `En Haut`) — preuve que c'est bien la vraie page de devis et pas un shell par défaut.

- [ ] **Step 4: Vérifier que les routes protégées redirigent vers Clerk**

Nécessite que `CLERK_SECRET_KEY` et `PUBLIC_CLERK_PUBLISHABLE_KEY` soient configurés
(secret Worker + `.env` au build — voir note ci-dessous si absent).

Run: `curl -s -o /dev/null -w "%{http_code}\n" https://staging.coolbeans.cc/espace`

Expected: `307` (Clerk redirige vers son sign-in hébergé, ex.
`https://<instance>.accounts.dev/sign-in?redirect_url=...`) — pas `200` ni `404`, ni
`500`. Un `500` ici signale des secrets Clerk manquants sur le Worker.

- [ ] **Step 5: Même vérification pour `/docs`, sur un vrai chemin de projet**

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
- Consumes: le Worker `coolbeans` existant (Task 2 l'a déjà déployé au moins une fois).
- Produces: chaque `git push` sur `main` ou `staging` déclenche désormais un build + déploiement automatique. Les tasks suivantes vérifient ce comportement.

**⚠️ Action manuelle requise (dashboard Cloudflare) — à faire par l'utilisateur, ou à guider pas-à-pas en partageant l'écran :**

- [ ] **Step 1: Ouvrir les réglages de build du Worker**

Dashboard Cloudflare → **Workers & Pages** → Worker `coolbeans` → **Settings** → **Build**.

- [ ] **Step 2: Connecter le repo GitHub**

Section **Git repository** → connecter le compte GitHub si pas déjà fait → sélectionner le repo `ludobourgoin/coolbeans`.

- [ ] **Step 3: Configurer la branche de production**

**Production branch** → `main`.

- [ ] **Step 4: Configurer les commandes de build/déploiement**

⚠️ C'est la commande de **build** qui doit varier selon la branche, pas la commande de
déploiement — voir spec §2.2 (correction post-Task 1). `WORKERS_CI_BRANCH` est une
variable système injectée automatiquement par Workers Builds (nom de la branche du
push) :

- **Build command** : `if [ "$WORKERS_CI_BRANCH" = "main" ]; then npm run build; else CLOUDFLARE_ENV=staging npm run build; fi`
- **Deploy command** : `npx wrangler deploy` (nu — le build a déjà figé la cible)
- **Builds for non-production branches** : activer la case
- **Non-production branch deploy command** : `npx wrangler deploy` (nu, même raison)

⚠️ Gotcha (spec §2.2) : "non-production branches" désigne *toutes* les branches autres que `main`, pas seulement `staging`. Avec la convention actuelle (pas de feature branches poussées sur le remote), aucun risque. Si des branches `feat/*` commencent à être poussées sur GitHub, elles écraseront `staging.coolbeans.cc` au même titre que `staging` — à surveiller si l'usage change.

⚠️ À vérifier concrètement en Task 4 (premier build automatique réel) : que `WORKERS_CI_BRANCH` vaut bien le nom court de la branche (`main`, `staging`) et pas une forme du type `refs/heads/main` — la doc Cloudflare ne le précise pas explicitement. Si le build échoue ou déploie le mauvais environnement en Task 4, commencer l'investigation par là.

- [ ] **Step 5: Sauvegarder**

Enregistrer les réglages. Confirmer que l'écran affiche bien les 5 valeurs de l'étape 4.

---

### Task 4: Vérifier que l'auto-déploiement fonctionne réellement

**Files:** aucun

**Interfaces:**
- Consumes: la connexion Git de la Task 3.
- Produces: preuve que le pipeline `push → build → deploy` fonctionne sans intervention manuelle, pour `staging` comme pour `main`.

- [ ] **Step 1: Déclencher un build en poussant ce plan sur `staging`**

```bash
git add docs/superpowers/plans/2026-08-04-deploy-workers-migration.md
git commit -m "$(cat <<'EOF'
docs(plan): plan d'implémentation de la bascule Pages -> Worker

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
git push origin staging
```

- [ ] **Step 2: Vérifier qu'un build automatique démarre**

Run: `npx wrangler deployments list --name=coolbeans`

Expected: une nouvelle entrée apparaît avec **Source: Push** (ou équivalent Git, pas `Upload`), correspondant au commit de l'étape 1 — preuve que c'est bien Workers Builds qui a déclenché le déploiement, pas une action manuelle.

- [ ] **Step 3: Revérifier `staging.coolbeans.cc`**

Run: `curl -s -o /dev/null -w "%{http_code}\n" https://staging.coolbeans.cc/`

Expected: `200`, avec un contenu à jour (le déploiement automatique a bien remplacé celui de la Task 2).

---

### Task 5: [GATÉ — feu vert explicite requis] Bascule du domaine de production

**Files:** aucun (dashboard Cloudflare pour le détachement Pages, CLI pour le rattachement Worker)

**Interfaces:**
- Consumes: le Worker `coolbeans` avec routes de production déclarées (Task 1), auto-déploiement fonctionnel (Task 4).
- Produces: `coolbeans.cc` et `www.coolbeans.cc` servis par le Worker au lieu du projet Pages.

**⚠️ NE PAS EXÉCUTER cette task sans confirmation explicite de l'utilisateur au moment de le faire, même si ce plan a été approuvé dans son ensemble.** C'est le seul moment où du trafic de production change de destination.

- [ ] **Step 0: Demander confirmation explicite avant de continuer**

Ne pas passer à l'étape 1 sans un message clair de l'utilisateur du type « go », « lance la bascule prod », etc., obtenu dans la conversation au moment de l'exécution.

- [ ] **Step 1: Détacher les domaines custom du projet Pages (dashboard, manuel)**

Dashboard Cloudflare → **Workers & Pages** → projet Pages `coolbeans` → **Custom domains** → retirer `coolbeans.cc` et `www.coolbeans.cc`.

- [ ] **Step 1bis: Provisionner le secret Clerk sur le Worker de production**

Même prérequis que la Task 2 (voir sa note), pas encore fait pour `coolbeans` :

Run: `grep '^CLERK_SECRET_KEY=' .env | cut -d= -f2- | npx wrangler secret put CLERK_SECRET_KEY --name coolbeans`

Si `.env` n'existe pas dans ce répertoire de travail, `clerk env pull --file .env`
d'abord. Sans ce secret, `/espace` et `/docs/<projet>` répondront `500` en prod au lieu
de rediriger vers Clerk.

- [ ] **Step 2: Rebuild en production (sécurité) puis rattacher les domaines au Worker**

Run: `npm run build && npx wrangler deploy`

Le `npm run build` sans `CLOUDFLARE_ENV` garantit que `dist/` cible bien la production
(name `coolbeans`) et pas un reliquat d'un build staging précédent — voir spec §2.2.

Expected: build réussi, déploiement réussi, Wrangler confirme la création des Custom Domains `coolbeans.cc` et `www.coolbeans.cc` sur le Worker `coolbeans`.

- [ ] **Step 3: Vérifier la prod**

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://coolbeans.cc/
curl -s -o /dev/null -w "%{http_code}\n" https://coolbeans.cc/espace
```

Expected : `200` sur `/`, `307` sur `/espace` (comportement Clerk réel, vérifié en Task 2 — pas `302`/`303`).

Note : à ce stade `main` contient toujours la page stub ("Update page title to Coolbeans"), pas le site refondu — c'est attendu, cf. spec §4 (la fusion `staging` → `main` est une décision de contenu séparée, hors périmètre de cette task).

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
