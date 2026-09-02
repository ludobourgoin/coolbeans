// Ce qui se déclenche quand un client valide une proposition commerciale
// (spec 2026-09-01-cockpit-devis-tableau-crm-design.md).
//
// Trois gestes dans Linear, aucun vers le client : l'affaire passe en
// « ✍️ Proposition validée », une sous-tâche de facturation naît sous elle avec
// tout ce qu'il faut pour agir, et son identifiant est accroché à la réponse
// pour ne jamais la créer deux fois.
//
// L'état d'arrivée n'est PAS « 🏆 Signée ». Une affaire signée demande deux
// conditions, pas une : la validation du formulaire ET le règlement de
// l'acompte (règle posée le 2026-09-01). Le client qui a dit oui sans virer
// occupe la colonne intermédiaire, celle où une affaire se perd le plus
// facilement. C'est Ludo qui passe l'affaire en « 🏆 Signée » à l'encaissement,
// faute de webhook bancaire ou d'API Tiime pour le faire à sa place.
//
// Ce module ne génère aucun document et n'envoie aucun mail au client. Le
// devis Tiime et la facture d'acompte se font à la main : l'API Tiime est
// réservée aux éditeurs de logiciels, et surtout rien ne part chez un client
// sans ordre explicite de Ludo.

import {
  changerEtatAffaire,
  creerSousTache,
  fetchEtatsAffaires,
  numeroAffaire,
  type TacheLinear,
} from "../portail/linear-crm";
import { marquerTacheLinear, tacheExistante, type D1Like } from "./reponses";

/** Nom de l'état d'arrivée dans le pipeline commercial. */
const ETAT_PROPOSITION_VALIDEE = "Proposition validée";

export interface ContexteSignature {
  slug: string;
  /** Titre du devis, tel qu'écrit dans le YAML. */
  titre: string;
  objet: string;
  /** Champ `linear.affaire` brut : « CRM-9 » ou l'URL complète. */
  affaire: string | undefined;
  /** Montant total, déjà formaté — « 3 520 € », « En construction », « — ». */
  total: string;
  /** Phrase de règlement du budget, citée telle quelle. */
  reglement: string | undefined;
  client: {
    prenom: string;
    nom: string;
    email: string;
    raisonSociale?: string | null;
    siren?: string | null;
    adresse?: string | null;
    tva?: string | null;
  };
}

const ligne = (label: string, valeur: string | null | undefined): string | null =>
  valeur ? `- **${label}** : ${valeur}` : null;

/**
 * Corps Markdown de la sous-tâche de facturation.
 *
 * Fonction pure : c'est le contenu qui compte, et le tester ne doit pas
 * demander de parler à Linear.
 *
 * Le montant d'acompte n'est pas calculé. Le champ `reglement` du budget est
 * du texte libre — « 100 % à la livraison », des blocs de plusieurs lignes
 * ailleurs — et en déduire un pourcentage produirait un chiffre faux un jour
 * sur deux. La phrase est citée, l'arbitrage reste humain.
 */
export function corpsTacheFacturation(ctx: ContexteSignature): string {
  const c = ctx.client;
  const coordonnees = [
    ligne("Contact", `${c.prenom} ${c.nom}`),
    ligne("Email", c.email),
    ligne("Raison sociale", c.raisonSociale),
    ligne("SIREN", c.siren),
    ligne("Adresse", c.adresse),
    ligne("TVA intracommunautaire", c.tva),
  ].filter((l): l is string => l !== null);

  return [
    `Le client a validé la proposition commerciale depuis sa page publique.`,
    "",
    `**${ctx.titre}** — ${ctx.objet}`,
    `Montant de la proposition : **${ctx.total}**`,
    "",
    "## Coordonnées de facturation",
    ...coordonnees,
    "",
    "## Règlement",
    ctx.reglement
      ? `> ${ctx.reglement.trim().replace(/\n/g, "\n> ")}`
      : "_Aucune modalité de règlement dans le devis — à trancher avant d'émettre la facture._",
    "",
    "## À faire",
    "- [ ] Créer ou vérifier le client dans Tiime",
    "- [ ] Émettre le devis dans Tiime, au périmètre exact de la proposition validée",
    "- [ ] Émettre la facture d'acompte",
    "- [ ] Envoyer **un seul mail** au client avec les trois documents : proposition validée, devis, facture d'acompte",
    "- [ ] À l'encaissement : passer l'affaire en 🏆 Signée",
    "",
    `[Voir la proposition](https://coolbeans.cc/devis/${ctx.slug})`,
  ].join("\n");
}

export type ResultatSignature =
  | { statut: "cree"; tache: TacheLinear }
  | { statut: "deja_traite"; taskId: string }
  | { statut: "sans_affaire" }
  | { statut: "affaire_introuvable"; numero: number };

/**
 * Déclenche la suite d'une validation. Ne lève jamais pour un cas prévu
 * (devis sans affaire rattachée, affaire supprimée) : ce sont des états
 * normaux que l'appelant journalise. Une panne Linear, elle, remonte.
 *
 * @param reponseId id de la réponse qui vient d'être enregistrée en D1.
 */
export async function declencherSignature(
  apiKey: string,
  ctx: ContexteSignature,
  reponseId: number,
  d1?: D1Like,
): Promise<ResultatSignature> {
  const deja = await tacheExistante(ctx.slug, d1);
  if (deja) return { statut: "deja_traite", taskId: deja };

  const numero = numeroAffaire(ctx.affaire);
  if (numero === null) return { statut: "sans_affaire" };

  const affaires = await fetchEtatsAffaires(apiKey, [numero]);
  const affaire = affaires.get(numero);
  if (!affaire) return { statut: "affaire_introuvable", numero };

  // L'ordre compte : la sous-tâche d'abord, le changement d'état ensuite. Si
  // Linear tombe entre les deux, mieux vaut une affaire encore en « Proposition
  // envoyée » avec sa tâche de facturation qu'une affaire marquée validée dont
  // personne ne facturera jamais rien.
  const tache = await creerSousTache({
    apiKey,
    parentId: affaire.issueId,
    title: `Devis et acompte — ${ctx.titre}`,
    description: corpsTacheFacturation(ctx),
  });
  await marquerTacheLinear(reponseId, tache.id, d1);
  await changerEtatAffaire(apiKey, affaire.issueId, ETAT_PROPOSITION_VALIDEE);

  return { statut: "cree", tache };
}
