# Portail client Coolbeans — décisions, specs et recommandations

**Statut :** décisions arrêtées, prêt à découper
**Date :** 17 août 2026
**Auteur des décisions :** Ludo
**Objet :** consolider la stratégie, les specs fonctionnelles et les décisions techniques du portail client `my.coolbeans.cc`, en vue de la création des issues Linear.

---

## 0. Instruction pour Claude Code

Ce document est la source de vérité produit du portail client. À partir de lui :

1. Crée les projets et issues Linear selon le découpage proposé en **section 8**. Respecte la séquence et les dépendances indiquées.
2. Chaque issue doit reprendre les critères d'acceptation de la section 3 ou 4 correspondante, pas un résumé.
3. Ne crée **aucune issue** pour la section 9 (questions ouvertes) : ce sont des décisions qui appartiennent à Ludo. Crée à la place une seule issue « Arbitrages en attente » qui les liste.
4. Les sections 1, 2 et 5 sont des invariants. Ne les transforme pas en issues, mais rattache-les au projet parent comme document de référence, et vérifie que chaque issue les respecte.
5. Si un point te semble contradictoire ou sous-spécifié, crée l'issue quand même et ajoute une note `⚠️ à préciser` plutôt que d'inventer.

---

## 1. Positionnement (invariant, ne pas perdre de vue)

Le portail n'est pas le produit. Le produit est : **quelqu'un surveille votre site en continu, vous dit quoi faire, et rien ne se perd.** Le portail est la preuve que ce travail existe.

Conséquences qui contraignent toutes les décisions produit :

