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
//
// Vide depuis le retrait du sync Asana (S1) : ASANA_PAT et ADMIN_SYNC_SECRET
// étaient les deux seuls. Le squelette reste pour le prochain secret.

interface PortalSecrets {}

interface Env extends PortalSecrets {}

declare namespace Cloudflare {
  interface Env extends PortalSecrets {}
}
