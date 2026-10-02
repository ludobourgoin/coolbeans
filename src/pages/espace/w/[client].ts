// Bascule de workspace par URL, posée le 2026-10-02 pour les boutons du Stream Deck.
//
// Le sélecteur du portail bascule par une Action en POST (src/actions/index.ts,
// `choisirWorkspace`). Un bouton Stream Deck ne sait faire qu'un GET : aucun
// raccourci ne pouvait donc ouvrir le workspace d'un client donné, et un bouton
// vers /espace tombait sur le dernier client choisi. Un libellé « SET » qui
// ouvre le portail d'Amusoire est un piège, pas un raccourci.
//
// Une requête GET pose donc un cookie. Ce n'est pas pur, et c'est déjà le parti
// pris de src/pages/docs/[client]/[...slug].astro : une préférence d'affichage,
// sans effet sur les données.
//
// Garde identique à celle de l'Action : session, puis rôle admin. Un compte
// client n'a de toute façon qu'un seul workspace, la route ne lui sert à rien.
// Elle répond 404 et non 403, comme la route de pièce jointe de la messagerie :
// la réponse ne dit pas si le slug existe.

import type { APIRoute } from "astro";
import { getPortalContext } from "../../../lib/portail/context";
import { WORKSPACE_COOKIE } from "../../../lib/portail/current-workspace";
import { isAdmin } from "../../../lib/portail/metadata";
import { portalHref } from "../../../lib/portail/nav";
import { getWorkspace } from "../../../lib/portail/workspaces";

export const prerender = false;

/* Une Response ne se consomme qu'une fois : on en construit une par requête
   plutôt que d'en partager une seule entre tous les appels. */
const introuvable = () => new Response("Introuvable", { status: 404 });

export const GET: APIRoute = async (context) => {
  const { user, meta } = await getPortalContext(context);
  if (!user || !isAdmin(meta)) return introuvable();

  const cible = await getWorkspace(context.params.client);
  if (!cible) return introuvable();

  context.cookies.set(WORKSPACE_COOKIE, cible.slug, {
    path: "/",
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });

  // L'accueil du workspace, jamais la page d'où l'on vient : le Stream Deck
  // n'a pas de page d'origine, et revenir sur une page de doc relancerait la
  // règle « l'URL gagne » de la route de doc, qui réécrirait le cookie.
  //
  // portalHref et non "/espace" en dur : sur my.coolbeans.cc le portail est à
  // la racine, et le worker renvoie /espace/... en 301 vers la forme sans
  // préfixe. Un chemin codé en dur marcherait, au prix d'un aller-retour
  // inutile et d'une URL non canonique dans la barre d'adresse.
  return context.redirect(portalHref("/", context.url.hostname), 302);
};
