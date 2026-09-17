import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { Resend } from "resend";
import { getEntry } from "astro:content";
import { renderTemoignageConfirmation } from "../../emails/temoignage-confirmation";
import {
  citation,
  esc,
  kv,
  p,
  renderTransactionnel,
  qr,
  titreSection,
} from "../../emails/transactionnel";
import {
  reponsesLisibles,
  trierParPoids,
  type QuestionCadrage,
  type ReponseBrute,
} from "../../lib/cadrage";

export const prerender = false;

/* Soumission d'une page de témoignage. Cousin de /api/cadrage-reponse, dont il
   reprend le moteur de traduction des réponses, avec deux différences :

   - **Multipart, et non JSON.** La photo de profil voyage dans la même
     requête que les réponses. Un second appel obligerait à gérer un envoi
     partiellement réussi, exactement sur le geste où le client a déjà donné
     dix minutes de son temps.
   - **La photo part en R2 ET en pièce jointe du mail.** R2 est la copie
     durable, la pièce jointe évite d'écrire une route de téléchargement
     authentifiée pour une photo par projet. Sans elle, il faudrait une table
     et une migration, c'est-à-dire un geste non parallélisable qui part en
     prod dès le merge sur staging.

   Comme le cadrage : aucune écriture en base, aucun effet Linear. Le mail est
   la trace, Ludo lit et décide. */

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const MAX_TEXTE = 5000;
const MAX_MESSAGE = 5000;
const MAX_REPONSES = 60;
const MAX_VALEURS = 30;
const MAX_VALEUR = 120;
/* 8 Mo : une photo de téléphone non retouchée pèse rarement plus, et Resend
   plafonne l'ensemble d'un message à 40 Mo. Au-delà, le refus est explicite
   plutôt que silencieux. */
const MAX_PHOTO = 8 * 1024 * 1024;
const TYPES_PHOTO = ["image/jpeg", "image/png", "image/webp", "image/avif", "image/heic"];

/** Base64 par tranches : `String.fromCharCode(...tableau)` dépasse la pile
 *  d'appels bien avant 8 Mo, et l'échec arrive au moment de l'envoi. */
const base64 = (buffer: ArrayBuffer) => {
  const octets = new Uint8Array(buffer);
  let binaire = "";
  for (let i = 0; i < octets.length; i += 0x8000) {
    binaire += String.fromCharCode(...octets.subarray(i, i + 0x8000));
  }
  return btoa(binaire);
};

/** Nom de fichier réduit à ce qui peut vivre dans une clé R2 et un en-tête. */
const nomSur = (nom: string) =>
  nom
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .slice(-80) || "photo";

