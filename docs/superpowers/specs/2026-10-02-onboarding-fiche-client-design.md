# L'onboarding remplit la fiche client

Date : 2026-10-02
Statut : design validé en conversation le 2026-10-02, spec à relire
Chantier : « Documents client, harmonisation », lot 4 sur 4. Lots 1 à 3 : `2026-10-02-pronom-fiche-client-design.md`, `2026-10-02-sections-documents-design.md`, `2026-10-02-titres-au-dessus-design.md`.
Dépend de : les lots 1 et 2, et la fusion de `feat/documents-portail`. Le sous-projet 5 de la spec du 2026-09-30 (« publier le premier document d'un nouveau client ouvre son workspace ») s'appuie sur la fiche que ce lot crée.

## Pourquoi

Ce qu'on sait d'un client vit en quatre endroits : sa fiche du portail, la table `PROJETS` de `nomenclature.ts`, Linear, et les questions qu'une skill pose au fil de l'eau. La fiche ne naît qu'à la signature, dans la checklist d'`onboarding-client`.

Or un prospect a son workspace dès la publication de son premier document. Il lui faut une fiche dès ce moment-là, avec son pronom.

## Décisions de Ludo du 2026-10-01 et du 2026-10-02

1. Deux façons de remplir, un seul fichier : un gabarit YAML rempli d'un coup, ou des questions posées dans Claude Code, qui écrivent ce même fichier.
2. L'onboarding remplit la fiche client et ses projets.
3. Les projets vivent dans la fiche client, sous `projets:`. La table `PROJETS` de `nomenclature.ts` en devient dérivée.
4. Le gabarit se trouve à côté des fiches : `src/content/clients/_gabarit.yaml`, ignoré par le build.
5. L'onboarding commence au premier document, prospect compris, et se complète à la signature.
6. La skill `onboarding-client` absorbe le mode questions. Il n'y a pas de seconde skill.

## La fiche

Deux temps, dans le même fichier.

**Au premier document**

| Clé | Rôle |
|---|---|
| `nom` | Le nom que le client voit dans son portail |
| `cle` | La clé de la team Linear, en minuscules (existe sur `feat/documents-portail`) |
| `organisation` | Le revendeur, ou `coolbeans` |
| `prenom` | Le prénom du contact, celui qu'on emploie vraiment |
| `tutoiement` | Lot 1 |
| `linearTeamId` | L'UUID de la team Linear |
| `projets` | Au moins un projet |

**À la signature**

| Clé | Rôle |
|---|---|
| `facturation` | Raison sociale, SIREN, adresse, TVA. Chez UnlockBreath : DOS ET POSTURE, pas la marque |
| `depuis`, `emoji`, `doc`, `analytics`, `uptimerobot_monitor_ids` | Les clés du portail, déjà existantes |

**Un projet**

```yaml
projets:
  - projet: plateforme-327    # le segment de la nomenclature, référence comprise
    linear: 03dc21021720      # slugId du projet Linear
    stack: Next.js, Sanity, Cloudflare, Loops
```

L'objet, les dates et le statut du projet restent dans Linear, qui fait foi. Les questions d'onboarding les écrivent dans Linear, pas dans la fiche : deux sources finiraient par se contredire.

## La nomenclature

`CLIENTS` et `PROJETS` se construisent à partir des fiches, lues au build. Plus aucune table en dur. `HORS_NOMENCLATURE` reste dans le code : il désigne des documents, pas des clients.

## Le gabarit

`src/content/clients/_gabarit.yaml` porte toutes les clés, commentées une à une, rangées en deux parties : « Au premier document » et « À la signature ». Le loader de la collection ignore les fichiers qui commencent par `_`.

Pour le remplir d'un coup : copier le gabarit sous `<slug>.yaml`, remplir, puis dire à Claude « vérifie la fiche de X ». La skill valide le schéma, vérifie dans Linear que la team et chaque projet existent, et rend un constat.

## Le mode questions

Une étape 0 dans `onboarding-client`, « La fiche », déclenchée de trois façons :

- par Ludo : « onboarding de X », « nouveau prospect X », « crée la fiche de X » ;
- par la skill d'un document (proposition, cadrage, audit) quand la fiche du client manque ;
- à la signature, pour la seconde partie.

Elle suit la règle de la skill, « collecter avant de demander » : la team et le projet Linear, les mails du contact, les documents existants. Puis elle pose en une salve, par une question interactive, ce qui reste. Le pronom se confirme toujours. Elle écrit la fiche, la valide comme dans le mode gabarit, et montre le diff.

Le reste de la checklist d'`onboarding-client` ne change pas. Sa ligne « Fiche client » de la section Portail devient « Compléter la fiche, partie signature ».

## Tests

- Schéma : une fiche sans `projets`, un projet sans `projet` ou sans `linear`, un `projet` en double dans deux fiches : refusés.
- Le loader ignore `_gabarit.yaml`.
- La nomenclature dérivée des fiches donne exactement la table `PROJETS` d'aujourd'hui. Le test sert de garde-fou à la migration, puis reste.
- Le gabarit lui-même passe le schéma une fois ses valeurs d'exemple remplies.

## Hors périmètre

- Les comptes du portail et l'ouverture du workspace : sous-projets 3 et 5 de la spec du 2026-09-30.
- Le reste de la checklist d'onboarding : repo, environnements, monitoring, mail au client.

## Documentation

- `src/content/docs/coolbeans/04-portail.mdx` : la fiche, ses deux temps, ses projets, le gabarit.
- `src/content/docs/coolbeans/02-vente.mdx` : la fiche naît au premier document.
- Skill `onboarding-client` : `SKILL.md` (étape 0, déclencheurs dans la description) et `references/checklist.md` (ligne Fiche client).
- Skill `proposition-commerciale` : appeler l'étape 0 quand la fiche manque, en remplacement du minimum posé au lot 1.
- `src/content/docs/coolbeans/10-catalogue-skills.mdx` : les nouveaux déclencheurs d'`onboarding-client`.
- `docs/superpowers/specs/README.md` : la ligne de cette spec.
