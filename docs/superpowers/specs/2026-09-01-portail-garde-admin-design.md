# Garde admin déclarative pour le portail

Spec de conception — 2026-09-01

## Pourquoi

Le portail sépare authentification et autorisation. `src/middleware.ts`
tranche « connecté ou non » pour tout `/espace` et `/docs`. L'autorisation,
elle, vit dans chaque page :

```ts
if (!isAdmin(meta)) return Astro.redirect("/espace");
```

Relevé au 2026-09-01 : **4 pages sur 21** portent cette ligne — `clients`,
`utilisateurs`, `devis/index`, `devis/reglages`. Les autres sont soit
légitimement mixtes (`projets`, `messagerie`, `monitoring`, `index`, `doc`
affichent un encart admin dans une page que le client voit), soit ouvertes à
tout compte connecté.

Aucune page n'est aujourd'hui mal protégée. **Le défaut est le mode de
défaillance, pas l'état actuel** : la protection s'obtient en se souvenant de
l'écrire. Une page ajoutée sans cette ligne devient visible par n'importe quel
compte connecté, sans erreur, sans test rouge, sans trace. La défaillance est
silencieuse et ouvre au lieu de fermer.

Côté client contre client, la situation est différente et saine :
`src/lib/portail/appartenances.ts` est une fonction pure, testée, dont le
dernier cas ferme explicitement l'accès d'un compte dont le workspace ne relève
pas de son organisation.

Une asymétrie à noter : les Actions, elles, disposent déjà d'une garde
partagée et testée, `src/lib/portail/require-admin.ts`, appelée à six endroits
de `src/actions/index.ts`. Les pages n'ont pas d'équivalent. C'est cette
asymétrie que la spec corrige.

**Déclencheur.** Le cockpit financier (soldes bancaires, CA, charges) doit
vivre dans le portail. Sur cette donnée, une page oubliée n'expose plus un
chiffrage : elle expose la situation financière personnelle de Ludo à ses
propres clients. Le durcissement précède la fonctionnalité, il ne la suit pas.

## Objectifs

1. Rendre la garde admin **déclarative et fermée par défaut** : impossible à
   oublier, parce qu'il n'y a plus rien à écrire dans la page.
2. Poser un **test qui échoue** si une page admin cesse d'être protégée.
3. Garantir que la donnée financière **ne quitte jamais le serveur**.

## Non-objectifs

- Refondre `appartenances.ts`, qui remplit son rôle.
- Toucher aux gardes des Actions, déjà centralisées.
- Migrer les pages admin existantes dans le même lot (voir Migration).
- Ajouter un second facteur d'authentification. Utile un jour, hors périmètre
  ici : ça ne corrige pas le défaut nommé.

## Conception

### Un préfixe gardé au middleware

Toute route sous `/espace/admin/` exige `portalRole === "admin"`. La règle vit
dans `src/middleware.ts`, à côté de la règle d'authentification existante :

```ts
const PROTECTED = [/^\/espace(\/|$)/, /^\/docs(\/|$)/];
const ADMIN_ONLY = [/^\/espace\/admin(\/|$)/];
```

Après la vérification de session, si le chemin correspond à `ADMIN_ONLY` et que
`isAdmin(meta)` est faux, la requête ne poursuit pas.

La garde réutilise `isAdmin` de `src/lib/portail/metadata.ts` — même source de
vérité que les pages et les Actions. Aucun troisième mécanisme.

### Répondre 404, pas une redirection

Les pages actuelles redirigent vers `/espace`. Sous le préfixe admin, la
réponse est un **404**.

Une redirection dit « cette page existe, elle n'est pas pour toi ». Sur un
chiffrage, l'aveu est sans conséquence. Sur `/espace/admin/finances/tresorerie`,
il apprend à un client que Ludo tient un suivi de trésorerie et à quelle
adresse. Un 404 ne distingue pas « n'existe pas » de « pas pour toi ».

Contrepartie assumée : un admin dont la session a expiré verra un 404 plutôt
qu'un écran d'erreur explicite. Le middleware traite l'authentification avant
l'autorisation, donc ce cas se résout en redirection vers `/connexion` et ne se
présente pas en pratique.

