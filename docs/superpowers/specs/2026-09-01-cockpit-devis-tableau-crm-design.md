# Cockpit devis : tableau triable, statut CRM Linear, déclenchement à la signature

Date : 2026-09-01
Statut : validé par Ludo, implémentation directe (pas de plan séparé)

## Problème

Le cockpit `/espace/devis` affiche les devis en cartes empilées, triées par date
décroissante, sans autre entrée de lecture. Le statut affiché (`publie` /
`envoye` / `repondu`) est dérivé du YAML et de la table D1 `devis_reponses` :
c'est le statut *du document*, pas celui de *l'affaire*. Le vrai pipeline
commercial vit dans la team CRM de Linear (13 états, refonte du 2026-08-29), et
les deux référentiels dérivent l'un de l'autre en silence.

Troisième manque : quand un client valide un devis depuis la page publique,
rien ne se passe côté facturation. Le mail de notification arrive, et la suite
(devis Tiime, facture d'acompte) repose entièrement sur la mémoire de Ludo. Les
informations de facturation saisies par le client à ce moment-là — adresse,
raison sociale, SIREN, TVA — ne sont persistées nulle part : elles n'existent
que dans le corps du mail.

## Décisions

Prises avec Ludo le 2026-09-01, avant écriture.

1. **La colonne Statut porte l'état Linear, et lui seul.** Le statut dérivé
   `publie/envoye/repondu` disparaît de la vue. Conséquence assumée : un devis
   sans `linear.affaire` renseigné n'a plus de statut du tout (`—`). C'est
   voulu — ça rend visible un rattachement oublié plutôt que de le masquer
   derrière un statut de repli.
2. **Lecture live au rendu de la page.** Une requête GraphQL par affichage,
   pas de cache, pas de cron, pas de webhook. La page est admin-only et son
   trafic est proche de zéro.
3. **À la validation d'un devis : sous-issue Linear + brouillons.** L'affaire
   passe en `🏆 Signée`, une sous-issue de facturation est créée avec tout ce
   qu'il faut pour agir. Aucune génération Tiime, aucun envoi au client.
4. **Pas de calcul d'acompte.** Le champ `reglement` du budget est du texte
   libre. La sous-issue reporte le total et cite la phrase de règlement telle
   quelle.

### Tiime, hors périmètre

L'API Tiime est « exclusivement disponible sur demande pour les éditeurs de
logiciels » (aide Tiime, article « Proposez-vous une API ? », 3 juillet 2026).
Les deux chemins réalistes pour automatiser plus tard : demander un accès
partenaire à `support@tiime.fr`, ou passer par l'intégration officielle Tiime
sur Make. Réserve sur le second : le compte Make existant est `ludo@trigger.fr`
(Trigger), pas Coolbeans — il faudrait un compte Make côté Coolbeans.

Rien de tout ça n'est engagé ici.

## Architecture

### Lecture de l'état CRM

`src/lib/portail/linear-graphql.ts` (nouveau) — la fonction `graphql()` est
aujourd'hui privée dans `linear.ts`. Elle est extraite pour être partagée sans
faire de `linear.ts` un fourre-tout : ce fichier fait déjà 245 lignes et ne
parle que de support et de messagerie.

`src/lib/portail/linear-crm.ts` (nouveau) :

- `numeroAffaire(ref)` — accepte les deux formes présentes dans les YAML,
  `CRM-9` et `https://linear.app/coolbeans-hq/issue/CRM-74`, rend le numéro ou
  `null`. Une seule fonction pure, testée isolément.
- `fetchEtatsAffaires(apiKey, numeros)` — une requête, filtre
  `team.key = CRM` + `number.in`, rend une `Map<number, EtatAffaire>` portant
  `issueId`, `identifier`, `url`, et l'état (`name`, `type`, `position`).
- `etatsCrm(apiKey)` — les états de la team CRM (id, nom, type, position),
  mémorisés à l'échelle de l'isolate. Sert à résoudre `🏆 Signée` et `Todo`
  sans coder d'UUID en dur : le pipeline a déjà été refondu une fois
  (2026-08-29), il le sera encore.

Le tri par statut suit `state.position`, l'ordre du pipeline. Un tri
alphabétique sur des noms préfixés d'emoji serait inutilisable.

**Dégradation** : clé absente, Linear en panne, réponse malformée — la page
s'affiche, la colonne vaut `—`. Même posture que le `try/catch` déjà en place
sur la lecture D1 dans la page.

### Le tableau

`src/components/portail/DevisBoard.astro` (nouveau), sur le modèle de
`MessagerieBoard.astro` : `<table>` en utilitaires Tailwind sur les tokens,
jamais la classe `card` (piège de spécificité `.doc-root .card`).

Colonnes : **Client · Devis · Montant · Statut · Envoyé le · Date**, plus une
cellule de liens (devis public, projet Linear, affaire CRM).

Rendu serveur trié par date décroissante. Le tri au clic est une amélioration
progressive : chaque cellule porte un `data-sort` normalisé (timestamp pour les
dates, nombre pour les montants, position pour le statut), et un script réordonne
les `<tr>`. Sans JavaScript, le tableau reste lisible et trié par date.

La réponse du client (identité, date, message) ne tient pas dans une cellule :
elle occupe une ligne dépliable sous la ligne du devis, signalée par une pastille.
Aucune information de l'affichage actuel n'est perdue.

### Déclenchement à la signature

Déclencheur : `POST /api/devis-reponse` avec `decision: "validation"`.
Quatre effets, chacun isolé — l'échec de l'un n'empêche jamais les suivants, et
le mail à Ludo reste la garantie de délivrance :

1. **D1** — la réponse est enregistrée avec les champs de facturation
   (migration 0006).
2. **Linear** — l'affaire CRM passe en `🏆 Signée`.
3. **Linear** — une sous-issue de l'affaire est créée : « Facturation acompte —
   <titre du devis> ». Description : coordonnées de facturation, total,
   règlement cité mot pour mot, lien vers le devis, checklist (devis Tiime →
   facture d'acompte → envoi au client). Assignée à Ludo, **repassée
   explicitement en `Todo`** — une sous-tâche créée par API atterrit en
   `📥 Triage lead`.
4. **Mail** — le mail existant, enrichi du lien vers la sous-issue.

**Idempotence** : la colonne `linear_task_id` de `devis_reponses` porte
l'identifiant de la sous-issue créée. Une seconde validation du même devis ne
crée pas de doublon.

### Migration 0006

`ALTER TABLE devis_reponses` : `raison_sociale`, `siren`, `adresse`, `tva`,
`linear_task_id`. Toutes nullables — les lignes existantes n'ont pas ces
valeurs, et un client qui répond en tant que particulier n'a ni raison sociale
ni SIREN.

## Tests

Vitest, à côté des tests existants du module :

- `numeroAffaire` sur les deux formes, sur une chaîne illisible, sur `undefined`.
- Ordre de tri des statuts : c'est la position Linear qui décide, pas le nom.
- Aller-retour D1 avec les nouveaux champs, y compris tous à `null`.
- Idempotence : deux validations du même devis, une seule sous-issue.
- Dégradation : `fetchEtatsAffaires` en échec laisse la page rendre des `—`.

## Ce que cette spec ne fait pas

- Aucune génération ni envoi de document Tiime.
- Aucun mail au client au-delà de l'accusé de réception déjà en place.
- Aucun calcul de montant d'acompte.
- Aucune écriture vers Linear depuis le tableau : la page reste en lecture.
