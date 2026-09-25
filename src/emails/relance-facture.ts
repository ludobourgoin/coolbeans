/* ============================================================================
   COOLBEANS : relance d'une facture impayée, envoyée AU CLIENT.
   Même coquille que les autres transactionnels. Trois niveaux, du rappel
   courtois à la mise en demeure, parce qu'une relance qui garde le même ton
   à chaque envoi n'obtient rien.

   Le module ne fixe pas l'expéditeur : il retourne l'objet, le HTML et la
   version texte, l'appelant choisit l'adresse et envoie via Resend.
   ========================================================================== */

import { citation, esc, kv, p, renderTransactionnel, titreSection } from "./transactionnel";

/**
 * Le niveau commande le ton, l'objet et les mentions légales rappelées.
 * `mise-en-demeure` fait courir les pénalités : il double une lettre
 * recommandée avec accusé de réception, il ne la remplace pas.
 */
export type NiveauRelance = "rappel" | "relance" | "mise-en-demeure";

export interface RelanceFactureProps {
  niveau: NiveauRelance;
  /** Raison sociale facturée, telle qu'elle figure sur la facture. */
  societe: string;
  /** Prénom du destinataire, absent si on ne l'a pas. */
  prenom?: string;
  /** Numéro de la facture, sans le préfixe « n° ». */
  numeroFacture: string;
  /** Date d'émission au format YYYY-MM-DD. */
  emissionISO: string;
  /** Date d'échéance au format YYYY-MM-DD. */
  echeanceISO: string;
  /** Montant restant dû, en euros TTC. */
  montantTTC: number;
  /** Montant restant dû hors taxes, affiché à titre de rappel. */
  montantHT?: number;
  iban: string;
  bic: string;
  /** Lien vers la facture si elle est hébergée quelque part. */
  lienFacture?: string;
  /** Date de référence du calcul du retard, pour les tests. */
  aujourdhui?: Date;
}

export interface EmailPret {
  subject: string;
  html: string;
  text: string;
}

const PIED = "Cet email concerne une facture émise par Coolbeans, Ludovic Bourgoin (EI).";

const INDEMNITE_RECOUVREMENT = "40 €";

/**
 * Formatage maison plutôt qu'Intl : un montant de facture ne peut pas
 * basculer en séparateur anglais si le runtime a une ICU partielle.
 */
