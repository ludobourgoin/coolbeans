# Passation, refonte du gabarit des documents client

Écrit le 2026-09-22 pour la session qui reprendra le travail depuis le dépôt `coolbeans`. La conception s'est faite depuis une session ouverte sur `dev/cafa`, d'où cette passation.

## Le travail

Implémenter `docs/superpowers/specs/2026-09-22-documents-client-entete-design.md`. Lire la spec en entier avant toute chose, elle fait 240 lignes et porte onze décisions.

Le point de départ : sur un document à onglets, tout l'en-tête changeait au changement d'onglet, ce qui fait croire à une navigation. La refonte va bien au-delà du correctif.

## État du dépôt

Branche `staging`, **quatre commits non poussés**, tous sur la spec :

```
4d2a865  les trois états d'un document
f7acea9  passe au propre après arbitrages
5672ffa  pastilles à l'échelle de l'image OG, numérotées
04b3dd2  première version de la spec
```

Deux fichiers non commités **m'appartiennent** :

- `src/pages/apercu-gabarit.astro`, page jetable qui a servi à tous les arbitrages visuels. À supprimer une fois l'implémentation faite, ou tout de suite si elle gêne.
- `src/components/ui/Badge.astro`, variante `green` ajoutée. Elle ne sert plus, la frise a son propre composant. À retirer si personne n'en veut.

**Tous les autres fichiers modifiés ou non suivis ne sont pas de moi** : `revolutions-douces.yaml`, les `docs/*.mdx`, les brouillons, `.vscode`. Ne pas les commiter.

## Décisions encore ouvertes

Rien de bloquant pour commencer, tout bloquant pour finir.

- Qui renomme les huit projets Linear listés en section 4 de la spec, Ludo ou l'assistant
- Les deux projets de Mathilde Chevalier sont à fusionner dans Linear
- La revue de confidentialité des quatre gabarits, section 9, à faire avant ou pendant
- `littlebox`, `miharu`, `veronique-berthet` : mappings supposés, à confirmer avec Ludo
- La collision entre le filet de 3 px et `EnvBanner`, qui occupe la même place en dev et en préproduction

## Pièges rencontrés pendant la conception

**L'alignement de la nav des sections.** La liste porte `width: max-content` pour déborder et déclencher le défilement latéral. Elle ne peut donc pas porter `margin-inline: auto`, qui la centre au lieu de l'aligner. Il faut un bloc parent qui porte la colonne de 880 px. Erreur commise deux fois. Vérifier par mesure, pas à l'œil : tous les éléments doivent partir de la même abscisse.

**Le hook `relire-francais.mjs` ne distingue pas la prose du code.** Il a bloqué sur un ternaire JavaScript, en lisant son point d’interrogation comme une ponctuation française qui appellerait une espace fine. Et une correction passée en aveugle sur un fichier entier a glissé des espaces insécables à l'intérieur d'expressions JavaScript. Ne jamais appliquer la correction typographique à un fichier de code sans épargner le frontmatter, les expressions entre accolades et les blocs `<style>`.

**Le HMR d'Astro décroche** quand un fichier est réécrit plusieurs fois depuis l'extérieur de l'éditeur : la page se sert sans aucune feuille de style, sans erreur dans les logs. Relancer le serveur.

**Deux serveurs de dev peuvent coexister** sur le port 4321 sans le dire. `npx astro dev stop` avant d'en lancer un autre.

## Règles de la maison à ne pas perdre

- **Jamais de publication en production sans ordre explicite de Ludo.** La préproduction est libre.
- Ton direct, pas de flatterie, signaler les failles de raisonnement même non sollicité. Écrire court.
- Avant une tâche lourde, pré-vol en une ligne, estimation qualitative, et attendre le feu vert. Celle-ci est 🔴 lourde.
- Pas de suppression ni de renommage de fichier sans confirmation.

## Hors périmètre

Le rangement de `/dev` en dossiers client contenant leurs projets est suivi dans **COO-232**, avec l'inventaire des chemins en dur à traiter avant tout déplacement. Ne pas l'entamer ici.

## Prochaine étape

Si Ludo a validé la spec, invoquer la skill `superpowers:writing-plans` pour produire le plan d'implémentation. Ne pas écrire de code avant.
