/* Approfondit le clone git avant la compilation, quand il est superficiel.
 *
 * Cloudflare Workers Builds clone en `--depth=1`. `git log -n 40` n'y rend
 * donc qu'une seule empreinte, et le compteur de commits d'avance de la bande
 * d'environnement (components/ui/EnvBanner.astro) dégrade en « écart inconnu ».
 * L'alerte visuelle fonctionne quand même, mais le décompte disparaît.
 *
 * Ce script ne s'exécute que là où il sert : sur un clone complet, en local,
 * il constate et sort sans rien faire, sans accès réseau.
 *
 * Il ne peut pas faire échouer une compilation. Pas de git, pas de réseau,
 * dépôt sans distant, jeton absent : il sort en 0 dans tous les cas. Un
 * compteur manquant se répare ; un déploiement bloqué un vendredi soir, non.
 */
import { execSync } from "node:child_process";

const git = (commande) =>
  execSync(`git ${commande}`, { stdio: ["ignore", "pipe", "ignore"] })
    .toString()
    .trim();

try {
  if (git("rev-parse --is-shallow-repository") !== "true") {
    process.exit(0);
  }
  // Soixante commits : largement au-delà des quarante que lit EnvBanner, et
  // assez court pour ne pas rallonger la compilation de façon sensible.
  git("fetch --deepen=60");
  console.log(`clone approfondi : ${git("rev-list --count HEAD")} commits disponibles`);
} catch {
  // Silence volontaire, voir l'en-tête.
}
