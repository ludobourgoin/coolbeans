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
}

interface Env extends PortalSecrets {}

declare namespace Cloudflare {
  interface Env extends PortalSecrets {}
}
