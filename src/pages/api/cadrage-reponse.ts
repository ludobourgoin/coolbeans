import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { Resend } from "resend";
import { getEntry } from "astro:content";
import { renderCadrageConfirmation } from "../../emails/cadrage-confirmation";
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

/* Soumission d'un document de cadrage. Jumeau de /api/devis-reponse, avec
   deux différences assumées :

   - **Aucune écriture en base.** Le mail est la trace. Une table D1 imposerait
     une migration, qui est un geste non parallélisable et qui part en prod dès
     le merge sur staging ; un cadrage ne pilote aucun statut de cockpit et
     n'en a pas besoin (décision du 2026-09-05, COO-188).
   - **Aucun effet Linear.** Pas d'équivalent de `declencherSignature` : un
     cadrage ne valide rien, il informe. Ludo lit et décide. */

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/* Bornes de saisie. Elles existent parce que ce endpoint est ouvert : un POST
   forgé ne doit pas pouvoir composer un mail de dix mégaoctets. */
const MAX_TEXTE = 5000;
const MAX_MESSAGE = 5000;
const MAX_REPONSES = 60;
const MAX_VALEURS = 30;
const MAX_VALEUR = 120;

export const POST: APIRoute = async ({ request }) => {
  const data = await request.json().catch(() => null);
  if (!data || typeof data !== "object") return json({ error: "Requête invalide." }, 400);

  const { slug, reponses, prenom, nom, email, message, consentement } = data as Record<
    string,
    unknown
  >;

  // Slug borné et validé : il sert à relire le YAML et à composer une URL.
  if (typeof slug !== "string" || !/^[a-z0-9-]+(?:\/[a-z0-9-]+)*$/.test(slug) || slug.length > 96) {
    return json({ error: "Requête invalide." }, 400);
  }
  if (
    (typeof prenom === "string" && prenom.length > 100) ||
    (typeof nom === "string" && nom.length > 100) ||
    (typeof email === "string" && email.length > 200)
  ) {
    return json({ error: "Requête invalide." }, 400);
  }
  if (typeof message === "string" && message.length > MAX_MESSAGE) {
    return json({ error: "Message trop long (5 000 caractères max)." }, 400);
  }
  // Prénom obligatoire : il ouvre l'accusé de réception, qui n'a pas de
  // formulation de repli. Nom obligatoire aussi.
  if (typeof prenom !== "string" || !prenom.trim()) {
    return json({ error: "Merci de renseigner votre prénom." }, 400);
  }
  if (typeof nom !== "string" || !nom.trim()) {
    return json({ error: "Merci de renseigner votre nom." }, 400);
  }
  // Le consentement conditionne l'envoi : la case du formulaire ne protège que
  // le navigateur, un POST direct doit être refusé de la même façon.
  if (consentement !== true) {
    return json({ error: "Merci d'accepter la conservation de vos informations." }, 400);
  }
  // L'email sert d'adresse de réponse ET de destinataire de l'accusé.
  if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return json({ error: "Merci de renseigner un email valide." }, 400);
  }

  /* Réponses brutes : uniquement des identifiants et des saisies libres. Tout
     est borné avant d'atteindre `reponsesLisibles`, qui écartera de toute
     façon les valeurs absentes du questionnaire. */
  const brutes: ReponseBrute[] = Array.isArray(reponses)
    ? reponses
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

  /* Le document est relu ici : c'est lui qui fait foi sur les libellés. Le
     navigateur n'envoie que des identifiants, jamais le texte d'une question
     ni celui d'une option, même règle que les prix du devis, qui ne
     remontent jamais depuis une page publique. */
  const doc = await getEntry("cadrage", slug).catch(() => undefined);
  if (!doc) {
    console.error(`cadrage-reponse: document ${slug} introuvable dans la collection`);
    return json({ error: "Document introuvable." }, 404);
  }

  const lisibles = reponsesLisibles(doc.data.questions as QuestionCadrage[], brutes);
  const { decisives, autres } = trierParPoids(lisibles);

  const prenomLead = prenom.trim();
  const nomLead = nom.trim();
  const emailLead = email.trim();
  const messageLead = typeof message === "string" && message.trim() ? message.trim() : undefined;

  /* Trace du consentement : sans base de données, l'email de notification est
     le seul endroit où il en reste une preuve horodatée. */
  const traceConsentement = "Accord&eacute; via le formulaire de cadrage";

  const paires = (rs: typeof lisibles): Array<[string, string]> =>
    rs.map((r) => [esc(r.question), esc(r.reponse)] as [string, string]);

  const html = renderTransactionnel({
    preheader: `Cadrage complété · ${esc(doc.data.titre)}`,
    kicker: `Cadrage · ${esc(slug)}`,
    titre: doc.data.titre,
    contenu: [
      kv([
        ["Prénom", esc(prenomLead)],
        ["Nom", esc(nomLead)],
        ["Email", esc(emailLead)],
        ["Consentement", traceConsentement],
      ]),
      /* Les réponses qui déplacent le chiffrage passent en premier et sous
         leur propre titre. Sur neuf questions, les trois qui décident du prix
         ne doivent pas se lire au même rang que les six autres : une liste
         plate se parcourt en diagonale, et c'est exactement là qu'on rate
         l'information qui valait le questionnaire. */
      decisives.length ? titreSection("Ce qui décide du chiffrage") + qr(paires(decisives)) : "",
      autres.length ? titreSection("Le reste des réponses") + qr(paires(autres)) : "",
      messageLead
        ? titreSection("Message") + citation(esc(messageLead).replace(/\n/g, "<br>"))
        : titreSection("Message") + p("(pas de message)"),
    ].join(""),
    cta: {
      // Pas d'encodeURIComponent : le slug porte un slash, que l'encodage
      // casserait. La regex ci-dessus borne déjà les caractères possibles.
      label: "Voir le document",
      url: `https://coolbeans.cc/cadrage/${slug}`,
    },
    piedContexte: "R&eacute;ponses re&ccedil;ues via la page publique de cadrage.",
  });

  const ligneTexte = (r: (typeof lisibles)[number]) => `- ${r.question}\n  ${r.reponse}`;

  try {
    const resend = new Resend(env.RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from: "Cadrage Coolbeans <devis@coolbeans.cc>",
      to: "ludo@coolbeans.cc",
      replyTo: emailLead,
      subject: `Cadrage ${slug} · ${prenomLead} ${nomLead}`,
      html,
      text: [
        `Cadrage : ${slug}`,
        `Document : ${doc.data.titre}`,
        `Prénom : ${prenomLead}`,
        `Nom : ${nomLead}`,
        `Email : ${emailLead}`,
        "Consentement : accordé via le formulaire de cadrage",
        "",
        ...(decisives.length
          ? ["CE QUI DÉCIDE DU CHIFFRAGE", ...decisives.map(ligneTexte), ""]
          : []),
        ...(autres.length ? ["LE RESTE DES RÉPONSES", ...autres.map(ligneTexte), ""] : []),
        messageLead ?? "(pas de message)",
      ].join("\n"),
    });

    if (error) throw error;

    /* Accusé de réception au lead. Un échec ici ne doit pas faire échouer la
       requête : les réponses sont déjà arrivées chez Ludo, c'est ce qui
       compte. */
    const confirmation = renderCadrageConfirmation({
      slug,
      prenom: prenomLead,
      titre: doc.data.titre,
      reponses: lisibles,
      message: messageLead,
      tutoiement: doc.data.tutoiement,
    });

    const { error: erreurConfirmation } = await resend.emails.send({
      from: "Ludo de Coolbeans <devis@coolbeans.cc>",
      to: emailLead,
      replyTo: "ludo@coolbeans.cc",
      subject: confirmation.subject,
      html: confirmation.html,
      text: confirmation.text,
    });
    if (erreurConfirmation) {
      console.error("cadrage-reponse: accusé de réception non envoyé", erreurConfirmation);
    }

    return json({ ok: true }, 200);
  } catch (err) {
    console.error("cadrage-reponse: envoi Resend échoué", err);
    return json({ error: "Envoi impossible, réessaie dans un instant." }, 502);
  }
};
