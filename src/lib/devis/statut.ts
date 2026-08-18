import type { ReponseDevis } from "./reponses";

/* Statut d'un devis, dérivé et jamais stocké : le YAML porte l'envoi
   (écrit par la skill devis), D1 porte la réponse client. Une réponse
   prime toujours — même si l'envoi n'a pas été noté dans le YAML, un
   client qui répond prouve que le devis est parti. */

export type StatutDevis = "publie" | "envoye" | "repondu";

export const STATUT_LABEL: Record<StatutDevis, string> = {
  publie: "Publié",
  envoye: "Envoyé",
  repondu: "Répondu",
};

export function statutDevis(
  envoi: { date: Date } | undefined,
  reponse: ReponseDevis | undefined,
): StatutDevis {
  if (reponse) return "repondu";
  if (envoi) return "envoye";
  return "publie";
}
