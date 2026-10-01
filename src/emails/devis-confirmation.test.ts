import { describe, expect, it } from "vitest";
import { renderConfirmationQuestion, renderConfirmationValidation } from "./devis-confirmation";

const base = { slug: "client/projet-1234", prenom: "Thierry" };

describe("accusés de réception du devis — pronom", () => {
  it("vouvoie par défaut", () => {
    const { subject, text } = renderConfirmationQuestion(base);
    expect(subject).toBe("Devis client/projet-1234 : bien reçu, je vous réponds vite");
    expect(text).toContain("je reviens vers vous très vite");
  });

  it("tutoie quand la proposition tutoie, sans un « vous » qui traîne", () => {
    /* Un client tutoyé sur la page qui reçoit un accusé vouvoyé lit deux
       interlocuteurs : aucune phrase ne doit rester au « vous ». */
    const validation = renderConfirmationValidation({
      ...base,
      tutoiement: true,
      message: "Ok",
      raisonSociale: "DOS ET POSTURE",
    });
    const question = renderConfirmationQuestion({ ...base, tutoiement: true, message: "Ok" });
    expect(question.subject).toBe("Devis client/projet-1234 : bien reçu, je te réponds vite");
    for (const mail of [validation, question]) {
      expect(mail.text).not.toMatch(/\b(vous|votre|vos)\b/i);
      expect(mail.html).not.toMatch(/\b(vous|votre|vos)\b/i);
    }
  });
});
