import { describe, expect, it } from "vitest";
import { reponsesLisibles, trierParPoids, SANS_REPONSE, type QuestionCadrage } from "./cadrage";

/* `reponsesLisibles` décide de ce que Ludo lira dans sa boîte mail à partir
   d'un POST venu d'une page publique. Les trois propriétés testées ici sont
   celles qui, si elles cassent, produisent un mail faux sans rien signaler :
   l'ordre, l'écart des valeurs inconnues, et la persistance des trous. */

const q = (over: Partial<QuestionCadrage> & Pick<QuestionCadrage, "id" | "label" | "type">) =>
  ({
    decisif: false,
    requis: false,
    multiple: false,
    autre: false,
    long: false,
    ...over,
  }) as QuestionCadrage;

const QUESTIONS: QuestionCadrage[] = [
  q({
    id: "gene",
    label: "Qu'est-ce qui te gêne le plus ?",
    type: "choix",
    autre: true,
    options: [
      { valeur: "salle-pleine", label: "Trop de monde dans la salle" },
      { valeur: "messages", label: "Trop de temps à répondre aux messages" },
    ],
  }),
  q({ id: "cours", label: "Quels cours sont concernés ?", type: "texte", long: true }),
  q({
    id: "mode",
    label: "Qui tient les comptes ?",
    type: "choix",
    decisif: true,
    options: [
      { valeur: "eux", label: "Les gens réservent eux-mêmes" },
      { valeur: "moi", label: "Je garde la main" },
    ],
  }),
];

describe("reponsesLisibles", () => {
  it("traduit les identifiants en libellés du questionnaire", () => {
    const out = reponsesLisibles(QUESTIONS, [
      { question: "gene", valeurs: ["salle-pleine"] },
      { question: "cours", texte: "Le Pilates du mardi" },
      { question: "mode", valeurs: ["moi"] },
    ]);

    expect(out.map((r) => r.reponse)).toEqual([
      "Trop de monde dans la salle",
      "Le Pilates du mardi",
      "Je garde la main",
    ]);
  });

  it("suit l'ordre du questionnaire, pas celui de la soumission", () => {
    const out = reponsesLisibles(QUESTIONS, [
      { question: "mode", valeurs: ["eux"] },
      { question: "gene", valeurs: ["messages"] },
    ]);

    expect(out.map((r) => r.question)).toEqual(QUESTIONS.map((x) => x.label));
  });

  it("ignore une valeur absente du questionnaire", () => {
    // Cas d'un POST forgé : la valeur n'existe pas, donc rien ne doit
    // apparaître sous le libellé de la question.
    const out = reponsesLisibles(QUESTIONS, [
      { question: "gene", valeurs: ["salle-pleine", "<script>alert(1)</script>"] },
    ]);

    expect(out[0].reponse).toBe("Trop de monde dans la salle");
  });

  it("ignore une question inconnue au lieu de l'ajouter au mail", () => {
    const out = reponsesLisibles(QUESTIONS, [{ question: "inventee", texte: "coucou" }]);

    expect(out).toHaveLength(QUESTIONS.length);
    expect(out.every((r) => r.reponse === SANS_REPONSE)).toBe(true);
  });

  it("garde les questions sans réponse, marquées comme telles", () => {
    const out = reponsesLisibles(QUESTIONS, [{ question: "cours", texte: "  " }]);

    // Un trou visible se lit ; une ligne absente passe inaperçue, et sur une
    // question décisive c'est précisément le trou qui informe.
    expect(out[1].reponse).toBe(SANS_REPONSE);
    expect(out[2].reponse).toBe(SANS_REPONSE);
  });

  it("rend le « autre » en clair, et signale un « autre » sans précision", () => {
    const avec = reponsesLisibles(QUESTIONS, [
      { question: "gene", valeurs: ["autre"], texte: "Les inscriptions par WhatsApp" },
    ]);
    const sans = reponsesLisibles(QUESTIONS, [{ question: "gene", valeurs: ["autre"] }]);

    expect(avec[0].reponse).toBe("Autre : Les inscriptions par WhatsApp");
    expect(sans[0].reponse).toBe("Autre, sans précision");
  });

  it("joint les réponses multiples dans l'ordre des options", () => {
    const out = reponsesLisibles(QUESTIONS, [
      { question: "gene", valeurs: ["messages", "salle-pleine"] },
    ]);

    expect(out[0].reponse).toBe("Trop de monde dans la salle · Trop de temps à répondre aux messages");
  });
});

describe("trierParPoids", () => {
  it("isole les questions qui décident du chiffrage", () => {
    const { decisives, autres } = trierParPoids(
      reponsesLisibles(QUESTIONS, [{ question: "mode", valeurs: ["eux"] }]),
    );

    expect(decisives.map((r) => r.reponse)).toEqual(["Les gens réservent eux-mêmes"]);
    expect(autres).toHaveLength(2);
  });
});
