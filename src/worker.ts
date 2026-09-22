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
// - coolbeans.cc/connexion  → 302 vers my.coolbeans.cc/connexion (une seule
//   page de connexion, celle du portail)
import { handle } from "@astrojs/cloudflare/handler";
import { ouvrirLesDues } from "./lib/portail/messagerie/ouvrir";
import { publierLesDues } from "./lib/portail/messagerie/publier";
import { synchroniserLivraisons } from "./lib/livraisons/sync";

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
    } else if (PORTAL_OF[hostname]) {
      // Hôte principal : l'espace a déménagé sur le sous-domaine.
      if (inEspace(pathname)) {
        url.hostname = PORTAL_OF[hostname];
        url.pathname = stripEspace(pathname);
        return Response.redirect(url.href, 301);
      }
      // Une seule page de connexion, et elle est sur le portail. Servir
      // /connexion ici aussi donnait deux formulaires pour un même compte :
      // celui du site posait le cookie sur coolbeans.cc puis renvoyait vers
      // /espace, donc sur my.*, qui ne le voyait pas — la connexion semblait
      // échouer sans jamais dire pourquoi. Le cookie est désormais partagé
      // (lib/auth/options.ts), ce qui suffirait ; cette redirection ne laisse
      // en plus qu'une seule adresse à retenir et à mettre en favori.
      //
      // 302 et non 301 : un 301 se grave dans le navigateur, et on ne veut pas
      // rendre irréversible le choix d'héberger la connexion sur my.*.
      if (pathname === "/connexion" || pathname === "/connexion/") {
        url.hostname = PORTAL_OF[hostname];
        // Le middleware a posé `redirect_url` en URL ABSOLUE sur l'hôte
        // principal (cas de /docs/<projet>, protégé et servi ici aussi). La
        // page de connexion refuse une destination d'une autre origine que la
        // sienne — à raison, c'est ce qui la protège d'une redirection
        // ouverte. Sans ce report d'hôte, la destination serait simplement
        // perdue et le client atterrirait sur l'accueil du portail.
        const suite = url.searchParams.get("redirect_url");
        if (suite) {
          try {
            const cible = new URL(suite);
            if (PORTAL_OF[cible.hostname]) {
              cible.hostname = PORTAL_OF[cible.hostname];
              url.searchParams.set("redirect_url", cible.href);
            }
          } catch {
            // Paramètre illisible : on le laisse tel quel, la page de
            // connexion le rejettera et repartira sur /espace.
          }
        }
        return Response.redirect(url.href, 302);
      }
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
    // Calendrier Livraisons : le cron tourne toutes les 5 minutes, la
    // synchronisation ne s'exécute qu'au premier passage de chaque heure.
    // Production uniquement : sans les secrets Google la tâche se saute, ce
    // qui évite que staging et prod se disputent le même agenda.
    if (new Date(controller.scheduledTime).getUTCMinutes() < 5) {
      if (!env.LINEAR_API_KEY || !env.GOOGLE_SA_EMAIL || !env.GOOGLE_SA_PRIVATE_KEY || !env.GOOGLE_CALENDAR_LIVRAISONS_ID) {
        console.log(JSON.stringify({ event: "livraisons_sync", status: "skipped_missing_secrets", scheduled_at: scheduledAt }));
      } else {
        ctx.waitUntil(
          synchroniserLivraisons({
            apiKey: env.LINEAR_API_KEY,
            email: env.GOOGLE_SA_EMAIL,
            clePriveeBase64: env.GOOGLE_SA_PRIVATE_KEY,
            calendarId: env.GOOGLE_CALENDAR_LIVRAISONS_ID,
          })
            .then((r) =>
              console.log(JSON.stringify({ event: "livraisons_sync", status: "ok", ...r, scheduled_at: scheduledAt })),
            )
            .catch((err) =>
              console.log(JSON.stringify({ event: "livraisons_sync", status: "error", message: String(err), scheduled_at: scheduledAt })),
            ),
        );
      }
    }
  },
} satisfies ExportedHandler<Env>;