**Conséquence découverte à l'implémentation (2026-09-01), non anticipée par
cette spec :** en sortie `server`, Astro **refuse** de réécrire une route rendue
à la demande vers une route prérendue statique — « You tried to rewrite the
on-demand route '/espace/admin' with the static route '/404' ». La garde
renvoyait un 500 au lieu du 404.

Le point de méthode compte autant que le correctif : **la suite de tests
unitaires était verte**. Seule une vérification en session réelle, avec deux
comptes de rôles différents, l'a montré. Une garde ne se prouve pas par des
fonctions pures.

`src/pages/404.astro` porte donc `export const prerender = false`. Coût réel :
chaque 404 du site public devient une invocation du Worker au lieu d'un actif
statique. Négligeable à cette échelle, et la contrepartie est que la page 404
de marque devient utilisable depuis n'importe quelle garde, présente ou future.

### La donnée financière ne quitte pas le serveur

Les fichiers de `src/content/finances/` sont lus dans le frontmatter des pages
`.astro` et ne sont jamais passés en props à un composant client
(`client:load`, `client:visible`, etc.), ni sérialisés dans le HTML autrement
que sous la forme déjà rendue à l'écran.

Conséquence de conception : les vues du cockpit sont rendues côté serveur. Un
tri ou un filtre interactif se fait sur le DOM déjà rendu, jamais en
réhydratant le jeu de données complet.

## Tests

Trois tests, dans `src/lib/portail/garde-admin.test.ts` et le middleware.

**1. La règle de chemin.** Fonction pure `estRouteAdmin(pathname)` : vérifie
`/espace/admin`, `/espace/admin/`, `/espace/admin/finances`, et le rejet de
`/espace/administration` — le piège classique du préfixe non ancré.

**2. L'énumération.** Le test liste les fichiers de `src/pages/espace/admin/`
sur le disque et vérifie que `estRouteAdmin` est vraie pour la route de chacun.
C'est ce test qui protège dans six mois : une page ajoutée hors du préfixe mais
destinée aux admins ne le déclenche pas — d'où le troisième.

**3. Le décideur.** Table de cas sur la fonction de décision
`(pathname, meta) → "passe" | "connexion" | "404"` : admin sur route admin,
client sur route admin, revendeur sur route admin, non connecté sur route
admin, chacun des trois rôles sur une route non-admin.

Les tests existants de `appartenances`, `metadata` et `require-admin` restent
inchangés.

## Migration des pages admin existantes

`clients`, `utilisateurs`, `devis/index` et `devis/reglages` **ne bougent pas
dans ce lot**. Les déplacer change leurs URL, donc la navigation, les liens
en dur et les signets, pour un gain nul : elles sont déjà gardées.

Elles conservent leur `if (!isAdmin(meta))`. Deux verrous valent mieux qu'un, et
une page migrée plus tard sous le préfixe gardera utilement sa ligne.

Un déplacement ultérieur, si Ludo le souhaite, est une tâche distincte avec ses
redirections 301.

## Ce que la spec ne protège pas

Elle ne protège pas contre une page **hors** du préfixe qui afficherait de la
donnée sensible. La règle qui l'accompagne est éditoriale et tient en une
phrase : toute donnée financière vit sous `/espace/admin/finances/`, sans
exception, y compris un simple encart de rappel.

Elle ne protège pas non plus contre une erreur d'attribution de rôle. Un compte
client promu `admin` par erreur voit tout. C'est `utilisateurs.astro` qui porte
ce risque, et il est déjà gardé.

## Risques

| Risque | Portée | Traitement |
|---|---|---|
| Préfixe non ancré (`/espace/administration` capté ou ignoré à tort) | Faux positif ou faux négatif de garde | Test 1, cas explicite |
| Page admin créée hors du préfixe | Exposition silencieuse | Test 2 + règle éditoriale |
| Donnée financière sérialisée dans le bundle client | Exposition sans passer par une route | Rendu serveur, revue à l'ajout de tout composant interactif |
| 404 déroutant pour un admin | Confort | Cas résolu en amont par la garde d'authentification |
