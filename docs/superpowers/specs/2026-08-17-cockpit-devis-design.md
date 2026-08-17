# Cockpit Devis et chiffrage piloté par Linear — design

Date : 2026-08-17 · Statut : validé en brainstorm, en attente de relecture

## 1. Contexte et objectif

Le module `/espace/chiffrages` modélise un workflow mort : composition
manuelle d'un chiffrage depuis un catalogue de prestations, conversion
`toDevis`, publication KV. Le workflow réel est désormais : projet Linear
Proposal (issues estimées) → skill `devis` (collecte, challenge, checklist)
→ YAML `src/content/devis/<slug>.yaml` → prod → envoi Resend au lead.

Objectif : une seule chaîne. Le projet Linear devient la source de vérité du
chiffrage, la skill le challenge et en dérive le devis, l'admin devient un
cockpit de suivi. Le modèle de calcul existant (segments, affinité,
réductions, urgence, marge) est conservé intégralement, corrigé et déplacé.

## 2. Workflow cible

Deux passes, autour du rendez-vous de brief :

1. **Passe 1 — avant le brief (optionnelle).** Ludo crée le projet Proposal
   et un premier jet d'issues estimées, parfois sans aucune info du lead. La
   skill tourne en mode dégradé : peu de sources, peu de challenge. Livrable
   attendu : une **fourchette de prix** à annoncer au brief. Le lead est
   prévenu : si ce n'est pas dans son budget, Coolbeans n'est peut-être pas
   la bonne personne — dit cordialement, dès le brief.
2. **Passe 2 — après le brief.** Besoin, attentes et budget compris. La
   skill refait un passage complet : collecte (Linear, Gmail, Granola, web),
   challenge des estimates et des prix, arbitrage socle/options pour tenir
   le budget, mise à jour du projet Linear, puis génération du devis.

Principe directeur : **le budget du lead définit le projet.** Pour tenir la
fourchette, des besoins passent en option chiffrée (réalisable en V1 si le
lead la coche) ou en piste « V2 du site » mentionnée sans prix ferme dans
les notes du devis. Le devis rend cet arbitrage lisible au lead.

## 3. Source de vérité : le bloc Chiffrage du projet Linear

La donnée commerciale par projet vit dans la **description du projet
Linear**, dans un bloc clé:valeur en fin de description, lisible par Ludo et
parsable par la skill :

```markdown
## Chiffrage
- Contact : <prénom nom> <email> (copie : <emails>)
- Segment : tpe | pme | association | agence | designer
- Affinité : neutre | envie | pasenvie
- Gestion de projet : oui | non
- Urgence : oui | non
- Marge : 0 | 10 | 20 | 30
- Réduction : <nom> · <montant € ou %>
- Prix cible / budget lead : <montant ou fourchette, source>
- Échéancier : <ex. 30/40/30>
- Validité : <durée>
- Notes : <libre>
```

- Un **template de projet Linear** (créé une fois à la main dans le
  workspace, contenu fourni au moment de l'implémentation) pré-remplit ce
  bloc avec les champs vides : compléter un Proposal montre exactement ce
  qui intervient dans le calcul.
- Si le bloc manque sur un projet existant, la skill le pose elle-même
  (write-back) après avoir posé ses questions.
- Les issues estimées restent le **cœur du réacteur** : Ludo les crée, la
  skill les challenge (charge ET prix), le chiffrage de base est
  `somme des estimates × TJM`.

## 4. Modèle de calcul

Repris du module actuel (`src/lib/chiffrage/`), avec corrections :

| Élément | Règle | Correction vs existant |
|---|---|---|
| Base | Somme des estimates (1 pt = 1 h, 7 h = 1 j) × TJM | Remplace le catalogue par niveaux |
| Segment | Posture + gestion de projet par défaut (agence, designer, pme, tpe, association) | Conservé tel quel |
| Gestion de projet | **+15 % sur la totalité du projet** | L'actuel `coefHebdo` est faux : ce n'est pas hebdomadaire |
| Affinité | envie −20 % · pasenvie +20 % · neutre 0 | Conservé, valeurs dans Réglages |
| Urgence | +20 %, **affichée au devis en valeur absolue (€)** avec tooltip d'explication : « Je vous fais passer en priorité pour répondre à votre deadline (+20 %). » | Aujourd'hui interne ; devient une ligne visible |
| Marge | 0/10/20/30 % | Conservé |
| Réduction | Nommée (exceptionnelle, association…) + montant ou %, **affichée** — une remise a une valeur commerciale | Conservé |
| Prix retenu | Arrondi commercial final, décidé par Ludo | Conservé |

### Pricing par la valeur — le point le plus important

Le temps × TJM est un **plancher interne**, pas un prix. La skill fait une
passe de challenge dans les deux sens, ligne par ligne puis sur le total :

- **Sous-facturation** : une ligne à faible charge mais forte valeur client
  (impact business, autonomie, différenciation, demande explicite du lead)
  doit être signalée — « ça te prend 15 minutes, ça vaut 3 fois plus ».
- **Sur-facturation** : une ligne dont le prix dépasse la valeur perçue, ou
  un total qui ferait peur au client vs le budget annoncé, doit être
  signalée avec une proposition (baisser, regrouper, passer en option).

Critères d'évaluation de la valeur : impact pour le client (conversion,
autonomie, visibilité), différenciation, prix de marché, ce que le lead a
explicitement demandé. La skill argumente, Ludo tranche.

