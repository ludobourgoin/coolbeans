// Ce qui se déclenche quand un client valide un devis
// (spec 2026-09-01-cockpit-devis-tableau-crm-design.md).
//
// Trois gestes dans Linear, aucun vers le client : l'affaire passe en
// « 🏆 Signée », une sous-tâche de facturation naît sous elle avec tout ce
// qu'il faut pour agir, et son identifiant est accroché à la réponse pour ne
// jamais la créer deux fois.
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
const ETAT_SIGNEE = "Signée";

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
    `Le client a validé la proposition depuis la page publique du devis.`,
    "",
    `**${ctx.titre}** — ${ctx.objet}`,
    `Montant du devis : **${ctx.total}**`,
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
    "- [ ] Émettre le devis dans Tiime",
    "- [ ] Émettre la facture d'acompte",
    "- [ ] Envoyer la facture d'acompte au client",
    "",
    `[Voir le devis](https://coolbeans.cc/devis/${ctx.slug})`,
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
  // Linear tombe entre les deux, mieux vaut une affaire encore en « Devis
  // envoyé » avec sa tâche de facturation qu'une affaire marquée signée dont
  // personne ne facturera jamais rien.
  const tache = await creerSousTache({
    apiKey,
    parentId: affaire.issueId,
    title: `Facturation acompte — ${ctx.titre}`,
    description: corpsTacheFacturation(ctx),
  });
  await marquerTacheLinear(reponseId, tache.id, d1);
  await changerEtatAffaire(apiKey, affaire.issueId, ETAT_SIGNEE);

  return { statut: "cree", tache };
}
