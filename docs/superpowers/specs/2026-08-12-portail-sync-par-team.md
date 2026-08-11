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

**Le sync est paramétrable par team. Le cron reste le régime permanent ; le déclenchement manuel
couvre l'immédiateté.** Ce sont deux besoins distincts, à ne pas confondre :

- Le **périmètre par team** (`syncTeam(gid)`) répond au plafond de subrequests.
- Le **déclenchement manuel** répond au délai après un « regarde ton portail » (garde-fou 01, déjà
  acté par la promotion de la route admin en « requis »). Il n'a jamais eu vocation à remplacer
  l'automatisme.

Deux décisions du 2026-08-12 encadrent le tout : **passage au plan Workers Paid (5 $/mois)**, qui
efface les plafonds plutôt que de les contourner, et **cadence portée à 15 minutes**. Détail plus
bas.

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

### 3. Un bouton « Synchroniser maintenant » dans l'espace admin — recommandé, pas requis

Sur `/espace/projets`, visible des seuls `role: "admin"`, déclenchant le sync de la team affichée.

Sa justification a faibli avec la cadence à 15 minutes : il ne rattrape plus une heure de retard,
seulement quinze minutes. Il garde son intérêt pour le moment de démonstration (« regarde, c'est à
jour ») et évite qu'un `curl` avec un secret dans la commande soit le seul geste possible. Ludo étant
le client zéro, il vit dans son espace, à côté du projet concerné — cohérent avec « espace admin =
même structure que le portail client, entrées admin-only additives ».

À trancher en S1.6 selon le temps disponible. La route admin, elle, reste requise : elle sert aussi
l'amorçage du premier snapshot et les tests.

### 4. Le cron reste le régime permanent

Balayage complet, à la cadence définie plus bas.

**Pourquoi ne pas basculer en tout-manuel :** le risque n'est pas technique, il est humain. Le jour
où une tâche est cochée dans Asana depuis un téléphone sans que le sync soit déclenché, le portail
reste faux **indéfiniment** — alors que le cron borne l'écart à une heure. Le bandeau « Dernière
mise à jour » afficherait une date ancienne, et c'est le genre de détail qu'un client remarque.

Le supprimer n'apporterait de toute façon aucune marge, le plafond n'étant pas lié à la fréquence.

## Le plafond se règle en payant, pas en codant

**Décision du 2026-08-12 : passage au plan Workers Paid (5 $/mois) avant d'écrire S1.**
Amendement assumé au principe « 0 €/mois » du doc master, qui rangeait Cloudflare parmi les free
tiers.

Ce que les 5 $ effacent :

