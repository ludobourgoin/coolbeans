// Ajout d'un document depuis la vue admin : dépôt de fichier vers R2, ou lien
// externe. Réservé à l'admin, et toujours créé MASQUÉ (spec §3).
//
// Le nom d'origine du fichier ne sert JAMAIS de clé R2 (traversée, collisions,
// caractères exotiques) : il est conservé en base pour l'affichage, comme dans
// la messagerie.

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { getPortalContext } from "../../../lib/portail/context";
import { isAdmin } from "../../../lib/portail/metadata";
import { creerDocument, type DocumentRow } from "../../../lib/portail/documents/store";

export const prerender = false;

const MAX_TAILLE = 25 * 1024 * 1024; // 25 Mo

function cleR2(client: string, filename: string): string {
  const ext = /\.([a-zA-Z0-9]+)$/.exec(filename)?.[1]?.toLowerCase() ?? "bin";
  return `documents/${client}/${crypto.randomUUID()}.${ext}`;
}

function jour(valeur: FormDataEntryValue | null): string {
  const brut = typeof valeur === "string" ? valeur.trim() : "";
  return /^\d{4}-\d{2}-\d{2}$/.test(brut) ? brut : new Date().toISOString().slice(0, 10);
}

export const POST: APIRoute = async (context) => {
  const { user, meta, client } = await getPortalContext(context);
  if (!user || !isAdmin(meta) || !client) return new Response("Introuvable", { status: 404 });

  const form = await context.request.formData();
  const maintenant = new Date().toISOString();
  const base = {
    id: crypto.randomUUID(),
    client: client.slug,
    visible: 0, // toujours masqué à la création
    cree_le: maintenant,
    cle_source: null,
    date_doc: jour(form.get("date")),
  };

  const fichier = form.get("fichier");
  const lien = typeof form.get("url") === "string" ? String(form.get("url")).trim() : "";
  const titreSaisi = typeof form.get("titre") === "string" ? String(form.get("titre")).trim() : "";

  let ligne: DocumentRow;

  if (fichier instanceof File && fichier.size > 0) {
    if (fichier.size > MAX_TAILLE) {
      return new Response("Fichier trop lourd (25 Mo maximum).", { status: 400 });
    }
    const cle = cleR2(client.slug, fichier.name);
    await env.PORTAL_FILES.put(cle, fichier.stream(), {
      httpMetadata: { contentType: fichier.type || "application/octet-stream" },
    });
    ligne = {
      ...base,
      titre: titreSaisi || fichier.name,
      source: "fichier",
      r2_key: cle,
      url: null,
      mime: fichier.type || "application/octet-stream",
      taille: fichier.size,
    };
  } else if (lien) {
    let url: URL;
    try {
      url = new URL(lien);
    } catch {
      return new Response("Adresse invalide.", { status: 400 });
    }
    // Un `javascript:` ou un `data:` enregistré ici deviendrait un lien
    // cliquable servi depuis le portail.
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return new Response("Seules les adresses http et https sont acceptées.", { status: 400 });
    }
    ligne = {
      ...base,
      titre: titreSaisi || url.hostname,
      source: "lien",
      r2_key: null,
      url: url.toString(),
      mime: null,
      taille: null,
    };
  } else {
    return new Response("Il faut un fichier ou une adresse.", { status: 400 });
  }

  await creerDocument(env.PORTAL_DB, ligne);
  return context.redirect("/espace/projets/documents", 303);
};