- **Ne jamais vendre une liste de features.** Messagerie + tickets + doc + monitoring + analytics est un descriptif qui met Coolbeans en comparaison frontale avec Notion, Basecamp et ClickUp. Cette comparaison se perd. Vendre le résultat.
- **Glissement de positionnement assumé :** de la prestation de développement vers l'accompagnement en marketing digital piloté par la donnée. On ne livre pas un site, on l'exploite et on l'optimise. C'est le point de valeur business le plus élevé de l'offre et il doit transparaître partout : vocabulaire, contenu des emails, structure de la page de vente.
- **Le coût marginal par client doit baisser, pas monter.** Toute feature qui ajoute du travail manuel récurrent par client est un coût déguisé en stratégie. Critère de validation de toute automatisation : peut-elle servir 40 clients aussi bien que 5.
- **Règle absolue : la détection est automatisée, l'envoi est validé par un humain.** Rien ne part chez un client sans que Ludo l'ait relu. C'est ce qui distingue une observation d'un mail marketing.
- **Pas de notification creuse.** La valeur du canal vient de sa rareté et de sa justesse. Un seul email vide et les taux d'ouverture s'effondrent, l'actif est mort. Pas de constat = pas d'envoi. Aucun badge, aucune gamification, aucune relance artificielle.
- **Le portail a une valeur même sans visite client.** C'est déjà l'outil de travail de Ludo (retrouver une info d'API trois mois plus tard). Ne pas sur-concevoir pour un engagement qui ne viendra pas chez certains clients.

---

## 2. Architecture des flux : trois boucles

Le portail n'est pas un ensemble de pages, c'est trois boucles qui tournent. Toute feature doit se rattacher à l'une d'elles.

### Boucle entrante (client → Ludo)
Le client a une demande. Elle passe par la **messagerie du portail**, qui est la source de vérité unique du suivi projet et support. Elle atterrit dans **Linear Triage**. Le statut redevient visible côté client.

> **Règle de discipline, non négociable :** si un client écrit par email, Slack ou WhatsApp, Ludo répond « je le remonte dans ton portail » et crée le ticket lui-même. Sans cette discipline, l'affirmation « le portail est la source de vérité » est fausse et l'outil perd sa raison d'être.

### Boucle sortante (Ludo → client)
Un événement est détecté (observation, livraison, document ajouté, opportunité, échéance). Il génère un brouillon. Ludo valide. Un **email Resend** part, sobre, signé, et **renvoie systématiquement vers la page correspondante du portail**.

> Précision suite à discussion : l'email n'est pas le canal des demandes, c'est le canal des notifications sortantes. Personne ne se connecte spontanément à un portail. Les deux affirmations ne se contredisent pas, elles décrivent deux directions.

### Boucle documentaire (tout → doc)
Toute information produite dans les deux boucles précédentes finit dans la doc client : réponse à une question, feature ajoutée, fix, mapping technique, décision. Puis « j'ai ajouté X à ta doc, c'est ici ».

> C'est le levier le plus fiable et le moins cher : la doc est déjà utilisée intensivement par 2 clients, précisément parce qu'elle répond à une question au moment où elle se pose. Cette boucle industrialise ce constat.

---

## 3. Modules

### 3.1 Documentation client
**État :** existant, très utilisé, à renforcer.

- Conserver la convention d'en-tête déjà en place : statut (`WIP` / `Final`) + date de mise à jour. Une doc périmée fait plus de mal qu'une absence de doc.
- Recherche full-text (⌘K) sur l'ensemble de la doc du client.
- **Automatisme à créer :** toute issue Linear passée en `Done` qui touche une feature documentée déclenche une tâche de mise à jour de la page de doc concernée (voir 4.3).
- Contenu à couvrir systématiquement : infos d'API, mappings inter-outils (ex. Webflow → Make → HubSpot), variables d'environnement non secrètes, procédures, périmètre inclus / hors périmètre.
- Export de la doc (PDF ou markdown) disponible côté client. Sert la confiance et l'histoire de sortie (voir 5.4).

**Critères d'acceptation :** recherche fonctionnelle, statut + date affichés sur chaque page, export disponible, lien profond vers une page citable dans un email.

---

### 3.2 Messagerie et ticketing
**État :** existant (formulaire de support).

- Source de vérité unique de l'entrant. Objet + description → **Linear Triage**, avec identification automatique du client et du projet.
- Le client voit ses demandes : `Reçue` / `En cours` / `En validation` / `Résolue`. Pas les états internes Linear.
- Fil de discussion par demande, pour éviter le retour vers l'email.
- **Délai de réponse annoncé** visible sur la page (répond à la FAQ « sous quel délai aurai-je une réponse »). L'annoncer engage, donc le calibrer sur la réalité.
- **À la clôture :** notification « résolu », avec ce qui s'est passé, ce qui a été changé, et le lien vers l'entrée de doc correspondante. Chaque incident devient une démonstration de valeur.

**Critères d'acceptation :** création d'un ticket Linear en < 5 s, mapping d'état correct, notification de clôture rédigée et validée avant envoi, fil consultable.

---

### 3.3 Liens et comptes de services
**État :** page « Liens utiles » en WIP. À prioriser, gros irritant client identifié.

Le client perd un temps considérable à retrouver ses accès. Le portail devient l'annuaire unique.

Pour chaque service (Mailchimp, Google Search Console, GA4, Cloudflare, OVH / Ionos, HubSpot, Make, Webflow, Resend…) :

| Champ | Contenu |
|---|---|
| Service | Nom + logo |
| URL | Lien direct vers le dashboard du client, pas la home du service |
| Propriétaire du compte | Client ou Coolbeans, explicitement |
| Rôle de Ludo | Admin / éditeur / aucun |
| Échéance | Date de renouvellement si applicable (domaine, abonnement) |
| Contact | Support du service ou référent |

- **Alertes automatiques d'échéance** (haute valeur, très peu de code) : expiration de nom de domaine à J-60 / J-30 / J-7, expiration de certificat SSL, expiration du moyen de paiement sur les abonnements critiques quand l'info est accessible. Un domaine qui expire est un sinistre évitable et un email d'alerte vaut à lui seul l'abonnement.
- **Aucun mot de passe ni secret stocké dans le portail.** Voir 4.4.

**Critères d'acceptation :** annuaire complet par client, alertes d'échéance domaine et SSL fonctionnelles, aucun secret en base.

---

### 3.4 Historique des modifications (changelog automatique depuis Linear)
**État :** à créer. Idée validée avec enthousiasme.

**Principe :** chaque issue passée en `Done` alimente le changelog du client, dans un langage sobre, structuré et non technique.

**Architecture :**
1. Webhook Linear sur changement d'état vers `Done`, filtré par label ou projet mappé à un client.
2. Le contenu client provient d'une **section dédiée `## Client` dans la description de l'issue**, rédigée par Ludo. Convention à adopter dès maintenant, y compris sur les issues en cours.
3. Si la section est absente, un brouillon est généré à partir du titre, de la description et du diff, puis mis en file de validation.
4. **Aucune publication automatique brute.** Les titres Linear contiennent du langage interne, des raccourcis, parfois des formulations qui n'ont rien à faire chez un client. Le garde-fou humain est obligatoire.
5. Publication **groupée en digest hebdomadaire**, pas une notification par issue. Une notification par ticket clos détruirait la rareté du canal.
6. Chaque entrée renvoie vers la page de doc mise à jour correspondante.

**Format d'une entrée :** date, titre en langage métier, une à trois phrases sur ce qui change concrètement pour le client, lien doc, et le cas échéant « à faire de votre côté ».

**Critères d'acceptation :** webhook opérationnel, file de validation avec édition avant publication, digest hebdo groupé, zéro publication automatique non relue.

---

### 3.5 Moteur d'observations (analytics et monitoring)
**État :** à créer. C'est le cœur de l'offre et le module le plus structurant.

**Contrainte posée par Ludo, qui commande toute l'architecture :** il est hors de question de passer 2 à 3 heures par site et par mois à chercher manuellement les données pertinentes. Sans automatisation de la détection, la feature ne peut pas être proposée par défaut sur tout le parc.

**Réponse architecturale :** voir 4.1 (taxonomie d'événements standardisée) et 4.2 (pipeline de détection). Le point clé est que la standardisation du tracking est ce qui rend l'analyse générique. Sans taxonomie commune, chaque site demande une analyse sur mesure et on revient à 3 h par site.

**Sources de données à collecter par site :**

- Événements du site (taxonomie standard, voir 4.1)
- Google Search Console API : impressions, clics, position moyenne, requêtes émergentes ou perdues
- Core Web Vitals : CrUX API (données terrain) et PageSpeed Insights API (données labo)
- Disponibilité : sondes uptime
- Formulaires : volume de soumissions, taux de complétion, erreurs
- État technique : dépendances obsolètes, erreurs 4xx/5xx, liens morts
- Échéances (voir 3.3)

**Ce que le client doit lire :** jamais « uptime 99,9 % » ou « LCP 2,4 s ». Toujours l'effet business. « La page Réserver convertit à 3,2 %, en baisse depuis la refonte du 12 » est lisible par un dirigeant. La métrique technique est la cause, pas le message.

**Critères d'acceptation :** collecte automatisée sur tout le parc, détection par règles explicites, temps de validation humaine < 10 min par semaine pour l'ensemble des clients, zéro email envoyé une semaine sans constat.

---

### 3.6 File d'opportunités détectées
**État :** à créer. Validé sans réserve. C'est l'upsell productisé.

**Principe :** le portail affiche « N recommandations en attente de votre avis ». Le client vient voir ce que Ludo a trouvé.

**Structure d'une opportunité :**

| Champ | Contenu |
|---|---|
| Constat | Le fait observé, chiffré, daté |
| Recommandation | Ce qu'on propose de faire |
| Impact estimé | En langage business, avec ordre de grandeur honnête |
| Effort | Fourchette de temps |
| Prix indicatif | Fourchette, pas un devis |
| Validité | Date d'expiration de l'offre |

**Cycle de vie :** `Brouillon` → `Proposée` → `Intéressé` → `Devisée` → `Acceptée` / `Déclinée` / `Expirée`.

**Comportement du bouton « ça m'intéresse » :** il **n'émet pas de devis automatique**. Il ouvre un fil dans la messagerie. La conversation précède le chiffrage. Le devis chiffré arrive ensuite et le projet est créé dans Linear. Décision explicite de Ludo, à respecter.

**Sur l'urgence et la rareté :** le levier est légitime mais sur une relation récurrente il ne pardonne pas l'artifice. Une date d'expiration inventée qui se répète est repérée en trois occurrences et détruit la crédibilité de tout le canal. La rareté doit être réelle et vérifiable : « créneau de production réservé jusqu'au 12 septembre », adossé à sa capacité effective. Formuler l'échéance en termes de capacité, jamais en termes de promotion commerciale.

**Origine des opportunités :** générées par le moteur d'observations (3.5) ou saisies manuellement par Ludo depuis la vue admin. Même objet, même cycle de vie. Le moteur d'observations et la file d'opportunités sont **un seul pipeline**, pas deux features : constat → recommandation → validation → proposition → conversation → devis.

**Critères d'acceptation :** création manuelle et automatique, validation obligatoire avant exposition au client, bouton qui ouvre un fil messagerie, suivi du taux d'acceptation et du CA généré.

---

### 3.7 Suivi commercial
**État :** à créer (« Chiffrages » présent dans la navigation admin).

Les chiffres qui engagent sont consultés. C'est un moteur de retour fiable.

- Devis : émis, en attente, acceptés, déclinés, avec date de validité
- Acomptes : demandés, réglés, en attente
- Factures : passées, réglées, à venir, avec échéances
- Le cas échéant : budget ou heures consommées sur un forfait, et solde restant

**Règles :** lecture seule côté client. Aucune action de paiement dans le portail au premier temps. La source de vérité reste l'outil de facturation (voir question ouverte 9.3), le portail est un miroir.

**Critères d'acceptation :** synchronisation automatique avec l'outil de facturation, aucun écart possible entre les deux, historique complet.

---

### 3.8 Suivi de production (board projet)
**État :** à créer (« Projets / Actifs / Terminés » en WIP).

- Un board par projet, alimenté depuis Linear, sur le portail du client.
- **Mapping obligatoire des états :** les états internes Linear ne sont pas exposés. Trois ou quatre colonnes côté client maximum : `À venir` / `En cours` / `En validation` / `Livré`.
- **Ne jamais exposer :** estimations internes, commentaires internes, priorités internes, noms d'issues techniques bruts.
- Objectif affiché : chacun sait où on en est, rien ne se perd, pas de fuite d'information dans un fil Slack vieux d'une semaine.

**Critères d'acceptation :** synchronisation Linear temps réel ou quasi, mapping d'états respecté, aucune donnée interne visible.

---

### 3.9 Documents et assets
**État :** à créer. Stockage Cloudflare R2 déjà arbitré.

- Bibliothèque par client : logos (vectoriels inclus), chartes, photos, contrats, livrables, exports.
- **Upload depuis la vue admin de Ludo sur le portail du client.** Pas d'outil séparé.
- **Notification différée de 15 minutes après le dernier ajout**, groupée : un seul email listant tous les fichiers ajoutés dans la fenêtre, avec lien vers la page « Documents ». Le délai sert de fenêtre de regroupement et permet de corriger une erreur avant l'envoi.
- Versionnage simple : conserver la version précédente d'un fichier remplacé.
- **Aucun identifiant ni secret déposé ici.** Voir 4.4.

**Critères d'acceptation :** upload admin fonctionnel, débounce de 15 min avec regroupement, un seul email par lot, liens signés à durée de vie limitée pour le téléchargement.

---

### 3.10 Checklists de procédures
**État :** à créer.

Autant de checklists que le client a de procédures techniques récurrentes :

- Publier un nouvel article de blog
- Mettre à jour le site sans casser la qualité pro
- Soumettre le sitemap XML sur Google Search Console
- Audit de performance et lecture des Core Web Vitals
- Ajouter une page au site
- Modifier des prix ou des offres
- Préparer une opération saisonnière

**Comportement :** cases à cocher dynamiques persistées par client, bouton `Reset` en bas de liste, et **horodatage de la dernière exécution avec le nom de la personne**. L'historique d'exécution est plus utile que l'état courant.

**Effet secondaire à exploiter :** une checklist complétée est un signal pour Ludo. « Le client vient de publier un article » déclenche une vérification automatique quelques jours plus tard (indexation, performance de la page), qui peut devenir une observation ou une opportunité. Brancher les complétions sur le moteur d'observations.

**Critères d'acceptation :** persistance par client, reset, historique daté et nominatif, événement émis à la complétion.

---

### 3.11 Couche de notifications (transverse)
**État :** à créer. Resend déjà en place.

**Trois types, à ne pas mélanger :**

| Type | Exemples | Fréquence | Désabonnable |
|---|---|---|---|
| Transactionnel | Ticket résolu, documents ajoutés, alerte d'échéance, incident | À l'événement | Non (opérationnel) |
| Digest | Changelog hebdo, observations, leads non traités | Hebdo ou mensuel | Oui |
| Opportunité | Nouvelle recommandation | À l'événement, plafonnée | Oui |

**Règles :**
- Plafond de fréquence par client, tous types confondus. À calibrer, ordre de grandeur : pas plus de deux emails par semaine hors incident.
- Regroupement systématique quand plusieurs événements tombent dans la même fenêtre.
- **Digest vide = pas d'envoi.**
- Tout email renvoie vers la page correspondante du portail.
- Rédaction sobre, factuelle, en français, signée Ludo, brandée Coolbeans. Pas de vocabulaire marketing, pas de ton commercial générique.
- Validation humaine avant envoi pour tout ce qui contient une analyse ou une recommandation. Les notifications purement transactionnelles peuvent partir sans validation.

**Critères d'acceptation :** plafond de fréquence appliqué, regroupement fonctionnel, aucun digest vide envoyé, file de validation utilisable en quelques minutes.

---

## 4. Décisions techniques

### 4.1 Tracking : ne pas déployer GTM, standardiser une taxonomie d'événements

Trois questions posées par Ludo, trois réponses.

**Le poids sur le chargement des pages.** Un conteneur GTM plus la balise GA4 représente typiquement 100 à 150 Ko de JavaScript tiers, exécuté au chargement. Une solution analytics légère (Plausible, Umami, Cloudflare Web Analytics) est de l'ordre du kilooctet. Sur des sites vitrines dont l'argument est la qualité pro et les Core Web Vitals, le surcoût GTM est difficile à défendre.

**Faut-il passer par le compte GTM du client.** La question devient sans objet, parce que **la recommandation est de ne pas utiliser GTM du tout**. GTM existe pour permettre à une équipe marketing non technique d'ajouter des balises sans déploiement. Ce besoin n'existe pas ici : c'est Ludo qui pose le tracking, et il déploie en quelques minutes via Claude Code. GTM ajoute donc du poids, une dépendance à une interface et une source de vérité hors du dépôt, pour un bénéfice nul dans ce contexte.

**Claude Code peut-il gérer le tracking technique en fonction du parcours utilisateur.** Oui, et c'est nettement meilleur en code qu'en interface. Les événements deviennent versionnés, relisibles, testables, reproductibles d'un site à l'autre, et modifiables par instruction.

**Décision structurante, c'est le point le plus important de cette section :**

> Créer une **taxonomie d'événements standard**, identique sur tous les sites maintenus, packagée dans une petite librairie interne (`@coolbeans/track` ou équivalent), déployée par défaut sur chaque projet.

Sans elle, chaque site demande une analyse sur mesure et le coût par site reste à 2-3 h. Avec elle, **une seule requête fonctionne sur tout le parc**, et le moteur d'observations devient générique. C'est ce qui transforme une prestation artisanale en feature livrée par défaut.

**Taxonomie minimale à définir** (à affiner, mais elle doit être figée avant tout déploiement) :

- `page_view` (avec type de page normalisé : accueil, offre, contenu, conversion)
- `form_start`, `form_submit`, `form_error` (avec identifiant de formulaire normalisé)
- `cta_click` (avec emplacement et destination normalisés)
- `outbound_click`
- `scroll_depth` sur les pages longues
- `tool_interaction` pour les composants sur mesure (simulateur ROI, etc.)
- Un ensemble commun de propriétés : identifiant de site, type de page, source de trafic, appareil

**Propriété des comptes.** Les propriétés GA4 et Search Console doivent appartenir au **compte du client**, avec Ludo en administrateur. Trois raisons : le client possède ses données, cela évite tout litige en fin de relation, et c'est un argument de confiance à afficher sur la page de vente. Coolbeans ne détient pas les données de ses clients en otage.

**Point réglementaire à arbitrer par client.** En France, GA4 en configuration standard nécessite un bandeau de consentement, et le taux de refus fait perdre une part significative des données, souvent plusieurs dizaines de pour cent. Une solution d'audience cookieless correctement configurée peut relever de l'exemption de consentement CNIL, ce qui donne des données plus complètes et supprime le bandeau. À vérifier au cas par cas au regard des critères d'exemption en vigueur. Le choix dépend surtout de la dépendance du client à Google Ads : s'il fait de l'acquisition payante, GA4 reste nécessaire. Sinon, l'alternative cookieless est probablement supérieure sur tous les plans.

**Recommandation par défaut :** événements en code via le package interne, envoyés vers une solution cookieless, plus GA4 en complément uniquement chez les clients qui font de l'acquisition payante.

**Critères d'acceptation :** taxonomie documentée et figée, package interne publié, déployé sur au moins deux sites pilotes, données interrogeables par API de façon identique sur les deux.

---

### 4.2 Pipeline du moteur d'observations

**Objectif chiffré :** moins de 10 minutes de travail humain par semaine pour produire les observations de l'ensemble du parc.

**Chaîne :**

1. **Collecte planifiée** (cron Cloudflare Worker) : appel des API par site, stockage des séries normalisées.
2. **Détection par règles explicites**, jamais par appréciation. Comparaison de la période N contre N-1 et contre la médiane des 8 dernières semaines, avec seuils écrits.
3. **Filtre de significativité, obligatoire :** un seuil de volume minimal en dessous duquel aucune variation ne déclenche de constat. Sur un site à faible trafic, une variation de 40 % est du bruit statistique, et envoyer une alerte dessus détruit la crédibilité du dispositif plus vite que n'importe quoi d'autre.
4. **Rédaction :** un LLM met en forme à partir des faits structurés déjà calculés. Jamais l'inverse. Le modèle rédige, il ne mesure pas et il n'interprète pas librement.
5. **File de validation** dans la vue admin : Ludo lit, corrige, écarte ou valide. Un clic par constat.
6. **Envoi groupé.** Pas de constat validé cette semaine = pas d'email.

**Exemples de règles de détection à implémenter :**

- Chute du taux de conversion d'une page de conversion au-delà de X % avec volume suffisant
- Perte de position moyenne sur une requête qui générait plus de N clics
- Dégradation d'un Core Web Vital franchissant un seuil Google
- Apparition de pages en erreur ou désindexées
- Formulaire dont le taux d'erreur augmente (symptôme classique de régression silencieuse)
- Baisse de trafic sur une page qui en générait beaucoup
- Écart anormal entre visiteurs uniques et soumissions de formulaire
- Échéance approchant (domaine, SSL, abonnement)

Chaque règle déclenchée produit un constat, et un constat peut être promu en opportunité (3.6).

**Critères d'acceptation :** exécution planifiée fiable, règles et seuils versionnés et documentés, filtre de significativité actif, file de validation utilisable en quelques minutes, aucun envoi non validé.

---

### 4.3 Automatisation du changelog depuis Linear

Voir 3.4 pour le fonctionnel. Points techniques :

- Webhook Linear sur transition d'état, filtré par label client ou projet.
- Table de correspondance projet Linear ↔ client portail.
- Convention de rédaction : section `## Client` dans la description de l'issue. À adopter immédiatement, avant même le développement, pour que le corpus existe quand l'automatisation arrive.
- Génération de brouillon en cas d'absence de section `## Client`.
- File de validation partagée avec le moteur d'observations : une seule interface de validation pour tout ce qui part au client.
- Mise à jour de doc déclenchée par le même événement, quand l'issue porte un label indiquant qu'elle touche une feature documentée.

---

### 4.4 Sécurité et données

- **Aucun mot de passe, clé d'API ou secret client stocké dans le portail ou dans R2.** Le portail stocke des liens, des noms de comptes, des rôles et des échéances. Les secrets vont dans un gestionnaire de mots de passe avec coffre partagé. Un portail multi-clients qui centralise des identifiants est une cible et un risque de responsabilité disproportionné par rapport au service rendu.
- Isolation stricte des données entre clients, à tester explicitement (un client ne doit jamais pouvoir atteindre les ressources d'un autre par manipulation d'URL ou d'identifiant).
- Liens de téléchargement R2 signés et à durée de vie limitée.
- Journal des accès et des actions administratives.
- Rôles : `admin` (Ludo), `client` (accès à son périmètre uniquement). Prévoir plusieurs utilisateurs par client dès le modèle de données.

---

## 5. Règles transverses

### 5.1 Validation humaine
Tout contenu analytique, éditorial ou commercial destiné à un client passe par une file de validation. Seules les notifications strictement transactionnelles partent sans relecture.

### 5.2 Ton et forme
Sobre, factuel, français, signé Ludo, brandé Coolbeans. Un constat, une recommandation, une action possible. Pas de superlatifs, pas de vocabulaire d'agence, pas de mise en forme surchargée.

### 5.3 Périmètre du « gratuit à vie »
Le portail est offert et inclus dans les projets, à vie. Cette promesse est irréversible en pratique : la retirer un jour sera un événement de confiance négatif. À 40 clients, la charge est réelle.

**À écrire noir sur blanc avant de le vendre** : ce qui est inclus (accès, doc, documents, changelog, board, liens), et ce qui ne l'est pas (temps d'intervention, corrections hors garantie, développements). Voir question ouverte 9.4.

Le module doit être conçu pour pouvoir **basculer en offre payante** plus tard sans réécriture, même s'il est offert au départ. C'est la seule ligne de revenu qui survivra à la compression du prix des projets.

### 5.4 Fin de relation
Prévoir et **annoncer** ce qui se passe si le client part : export de la doc, transfert des accès, restitution des documents. L'annoncer sur la page de vente réduit la peur de l'enfermement et renforce la confiance, à l'inverse du réflexe de rétention.

---

## 6. Page de vente dédiée

**Angle :** le résultat, pas les features. « Quelqu'un surveille votre site en continu, vous dit quoi faire, et rien ne se perd. »

**À éviter absolument :** la liste « messagerie, tickets, documentation, monitoring, analytics ». Elle place Coolbeans en comparaison directe avec des outils gratuits ou à 10 € par mois, et cette comparaison se perd sur le terrain des fonctionnalités.

**Structure recommandée :**

1. La promesse en une phrase, orientée résultat.
2. Les trois irritants qu'on supprime : l'information perdue dans les mails et Slack, les accès introuvables, l'absence de visibilité sur ce qui a été fait et sur ce que le site produit.
3. Ce que le client reçoit concrètement, formulé en bénéfices datés : un point régulier sur ce que son site produit, des recommandations chiffrées, un historique de tout ce qui a été livré, ses accès et ses documents au même endroit.
4. La preuve : captures du portail réel, extraits d'observations réelles anonymisées.
5. Les garanties : vous possédez vos comptes et vos données, aucun secret stocké, export et sortie possibles à tout moment.
6. Inclus dans tout projet Coolbeans, à vie.

---

## 7. Mesure

Ne pas mesurer les visites. C'est une métrique de vanité sur un portail B2B.

**Métriques qui comptent :**

| Métrique | Pourquoi | Cible à poser |
|---|---|---|
| Actions initiées par le client / mois | Mesure l'usage réel | À définir |
| Taux de réponse aux opportunités | Valide la thèse d'upsell | > 20 % serait bon |
| CA généré par les opportunités | Le seul juge de paix | À définir |
| Temps passé par site / mois | **Doit baisser** | < 30 min |
| Demandes arrivant hors canal | Mesure la discipline du 2.1 | Tendre vers 0 |
| Emails ouverts / cliqués | Santé du canal sortant | Surveiller la dérive |

**Test de falsification, à faire tôt :** vingt observations réelles envoyées à des clients existants. Si elles produisent zéro réponse et zéro conversation commerciale, la thèse est fausse et il vaut mieux le savoir après une semaine qu'après six mois de développement.

---

## 8. Découpage Linear proposé

### Séquence recommandée

Le chemin critique est le **tracking standardisé** (P5) : il conditionne le moteur d'observations, il doit être déployé site par site, donc il paie tard. Le lancer tôt, en parallèle des gains rapides.

**Vague 1, gains rapides et fondations (semaines 1-3)**
- P0 Fondations : multi-tenant, rôles, vue admin par client, isolation testée
- P1 Liens et comptes de services + alertes d'échéance
- P3 Documents et assets (R2 + notification différée 15 min)
- P5 Tracking : définir et figer la taxonomie, publier le package, déployer sur 2 sites pilotes

**Vague 2, boucles de suivi (semaines 3-6)**
- P2 Messagerie et board de production (mapping d'états, Triage)
- P4 Changelog automatique depuis Linear + convention `## Client`
- P9 Couche de notifications (plafond, regroupement, file de validation partagée)
- P6 Checklists de procédures

**Vague 3, le cœur de l'offre (semaines 6-12)**
- P7 Moteur d'observations (collecte, règles, significativité, rédaction, validation)
- P8 File d'opportunités
- P10 Suivi commercial

**Vague 4**
- P11 Page de vente
- P12 Documentation et export, histoire de sortie

### Projets Linear à créer

| Code | Projet | Dépend de |
|---|---|---|
| P0 | Portail — fondations et multi-tenant | — |
| P1 | Portail — liens et comptes de services | P0 |
| P2 | Portail — messagerie et suivi de production | P0 |
| P3 | Portail — documents et assets | P0 |
| P4 | Portail — changelog automatique Linear | P0, P9 |
| P5 | Tracking standardisé Coolbeans | — |
| P6 | Portail — checklists de procédures | P0 |
| P7 | Moteur d'observations | P5, P9 |
| P8 | File d'opportunités | P7, P2 |
| P9 | Couche de notifications et file de validation | P0 |
| P10 | Portail — suivi commercial | P0 |
| P11 | Page de vente du portail | P1..P8 |
| P12 | Sortie, export et périmètre contractuel | P0 |

### Labels suggérés
`portail`, `client-facing`, `automatisation`, `tracking`, `notification`, `validation-requise`, `sécurité`, `commercial`

---

## 9. Questions ouvertes (décision de Ludo requise, ne pas trancher à sa place)

1. **Réponses aux emails de notification.** Où arrive un email auquel un client répond directement ? Vérifier les capacités de réception entrante de Resend. À défaut : `reply-to` vers la boîte de Ludo, avec conversion manuelle en ticket pour préserver la règle du canal unique.
2. **Analytics par client :** cookieless exemptable, GA4, ou les deux. Dépend de la dépendance de chaque client à Google Ads. Décider une règle par défaut plutôt qu'un arbitrage à chaque fois.
3. **Source de vérité de la facturation.** Quel outil, et quelle API pour alimenter 3.7.
4. **Périmètre exact du « gratuit à vie ».** Ce qui est inclus, ce qui ne l'est pas, et le délai de réponse annoncé sur la page Support. À figer avant de le vendre.
5. **Hébergement et modèle de données du portail.** Isolation, sauvegardes, restauration.
6. **Fréquence des digests :** hebdomadaire ou mensuelle. Le mensuel préserve mieux la rareté, l'hebdomadaire crée mieux l'habitude. Peut-être hebdo pour les leads et le changelog, mensuel pour les observations de fond.

---

## Annexe — Points de vigilance issus de la discussion

- **La stratégie repose entièrement sur le fait que Ludo comprenne les systèmes de ses clients mieux qu'eux.** Elle est incompatible avec l'habitude de ne pas relire le code livré. Le conseil ne se vend pas sur un système qu'on ne comprend pas.
- **Le portail est un actif, pas un centre de coût, à condition qu'il fasse baisser le coût marginal par client.** Surveiller la métrique « temps passé par site et par mois ».
- **Certains clients ne se connecteront jamais.** Leur valeur reste servie par les emails et par le fait que Ludo, lui, retrouve l'information. Ne pas sur-investir dans l'engagement de ces comptes.
- **Ne pas construire à la place de vendre.** La fenêtre d'avance technique actuelle sert à financer des positions durables, pas à s'optimiser elle-même.
