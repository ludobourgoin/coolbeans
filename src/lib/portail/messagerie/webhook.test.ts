import { describe, expect, test } from "vitest";
import { SUPPORT_LABEL_ID } from "../linear";
import { analyserEvenement, analyserEvenementIssue, signatureValide } from "./webhook";

describe("signatureValide", () => {
  test("accepte le HMAC-SHA256 hex du corps brut", async () => {
    // Vecteur calculé réellement (pas copié du brief) :
    // node -e 'const c=require("crypto");console.log(c.createHmac("sha256","secret").update("corps").digest("hex"))'
    const attendu = "7b0a2f27c1116fa42eb393555fadc7594a678db6f0f408e79363dab020915c7e";
    expect(await signatureValide("secret", "corps", attendu)).toBe(true);
  });
  test("refuse une signature absente ou fausse", async () => {
    expect(await signatureValide("secret", "corps", null)).toBe(false);
    expect(await signatureValide("secret", "corps", "deadbeef")).toBe(false);
  });
  test("refuse un hex malformé (longueur impaire ou caractères invalides)", async () => {
    expect(await signatureValide("secret", "corps", "abc")).toBe(false);
    expect(await signatureValide("secret", "corps", "zz".repeat(32))).toBe(false);
  });
});

describe("analyserEvenement", () => {
  const commentaire = (body: string) => ({
    action: "create",
    type: "Comment",
    data: { id: "c1", body, issueId: "i1" },
  });
  test("retient un commentaire créé commençant par >>", () => {
    expect(analyserEvenement(commentaire(">> Bonjour"))).toEqual({
      commentId: "c1",
      issueId: "i1",
      body: ">> Bonjour",
    });
  });
  test("ignore les notes internes, les updates et les autres types", () => {
    expect(analyserEvenement(commentaire("note interne"))).toBeNull();
    expect(analyserEvenement({ ...commentaire(">> x"), action: "update" })).toBeNull();
    expect(analyserEvenement({ action: "create", type: "Issue", data: {} })).toBeNull();
  });
});

describe("analyserEvenementIssue", () => {
  const issue = (over: Record<string, unknown> = {}) => ({
    action: "update",
    type: "Issue",
    data: { id: "uuid-issue", teamId: "uuid-team", labelIds: [SUPPORT_LABEL_ID], ...over },
  });

  test("retient la pose du label Support", () => {
    expect(analyserEvenementIssue(issue())).toEqual({
      issueId: "uuid-issue",
      teamId: "uuid-team",
      support: true,
    });
  });

  // Le geste courant est de créer l'issue PUIS de poser le label : sans les
  // update, la porte d'entrée ne s'ouvrirait presque jamais.
  test("retient aussi bien les create que les update", () => {
    expect(analyserEvenementIssue({ ...issue(), action: "create" })?.support).toBe(true);
  });

  // Support absent = retrait du label. L'événement est retourné quand même :
  // c'est l'appelant qui décide s'il y a un fil à masquer.
  test("signale l'absence du label sans écarter l'événement", () => {
    expect(analyserEvenementIssue(issue({ labelIds: [] }))?.support).toBe(false);
    expect(analyserEvenementIssue(issue({ labelIds: undefined }))?.support).toBe(false);
  });

  test("ignore les événements qui ne sont pas des issues", () => {
    expect(analyserEvenementIssue({ ...issue(), type: "Comment" })).toBeNull();
    expect(analyserEvenementIssue({ ...issue(), action: "remove" })).toBeNull();
    expect(analyserEvenementIssue(issue({ teamId: undefined }))).toBeNull();
  });
});
