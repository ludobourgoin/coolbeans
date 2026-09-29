# Les réponses du client vivent dans le document

Date : 2026-09-29
Portée : les quatre collections `cadrage`, `devis`, `livrable`, `temoignage`
Remplace : §13.2 de `2026-08-18-cadrage-client-design.md` (« pas de base de données en V1 »)

## Le défaut à corriger

Les réponses aux formulaires de cadrage, de livrable et de témoignage n'étaient écrites nulle part ailleurs que dans le mail de notification. Supprimer ce mail, c'était perdre la réponse. Seules les propositions écrivaient en base (`devis_reponses`).

Le choix du 2026-09-05 évitait une migration D1, geste non parallélisable qui part en prod dès le merge sur `staging`. La migration se fait une fois. Un mail supprimé est perdu pour de bon.

## Les décisions du 2026-09-29

1. **Les réponses vont en D1.** Une table `document_reponses` pour le cadrage, le livrable et le témoignage. Les propositions gardent `devis_reponses`, que le cockpit lit déjà.
2. **Le document affiche les réponses à la place du formulaire**, dans la forme du mail de notification : la question en petit, la réponse en gras.
3. **L'identité s'affiche biffée.** Prénom, nom, email, raison sociale, SIREN, adresse, TVA, consentement et photo gardent leur libellé, avec la valeur remplacée par une barre. La valeur en clair ne vit qu'en D1 et dans le mail. Elle n'atteint jamais le navigateur : la barre a une largeur fixe, qui ne trahit pas la longueur.
4. **Une réponse définitive fait disparaître le formulaire.** Est définitive : toute réponse à un cadrage ou à un témoignage, une validation de proposition ou de livrable sur la version courante. Une question sur une proposition ou des retours sur un livrable laissent le formulaire en place, sous les réponses déjà reçues.
5. **Le serveur refuse une deuxième réponse** sur un document clos, en 409. Si le client s'est trompé, il faut un nouveau document.
6. **Les réponses passées sont reprises depuis les mails**, avec leur date d'origine et `origine = 'reprise'`.

## La mécanique

Les pages restent prérendues. Un composant `ReponsesDocument`, posé juste avant le formulaire en `server:defer` (server island), interroge D1 à chaque visite et rend le bloc des réponses.

Quand le document est clos, l'île émet aussi une règle CSS qui masque la section du formulaire. Le formulaire ne passe pas dans l'île : ses scripts ne s'exécuteraient pas de façon sûre dans le HTML injecté, et son balisage dépasserait la limite d'URL de la requête GET.

Conséquence : le formulaire reste visible le temps que l'île réponde, en bas d'une page longue, donc hors de l'écran à l'ouverture. Sans JavaScript, l'île ne se charge pas, mais le formulaire n'envoie rien sans JavaScript non plus.

Après un envoi réussi, la page se recharge : le client voit ses réponses à la place du formulaire.

## Le schéma

```sql
CREATE TABLE document_reponses (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  type       TEXT NOT NULL CHECK (type IN ('cadrage', 'livrable', 'temoignage')),
  slug       TEXT NOT NULL,
  decision   TEXT,          -- livrable : 'validation' | 'retours' ; nul ailleurs
  reponses   TEXT,          -- JSON [{ question, reponse, decisif }], instantané lisible
  message    TEXT,
  prenom     TEXT NOT NULL,
  nom        TEXT NOT NULL,
  email      TEXT NOT NULL,
  photo_r2   TEXT,          -- témoignage : clé R2 de la photo
  origine    TEXT NOT NULL DEFAULT 'formulaire' CHECK (origine IN ('formulaire', 'reprise')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

`reponses` stocke les libellés tels que le client les a lus, pas les identifiants d'options. Un YAML corrigé après coup ne réécrit pas une réponse déjà donnée.

`devis_reponses` reçoit la même colonne `origine`, pour distinguer les reprises.

Le consentement n'a pas de colonne : l'endpoint refuse toute réponse sans lui, donc chaque ligne en porte la preuve, datée par `created_at`.

## Ce qui ne change pas

- Les mails de notification et d'accusé de réception partent comme avant. Un échec D1 ne bloque jamais le mail.
- Le champ `formulaire` des YAML reste un interrupteur manuel.
- Le cockpit `/espace/devis` lit `devis_reponses` comme avant.

## Hors périmètre

Le gel des réponses, le calcul d'écart et les notifications du §6 de la spec cadrage.
