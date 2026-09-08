/* ============================================================================
   COOLBEANS · Document de cadrage

   Le cadrage est le document frère de la proposition commerciale : il part
   avant qu'on sache s'il y aura une affaire, pour qualifier un lead et
   recueillir son besoin par écrit sans y passer un rendez-vous.

   Ce module ne porte que ce qui doit être partagé entre le rendu de la page
   et l'endpoint de soumission : les types, et la traduction des réponses
   brutes en libellés lisibles.

   La règle qui justifie ce partage : le navigateur n'envoie que des
   identifiants de question et de réponse. C'est le serveur qui relit le YAML
   pour retrouver les libellés, exactement comme il relit les prix d'un devis
   au lieu de croire un total posté depuis une page publique.
   ========================================================================== */

/** Une réponse telle qu'elle sort du formulaire, avant traduction. */
export type ReponseBrute = {
  /** `id` de la question dans le YAML. */
  question: string;
  /** Valeurs cochées, pour une question de type `choix`. */
  valeurs?: string[];
  /** Saisie libre : le corps d'une question `texte`, ou le « autre » d'un choix. */
  texte?: string;
};

/** Forme minimale d'une question, telle que le schéma Zod la produit. */
export interface QuestionCadrage {
  id: string;
  label: string;
  type: "choix" | "texte";
  decisif: boolean;
  requis: boolean;
  multiple: boolean;
  autre: boolean;
  long: boolean;
  aide?: string;
  options?: { valeur: string; label: string; aide?: string }[];
  placeholder?: string;
}

/** Une question et sa réponse, prêtes à écrire dans un mail. */
export interface ReponseLisible {
  question: string;
  /** Réponse en clair. Chaîne vide quand le lead a passé la question. */
  reponse: string;
  decisif: boolean;
}

/** Marqueur des questions restées sans réponse, dans les deux mails. */
export const SANS_REPONSE = "(pas de réponse)";

/**
 * Traduit les réponses brutes du formulaire en couples question / réponse
 * lisibles, dans l'ordre du questionnaire.
 *
 * Fonction pure, et c'est le point : c'est elle qui décide de ce que Ludo
 * lira dans sa boîte mail, donc elle doit se tester sans parler ni à Resend
 * ni à la collection de contenu.
 *
 * Trois garanties :
 *
 * 1. **L'ordre vient du YAML, jamais du navigateur.** Un client qui poste ses
 *    réponses dans le désordre ne réordonne pas le mail.
 * 2. **Une valeur inconnue est ignorée.** Seules les options réellement
 *    déclarées dans le questionnaire ressortent : une valeur forgée n'a
 *    aucun moyen d'écrire du texte arbitraire sous un libellé de question.
 * 3. **Une question sans réponse reste dans la liste**, marquée `SANS_REPONSE`.
 *    Un trou visible se lit ; une ligne absente passe inaperçue, et sur les
 *    questions décisives c'est précisément le trou qui informe.
 */
export function reponsesLisibles(
  questions: QuestionCadrage[],
  brutes: ReponseBrute[],
): ReponseLisible[] {
  const parQuestion = new Map(brutes.map((r) => [r.question, r]));

  return questions.map((q) => {
    const brute = parQuestion.get(q.id);
    const libre = brute?.texte?.trim() ?? "";

    if (q.type === "texte") {
      return { question: q.label, reponse: libre || SANS_REPONSE, decisif: q.decisif };
    }

    /* Choix : on ne retient que les valeurs qui existent au questionnaire, et
       on les rend dans l'ordre des options, pas dans celui de la soumission. */
    const cochees = new Set(brute?.valeurs ?? []);
    const labels = (q.options ?? []).filter((o) => cochees.has(o.valeur)).map((o) => o.label);

    /* Le « autre » est une option comme les autres à l'affichage, mais son
       contenu est du texte libre : il se rend « Autre : … » pour qu'on voie
       d'un coup d'œil que la réponse sort de la liste proposée. */
    if (q.autre && cochees.has("autre") && libre) labels.push(`Autre : ${libre}`);
    else if (q.autre && cochees.has("autre")) labels.push("Autre, sans précision");

    return {
      question: q.label,
      reponse: labels.join(" · ") || SANS_REPONSE,
      decisif: q.decisif,
    };
  });
}

/**
 * Sépare les réponses décisives du reste, en conservant l'ordre.
 *
 * Sur neuf questions, les trois qui déplacent le chiffrage ne doivent pas se
 * lire au même rang que les six autres : sans cette séparation, le mail est
 * une liste plate qu'on parcourt en diagonale.
 */
export function trierParPoids(reponses: ReponseLisible[]): {
  decisives: ReponseLisible[];
  autres: ReponseLisible[];
} {
  return {
    decisives: reponses.filter((r) => r.decisif),
    autres: reponses.filter((r) => !r.decisif),
  };
}
