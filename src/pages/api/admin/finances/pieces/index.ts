/* Rattacher une pièce, la marquer réglée, annuler son règlement. Sous
   /api/admin/, donc gardée par le middleware. Un rattachement ne vise que
   les projets du client de la pièce (spec 2026-10-02, §3). */
import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { db } from "../../../../../lib/devis/reponses";
import { PROJETS } from "../../../../../lib/documents/nomenclature";
import { lireAction, projetsProposes } from "../../../../../lib/pieces/actions-admin";
import { annulerReglement, marquerReglee, pieceParId, rattacher } from "../../../../../lib/pieces/store";

export const prerender = false;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

export const POST: APIRoute = async ({ request }) => {
  let corps: unknown;
  try {
    corps = await request.json();
  } catch {
    corps = null;
  }
  const a = lireAction(corps, Object.keys(PROJETS));
  if ("erreur" in a) return json({ error: a.erreur }, 400);
  if (a.action === "rattacher" && a.projet) {
    const piece = await pieceParId(db(), a.id);
    if (!piece) return json({ error: "Pièce inconnue." }, 404);
    const cles = Object.fromEntries((await getCollection("clients")).map((e) => [e.id, e.data.cle]));
    if (!projetsProposes(piece, cles).includes(a.projet)) {
      return json({ error: `Projet ${a.projet} hors des projets de ce client.` }, 400);
    }
  }
  if (a.action === "rattacher") await rattacher(db(), a.id, a.projet);
  if (a.action === "regler") await marquerReglee(db(), a.id, a.date);
  if (a.action === "annuler-reglement") await annulerReglement(db(), a.id);
  return json({ ok: true });
};
