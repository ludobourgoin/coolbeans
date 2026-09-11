// Secrets du Worker, absents de `worker-configuration.d.ts`.
//
// Ce dernier est régénéré par `wrangler types` à partir de wrangler.jsonc et
// de .dev.vars — or les secrets ne sont dans ni l'un ni l'autre, par
// construction : ils sont posés par `wrangler secret put` (cf.
// .dev.vars.example). Sans une déclaration ici, `env.<SECRET>` ne compile pas
// alors que la valeur existe bien à l'exécution.
//
// Optionnels à dessein : rien ne garantit qu'un secret ait été posé sur un
// environnement donné, et le code doit gérer son absence.
//
// Les deux interfaces sont augmentées : `Env` est celle que voit
// `ExportedHandler<Env>` dans src/worker.ts, `Cloudflare.Env` celle des
// consommateurs Astro (`Astro.locals.runtime.env`).
//
// Toute nouvelle entrée ici doit rester un secret : les valeurs publiques
// vont dans `vars` de wrangler.jsonc, où wrangler sait les typer seul.

interface PortalSecrets {
  /**
   * Clé API Linear (personnelle, workspace coolbeans-hq) : création des
   * tickets support depuis /api/support (COO-30). `wrangler secret put
   * LINEAR_API_KEY` sur chaque environnement, `.dev.vars` en local.
   */
  LINEAR_API_KEY?: string;

  /**
   * Secret de signature du webhook Linear (Settings → API → Webhooks) :
   * vérification HMAC-SHA256 dans /api/linear-webhook. `wrangler secret put
   * LINEAR_WEBHOOK_SECRET` sur chaque environnement, `.dev.vars` en local.
   */
  LINEAR_WEBHOOK_SECRET?: string;

  /**
   * Clé API Resend : envoi des emails transactionnels du portail (support,
   * devis, messagerie — dont le cron de publication de
   * lib/portail/messagerie/publier.ts). `wrangler secret put RESEND_API_KEY`
   * sur chaque environnement, `.dev.vars` en local.
   */
  RESEND_API_KEY?: string;

  /**
   * Secret de signature de Better Auth (sessions et jetons) : `wrangler
   * secret put BETTER_AUTH_SECRET` sur chaque environnement, `.dev.vars` en
   * local. Une valeur differente par environnement — la partager reviendrait
   * a rendre une session de staging valable en production.
   */
  BETTER_AUTH_SECRET?: string;

  /**
   * Compte de service Google (adresse en @...iam.gserviceaccount.com) : écriture
   * du calendrier Livraisons depuis le cron. `wrangler secret put
   * GOOGLE_SA_EMAIL`, production uniquement.
   */
  GOOGLE_SA_EMAIL?: string;

  /**
   * Clé privée PEM du compte de service, encodée en base64 pour survivre au
   * passage d'une valeur multiligne en secret. `wrangler secret put
   * GOOGLE_SA_PRIVATE_KEY`, production uniquement.
   */
  GOOGLE_SA_PRIVATE_KEY?: string;

  /**
   * Identifiant du calendrier Google « Livraisons » (Paramètres du calendrier
   * > Intégrer le calendrier). `wrangler secret put
   * GOOGLE_CALENDAR_LIVRAISONS_ID`, production uniquement.
   */
  GOOGLE_CALENDAR_LIVRAISONS_ID?: string;
}

interface Env extends PortalSecrets {}

declare namespace Cloudflare {
  interface Env extends PortalSecrets {}
}
