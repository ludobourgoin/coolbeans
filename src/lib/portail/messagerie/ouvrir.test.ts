import { describe, expect, it } from "vitest";
import { SUPPORT_LABEL_ID } from "../linear";
import { decisionOuverture } from "./ouvrir";

const issue = (over: Partial<Parameters<typeof decisionOuverture>[0] & object> = {}) => ({
  title: "Le formulaire de contact n'envoie plus de mail",
  description: "Contexte interne : SPF cassé depuis la migration.\n\n>> Bonjour, c'est réparé.",
  url: "https://linear.app/coolbeans-hq/issue/AMU-12",
  labelIds: [SUPPORT_LABEL_ID],
  ...over,
});

describe("decisionOuverture", () => {
  it("ouvre le fil avec le titre en objet et le bloc >> en message", () => {
    const d = decisionOuverture(issue());
    expect(d).toMatchObject({
      type: "ouvrir",
      objet: "Le formulaire de contact n'envoie plus de mail",
      corps: "Bonjour, c'est réparé.",
    });
  });

  // Le contexte interne au-dessus du >> ne doit jamais partir : c'est toute la
  // raison d'être du marqueur, et la ligne de défense contre la fuite de notes.
  it("laisse le contexte au-dessus du marqueur hors du message", () => {
    const d = decisionOuverture(issue());
    expect(d.type === "ouvrir" && d.corps).not.toContain("SPF");
  });

  // Trois annulations, toutes légitimes et toutes silencieuses.
  it("annule quand l'issue a disparu", () => {
    expect(decisionOuverture(null)).toMatchObject({ type: "annuler" });
  });

  it("annule quand le label Support a été retiré pendant le délai de grâce", () => {
    expect(decisionOuverture(issue({ labelIds: [] }))).toMatchObject({ type: "annuler" });
  });

  // Le cas le plus fréquent : Ludo tague une issue de travail ordinaire. Rien
  // ne doit partir chez le client tant qu'il n'a pas écrit de bloc >>.
  it("annule quand la description n'a pas de bloc >>", () => {
    const d = decisionOuverture(issue({ description: "Juste une note interne." }));
    expect(d).toMatchObject({ type: "annuler" });
  });

  it("annule sur une description vide", () => {
    expect(decisionOuverture(issue({ description: null }))).toMatchObject({ type: "annuler" });
  });

  // Une image du CDN privé Linear serait morte chez le client : retirée, et si
  // le message se réduisait à ça, il n'y a plus rien à ouvrir.
  it("annule quand le bloc >> ne contenait qu'une image Linear", () => {
    const description = ">> ![capture](https://uploads.linear.app/abc/def.png)";
    expect(decisionOuverture(issue({ description }))).toMatchObject({ type: "annuler" });
  });

  it("compte les images retirées pour l'alerte à Ludo", () => {
    const description = ">> Voilà le rendu :\n![c](https://uploads.linear.app/a.png)";
    const d = decisionOuverture(issue({ description }));
    expect(d).toMatchObject({ type: "ouvrir", imagesRetirees: 1 });
  });
});
