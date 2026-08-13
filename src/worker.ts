// Point d'entrée du Worker (déclaré via `main` dans wrangler.jsonc).
//
// Le portail client vit sur my.coolbeans.cc avec des URLs propres :
// my.coolbeans.cc/chiffrages est servie en interne par /espace/chiffrages.
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

  // Sync du portail client, cron "*/5 * * * *" (cf. wrangler.jsonc).
  //
  // Squelette, à nouveau : le sync Asana livré en S1 a été retiré (l'outil de
  // gestion de projet est passé à Linear) et son remplaçant est un chantier
  // séparé, à ouvrir une fois Linear paramétré. Le handler ne fait donc que
  // tracer son passage et l'état de ses dépendances.
  //
  // Il reste en place plutôt que d'être supprimé parce que le cron de
  // wrangler.jsonc, lui, est conservé : un trigger sans handler échoue à
  // chaque tick. C'est aussi le point d'accroche du futur sync Linear.
  async scheduled(controller, env, _ctx) {
    const scheduledAt = new Date(controller.scheduledTime).toISOString();

    console.log(
      JSON.stringify({
        event: "portal_sync",
        status: "skipped_not_implemented",
        cron: controller.cron,
        scheduled_at: scheduledAt,
        bindings: {
          portal_kv: Boolean(env.PORTAL_KV),
        },
      }),
    );
  },
} satisfies ExportedHandler<Env>;
