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
  // Le handler ne synchronise pas lui-même : il appelle la route Astro
  // /api/admin/sync via `handle()`. La liste des teams se lit dans le registre
  // des clients (src/content/clients/*.yaml) via `astro:content`, dont la
  // résolution depuis ce point d'entrée custom — hors du bundle serveur
  // d'Astro — n'est pas garantie. Passer par la route lève l'incertitude et
  // laisse un seul chemin de code pour le sync.
  //
  // `handle()` est un appel de fonction, pas un fetch : aucun subrequest.
  //
  // Un secret manquant est la panne la plus probable au premier déploiement
  // (les `wrangler secret put` sont un geste manuel). On trace sa présence,
  // jamais sa valeur — critère d'acceptation 6.
  async scheduled(controller, env, ctx) {
    const scheduledAt = new Date(controller.scheduledTime).toISOString();
    const secret = env.ADMIN_SYNC_SECRET;

    if (!secret || !env.ASANA_PAT || !env.PORTAL_KV) {
      console.log(
        JSON.stringify({
          event: "portal_sync",
          status: "skipped_missing_bindings",
          cron: controller.cron,
          scheduled_at: scheduledAt,
          bindings: {
            portal_kv: Boolean(env.PORTAL_KV),
            asana_pat: Boolean(env.ASANA_PAT),
            admin_sync_secret: Boolean(secret),
          },
        }),
      );
      return;
    }

    // L'hôte n'a pas d'importance : /api/* est en passthrough dans le handler
    // fetch ci-dessus, et la route ne lit pas le hostname.
    //
    // `content-type: application/json` n'est pas décoratif : sans en-tête
    // `origin` ET sans content-type, le middleware CSRF natif d'Astro
    // (`security.checkOrigin`, actif par défaut) rejette toute requête
    // POST/PUT/PATCH/DELETE en 403 AVANT d'atteindre la route — donc avant
    // même le contrôle du secret. Un content-type qui n'est pas un type
    // « formulaire » (`application/x-www-form-urlencoded`, `multipart/form-data`,
    // `text/plain`) fait sortir cette requête interne du champ de ce contrôle,
    // quelle que soit l'origine. Sans lui, le cron ne synchroniserait jamais
    // rien (constaté en local : cf. task-7-report.md).
    const request = new Request("https://my.coolbeans.cc/api/admin/sync", {
      method: "POST",
      headers: { "x-admin-sync-secret": secret, "content-type": "application/json" },
    });

    const res = await handle(request, env, ctx);
    console.log(
      JSON.stringify({
        event: "portal_sync",
        status: res.ok ? "done" : "failed",
        http_status: res.status,
        cron: controller.cron,
        scheduled_at: scheduledAt,
      }),
    );
  },
} satisfies ExportedHandler<Env>;
