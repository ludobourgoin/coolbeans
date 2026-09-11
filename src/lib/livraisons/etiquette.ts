// Derive l'etiquette courte affichee dans le calendrier Livraisons.
//
// Linear n'est jamais modifie : les noms de milestones restent explicites,
// parce que Ludo les relit et que le client les retrouve dans la proposition
// commerciale. Le raccourci vit ici, a l'ecriture dans l'agenda.

const MAX = 30;

// Prefixe de code en tete : "S0 <cadratin> ", "P7 <point median> ", "12- ".
// Les deux echappements sont le cadratin et le demi-cadratin, ecrits ainsi
// pour respecter la regle de redaction du depot.
const PREFIXE_CODE = /^[A-Z]?\d+\s*[·\u2014\u2013-]\s*/;

// Coupe au premier connecteur. La forme " mot" plutot que "\bmot\b" est
// deliberee : en JavaScript, \b est ASCII, donc "\ba\b" ne matcherait jamais
// le "a" accentue de "a Amusoire".
const CONNECTEUR = /\s(?:et|ou|puis|à|vers|conforme|avec|pour|afin|selon)(?=\s|$)|[(,:+]/u;

// Porte de sortie : une ligne "Agenda : ..." dans la description de la
// milestone l'emporte sur la regle de coupe. La description est interne.
const LIGNE_AGENDA = /^[ \t]*Agenda[ \t]*:[ \t]*(.+)$/im;

function tronquer(texte: string): string {
  return texte.length > MAX ? `${texte.slice(0, MAX - 1).trimEnd()}…` : texte;
}

export function etiquetteMilestone(m: { nom: string; description?: string | null }): string {
  const force = m.description?.match(LIGNE_AGENDA)?.[1]?.trim();
  if (force) return tronquer(force);

  let nom = m.nom.replace(PREFIXE_CODE, "").trim();
  const coupe = nom.match(CONNECTEUR);
  if (coupe?.index !== undefined && coupe.index > 0) {
    nom = nom.slice(0, coupe.index).trim();
  }
  return tronquer(nom);
}

export function titreEvenement(cleTeam: string, etiquette: string): string {
  return `${cleTeam}-${etiquette}`;
}
