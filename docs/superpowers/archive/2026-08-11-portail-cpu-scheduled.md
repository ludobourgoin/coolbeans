# S0.2 · Budget du handler `scheduled` sur le plan Workers Free

Vérification exigée par `corrections-spec-portail-client.md` §0, qui la classe **bloquante** :
« le seul point qui peut invalider l'architecture entière ». À lever avant tout code de sync.

Source : <https://developers.cloudflare.com/workers/platform/limits/>, relevée le 2026-08-11.

## Limites constatées

| Limite | Workers Free | Workers Paid |
| --- | --- | --- |
| CPU time par requête HTTP | **10 ms** | 5 min (défaut 30 s) |
| CPU time **par Cron Trigger** | **10 ms** | 30 s (< 1 h d'intervalle) · 15 min (≥ 1 h) |
| Durée (wall clock) d'un Cron Trigger | 15 min | 15 min |
| **Subrequests par invocation** | **50** | 10 000 |
| Connexions sortantes simultanées | 6 | 6 |
| Mémoire | 128 MB | 128 MB |

Deux précisions de la doc qui changent la lecture :

- **L'attente réseau ne compte pas dans le CPU time.** « Waiting on network requests (such as
  `fetch()` calls, KV reads, or database queries) does not count toward CPU time. » Seul le travail
  CPU réel compte : parsing JSON, hachage, tri, sérialisation.
- **Un subrequest, ce n'est pas seulement `fetch()`.** « A subrequest is any request a Worker makes
  using the Fetch API **or to Cloudflare services like R2, KV, or D1**. » Les lectures et écritures
  KV consomment donc le même budget de 50 que les appels Asana et Clerk.

Repères de la doc : un Worker moyen consomme ~2,2 ms de CPU par requête ; les charges lourdes
(authentification, SSR, parsing de gros payloads) montent à 10-20 ms. L'isolate tolère par ailleurs
un dépassement occasionnel ; c'est le dépassement *répété* qui fait terminer l'exécution.

## Verdict sur le point bloquant (§0)

**Non bloquant. Implémenter le sync en une passe, comme spécifié** (branche 2 des trois options
de §0). Le pronostic du garde-fou 06 du doc master est confirmé pour le CPU.

Justification : le travail CPU du sync est le parsing de quelques dizaines de Ko de JSON, un
SHA-256 par team (`crypto.subtle`, natif, coût négligeable) et un regroupement en mémoire de
quelques centaines de tâches. À l'échelle du pilote (1 team) comme à 5 clients, on reste largement
sous la barre des 10 ms — d'un ordre de grandeur en dessous du seuil « 10-20 ms » que Cloudflare
associe aux charges lourdes. La correction §2 (5 requêtes → 1 par projet) divise en plus le volume
à parser par ~5.

## Mais le plafond qui mord en premier n'est pas le CPU

**C'est la limite de 50 subrequests par invocation**, que ni le brief ni le doc de corrections
ne mentionnent. Le budget par exécution du cron, avec T teams et P projets par team en moyenne :

```
1                     Clerk : liste des users (+1 par tranche de 100 users)
+ T × 1               Asana : GET /teams/{gid}/projects
+ T × P               Asana : GET /tasks?project= (+1 par tranche de 100 tâches)
+ T × 1               KV    : getWithMetadata (lecture du hash, corrections §3)
+ T × 1               KV    : put (seulement si le snapshot a changé)
+ 1                   KV    : put meta:last_sync
= 2 + T × (P + 3)     dans le pire cas (toutes les teams ont changé)
```

| Échelle | Subrequests (pire cas) | Marge sur 50 |
| --- | --- | --- |
| Pilote : 1 team, 1 projet | 6 | large |
| 5 clients, 3 projets chacun | 32 | correcte |
| **8 clients, 3 projets chacun** | **50** | **plafond atteint** |

Le sync sature donc vers **7 à 8 clients**, bien avant le plafond d'écritures KV (~40 clients)
que la correction §3 cherchait à repousser. La spec a optimisé la mauvaise contrainte en premier.

Conséquences à retenir pour S1 :

- **La correction §2 devient structurelle, pas seulement une optimisation de débit.** Sans elle
  (5 requêtes par projet), le budget de 50 serait atteint dès ~2 clients.
- **Paralléliser les fetchs par lots de 6 maximum** (limite de connexions sortantes simultanées).
- **Compter les subrequests dans le résumé de `meta:last_sync`** et logger un warning au-delà de 40.
  C'est le signal qui déclenche la bascule, pas une surveillance manuelle.

> **Suite donnée (2026-08-12) — ce document décrit le plan gratuit, qui n'est plus la cible.**
> Décision de passer au plan **Workers Paid (5 $/mois)** avant S1 : les subrequests passent de 50 à
> 10 000 par invocation, le CPU de 10 ms à 30 s, les écritures KV de 1 000/jour à 1 M/mois. Le
> plafond analysé ci-dessous disparaît donc, et les contournements deviennent des plans de secours.
> Le sync reste néanmoins paramétrable par team, pour le déclenchement à la demande.
> Voir [Sync par team + déclenchement manuel](2026-08-12-portail-sync-par-team.md).
>
> Ce document reste la référence sur *ce que coûte* le sync et sur les limites du plan gratuit, au
> cas où l'abonnement serait abandonné.

## Échappatoire, le jour où l'un des deux plafonds est atteint

Celle de §0 option 3, inchangée, et elle traite les deux limites d'un coup : répartir les teams en
lots déterministes sur les 5 crons du plan gratuit (modulo sur le rang du team GID trié, un lot par
cron décalé de 12 minutes). Chaque invocation ne traite qu'un cinquième des teams : CPU et
subrequests divisés par 5, fréquence de rafraîchissement inchangée pour le client.

Ne rien pré-implémenter aujourd'hui : le déclencheur est le warning à 40 subrequests ci-dessus.

## Surveillance

Un dépassement CPU n'échoue pas silencieusement : Cloudflare renvoie l'erreur 1102 et l'invocation
apparaît en `exceededCpu` dans le dashboard (Metrics → Errors → Invocation Statuses) et dans
Logpush. À vérifier après le premier sync réel en staging, puis à l'occasion.
