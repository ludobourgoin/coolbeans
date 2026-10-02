import { describe, expect, it } from "vitest";
import { renderInvitation, renderLienMagique, renderReinitialisation } from "./auth";
import { renderReponseMessagerie } from "./messagerie-reponse";
import { renderConfirmationSupport } from "./support-confirmation";

// Bornes Unicode : `\b` ne connaît que l'ASCII, et « n'êtes » y contient le mot « tes ».
const mot = (mots: string) => new RegExp(`(?<![\\p{L}])(${mots})(?![\\p{L}])`, "iu");
const VOUS = mot("vous|votre|vos");
const IMPERATIF_VOUS = mot("copiez|ignorez|choisissez|répondez");
const TU = mot("tu|ton|ta|tes|toi");

const gabarits = (tutoiement: boolean) => [
  renderConfirmationSupport({ objet: "Bug", description: "Rien ne marche", prenom: "Thierry", tutoiement }),
  renderReponseMessagerie({
    objet: "Bug",
    corps: "C'est corrigé.",
    prenom: "Thierry",
    urlTicket: "https://my.coolbeans.cc/demandes/1",
    tutoiement,
  }),
  renderLienMagique({ url: "https://my.coolbeans.cc/x", tutoiement }),
  renderInvitation({ url: "https://my.coolbeans.cc/x", organisation: "UnlockBreath", inviteur: "Ludo", tutoiement }),
  renderReinitialisation({ url: "https://my.coolbeans.cc/x", prenom: "Thierry", tutoiement }),
];

describe("mails du portail, deux registres", () => {
  it("au tu, pas un vous ni un impératif vouvoyé", () => {
    for (const m of gabarits(true)) {
      for (const texte of [m.subject, m.text, m.html]) {
        expect(texte).not.toMatch(VOUS);
        expect(texte).not.toMatch(IMPERATIF_VOUS);
      }
    }
  });

  it("au vous par défaut, pas un tu", () => {
    for (const m of gabarits(false)) {
      for (const texte of [m.subject, m.text]) expect(texte).not.toMatch(TU);
    }
  });

  it("le vous reste celui d'aujourd'hui", () => {
    expect(renderLienMagique({ url: "https://x" }).subject).toBe("Votre lien de connexion à myCoolbeans");
    expect(renderLienMagique({ url: "https://x", tutoiement: true }).subject).toBe("Ton lien de connexion à myCoolbeans");
  });
});