| Limite | Free | Paid |
| --- | --- | --- |
| **Subrequests par invocation** | 50 | **10 000** |
| CPU par invocation | 10 ms | 30 s (jusqu'à 5 min) |
| **Cron Triggers par compte** | 5 | **250** |
| Écritures KV | 1 000/jour | 1 M/mois |

C'est-à-dire : le mur des 7-8 clients, le plafond d'écritures KV à ~40 clients visé par la
correction §3, la contrainte des crons par compte, et le budget CPU du §0 — tout disparaît d'un
coup. Le balayage complet tient sans effort à plusieurs centaines de clients.

À l'échelle du projet, les 5 $ sont la facture complète : 10 M de requêtes, 30 M de ms de CPU et
1 M d'écritures KV sont inclus, et le site vitrine comme le portail en sont très loin.

**Pourquoi payer plutôt que construire.** Contourner les limites du plan gratuit (répartiteur,
lots, tranche tournante) coûte une demi-journée, porte une réserve non validée sur l'auto-appel d'un
Worker, et laisse une complexité permanente dans le sync. Face à 60 $ par an, l'arbitrage n'est pas
disputable — et au moment où le plafond mordrait, 7-8 clients factureraient largement de quoi le
couvrir.

**Conséquence :** les trois contournements ci-dessous ne sont plus une trajectoire, mais des plans
de secours si le plan payant devait être abandonné. Ne rien en implémenter.

<details>
<summary>Contournements du plan gratuit, conservés pour mémoire</summary>

L'issue générale est toujours la même — une invocation par team, étalées dans le temps, chacune
repartant avec son propre budget. Deux contraintes de plateforme l'encadrent : le cron Cloudflare a
une **granularité à la minute**, et la limite de **5 Cron Triggers vaut par compte**, prod et
staging en consommant déjà un chacun.

Piège à écarter : enchaîner `sync(team1)`, attendre, `sync(team2)` dans une **même** invocation ne
sert à rien — le budget est par invocation, pas par unité de temps.

1. **Cron répartiteur.** Une invocation qui émet un `fetch` vers `/api/admin/sync?team_gid=…` par
   client ; chaque `fetch` coûte 1 subrequest au parent et ouvre une invocation neuve. Parent
   `1 + T`, enfant `P + 4`. *Réserve : limites de profondeur de sous-requêtes sur l'auto-appel, non
   testées.*
2. **Tranche tournante.** Un cron qui traite les teams 0-9 à l'heure paire, 10-19 à l'impaire.
3. **Lots sur les crons restants.** Borné à 3 lots ici, pas 5.

</details>

## Cadence : toutes les 15 minutes

`triggers.crons = ["*/15 * * * *"]` en remplacement de l'horaire, une fois le plan payant actif.

Le confort du client passe de « au pire 59 minutes de retard » à « au pire 15 ». Le coût reste nul :
96 invocations par jour, à comparer aux 10 M de requêtes et 30 M de ms de CPU inclus.

Un seul point de vigilance à cette cadence, côté Asana : le sync devient une rafale de
`1 + T × (1 + P)` requêtes toutes les 15 minutes, contre une limite de 150 req/min sur l'API Asana.
La marge reste large (81 requêtes à 20 clients), et la limite de 6 connexions sortantes simultanées
étale naturellement la rafale — mais le **retry avec backoff sur 429** du brief §4 reste obligatoire.

**Précondition :** la bascule vers le plan payant doit précéder S1. Sur le plan gratuit, une cadence
à 15 minutes rapprocherait le plafond d'écritures KV (1 000/jour) — `meta:last_sync` étant écrit à
chaque passage, soit 96/jour, plus les snapshots modifiés. Aujourd'hui le handler est un no-op :
la cadence peut donc être posée sans risque, mais pas le sync réel.

## Ce que ça change dans les tâches S1

| Tâche | Ajustement |
| --- | --- |
| **S1.1** Connecteur teams via Clerk | Sert le balayage complet uniquement. `syncTeam()` ne doit pas en dépendre. |
| **S1.2** Sync par team | Devient explicitement `syncTeam(gid)`, appelable seule. La correction §2 (1 requête par projet) reste structurelle : sans elle, le budget serait atteint dès ~2 clients. |
| **S1.5** Route admin sync | Accepte un `team_gid` optionnel. |
| **S1.6** Page `/espace/projets` | Ajouter le bouton « Synchroniser maintenant », admin uniquement. |
| **S1.8** DoD design system | Le bouton et son état de chargement rejoignent la Bibliothèque. |

Deux points transverses que le plan payant déplace sans annuler :

- **Le compteur de subrequests** dans le résumé de `meta:last_sync` perd son urgence (le seuil passe
  de 50 à 10 000). Le garder reste utile comme donnée d'observabilité, mais le warning à 40 n'a plus
  d'objet.
- **L'écriture KV conditionnelle** (correction §3) n'est plus une question de quota — 1 M
  d'écritures par mois sont incluses. Elle reste **requise** pour une autre raison, désormais la
  principale : elle fait de « Dernière mise à jour » la date du dernier *changement* et non de la
  dernière vérification. À 15 minutes, un horodatage qui bouge quatre fois par heure sans que rien
  n'ait changé serait un mensonge visible pour le client.

## Ce que ça ne change pas

Les principes du doc master tiennent, à un amendement près : miroir et pas outil, snapshot et pas
runtime. Le « 0 €/mois » devient **5 $/mois**, arbitré ci-dessus. Clerk, Asana, UptimeRobot et Resend
restent sur leurs free tiers.
La route admin reste ce que le garde-fou 01 en avait fait : le moyen de combler le délai d'une heure,
pas un remplacement du cron. Le sync demeure automatique. Le paramétrage par team ne change rien à la
fraîcheur en régime permanent, et l'améliore ponctuellement : après une grosse mise à jour, le client
voit le changement dès que tu déclenches, au lieu d'attendre jusqu'à 59 minutes.
