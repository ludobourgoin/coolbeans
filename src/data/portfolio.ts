/** Un projet livré, listé sur /projets.
 *
 * Volontairement minimal : un secteur et un domaine. Le domaine sert à la fois
 * de libellé et de lien, faute de captures et d'études de cas publiées. Quand
 * un projet gagne sa page dans la collection `projets`, ajouter `etude` avec
 * son slug pour renvoyer vers le récit plutôt que vers le site.
 */
export interface PortfolioItem {
  secteur: string;
  domaine: string;
  /** slug d'une entrée de src/content/projets/ (/projets/<slug>). */
  etude?: string;
}

/* Ordre volontaire : celui de la liste tenue par Ludo, pas un tri alphabétique
   ni chronologique. Les projets les plus parlants ouvrent la page. */
export const portfolio: PortfolioItem[] = [
  { secteur: "Entertainment", domaine: "amusoire.com" },
  { secteur: "Bijoux", domaine: "dupontdupontstore.fr" },
  { secteur: "Bien-être", domaine: "letapisdelaine.fr" },
  { secteur: "Événementiel", domaine: "grande-soiree-industrie.webflow.io" },
  { secteur: "Immobilier", domaine: "offres.zelidom.fr" },
  { secteur: "Automobile", domaine: "ev.encheres-vo.com" },
  { secteur: "Ressources humaines", domaine: "mathildechevalier.com" },
  { secteur: "Hôtellerie", domaine: "lp.miharu.fr" },
  { secteur: "Agence de publicité", domaine: "trigger.fr" },
  { secteur: "Agence vidéo", domaine: "ngupmedias.com" },
];
