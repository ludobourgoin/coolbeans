import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("cloudflare:workers", () => ({ env: {} }));

import {
  enregistrerReponse,
  listerReponses,
  type D1Like,
  type ReponseDevis,
} from "./reponses";

/* Mock D1 mémoire minimal : ne comprend que les deux requêtes du module
   (INSERT paramétré, SELECT trié). Même esprit que le mock KV de
   ../chiffrage/store.test.ts. */
class D1Mock implements D1Like {
  rows: ReponseDevis[] = [];
  private prochainId = 1;
  private horloge = 0;

  prepare(sql: string) {
    const all = async <T>() => {
      if (!/^\s*SELECT/i.test(sql)) throw new Error(`SELECT attendu, reçu : ${sql}`);
      const tri = [...this.rows].sort(
        (a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id,
      );
      return { results: tri as T[] };
    };
    return {
      all,
      bind: (...values: unknown[]) => ({
        all,
        run: async () => {
          if (!/^\s*INSERT/i.test(sql)) throw new Error(`INSERT attendu, reçu : ${sql}`);
          const [slug, decision, message, prenom, nom, email] = values as [
            string,
            "validation" | "question",
            string | null,
            string,
            string,
            string,
          ];
          this.rows.push({
            id: this.prochainId++,
            slug,
            decision,
            message,
            prenom,
            nom,
            email,
            createdAt: new Date(1_000_000 * this.horloge++).toISOString(),
          });
          return {};
        },
      }),
    };
  }
}

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

  it("message absent stocké et relu comme null", async () => {
    await enregistrerReponse(
      { slug: "cafa", decision: "question", message: null, prenom: "S", nom: "S", email: "s@s.fr" },
      d1,
    );
    expect((await listerReponses(d1))[0].message).toBeNull();
  });
});
