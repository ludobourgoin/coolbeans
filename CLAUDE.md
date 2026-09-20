# CLAUDE.md — coolbeans

Complète `/dev/CLAUDE.md`, ne le répète pas.

## Ce repo est à la fois un bureau et un atelier

`dev/coolbeans` sert à deux choses qui n'ont rien à voir : c'est le poste de pilotage de l'activité (CRM Linear, devis, doc client, shutdown, veille) **et** le code du site et du portail. Les autres projets clients, eux, vivent dans leur propre repo et leur propre fenêtre VS Code : ils ne sont jamais concernés par ce qui suit.

C'est de ce cumul que viennent les collisions entre conversations. Une session qui écrit un devis et une session qui refactorise le portail partagent le même working tree sur `staging`.

D'où la ligne de partage : **le clone principal est le bureau, jamais l'atelier.** Il reste sur `staging`, il n'accueille que du contenu. Tout travail de code part en worktree.

## Sessions parallèles — isolation par worktree

La règle d'isolation dépend de **ce que la session écrit**, pas du nombre d'issues qu'elle traite.

**Elle n'écrit aucun fichier du repo** (Linear, audit, lecture, shutdown, questions, recherche) → rien à faire. Travaille dans le clone principal, traite autant d'issues que nécessaire.

**Elle écrit uniquement du contenu propre à un dossier** (`src/content/devis/<client>/`, `src/content/docs/<client>/`, `docs/brouillons/`) → clone principal accepté, parce que deux dossiers clients ne se croisent pas. Commit strictement tes chemins, jamais `git add -A` : une autre session a probablement du travail non commité à côté.

**Elle écrit du code partagé** (`src/components/`, `src/layouts/`, `src/pages/`, `src/worker.ts`, `src/styles/`, `migrations/`, config racine) → worktree dédié obligatoire, une branche par lot :

```sh
git worktree add ../coolbeans-<slug> -b feat/<slug> staging
cp .env ../coolbeans-<slug>/.env                  # variables de build
cp .dev.vars ../coolbeans-<slug>/.dev.vars        # secrets + bindings D1/KV/R2
cp -R .wrangler/state ../coolbeans-<slug>/.wrangler/state   # base D1 locale
```

Les **trois**, pas seulement `.env`. Chacun a son symptôme, et aucun ne désigne
sa cause (constaté le 2026-09-04) :

- sans `.dev.vars`, le site vitrine s'affiche mais `/espace` et `/docs/*`
  répondent 500 ;
- sans `.wrangler/state`, tout répond correctement mais la base D1 est vide,
  donc **aucun compte n'existe** et la connexion échoue comme si le mot de
  passe était faux.

Deux emplacements sont acceptés : à côté du clone (`../coolbeans-<slug>`) ou sous `.claude/worktrees/<slug>`, qui est gitignoré. Ne pas en inventer un troisième.

Branche courte, mergée dans `staging` dès que le lot tient debout. Une branche qui vit plus de deux jours reconstitue le problème sous forme de conflits de merge.

## Avant le premier edit d'une session qui écrit

Vérifier `pwd`, `git branch --show-current`, `git status`. Une session longue dérive de répertoire, et un diff généré depuis le mauvais worktree est invisible à la relecture.

## Gestes qui ne se parallélisent jamais

Migration D1, `wrangler deploy`, merge vers `main`, script d'amorçage prod. Ces gestes touchent des ressources partagées que le worktree n'isole pas : une seule session à la fois, quel que soit le worktree d'où elle part.

## Nettoyage

Un worktree dont la branche est mergée dans `staging` se supprime (`git worktree remove <chemin>`). Un worktree oublié est une source de confusion : on y reprend du travail déjà publié, ou on y laisse du travail jamais publié. Vérifier de temps en temps `git worktree list` et `git branch --merged staging`.
