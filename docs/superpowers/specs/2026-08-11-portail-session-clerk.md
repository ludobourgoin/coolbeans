# S0.9 · Allonger la durée de session Clerk

Action de dashboard, à faire à la main. Ce document en fixe la procédure et signale une
contrainte de plan que le doc master n'avait pas anticipée.

## Pourquoi

Garde-fou 09 : « A2HS, le risque n'est pas le manifest, c'est la session. » Sur iOS, une app
installée depuis l'écran d'accueil a un stockage séparé du navigateur. Si la session Clerk expire,
l'utilisateur retombe sur l'écran de connexion dans une app qu'il croyait « à lui » — et le portail
fabrique de la déception au lieu de la commodité.

## Ne pas confondre avec le `session.lifetime` de la CLI

`clerk config pull` expose une clé `session.lifetime`, **60 secondes par défaut**. C'est la durée de
vie du **jeton JWT**, rafraîchi en continu — pas la durée de la session. L'allonger ne prolonge pas
la connexion et dégrade la révocation. **Ne pas y toucher.**

Les deux réglages qui nous intéressent sont *dashboard-only* : ni la CLI ni la Backend API ne les
exposent.

## Les deux réglages

| Réglage | Ce qu'il fait | Défaut |
| --- | --- | --- |
| **Maximum lifetime** | Expire la session après ce délai, quelle que soit l'activité | **activé, 7 jours** |
| **Inactivity timeout** | Expire la session après ce délai *sans activité* | désactivé |

Clerk interdit de désactiver les deux à la fois.

Le défaut de 7 jours est **exactement** le symptôme décrit par le garde-fou 09 : l'app installée
redemande le login chaque semaine.

## Contrainte de plan — à arbitrer avant de cliquer

D'après la doc Clerk, **une valeur personnalisée de Maximum lifetime exige un plan payant en
production**. C'est gratuit sur l'instance de développement (celle qu'utilise staging), donc :

- **Instance développement** (`ins_3HFrN8lHHgJbgSOFgalJzmYTFaC`, `pk_test_…`, sert staging) :
  réglable tout de suite, sans surcoût.
- **Instance production** (`ins_3HmSQnbS8j0x5HqBCACKZa2U1EO`, `pk_live_…`) : réglable seulement
  sous plan payant.

Cela heurte de front le principe « 0 €/mois » du doc master, qui liste Clerk parmi les free tiers.
Trois issues, à trancher :

1. **Rester à 7 jours en prod** et lancer le pilote comme ça. Le feedback J+14 (critère C3) dira si
   la reconnexion hebdomadaire gêne réellement. C'est l'option qui respecte le principe de coût, et
   elle est réversible.
2. **Passer au plan payant Clerk** pour la prod. Sort du 0 €/mois — décision de coût, pas technique.
3. **Régler seulement le développement** pour valider l'ergonomie en staging (S4.2, installation
   A2HS réelle), et repousser la décision prod au bilan du pilote.

Recommandation : **option 3 maintenant, option 1 au lancement.** Elle permet de tester l'app
installée sans rien payer et repousse la décision au moment où le pilote aura donné une réponse.

## Procédure (dashboard Clerk)

À faire pour chaque instance concernée. L'instance se choisit par le sélecteur en haut de page.

1. Ouvrir <https://dashboard.clerk.com>, application **Coolbeans**.
2. Sélectionner l'instance : **Development** (staging) ou **Production**.
3. Menu latéral → **Configure** → **Sessions**.
4. Section **Maximum lifetime** : porter la valeur à **30 jours**.
5. Laisser **Inactivity timeout** désactivé — un portail consulté une fois par mois ne doit pas
   déconnecter entre deux visites.
6. Enregistrer.

Aucun redéploiement n'est nécessaire : le réglage est côté Clerk.

## Vérification

Le changement ne s'applique qu'aux **nouvelles** sessions : se déconnecter puis se reconnecter, sinon
la session en cours garde son ancienne échéance. Contrôle réel en S4.2, lors de l'installation A2HS
sur iOS et Android : revenir dans l'app installée après plusieurs jours sans être redemandé.
