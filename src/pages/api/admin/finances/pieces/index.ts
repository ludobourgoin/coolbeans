/* Rattacher une pièce, la marquer réglée, annuler son règlement. Sous
   /api/admin/, donc gardée par le middleware. */
import type { APIRoute } from "astro";
import { db } from "../../../../../lib/devis/reponses";
import { PROJETS } from "../../../../../lib/documents/nomenclature";
import { lireAction } from "../../../../../lib/pieces/actions-admin";
import { annulerReglement, marquerReglee, rattacher } from "../../../../../lib/pieces/store";

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
  if (a.action === "rattacher") await rattacher(db(), a.id, a.projet);
  if (a.action === "regler") await marquerReglee(db(), a.id, a.date);
  if (a.action === "annuler-reglement") await annulerReglement(db(), a.id);
  return json({ ok: true });
};
