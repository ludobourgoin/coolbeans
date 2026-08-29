# Specs — index et cycle de vie

> Premier fichier à lire en session de travail sur le portail ou une feature spécifiée.
> Tout ce qui n'est pas listé ici est dans `../archive/` et ne doit **jamais** être
> référencé dans du travail courant.

## Specs vivantes

| Fichier | Rôle | Ancre Linear | Statut |
| --- | --- | --- | --- |
| `2026-08-17-portail-client-strategie-produit.md` | **Source de vérité produit du portail** : positionnement, boucles, modules, règles transverses, §4.5 client-safe | Projet « Portail myCoolbeans » (milestones P1-P12), projet « Tracking standardisé Coolbeans » | Vivant, s'amende |
| `2026-08-15-messagerie-portail-design.md` | Design de la messagerie bidirectionnelle (D1 + webhook Linear + `>>`) | Milestone « P2 · Messagerie complète » (COO-96 à 99) | **Implémentée sur staging le 2026-08-17** ; reste : recette navigateur de Ludo, gestes prod (migration D1, secrets, webhook), doc, puis archivage |
| `2026-08-19-crm-opportunites-checklist-design.md` | Modèle hybride du CRM : check-list des 14 étapes en description, sous-issues réservées aux actions (statuts Todo/Doing/Done), vocabulaire « Opportunité » | Team `🎯 CRM` | Actif : trois gestes UI de Ludo en attente, puis migration des sous-issues |
| `2026-08-14-portail-sidebar-design.md` | Refonte navigation : sidebar unique structure Geist | COO-80 (In Review), COO-81 | Actif, chantier en cours |
| `2026-08-11-portail-session-clerk.md` | Procédure durée de session Clerk (A2HS) | COO-46 (arbitrage en attente), bloque COO-42 | Actif tant que COO-46 n'est pas tranché |

## Cycle de vie d'une spec

Deux étages, pas un :

1. **Document produit vivant** (un par grand ensemble, aujourd'hui : la spec stratégie du
   portail). C'est lui que les issues Linear citent. Il ne meurt jamais, il s'amende, dans
   la même session que la décision qu'il consigne.
2. **Spec de design datée par chantier** (`YYYY-MM-DD-<sujet>-design.md`, produite par le
   brainstorming superpowers), liée à son milestone ou son issue Linear. En-tête
   obligatoire : date + `Statut :`. Elle décrit l'intention avant de construire ; elle n'a
   pas vocation à rester vraie. À la livraison du chantier : le durable migre vers la
   documentation, puis la spec et son plan partent dans `../archive/` **automatiquement,
   sans demande, dans la même session que la mise à jour de la doc** ; l'index ci-dessus
   est mis à jour dans la foulée.

La doc produite doit être claire, lisible et complète, avec **un seul niveau de titres**
(h2 ; le nom de la page est le h1) — règle détaillée dans la skill `doc-client`
(`references/redaction.md`).

## Convention spec → documentation (obligatoire)

Chaque spec de design se termine par une section `## Documentation` qui liste les pages de
doc à créer ou amender à la livraison (doc Coolbeans en client zéro, doc client via la
skill `doc-client`). **Le chantier n'est pas done tant que cette section n'est pas
exécutée.** C'est l'application de la boucle documentaire de la spec produit (§2) et le
pendant manuel de l'automatisme « issue Done → tâche de doc » (COO-95).