export const POST: APIRoute = async ({ request }) => {
  const fd = await request.formData().catch(() => null);
  if (!fd) return json({ error: "Requête invalide." }, 400);

  const champ = (nom: string) => {
    const v = fd.get(nom);
    return typeof v === "string" ? v : "";
  };

  const slug = champ("slug");
  const prenom = champ("prenom").trim();
  const nom = champ("nom").trim();
  const email = champ("email").trim();
  const message = champ("message").trim();
  const consentement = champ("consentement") === "true";

  if (!/^[a-z0-9-]+(?:\/[a-z0-9-]+)*$/.test(slug) || slug.length > 96) {
    return json({ error: "Requête invalide." }, 400);
  }
  if (prenom.length > 100 || nom.length > 100 || email.length > 200) {
    return json({ error: "Requête invalide." }, 400);
  }
  if (message.length > MAX_MESSAGE) {
    return json({ error: "Message trop long (5 000 caractères max)." }, 400);
  }
  if (!prenom) return json({ error: "Merci de renseigner votre prénom." }, 400);
  if (!nom) return json({ error: "Merci de renseigner votre nom." }, 400);
  if (!consentement) {
    return json({ error: "Merci d'accepter la conservation de vos informations." }, 400);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: "Merci de renseigner un email valide." }, 400);
  }

  let brutes: ReponseBrute[] = [];
  try {
    const parsees = JSON.parse(champ("reponses") || "[]");
    brutes = Array.isArray(parsees)
      ? parsees
          .slice(0, MAX_REPONSES)
          .filter((r): r is Record<string, unknown> => !!r && typeof r === "object")
          .map((r) => ({
            question: typeof r.question === "string" ? r.question.slice(0, 80) : "",
            valeurs: Array.isArray(r.valeurs)
              ? r.valeurs
                  .filter((v): v is string => typeof v === "string")
                  .slice(0, MAX_VALEURS)
                  .map((v) => v.slice(0, MAX_VALEUR))
              : undefined,
            texte: typeof r.texte === "string" ? r.texte.slice(0, MAX_TEXTE) : undefined,
          }))
      : [];
  } catch {
    return json({ error: "Requête invalide." }, 400);
  }

  /* Le document fait foi sur les libellés : le navigateur n'a envoyé que des
     identifiants, même règle que le cadrage et que les prix du devis. */
  const doc = await getEntry("temoignage", slug).catch(() => undefined);
  if (!doc) {
    console.error(`temoignage-reponse: document ${slug} introuvable dans la collection`);
    return json({ error: "Document introuvable." }, 404);
  }

  const photo = fd.get("photo");
  const aUnePhoto = photo instanceof File && photo.size > 0;
  if (aUnePhoto) {
    if (photo.size > MAX_PHOTO) {
      return json({ error: "Photo trop lourde (8 Mo maximum)." }, 400);
    }
    if (!TYPES_PHOTO.includes(photo.type)) {
      return json({ error: "Format de photo non reconnu (JPG, PNG, WEBP ou HEIC)." }, 400);
    }
  }
  if (doc.data.photo?.requis && !aUnePhoto) {
    return json({ error: "Merci de joindre une photo." }, 400);
  }

  const lisibles = reponsesLisibles(doc.data.questions as QuestionCadrage[], brutes);
  const { decisives, autres } = trierParPoids(lisibles);

  /* La photo est lue une seule fois : le flux d'un File ne se rejoue pas, et
     il en faut deux copies, une pour R2 et une pour la pièce jointe. */
  let cleR2: string | undefined;
  let piecesJointes: Array<{ filename: string; content: string }> | undefined;
  if (aUnePhoto) {
    const fichier = photo as File;
    const buffer = await fichier.arrayBuffer();
    const nomFichier = nomSur(fichier.name);
    cleR2 = `temoignage/${slug}/${Date.now()}-${nomFichier}`;
    try {
      await env.PORTAL_FILES.put(cleR2, buffer, { httpMetadata: { contentType: fichier.type } });
    } catch (err) {
      /* Un échec R2 ne doit pas perdre la photo : la pièce jointe suffit à ce
         que Ludo l'ait. On le signale sans faire échouer la soumission. */
      console.error("temoignage-reponse: dépôt R2 échoué", err);
      cleR2 = undefined;
    }
    piecesJointes = [{ filename: nomFichier, content: base64(buffer) }];
  }

  const paires = (rs: typeof lisibles): Array<[string, string]> =>
    rs.map((r) => [esc(r.question), esc(r.reponse)] as [string, string]);

  const html = renderTransactionnel({
    preheader: `Témoignage reçu · ${esc(doc.data.titre)}`,
    kicker: `Témoignage · ${esc(slug)}`,
    titre: doc.data.titre,
    contenu: [
      kv([
        ["Prénom", esc(prenom)],
        ["Nom", esc(nom)],
        ["Email", esc(email)],
        ["Consentement", "Accord&eacute; via la page de t&eacute;moignage"],
        ["Photo", aUnePhoto ? "En pi&egrave;ce jointe" : "Aucune"],
        ...(cleR2 ? ([["Copie R2", esc(cleR2)]] as Array<[string, string]>) : []),
      ]),
      /* Ce qui finira cité sur la page publique passe en premier : le reste
         est du contexte, et une liste plate se parcourt en diagonale. */
      decisives.length ? titreSection("Ce qui peut être cité") + qr(paires(decisives)) : "",
      autres.length ? titreSection("Le reste des réponses") + qr(paires(autres)) : "",
      message
        ? titreSection("Message") + citation(esc(message).replace(/\n/g, "<br>"))
        : titreSection("Message") + p("(pas de message)"),
    ].join(""),
    cta: {
      label: "Voir le document",
      url: `https://coolbeans.cc/temoignage/${slug}`,
    },
    piedContexte: "R&eacute;ponses re&ccedil;ues via la page publique de t&eacute;moignage.",
  });

  const ligneTexte = (r: (typeof lisibles)[number]) => `- ${r.question}\n  ${r.reponse}`;

  try {
    const resend = new Resend(env.RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from: "Témoignage Coolbeans <devis@coolbeans.cc>",
      to: "ludo@coolbeans.cc",
      replyTo: email,
      subject: `Témoignage ${slug} · ${prenom} ${nom}`,
      html,
      attachments: piecesJointes,
      text: [
        `Témoignage : ${slug}`,
        `Document : ${doc.data.titre}`,
        `Prénom : ${prenom}`,
        `Nom : ${nom}`,
        `Email : ${email}`,
        "Consentement : accordé via la page de témoignage",
        `Photo : ${aUnePhoto ? "en pièce jointe" : "aucune"}`,
        ...(cleR2 ? [`Copie R2 : ${cleR2}`] : []),
        "",
        ...(decisives.length ? ["CE QUI PEUT ÊTRE CITÉ", ...decisives.map(ligneTexte), ""] : []),
        ...(autres.length ? ["LE RESTE DES RÉPONSES", ...autres.map(ligneTexte), ""] : []),
        message || "(pas de message)",
      ].join("\n"),
    });

    if (error) throw error;

    /* Accusé de réception. Un échec ici ne fait pas échouer la requête : les
       réponses sont déjà arrivées, c'est ce qui compte. */
    const confirmation = renderTemoignageConfirmation({
      slug,
      prenom,
      titre: doc.data.titre,
      reponses: lisibles,
      message: message || undefined,
      tutoiement: doc.data.tutoiement,
      avecPhoto: aUnePhoto,
    });

    const { error: erreurConfirmation } = await resend.emails.send({
      from: "Ludo de Coolbeans <devis@coolbeans.cc>",
      to: email,
      replyTo: "ludo@coolbeans.cc",
      subject: confirmation.subject,
      html: confirmation.html,
      text: confirmation.text,
    });
    if (erreurConfirmation) {
      console.error("temoignage-reponse: accusé de réception non envoyé", erreurConfirmation);
    }

    return json({ ok: true }, 200);
  } catch (err) {
    console.error("temoignage-reponse: envoi Resend échoué", err);
    return json({ error: "Envoi impossible, réessayez dans un instant." }, 502);
  }
};
