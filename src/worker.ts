// Point d'entrée du Worker (déclaré via `main` dans wrangler.jsonc).
//
// Le portail client vit sur my.coolbeans.cc avec des URLs propres :
// my.coolbeans.cc/devis est servie en interne par /espace/devis.
// La réécriture se fait ici et non dans le middleware Astro, car les pages
// prérendues (home, /projets/*…) sont servies par la couche assets sans
// jamais passer par le middleware — seul le Worker voit tous les hostnames
// (combiné à `assets.run_worker_first`, cf. wrangler.jsonc).
//
// Règles :
// - my.*/            → /espace (accueil du portail)
// - my.*/<x>         → /espace/<x>, sauf /connexion et /docs/* (servis tels
//   quels : la connexion et la doc font partie du portail mais gardent leurs
//   routes propres) et les chemins internes d'Astro (/_actions, /_image…)
// - my.*/espace/<x>  → 301 vers my.*/<x> (URL canonique sans préfixe)
// - coolbeans.cc/espace/<x> → 301 vers my.coolbeans.cc/<x>
import { handle } from "@astrojs/cloudflare/handler";
import { ouvrirLesDues } from "./lib/portail/messagerie/ouvrir";
import { publierLesDues } from "./lib/portail/messagerie/publier";

const PORTAL_OF: Record<string, string> = {
  "coolbeans.cc": "my.coolbeans.cc",
  "www.coolbeans.cc": "my.coolbeans.cc",
  "staging.coolbeans.cc": "my-staging.coolbeans.cc",
};

const MAIN_OF: Record<string, string> = {
  "my.coolbeans.cc": "coolbeans.cc",
  "my-staging.coolbeans.cc": "staging.coolbeans.cc",
};

const inEspace = (p: string) => p === "/espace" || p.startsWith("/espace/");
const stripEspace = (p: string) => p.slice("/espace".length) || "/";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const { hostname, pathname } = url;

    if (MAIN_OF[hostname]) {
      // Le portail est un espace privé : jamais indexé, quel que soit
      // le robots.txt du site principal.
      if (pathname === "/robots.txt") {
        return new Response("User-agent: *\nDisallow: /\n", {
          headers: { "content-type": "text/plain; charset=utf-8" },
        });
      }
      // Hôte portail : préfixe /espace interdit dans l'URL publique.
      if (inEspace(pathname)) {
        url.pathname = stripEspace(pathname);
        return Response.redirect(url.href, 301);
      }
      const passthrough =
        pathname.startsWith("/_") ||
        pathname.startsWith("/api/") ||
        pathname === "/connexion" ||
      pathname === "/connexion/" ||
        pathname === "/docs" ||
        pathname.startsWith("/docs/");
      if (!passthrough) {
        url.pathname = pathname === "/" ? "/espace" : `/espace${pathname}`;
        request = new Request(url, request);
      }
    } else if (PORTAL_OF[hostname] && inEspace(pathname)) {
      // Hôte principal : l'espace a déménagé sur le sous-domaine.
      url.hostname = PORTAL_OF[hostname];
      url.pathname = stripEspace(pathname);
      return Response.redirect(url.href, 301);
    }

    return handle(request, env, ctx);
  },

  // Publication de la messagerie, cron "*/5 * * * *" : consomme la file
  // pending_publications alimentée par /api/linear-webhook (délai de grâce
  // 3 min → latence effective 3-8 min, assumée par la spec §7).
  async scheduled(controller, env, ctx) {
    const scheduledAt = new Date(controller.scheduledTime).toISOString();
    if (!env.LINEAR_API_KEY || !env.RESEND_API_KEY || !env.PORTAL_DB) {
      console.log(JSON.stringify({ event: "messagerie_publication", status: "skipped_missing_bindings", scheduled_at: scheduledAt }));
      return;
    }
    const options = {
      apiKey: env.LINEAR_API_KEY,
      resendKey: env.RESEND_API_KEY,
      maintenant: new Date().toISOString(),
      baseUrl: env.PORTAL_BASE_URL || "https://my.coolbeans.cc",
    };
    ctx.waitUntil(
      publierLesDues(env.PORTAL_DB, options)
        .then((r) =>
          console.log(JSON.stringify({ event: "messagerie_publication", status: "ok", ...r, scheduled_at: scheduledAt })),
        )
        // Un throw non catché ici disparaîtrait silencieusement (waitUntil
        // n'a personne pour le recueillir) : on le journalise pour ne pas
        // perdre la visibilité sur un cron qui casse.
        .catch((err) =>
          console.log(JSON.stringify({ event: "messagerie_publication", status: "error", message: String(err), scheduled_at: scheduledAt })),
        ),
    );
    // File jumelle : les fils ouverts depuis Linear (label « Support » posé à
    // la main). Deux waitUntil séparés à dessein — une panne sur l'une des
    // deux files ne doit pas empêcher l'autre de tourner.
    ctx.waitUntil(
      ouvrirLesDues(env.PORTAL_DB, options)
        .then((r) =>
          console.log(JSON.stringify({ event: "messagerie_ouverture", status: "ok", ...r, scheduled_at: scheduledAt })),
        )
        .catch((err) =>
          console.log(JSON.stringify({ event: "messagerie_ouverture", status: "error", message: String(err), scheduled_at: scheduledAt })),
        ),
    );
  },
} satisfies ExportedHandler<Env>;
