# Portail client — règles vivantes héritées des specs Asana

> **Condensé le 2026-08-17** (feu vert Ludo, rationalisation stratégie produit). La source de
> vérité produit du portail est désormais
> `2026-08-17-portail-client-strategie-produit.md`. Ce fichier ne conserve que les règles
> encore vivantes de l'ère Asana, transposées à Linear. Les anciens §0 à §7 (sync Asana,
> retiré par COO-22) sont supprimés ; l'historique complet reste dans git.
>
> Historique : rapatrié dans le repo le 2026-08-11 (tâche S0.1) depuis l'annexe A2 du doc
> master « my Coolbeans · Portail client » (v1.0, 2026-08-06), amendé les 2026-08-12 et
> 2026-08-14, condensé le 2026-08-17.

## §1 · Règle de statut projet (transposée à Linear)

La règle naïve (« si toutes les issues restantes sont en backlog/todo → Prêt à démarrer »)
est vraie **par vacuité** quand il ne reste aucune issue. Ne jamais annoncer « Prêt à
démarrer » sur un projet dont on ne peut rien déduire :

```
statutProjet(projet, issues):
  si projet est marqué terminé côté Linear   → "done"
  sinon:
    restantes = issues où statut ≠ done
    si restantes est vide                    → "in_progress"   // tout est fait mais projet non clôturé
    si toutes restantes sont en todo/backlog → "ready"
    sinon                                    → "in_progress"
```

Le cas « projet sans aucune issue » tombe dans `restantes` vide, donc `in_progress`.

Critères d'acceptation associés :

1. Un projet dont toutes les issues sont terminées, mais non clôturé côté Linear, s'affiche
   « En cours » et non « Prêt à démarrer ».
2. Un projet sans aucune issue s'affiche « En cours » et non « Prêt à démarrer ».

## §8 · Filtre de contenu client-safe (Linear)

Décidé avec Ludovic le 2026-08-14. Double garde-fou voulu : la skill `linear` (réécriture
des issues à la création) est censée neutraliser tout contenu inapproprié en amont, mais le
portail doit avoir sa **propre** défense, indépendante de cette skill — au cas où un item
créé avant elle, ou saisi un jour de fatigue hors du flux normal, contienne quelque chose
comme « faire ce que demande le client même si je pense que c'est de la merde ».

### Liste blanche de champs exposés

| Objet | Champs exposés | Jamais exposé |
| --- | --- | --- |
| **Projet** | nom, statut, deadline, description (voir ci-dessous) | commentaires |
| **Issue** | nom, statut | deadline, description, commentaires |

La description d'un projet s'affiche dans un **toggle fermé par défaut** (le client doit
cliquer pour la déplier), et reste soumise à la règle de troncature/séparateur héritée de
l'ancien §4 : lire uniquement le texte avant un séparateur `---`, sinon tronquer à
300 caractères. `notes`/description ne doivent jamais être injectés en HTML brut côté rendu.

> **Précision 2026-08-17 (spec stratégie produit §3.8)** : le « nom » d'issue exposé côté
> client est le titre issu de la section `## Client` de la description quand elle existe
> (convention COO-85) ; à défaut, repli sur le nom brut passé par le filtre ci-dessous. Les
> noms d'issues techniques bruts ne sont jamais montrés tels quels.

### Filtre de contenu, indépendant de la liste blanche de champs

Même dans un champ autorisé (nom ou description), bloquer et signaler à Ludovic tout contenu :

- vulgaire ou grossier ;
- insultant ou dénigrant envers le client, nommément ou par euphémisme reconnaissable.

Implémentation attendue lors du chantier Linear : passer le texte candidat (nom + description
tronquée) dans un filtre de mots-clés/expression avant de l'écrire dans le snapshot. En cas
de détection : exclure l'item du snapshot **et** notifier Ludovic (log Worker visible, ou
entrée dédiée côté admin) plutôt qu'échouer silencieusement. Ne jamais tenter de « nettoyer »
ou réécrire automatiquement le texte détecté — exclure et signaler, la correction reste
manuelle.

### Critères d'acceptation

3. Un projet ou une issue dont le nom ou la description contient un terme vulgaire ou
   insultant envers le client n'apparaît jamais sur le portail ; le cas est signalé à Ludovic
   plutôt que silencieusement ignoré.
4. Les commentaires (Linear : comments) d'une issue ou d'un projet ne sont jamais lus par le
   sync, ni exposés par l'API du portail.
5. La description d'un projet s'affiche repliée par défaut côté client.
