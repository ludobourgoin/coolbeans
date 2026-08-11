// Secrets du Worker, absents de `worker-configuration.d.ts`.
//
// Ce dernier est régénéré par `wrangler types` à partir de wrangler.jsonc et
// de .dev.vars — or les secrets ne sont dans ni l'un ni l'autre, par
// construction : ils sont posés par `wrangler secret put` (cf.
// .dev.vars.example). Sans cette déclaration, `env.ASANA_PAT` ne compile pas
// alors que la valeur existe bien à l'exécution.
//
// Optionnels à dessein : rien ne garantit qu'un secret ait été posé sur un
// environnement donné, et le code doit gérer son absence (le handler
// `scheduled` trace justement les manquants au lieu de planter).
//
// Les deux interfaces sont augmentées : `Env` est celle que voit
// `ExportedHandler<Env>` dans src/worker.ts, `Cloudflare.Env` celle des
// consommateurs Astro (`Astro.locals.runtime.env`).
//
// Toute nouvelle entrée ici doit rester un secret : les valeurs publiques
// vont dans `vars` de wrangler.jsonc, où wrangler sait les typer seul.

interface PortalSecrets {
  /** Personal Access Token Asana (Bearer) — sync du module Projets. */
  ASANA_PAT?: string;
  /** Secret partagé protégeant POST /api/admin/sync (brief §8). */
  ADMIN_SYNC_SECRET?: string;
}

interface Env extends PortalSecrets {}

declare namespace Cloudflare {
  interface Env extends PortalSecrets {}
}
