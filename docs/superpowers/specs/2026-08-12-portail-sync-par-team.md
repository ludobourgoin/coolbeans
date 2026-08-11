# Sync par team + déclenchement manuel — arbitrage pour S1

Décision du 2026-08-12, prise en réaction à la vérification S0.2
([budget du handler scheduled](2026-08-11-portail-cpu-scheduled.md)). Complète le
[brief §5 et §8](brief-portail-client-asana.md) et la
[correction §2](corrections-spec-portail-client.md) sans les contredire.

## Le constat qui déclenche l'arbitrage

Le plan Workers Free plafonne à **50 subrequests par invocation** — limite Cloudflare, pas Clerk —
et Cloudflare compte comme subrequest « toute requête faite via l'API Fetch **ou vers un service
Cloudflare comme R2, KV ou D1** ». Les lectures et écritures KV consomment donc le même budget que
les appels Asana.

Un sync qui balaie toutes les teams en une invocation coûte `2 + T × (P + 3)` subrequests
(T teams, P projets par team). Il sature vers **7-8 clients**.

**Le plafond est par invocation, pas par unité de temps.** Espacer le cron ne le déplace donc pas
d'un pouce : c'est le *périmètre* d'une invocation qui compte, pas sa fréquence. C'est le point
qu'il faut avoir en tête pour lire la suite.

## Décision

**Le sync est paramétrable par team, et le déclenchement manuel devient le chemin normal.
Le cron est conservé comme filet.**

### 1. `syncTeam(gid)` est l'unité de base

Le sync s'écrit comme une fonction qui traite **une** team. Le cron l'appelle en boucle, la route
admin l'appelle une fois. Contrainte de découpage, pas travail supplémentaire — mais elle doit être
posée dès S1, sinon elle impose une refonte plus tard.

Coût d'une invocation ne traitant qu'une team :

```
1   GET /teams/{gid}/projects
P × GET /tasks?project=
1   KV getWithMetadata      (hash, correction §3)
1   KV put du snapshot      (si changement)
1   KV put de meta
= P + 4 subrequests
```

Soit **~7 subrequests, constant quel que soit le nombre de clients**. Le plafond disparaît : il
faudrait 46 projets chez un même client pour l'approcher. À noter, l'appel Clerk de listage des
users devient inutile dans ce mode — on sait déjà quelle team on synchronise. Une requête et une
dépendance en moins.

### 2. `POST /api/admin/sync` accepte un `team_gid` optionnel

- Absent → balayage complet (comportement du cron).
- Présent → cette team seule.

Même protection par `ADMIN_SYNC_SECRET` en en-tête dans les deux cas (brief §8).

### 3. Un bouton « Synchroniser maintenant » dans l'espace admin

Sur `/espace/projets`, visible des seuls `role: "admin"`, déclenchant le sync de la team affichée.

Ce n'est pas du confort : sans lui, le geste manuel est un `curl` avec un secret dans la commande,
et il ne sera pas fait. Ludo étant le client zéro, le bouton vit dans son espace, à côté du projet
concerné — cohérent avec « espace admin = même structure que le portail client, entrées admin-only
additives ».

### 4. Le cron horaire reste, inchangé

`triggers.crons = ["0 * * * *"]`, balayage complet.

**Pourquoi ne pas le supprimer alors que le manuel devient le chemin normal :** le risque du
tout-manuel n'est pas technique, il est humain. Le jour où une tâche est cochée dans Asana depuis un
téléphone sans que le sync soit déclenché, le portail reste faux **indéfiniment** — alors que le
cron borne l'écart à une heure. Le bandeau « Dernière mise à jour » afficherait une date ancienne,
et c'est le genre de détail qu'un client remarque.

À l'échelle actuelle le cron coûte ~6 subrequests par passage : il ne gêne rien.

## Quand le cron deviendra un problème

À 7-8 clients, son balayage complet atteindra les 50 subrequests. Deux issues, à ce moment-là
seulement :

1. Découper les teams en lots déterministes sur les 5 crons du plan gratuit (option 3 du §0 des
   corrections) — chaque invocation traite un cinquième des teams.
2. Baisser sa fréquence, le manuel étant devenu le chemin principal.

**Ne rien pré-implémenter.** Le déclencheur est le warning à 40 subrequests posé en S1 (voir
ci-dessous), pas une surveillance manuelle.

## Ce que ça change dans les tâches S1

| Tâche | Ajustement |
| --- | --- |
| **S1.1** Connecteur teams via Clerk | Sert le balayage complet uniquement. `syncTeam()` ne doit pas en dépendre. |
| **S1.2** Sync par team | Devient explicitement `syncTeam(gid)`, appelable seule. La correction §2 (1 requête par projet) reste structurelle : sans elle, le budget serait atteint dès ~2 clients. |
| **S1.5** Route admin sync | Accepte un `team_gid` optionnel. |
| **S1.6** Page `/espace/projets` | Ajouter le bouton « Synchroniser maintenant », admin uniquement. |
| **S1.8** DoD design system | Le bouton et son état de chargement rejoignent la Bibliothèque. |

Ajout transverse : **compter les subrequests consommés et les écrire dans le résumé de
`meta:last_sync`**, avec un warning loggé au-delà de 40. C'est le signal qui déclenchera la bascule
vers le découpage en lots — sans lui, on découvrira le plafond par un sync qui échoue.

## Ce que ça ne change pas

Les principes du doc master tiennent : miroir et pas outil, snapshot et pas runtime, 0 €/mois.
La route admin avait déjà été promue de « bonus » à « requis » (garde-fou 01) pour combler le délai
d'une heure ; cet arbitrage en fait le chemin normal plutôt que le rattrapage. Le paramétrage par
team ne réduit pas non plus la fraîcheur perçue : elle s'améliore, le client voyant le changement
dès la fin de la mise à jour au lieu d'attendre jusqu'à 59 minutes.