const euros = (montant: number): string => {
  const [entier, decimales] = montant.toFixed(2).split(".");
  const milliers = entier.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${milliers},${decimales} €`;
};

const dateFr = (iso: string): string => {
  const [annee, mois, jour] = iso.split("-");
  return `${jour}/${mois}/${annee}`;
};

const joursDepuis = (iso: string, aujourdhui: Date): number => {
  const echeance = new Date(`${iso}T00:00:00Z`);
  const reference = new Date(
    Date.UTC(aujourdhui.getUTCFullYear(), aujourdhui.getUTCMonth(), aujourdhui.getUTCDate()),
  );
  return Math.round((reference.getTime() - echeance.getTime()) / 86_400_000);
};

/**
 * Relance de facture, prête pour Resend.
 *
 * Le corps reprend systématiquement les références de la facture : une
 * relance sans numéro ni montant oblige le destinataire à chercher, et
 * chercher est le meilleur prétexte pour remettre à demain.
 */
export function renderRelanceFacture(props: RelanceFactureProps): EmailPret {
  const {
    niveau,
    societe,
    prenom,
    numeroFacture,
    emissionISO,
    echeanceISO,
    montantTTC,
    montantHT,
    iban,
    bic,
    lienFacture,
    aujourdhui = new Date(),
  } = props;

  const retard = Math.max(0, joursDepuis(echeanceISO, aujourdhui));
  /**
   * Une mise en demeure garde l'appel formel même quand on tutoie le
   * destinataire au quotidien : le document doit tenir seul devant un tiers.
   */
  const bonjour =
    niveau === "mise-en-demeure" ? "Madame, Monsieur," : prenom ? `Bonjour ${prenom},` : "Bonjour,";

  const references = kv([
    ["Facture", `n° ${esc(numeroFacture)}`],
    ["Émise le", dateFr(emissionISO)],
    ["Échéance", dateFr(echeanceISO)],
    ["Montant dû", euros(montantTTC) + " TTC"],
    ["Dont hors taxes", montantHT ? euros(montantHT) : null],
    ["Retard", retard > 0 ? `${retard} jour${retard > 1 ? "s" : ""}` : null],
  ]);

  const virement = citation(
    [`IBAN : ${esc(iban)}`, `BIC : ${esc(bic)}`, `Référence à porter : facture ${esc(numeroFacture)}`].join(
      "<br>",
    ),
  );

  const penalites = `Passé l'échéance, le montant dû porte intérêt au taux légal majoré de trois fois, auquel s'ajoute une indemnité forfaitaire de recouvrement de ${INDEMNITE_RECOUVREMENT}.`;

  const corps: string[] = [p(esc(bonjour))];
  let titre: string;
  let subject: string;
  let preheader: string;

  if (niveau === "rappel") {
    titre = "Rappel d'échéance";
    subject = `Facture n° ${numeroFacture} : rappel d'échéance`;
    preheader = `Facture n° ${numeroFacture}, ${euros(montantTTC)} TTC.`;
    corps.push(
      p(
        `La facture n° ${esc(numeroFacture)} adressée à ${esc(societe)} arrive à échéance et ne m'est pas encore parvenue. Ce message est un simple rappel : si le virement est déjà parti, considérez-le comme sans objet.`,
      ),
    );
  } else if (niveau === "relance") {
    titre = "Facture impayée";
    subject = `Facture n° ${numeroFacture} impayée : relance`;
    preheader = `${euros(montantTTC)} TTC, ${retard} jours de retard.`;
    corps.push(
      p(
        `La facture n° ${esc(numeroFacture)} adressée à ${esc(societe)} reste impayée à ce jour, soit ${retard} jour${retard > 1 ? "s" : ""} après son échéance.`,
      ),
      p(
        "Merci de procéder au règlement sous huit jours. Si un élément bloque son traitement, dites-le-moi et je le corrige.",
      ),
    );
  } else {
    titre = "Mise en demeure de payer";
    subject = `Mise en demeure de payer la facture n° ${numeroFacture}`;
    preheader = `${euros(montantTTC)} TTC restent dus depuis le ${dateFr(echeanceISO)}.`;
    corps.push(
      p(
        `Par la présente, je mets en demeure ${esc(societe)} de régler la facture n° ${esc(numeroFacture)}, échue depuis le ${dateFr(echeanceISO)} et impayée à ce jour, soit ${retard} jour${retard > 1 ? "s" : ""} de retard.`,
      ),
      p(
        `Le règlement de ${euros(montantTTC)} TTC doit intervenir sous huit jours à compter de la réception de ce message. À défaut, je confierai le recouvrement de cette créance à qui de droit, sans nouvel avis.`,
      ),
    );
  }

  corps.push(titreSection("Références"), references);

  if (lienFacture) {
    corps.push(p(`La facture est consultable ici : ${esc(lienFacture)}`));
  }

  corps.push(titreSection("Règlement par virement"), virement);

  if (niveau !== "rappel") {
    corps.push(p(penalites));
  }

  corps.push(p(niveau === "mise-en-demeure" ? "Cordialement,<br>Ludovic Bourgoin" : "Merci,<br>Ludo"));

  const html = renderTransactionnel({
    preheader,
    kicker: `Facturation · n° ${numeroFacture}`,
    titre,
    contenu: corps.join(""),
    cta: lienFacture ? { label: "Voir la facture", url: lienFacture } : undefined,
    piedContexte: PIED,
  });

  const textCorps: string[] = [bonjour, ""];

  if (niveau === "rappel") {
    textCorps.push(
      `La facture n° ${numeroFacture} adressée à ${societe} arrive à échéance et ne m'est pas encore parvenue. Ce message est un simple rappel : si le virement est déjà parti, considérez-le comme sans objet.`,
    );
  } else if (niveau === "relance") {
    textCorps.push(
      `La facture n° ${numeroFacture} adressée à ${societe} reste impayée à ce jour, soit ${retard} jour${retard > 1 ? "s" : ""} après son échéance.`,
      "",
      "Merci de procéder au règlement sous huit jours. Si un élément bloque son traitement, dites-le-moi et je le corrige.",
    );
  } else {
    textCorps.push(
      `Par la présente, je mets en demeure ${societe} de régler la facture n° ${numeroFacture}, échue depuis le ${dateFr(echeanceISO)} et impayée à ce jour, soit ${retard} jour${retard > 1 ? "s" : ""} de retard.`,
      "",
      `Le règlement de ${euros(montantTTC)} TTC doit intervenir sous huit jours à compter de la réception de ce message. À défaut, je confierai le recouvrement de cette créance à qui de droit, sans nouvel avis.`,
    );
  }

  textCorps.push(
    "",
    "Références :",
    `Facture n° ${numeroFacture}`,
    `Émise le ${dateFr(emissionISO)}`,
    `Échéance ${dateFr(echeanceISO)}`,
    `Montant dû ${euros(montantTTC)} TTC${montantHT ? ` (${euros(montantHT)} HT)` : ""}`,
  );

  if (retard > 0) {
    textCorps.push(`Retard ${retard} jour${retard > 1 ? "s" : ""}`);
  }

  if (lienFacture) {
    textCorps.push("", `Facture : ${lienFacture}`);
  }

  textCorps.push(
    "",
    "Règlement par virement :",
    `IBAN : ${iban}`,
    `BIC : ${bic}`,
    `Référence à porter : facture ${numeroFacture}`,
  );

  if (niveau !== "rappel") {
    textCorps.push("", penalites);
  }

  textCorps.push(
    "",
    niveau === "mise-en-demeure" ? "Cordialement," : "Merci,",
    niveau === "mise-en-demeure" ? "Ludovic Bourgoin" : "Ludo",
  );

  return { subject, html, text: textCorps.join("\n") };
}