## 5. Présentation du devis

- **Un montant total unique.** Les lignes du périmètre sont sobres et sans
  prix ; on ne vend pas du temps, on vend un projet. **Seules les options
  affichent leur prix** (et l'urgence sa valeur absolue si active).
- **Tooltips** : le rendu devis (`DevisCorps.astro` + schéma
  `content.config.ts`) gagne un champ `tooltip` optionnel sur les items de
  liste, lignes de budget et notes. Usage : alléger le design en déplaçant
  les explications (justification du +20 % d'urgence, contenu d'un poste,
  détail d'une mention) hors du fil principal. À généraliser dès que
  justifié.
- La stack s'intitule **« Stack technique recommandée »** : le lead peut ne
  pas être d'accord (en pratique il l'est toujours).
- Notes : arbitrage budget rendu explicite — options V1 cochables, pistes
  V2 du site mentionnées sans engagement de prix.

## 6. Cockpit `/espace/devis`

- Route renommée (`/espace/chiffrages` → redirection), page « Devis ».
- **Liste antéchronologique** des devis YAML : client, objet, montant total,
  statut dérivé, liens page publique / projet Linear / affaire CRM. Volet
  réponse client (décision + message) quand elle existe. Pas de création ni
  d'édition : le devis naît dans la skill.
- **Statuts dérivés, jamais stockés** : Publié (YAML en prod sans `envoi`) →
  Envoyé (`envoi.date` dans le YAML) → Répondu (ligne D1, avec décision).
- **D1** : table `devis_reponses` (slug, décision accepté/à-discuter,
  message, contact, date) dans la base messagerie existante.
  `api/devis-reponse.ts` écrit en D1 puis envoie le mail Resend ; si D1
  échoue, le mail part quand même et l'erreur est loguée.
- **YAML enrichi** (champs internes, jamais rendus publiquement) :
  `envoi: { date, destinataire }`, `linear: { projet, affaire }`.
- **Réglages conservés et étendus** (`/espace/devis/reglages`, KV) : TJM,
  fourchette marché, charges, jours/semaine, semaines de marge,
  coefficients (affinité, urgence, gestion, marges), segments, textes
  standards de devis. **Les chiffres sensibles vivent ici, jamais dans la
  skill publiée.**
- Garde admin inchangée (pages + actions, double vérification).

## 7. Suppressions

Chaîne du chiffrage manuel : composants `Configurateur`, `ModeLibre`,
`BlocCalcul`, `ChiffrageEditor`, `DevisPreview`, lib `toDevis` + tests,
actions de publication, route `/devis/[client]/[projetId]`, clés KV
`chiffrage:*` et `devis:*` — **après vérification qu'aucun devis publié KV
n'est en circulation chez un client** ; sinon la route survit en lecture
seule jusqu'à extinction. `calc.ts` est réécrit autour du nouveau modèle
(base estimates + modificateurs), pas supprimé.

## 8. Skill `devis` — mises à jour induites

- Phase 1 : lit le bloc Chiffrage du projet + les Réglages.
- Phase 3 devient **« challenge + write-back »** : questions manquantes,
  challenge charge/valeur/budget (§4), puis mise à jour de la description du
  projet Linear. La composition ne lit plus que trois sources : issues
  estimées, bloc Chiffrage, Réglages.
- Mode « passe 1 » assumé : avec peu de sources, produire la fourchette et
  le dire, sans simuler une précision qu'on n'a pas.
- Phase 6 : l'adresse du lead vient du bloc Chiffrage ; après envoi validé,
  écrit `envoi:` dans le YAML et propose le commit+push annoncé.
- `references/composition.md` est corrigée selon §5 : montant total unique,
  lignes de périmètre sans prix, prix affiché sur les seules options (et
  l'urgence en valeur absolue), tooltips, « Stack technique recommandée ».
- Ces modifications de skill se font dans `coolbeans-claude-skills`
  (symlinks), avec resynchronisation dotfiles.

## 9. Tests

- `calc` réécrit : base estimates × TJM, chaque modificateur, ordre
  d'application, arrondi (tests unitaires, mocks mémoire existants).
- Parseur du bloc Chiffrage (markdown → objet, tolérant aux champs vides).
- Dérivation des statuts du cockpit.
- API réponse : écriture D1 + mail, et mail seul si D1 échoue.
- Rendu tooltip : présent quand le champ existe, absent sinon.

## 10. Suivi Linear

Chantier rattaché au projet **Portail myCoolbeans**, milestone
**« P10 · Suivi commercial »**. Issues créées via la skill `linear` après
validation de cette spec. La doc `05-chiffrages-et-devis.mdx` est réécrite à
la livraison (convention spec→doc).
