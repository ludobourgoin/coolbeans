import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { Resend } from "resend";
import {
  renderConfirmationQuestion,
  renderConfirmationValidation,
} from "../../emails/devis-confirmation";
import {
  citation,
  esc,
  kv,
  p,
  renderTransactionnel,
  titreSection,
} from "../../emails/transactionnel";
import { getEntry } from "astro:content";
import { montantAffiche, budgetDevis, totaux, eur, lignesRetenues } from "../../lib/devis";
import { derniereReponse, enregistrerReponse } from "../../lib/devis/reponses";
import { declencherSignature, type ResultatSignature } from "../../lib/devis/signature";

export const prerender = false;

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

export const POST: APIRoute = async ({ request }) => {
  const data = await request.json().catch(() => null);
  if (!data || typeof data !== "object") return json({ error: "Requête invalide." }, 400);

  const {
    slug,
    reponse,
    prenom,
    nom,
    email,
    message,
    consentement,
    raisonSociale,
    siren,
    adresse,
    tva,
    options,
  } = data as Record<string, unknown>;
  /* Index des options cochées. Bornés et entiers : ils servent à filtrer les
     lignes du YAML, et un tableau non contrôlé arrive ici depuis une page
     publique. Une valeur hors périmètre est simplement ignorée au calcul —
     `lignesRetenues` ne retient jamais qu'une ligne réellement `optionnel`. */
  const optionsRecues: number[] | undefined = Array.isArray(options)
    ? options.filter((v): v is number => Number.isInteger(v) && v >= 0 && v < 200).slice(0, 100)
    : undefined;
  // Slug borné et validé : il est persisté en D1 et pilote le statut affiché
  // dans le cockpit — un POST forgé ne doit pas pouvoir y injecter n'importe
  // quoi ni des valeurs sans limite de taille.
  if (
    typeof slug !== "string" ||
    !/^[a-z0-9-]+(?:\/[a-z0-9-]+)*$/.test(slug) ||
    slug.length > 96 ||
    (reponse !== "validation" && reponse !== "question")
  ) {
    return json({ error: "Requête invalide." }, 400);
  }
  if (typeof message === "string" && message.length > 5000) {
    return json({ error: "Message trop long (5 000 caractères max)." }, 400);
  }
  if (
    (typeof prenom === "string" && prenom.length > 100) ||
    (typeof nom === "string" && nom.length > 100) ||
    (typeof email === "string" && email.length > 200)
  ) {
    return json({ error: "Requête invalide." }, 400);
  }
  // Prénom obligatoire : il ouvre les accusés de réception, qui n'ont pas de
  // formulation de repli. Nom obligatoire aussi, quelle que soit la réponse.
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
  // L'email est obligatoire : il sert d'adresse de réponse ET de destinataire de
  // l'accusé de réception envoyé au client.
  if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return json({ error: "Merci de renseigner un email valide." }, 400);
  }
  /* Facturation : les trois champs sont exigés à la validation. Le contrôle
     est répété ici et pas seulement dans le formulaire, une requête pouvant
     être forgée — et une validation qui arrive sans de quoi facturer coûte
     un aller-retour de mails avant l'encaissement de l'acompte. */
  if (reponse === "validation") {
    const manquant = (
      [
        [raisonSociale, "la raison sociale"],
        [siren, "le numéro SIREN"],
        [adresse, "l'adresse de facturation"],
      ] as const
    ).find(([valeur]) => typeof valeur !== "string" || !valeur.trim());
    if (manquant) return json({ error: `Merci de renseigner ${manquant[1]}.` }, 400);
  }

  const objetReponse =
    reponse === "validation" ? "Validation de la proposition" : "Question / remarque";

  const champ = (valeur: unknown): string | undefined =>
    typeof valeur === "string" && valeur ? valeur : undefined;

  const prenomClient = prenom.trim();
  const nomClient = nom.trim();
  const emailClient = email.trim();
  // Trace du consentement : sans base de données, l'email de notification est le
  // seul endroit où il en reste une preuve horodatée.
  const traceConsentement = "Accord&eacute; via le formulaire du devis";

  /* Le devis est relu ici, avant tout enregistrement : c'est lui qui fait foi
     sur les prix. Le navigateur n'envoie que des index de cases, jamais un
     montant — un total posté depuis la page publique serait modifiable par
     quiconque sait ouvrir un inspecteur. */
  const devis = await getEntry("devis", slug).catch(() => undefined);
  const budget = devis && budgetDevis(devis.data);
  /* Un devis sans ligne optionnelle n'a pas de périmètre composé : on écrit
     null plutôt qu'un tableau vide, qui se lirait comme « tout décoché ». */
  const aDesOptions = budget?.lignes.some((l) => l.optionnel) ?? false;
  const montantCompose =
    budget && !budget.enAttente && aDesOptions
      ? totaux(budget, optionsRecues).totalFinal
      : undefined;
  const perimetreCompose = aDesOptions && optionsRecues ? JSON.stringify(optionsRecues) : undefined;

  // D1 d'abord : le cockpit /espace/devis lit cette table, et la tâche de
  // facturation a besoin de l'id de la ligne écrite. Un échec D1 ne bloque
  // jamais la notification — le mail reste la garantie de délivrance.
  let reponseId: number | undefined;
  try {
    await enregistrerReponse({
      slug,
      decision: reponse === "validation" ? "validation" : "question",
      message: champ(message) ?? null,
      prenom: prenomClient,
      nom: nomClient,
      email: emailClient,
      raisonSociale: champ(raisonSociale) ?? null,
      siren: champ(siren) ?? null,
      adresse: champ(adresse) ?? null,
      tva: champ(tva) ?? null,
      optionsRetenues: perimetreCompose ?? null,
      montantRetenu: montantCompose ?? null,
    });
    reponseId = (await derniereReponse(slug))?.id;
  } catch (err) {
    console.error("devis-reponse: écriture D1 échouée", err);
  }

  /* Validation : l'affaire CRM passe en « Proposition validée » — pas en
     « Signée », qui demande en plus l'encaissement — et reçoit sa sous-tâche
     de facturation. Rien ne part vers le client ici : le devis Tiime et la
     facture d'acompte s'émettent à la main, puis partent avec la proposition
     validée dans un seul mail. Toute panne de ce bloc est journalisée et
     ignorée : elle ne doit pas priver Ludo de la notification. */
  let tache: ResultatSignature | undefined;
  if (reponse === "validation" && reponseId !== undefined) {
    try {
      const apiKey = env.LINEAR_API_KEY;
      if (!apiKey) {
        console.error("devis-reponse: LINEAR_API_KEY absent de cet environnement");
      } else {
        const entry = devis;
        if (!entry) {
          console.error(`devis-reponse: devis ${slug} introuvable dans la collection`);
        } else {
          tache = await declencherSignature(
            apiKey,
            {
              slug,
              titre: entry.data.titre,
              objet: entry.data.objet,
              affaire: entry.data.linear?.affaire,
              /* Sur un devis composable, la tâche de facturation doit porter
                 ce que le client a réellement pris, pas le total d'affichage
                 par défaut : c'est ce montant qui part au devis Tiime. */
              total:
                montantCompose !== undefined
                  ? eur.format(montantCompose)
                  : montantAffiche(entry.data),
              reglement: budgetDevis(entry.data)?.reglement,
              client: {
                prenom: prenomClient,
                nom: nomClient,
                email: emailClient,
                raisonSociale: champ(raisonSociale) ?? null,
                siren: champ(siren) ?? null,
                adresse: champ(adresse) ?? null,
                tva: champ(tva) ?? null,
              },
            },
            reponseId,
          );
          console.log(JSON.stringify({ event: "devis_signature", slug, statut: tache.statut }));
        }
      }
    } catch (err) {
      console.error("devis-reponse: déclenchement de la signature échoué", err);
    }
  }

  /* Ligne « tâche » du mail : elle dit à Ludo si la suite est prise en charge
     ou s'il doit ouvrir Linear à la main. Un devis sans affaire rattachée est
     le cas qu'on veut voir passer — c'est un oubli de rattachement. */
  const lignesTache: Array<[string, string | undefined]> =
    tache?.statut === "cree"
      ? [
          [
            "Facturation",
            `<a href="${tache.tache.url}">${esc(tache.tache.identifier)}</a> créée dans Linear`,
          ],
        ]
      : tache?.statut === "deja_traite"
        ? [["Facturation", "Tâche déjà créée pour ce devis (soumission répétée)"]]
        : tache?.statut === "sans_affaire"
          ? [["Facturation", "Aucune affaire CRM rattachée au devis — tâche à créer à la main"]]
          : tache?.statut === "affaire_introuvable"
            ? [["Facturation", `Affaire CRM-${tache.numero} introuvable dans Linear`]]
            : [];

  /* Périmètre composé, en clair dans la notification : c'est ce que Ludo lit
     avant d'ouvrir Tiime. Les options sont listées telles qu'elles figurent au
     devis, gras du markdown retiré. */
  const optionsRetenuesLabels =
    budget && aDesOptions
      ? lignesRetenues(budget, optionsRecues)
          .filter((l) => l.optionnel)
          .map((l) => l.label.replaceAll("**", ""))
      : [];
  const lignesPerimetre: Array<[string, string | undefined]> = aDesOptions
    ? [
        [
          "Options retenues",
          optionsRetenuesLabels.length
            ? optionsRetenuesLabels.map((l) => esc(l)).join("<br>")
            : "aucune (socle seul)",
        ],
        ["Montant composé", montantCompose !== undefined ? eur.format(montantCompose) : undefined],
      ]
    : [];

  const html = renderTransactionnel({
    preheader: `${objetReponse} — devis ${esc(slug)}`,
    kicker: `Devis · ${esc(slug)}`,
    titre: objetReponse,
    contenu: [
      kv([
        ["Prénom", esc(prenomClient)],
        ["Nom", esc(nomClient)],
        ["Email", esc(emailClient)],
        ["Raison sociale", champ(raisonSociale) && esc(champ(raisonSociale)!)],
        ["SIREN", champ(siren) && esc(champ(siren)!)],
        ["Adresse", champ(adresse) && esc(champ(adresse)!)],
        ["TVA intracom.", champ(tva) && esc(champ(tva)!)],
        ["Consentement", traceConsentement],
        ...lignesPerimetre,
        ...lignesTache,
      ]),
      champ(message)
        ? titreSection("Message du client") + citation(esc(champ(message)!).replace(/\n/g, "<br>"))
        : titreSection("Message du client") + p("(pas de message)"),
    ].join(""),
    cta: {
      label: "Voir le devis",
      /* Pas d'encodeURIComponent : le slug peut porter un slash de
         séparation client/projet, que l'encodage transformerait en %2F et
         casserait la route. La regex de validation ci-dessus garantit déjà
         qu'il ne contient que [a-z0-9-] et des slashs. */
      url: `https://coolbeans.cc/devis/${slug}`,
    },
    piedContexte: "R&eacute;ponse re&ccedil;ue via la page publique du devis.",
  });

  try {
    const resend = new Resend(env.RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from: "Devis Coolbeans <devis@coolbeans.cc>",
      to: "ludo@coolbeans.cc",
      replyTo: emailClient,
      subject: `Devis ${slug} — ${objetReponse}`,
      html,
      text: [
        `Devis : ${slug}`,
        `Réponse : ${objetReponse}`,
        `Prénom : ${prenomClient}`,
        `Nom : ${nomClient}`,
        `Email : ${emailClient}`,
        champ(raisonSociale) && `Raison sociale : ${champ(raisonSociale)}`,
        champ(siren) && `SIREN : ${champ(siren)}`,
        champ(adresse) && `Adresse : ${champ(adresse)}`,
        champ(tva) && `TVA intracommunautaire : ${champ(tva)}`,
        "Consentement : accordé via le formulaire du devis",
        aDesOptions &&
          `Options retenues : ${optionsRetenuesLabels.join(" | ") || "aucune (socle seul)"}`,
        aDesOptions &&
          montantCompose !== undefined &&
          `Montant composé : ${eur.format(montantCompose)}`,
        tache?.statut === "cree" && `Facturation : ${tache.tache.identifier} — ${tache.tache.url}`,
        tache?.statut === "sans_affaire" &&
          "Facturation : aucune affaire CRM rattachée au devis, tâche à créer à la main",
        "",
        champ(message) ?? "(pas de message)",
      ]
        /* `cond && "texte"` rend `false`, pas `undefined`, quand la condition
           tombe : filtrer sur le seul `undefined` laissait « false » s'écrire
           en clair dans le corps du mail. On ne garde que des chaînes. */
        .filter((ligne): ligne is string => typeof ligne === "string")
        .join("\n"),
    });

    if (error) throw error;

    // Accusé de réception au client. Un échec ici ne doit pas faire échouer la
    // requête : le message est déjà arrivé chez Ludo, c'est ce qui compte.
    const confirmation = (
      reponse === "validation" ? renderConfirmationValidation : renderConfirmationQuestion
    )({
      slug,
      prenom: prenomClient,
      message: champ(message),
      raisonSociale: champ(raisonSociale),
      siren: champ(siren),
      adresse: champ(adresse),
      tva: champ(tva),
    });

    const { error: erreurConfirmation } = await resend.emails.send({
      from: "Ludo de Coolbeans <devis@coolbeans.cc>",
      to: emailClient,
      replyTo: "ludo@coolbeans.cc",
      subject: confirmation.subject,
      html: confirmation.html,
      text: confirmation.text,
    });
    if (erreurConfirmation) {
      console.error("devis-reponse: accusé de réception non envoyé", erreurConfirmation);
    }

    return json({ ok: true }, 200);
  } catch (err) {
    console.error("devis-reponse: envoi Resend échoué", err);
    return json({ error: "Envoi impossible, réessaie dans un instant." }, 502);
  }
};
