import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("cloudflare:workers", () => ({ env: {} }));

import {
  derniereReponse,
  enregistrerReponse,
  listerReponses,
  marquerTacheLinear,
  tacheExistante,
} from "./reponses";
import { D1Mock } from "./reponses.mock";

describe("réponses devis (D1)", () => {
  let d1: D1Mock;
  beforeEach(() => {
    d1 = new D1Mock();
  });

  it("aller-retour : une réponse enregistrée se relit avec tous ses champs", async () => {
    await enregistrerReponse(
      {
        slug: "cafa",
        decision: "validation",
        message: "On y va !",
        prenom: "Suzanne",
        nom: "Salerno",
        email: "suzanne@example.com",
      },
      d1,
    );
    const reponses = await listerReponses(d1);
    expect(reponses).toHaveLength(1);
    expect(reponses[0]).toMatchObject({
      slug: "cafa",
      decision: "validation",
      message: "On y va !",
      prenom: "Suzanne",
      nom: "Salerno",
      email: "suzanne@example.com",
    });
    expect(typeof reponses[0].id).toBe("number");
    expect(typeof reponses[0].createdAt).toBe("string");
  });

  it("coordonnées de facturation persistées, et absentes quand non fournies", async () => {
    await enregistrerReponse(
      {
        slug: "revolutions-douces/salon-2026-5336",
        decision: "validation",
        message: null,
        prenom: "Sam",
        nom: "Klingelschmitt",
        email: "sam@example.org",
        raisonSociale: "Rév'olutions Douces",
        siren: "123456789",
        adresse: "1 rue du Salon, 34300 Agde",
        tva: "FR00123456789",
      },
      d1,
    );
    await enregistrerReponse(
      {
        slug: "particulier",
        decision: "question",
        message: null,
        prenom: "A",
        nom: "B",
        email: "a@b.c",
      },
      d1,
    );
    const parSlug = new Map((await listerReponses(d1)).map((r) => [r.slug, r]));
    expect(parSlug.get("revolutions-douces/salon-2026-5336")).toMatchObject({
      raisonSociale: "Rév'olutions Douces",
      siren: "123456789",
      adresse: "1 rue du Salon, 34300 Agde",
      tva: "FR00123456789",
    });
    /* Un particulier n'a ni raison sociale ni SIREN : les colonnes doivent
       valoir null, pas une chaîne vide qui s'afficherait comme une donnée. */
    expect(parSlug.get("particulier")).toMatchObject({
      raisonSociale: null,
      siren: null,
      adresse: null,
      tva: null,
    });
  });

  it("liste triée de la plus récente à la plus ancienne", async () => {
    const base = {
      decision: "question" as const,
      message: null,
      prenom: "A",
      nom: "B",
      email: "a@b.c",
    };
    await enregistrerReponse({ ...base, slug: "premier" }, d1);
    await enregistrerReponse({ ...base, slug: "second" }, d1);
    const reponses = await listerReponses(d1);
    expect(reponses.map((r) => r.slug)).toEqual(["second", "premier"]);
  });

  it("deux réponses sur le même devis : seule la plus récente est rendue", async () => {
    const base = { prenom: "S", nom: "S", email: "s@s.fr" };
    await enregistrerReponse({ ...base, slug: "cafa", decision: "question", message: "1ère" }, d1);
    await enregistrerReponse({ ...base, slug: "cafa", decision: "validation", message: "2ème" }, d1);
    const reponses = await listerReponses(d1);
    expect(reponses).toHaveLength(1);
    expect(reponses[0].decision).toBe("validation");
    expect(reponses[0].message).toBe("2ème");
  });

  it("message absent stocké et relu comme null", async () => {
    await enregistrerReponse(
      { slug: "cafa", decision: "question", message: null, prenom: "S", nom: "S", email: "s@s.fr" },
      d1,
    );
    expect((await listerReponses(d1))[0].message).toBeNull();
  });

  it("derniereReponse rend la ligne qu'on vient d'écrire, undefined sinon", async () => {
    expect(await derniereReponse("cafa", d1)).toBeUndefined();
    const base = { prenom: "S", nom: "S", email: "s@s.fr", decision: "question" as const };
    await enregistrerReponse({ ...base, slug: "cafa", message: "1ère" }, d1);
    await enregistrerReponse({ ...base, slug: "cafa", message: "2ème" }, d1);
    expect((await derniereReponse("cafa", d1))?.message).toBe("2ème");
  });

  it("tacheExistante : null tant qu'aucune tâche n'est accrochée", async () => {
    await enregistrerReponse(
      { slug: "cafa", decision: "validation", message: null, prenom: "S", nom: "S", email: "s@s.fr" },
      d1,
    );
    expect(await tacheExistante("cafa", d1)).toBeNull();
    const id = (await derniereReponse("cafa", d1))!.id;
    await marquerTacheLinear(id, "issue-uuid", d1);
    expect(await tacheExistante("cafa", d1)).toBe("issue-uuid");
    /* La tâche est portée par le devis, pas par la réponse : une seconde
       soumission ne doit pas repartir de zéro. */
    expect(await tacheExistante("autre-devis", d1)).toBeNull();
  });
});
