/* Ce que la page publique d'un document montre des réponses reçues
   (spec 2026-09-29-reponses-dans-les-documents-design.md).

   La règle qui justifie ce module : l'identité du client ne quitte jamais le
   serveur. `ReponseAffichee` ne porte que les LIBELLÉS des champs d'identité,
   jamais leurs valeurs. Le composant qui la rend n'a donc aucun moyen de
   laisser fuir un email ou un SIREN, même par erreur : la donnée n'est pas
   là. Les valeurs en clair vivent en D1 et dans le mail de notification. */

import { budgetDevis, eur, lignesRetenues, type DevisData } from "../devis";
import type { ReponseDevis } from "../devis/reponses";
import { REPONSES_LIVRABLE } from "../livrable";
import { lireReponses, type ReponseDocument } from "./reponses";

export interface ReponseAffichee {
  /** « 16 septembre 2026 », à l'heure de Paris. */
  date: string;
  /** Renseignée seulement quand le document a plusieurs versions. */
  version?: number;
  /** Libellé du choix du client, tel que le formulaire le proposait. */
  decision?: string;
  /** Libellés des champs d'identité, affichés biffés. Jamais leurs valeurs. */
  identite: string[];
  /** Une décision reçue par mail se date autrement et n'a pas de consentement. */
  canal: "formulaire" | "mail";
  reponses: { question: string; reponse: string }[];
  /** Proposition à options : ce que le client a coché. */
  perimetre?: { options: string[]; montant?: string };
  message?: string;
}

const DATE = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: "Europe/Paris" });

/** Date d'une ligne D1 : `datetime('now')` écrit de l'UTC sans fuseau. */
export const dateReponse = (createdAt: string): string => {
  const iso = /(?:Z|[+-]\d\d:\d\d)$/i.test(createdAt)
    ? createdAt
    : `${createdAt.replace(" ", "T")}Z`;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : DATE.format(d).replace(/^1 /, "1er ");
};

/* Les deux libellés du formulaire de proposition (DevisReponse.astro). */
export const DECISIONS_DEVIS = {
  validation: "Je valide cette proposition",
  question: "J'ai une question ou une remarque",
} as const;

const IDENTITE = ["Prénom", "Nom", "Email"];

/* Le consentement est une case du formulaire. Une décision prise par mail ne
   l'a jamais cochée : afficher la ligne, même biffée, affirmerait le contraire. */
const consentement = (canal: ReponseAffichee["canal"]) =>
  canal === "mail" ? [] : ["Consentement"];

export function afficherReponseDocument(r: ReponseDocument, version?: number): ReponseAffichee {
  const canal = r.canal ?? "formulaire";
  return {
    date: dateReponse(r.createdAt),
    version,
    decision: r.decision ? REPONSES_LIVRABLE[r.decision] : undefined,
    identite: [...IDENTITE, ...(r.photoR2 ? ["Photo"] : []), ...consentement(canal)],
    canal,
    reponses: lireReponses(r.reponses).map(({ question, reponse }) => ({ question, reponse })),
    message: r.message?.trim() || undefined,
  };
}

export function afficherReponseDevis(
  r: ReponseDevis,
  perimetre?: ReponseAffichee["perimetre"],
  version?: number,
): ReponseAffichee {
  const canal = r.canal ?? "formulaire";
  return {
    date: dateReponse(r.createdAt),
    version,
    decision: DECISIONS_DEVIS[r.decision],
    canal,
    /* Même ordre que le mail de notification. Un champ laissé vide n'a pas de
       ligne : une barre sur une valeur absente ferait croire qu'on cache
       quelque chose. */
    identite: [
      ...IDENTITE,
      ...(r.raisonSociale ? ["Raison sociale"] : []),
      ...(r.siren ? ["SIREN"] : []),
      ...(r.adresse ? ["Adresse"] : []),
      ...(r.tva ? ["TVA intracom."] : []),
      ...consentement(canal),
    ],
    reponses: [],
    perimetre,
    message: r.message?.trim() || undefined,
  };
}

/**
 * Options retenues par le client sur une proposition composable, relues dans
 * le YAML de la version à laquelle il a répondu. Le montant est celui que le
 * serveur a recalculé à la réponse, jamais un recalcul d'aujourd'hui : un
 * YAML retouché après coup ne change pas ce qui a été accepté.
 */
export function perimetreDevis(
  data: DevisData,
  optionsRetenues: string | null | undefined,
  montantRetenu: number | null | undefined,
): ReponseAffichee["perimetre"] {
  const budget = budgetDevis(data);
  if (!budget || !optionsRetenues || !budget.lignes.some((l) => l.optionnel)) return undefined;
  let index: unknown;
  try {
    index = JSON.parse(optionsRetenues);
  } catch {
    return undefined;
  }
  if (!Array.isArray(index)) return undefined;
  const options = lignesRetenues(budget, index.filter(Number.isInteger))
    .filter((l) => l.optionnel)
    .map((l) => l.label.replaceAll("**", ""));
  return {
    options,
    montant: typeof montantRetenu === "number" ? eur.format(montantRetenu) : undefined,
  };
}
