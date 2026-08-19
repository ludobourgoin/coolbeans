// Règles pures de la messagerie (spec 2026-08-15-messagerie-portail-design.md).
// Aucune dépendance : tout est testable sous Vitest sans bindings CF.

/** Statuts affichés au client — mapping par statusType Linear, JAMAIS par
 *  nom d'état (les noms sont propres à chaque team, le type est stable). */
export type StatutTicket = "en_attente" | "en_cours" | "traite" | "inconnu";

export const STATUT_LABEL: Record<StatutTicket, string> = {
  en_attente: "En attente",
  en_cours: "En cours",
  traite: "Traité",
  inconnu: "—", // issue introuvable (supprimée, non ré-appairée) : pas d'erreur anxiogène
};

export function statutFromStateType(t: string | undefined): StatutTicket {
  if (t === "triage" || t === "backlog" || t === "unstarted") return "en_attente";
  if (t === "started") return "en_cours";
  if (t === "completed" || t === "canceled") return "traite";
  return "inconnu";
}

/** Options du champ urgence du formulaire, dans l'ordre d'affichage. */
export const URGENCES = [
  { value: "pas-presse", label: "Pas pressé" },
  { value: "normal", label: "Normal" },
  { value: "urgent", label: "Urgent" },
  { value: "bloquant", label: "Bloquant" },
] as const;

/** Urgence portail → priorité Linear (échelle globale 1-4). Sans choix : Medium. */
export function prioriteFromUrgence(u: string | null | undefined): number {
  switch (u) {
    case "bloquant":
      return 1;
    case "urgent":
      return 2;
    case "pas-presse":
      return 4;
    default:
      return 3;
  }
}

/** Marqueur de publication : un commentaire Linear qui commence par ">>". */
const MARQUEUR = ">>";

/**
 * Corps publiable d'un commentaire, ou null s'il ne doit pas partir : pas de
 * marqueur en tête (note interne), ou plus de contenu (le ">>" a été retiré à
 * l'édition pendant le délai de grâce = annulation).
 */
export function corpsPublie(body: string): string | null {
  if (!body.startsWith(MARQUEUR)) return null;
  const corps = body.slice(MARQUEUR.length).trim();
  return corps || null;
}

/**
 * Corps publiable d'une DESCRIPTION d'issue, ou null s'il n'y a rien à ouvrir.
 *
 * Un commentaire est publié en entier ou pas du tout : le « >> » doit être en
 * tête. Une description ne peut pas suivre cette règle — elle porte d'abord le
 * contexte interne (ce qu'on a constaté, où ça se passe, ce qu'on va faire),
 * et le mot au client vient à la fin. Le premier « >> » en début de ligne
 * ouvre donc le bloc publié, qui court jusqu'au bout de la description.
 *
 * Conséquence voulue : une issue sans « >> » n'ouvre aucun fil. Poser le label
 * « Support » sur une issue de travail ordinaire ne fait donc rien partir, et
 * c'est aussi ce qui distingue les issues créées par le formulaire du portail
 * (elles n'ont pas de « >> ») de celles que Ludo tague à la main.
 */
export function corpsPublieDescription(description: string | null | undefined): string | null {
  if (!description) return null;
  const lignes = description.split("\n");
  const debut = lignes.findIndex((l) => l.startsWith(MARQUEUR));
  if (debut === -1) return null;
  const bloc = [lignes[debut].slice(MARQUEUR.length), ...lignes.slice(debut + 1)].join("\n").trim();
  return bloc || null;
}

/**
 * Retire les images du CDN privé Linear (uploads.linear.app, authentifié :
 * les URLs seraient mortes chez le client — spec §7). Retourne le compte pour
 * alerter Ludo à la publication.
 */
export function retireImagesLinear(md: string): { texte: string; imagesRetirees: number } {
  let imagesRetirees = 0;
  const texte = md
    .replace(/!\[[^\]]*\]\([^)]*uploads\.linear\.app[^)]*\)/g, () => {
      imagesRetirees += 1;
      return "";
    })
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { texte, imagesRetirees };
}
