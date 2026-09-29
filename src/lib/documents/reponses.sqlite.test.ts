/* Rejoue les migrations telles qu'elles partiront en production, contre
 * SQLite, à travers une façade qui imite l'API D1 utilisée par les modules.
 * Même raison que store.sqlite.test.ts : comparer des chaînes SQL ne dit pas
 * qu'elles s'exécutent. */

import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("cloudflare:workers", () => ({ env: {} }));

import type { D1Like } from "../devis/reponses";
import { devisClos, enregistrerReponse, reponsesDesVersions } from "../devis/reponses";
import {
  documentClos,
  enregistrerReponseDocument,
  lireReponses,
  reponsesDuDocument,
} from "./reponses";

const MIGRATIONS = [
  "0002_devis_reponses.sql",
  "0006_devis_facturation.sql",
  "0007_devis_options.sql",
  "0009_document_reponses.sql",
  "0010_reponses_canal.sql",
];

function dbSqlite() {
  const sqlite = new DatabaseSync(":memory:");
  for (const m of MIGRATIONS) {
    sqlite.exec(
      readFileSync(fileURLToPath(new URL(`../../../migrations/${m}`, import.meta.url)), "utf8"),
    );
  }
  const requete = (sql: string, binds: unknown[] = []) => {
    const stmt = sqlite.prepare(sql);
    return {
      run: async () => stmt.run(...(binds as never[])),
      all: async <T>() => ({ results: stmt.all(...(binds as never[])) as T[] }),
    };
  };
  const d1: D1Like = {
    prepare: (sql: string) => ({
      bind: (...binds: unknown[]) => requete(sql, binds),
      all: <T>() => requete(sql).all<T>(),
    }),
  };
  return { d1, sqlite };
}

const identite = { prenom: "Aurélie", nom: "Malbec", email: "aurelie@example.com" };

describe("document_reponses (D1)", () => {
  let d1: D1Like;
  let sqlite: DatabaseSync;
  beforeEach(() => {
    ({ d1, sqlite } = dbSqlite());
  });

  it("aller-retour : une réponse de cadrage se relit avec son instantané", async () => {
    await enregistrerReponseDocument(
      {
        type: "cadrage",
        slug: "aurelie-malbec/precommande-livre-6284",
        reponses: [{ question: "PayPal ou Stripe ?", reponse: "Stripe", decisif: true }],
        message: null,
        ...identite,
      },
      d1,
    );
    const [r] = await reponsesDuDocument("cadrage", ["aurelie-malbec/precommande-livre-6284"], d1);
    expect(r).toMatchObject({
      type: "cadrage",
      decision: null,
      origine: "formulaire",
      canal: "formulaire",
      email: "aurelie@example.com",
      photoR2: null,
    });
    expect(r.createdAt).toMatch(/^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/);
    expect(lireReponses(r.reponses)).toEqual([
      { question: "PayPal ou Stripe ?", reponse: "Stripe", decisif: true },
    ]);
  });

  it("toute réponse de cadrage ou de témoignage clôt le document", async () => {
    expect(await documentClos("cadrage", "a/b-1234", d1)).toBe(false);
    await enregistrerReponseDocument({ type: "cadrage", slug: "a/b-1234", ...identite }, d1);
    expect(await documentClos("cadrage", "a/b-1234", d1)).toBe(true);

    await enregistrerReponseDocument({ type: "temoignage", slug: "a/t-1", ...identite }, d1);
    expect(await documentClos("temoignage", "a/t-1", d1)).toBe(true);
  });

  it("des retours sur un livrable laissent le formulaire ouvert, une validation le ferme", async () => {
    await enregistrerReponseDocument(
      { type: "livrable", slug: "a/site", decision: "retours", message: "Le logo", ...identite },
      d1,
    );
    expect(await documentClos("livrable", "a/site", d1)).toBe(false);
    await enregistrerReponseDocument(
      { type: "livrable", slug: "a/site", decision: "validation", ...identite },
      d1,
    );
    expect(await documentClos("livrable", "a/site", d1)).toBe(true);
  });

  it("la clôture ne déborde ni sur un autre type ni sur une autre version", async () => {
    await enregistrerReponseDocument({ type: "cadrage", slug: "a/b", ...identite }, d1);
    expect(await documentClos("temoignage", "a/b", d1)).toBe(false);
    await enregistrerReponseDocument(
      { type: "livrable", slug: "a/site", decision: "validation", ...identite },
      d1,
    );
    expect(await documentClos("livrable", "a/site-v2", d1)).toBe(false);
  });

  it("relit toutes les versions d'un document, dans l'ordre d'arrivée", async () => {
    await enregistrerReponseDocument(
      { type: "livrable", slug: "a/site", decision: "retours", ...identite },
      d1,
    );
    await enregistrerReponseDocument(
      { type: "livrable", slug: "autre/site", decision: "retours", ...identite },
      d1,
    );
    await enregistrerReponseDocument(
      { type: "livrable", slug: "a/site-v2", decision: "validation", ...identite },
      d1,
    );
    const rs = await reponsesDuDocument("livrable", ["a/site", "a/site-v2"], d1);
    expect(rs.map((r) => [r.slug, r.decision])).toEqual([
      ["a/site", "retours"],
      ["a/site-v2", "validation"],
    ]);
    expect(await reponsesDuDocument("livrable", [], d1)).toEqual([]);
  });

  it("la table refuse un type ou une décision hors liste", () => {
    expect(() =>
      sqlite.exec(
        "INSERT INTO document_reponses (type, slug, prenom, nom, email) VALUES ('devis', 'x', 'a', 'b', 'c')",
      ),
    ).toThrow();
    expect(() =>
      sqlite.exec(
        "INSERT INTO document_reponses (type, slug, decision, prenom, nom, email) " +
          "VALUES ('livrable', 'x', 'question', 'a', 'b', 'c')",
      ),
    ).toThrow();
  });

  it("une décision reprise d'un mail porte son canal", async () => {
    sqlite.exec(
      "INSERT INTO document_reponses (type, slug, decision, prenom, nom, email, origine, canal, created_at) " +
        "VALUES ('livrable', 'cafa/site', 'retours', 'S', 'S', 's@x.fr', 'reprise', 'mail', '2026-09-18 14:01:48')",
    );
    const [r] = await reponsesDuDocument("livrable", ["cafa/site"], d1);
    expect(r).toMatchObject({ origine: "reprise", canal: "mail" });
    expect(() =>
      sqlite.exec(
        "INSERT INTO document_reponses (type, slug, prenom, nom, email, canal) VALUES ('cadrage', 'x', 'a', 'b', 'c', 'sms')",
      ),
    ).toThrow();
  });

  it("une reprise garde sa date d'origine", async () => {
    sqlite.exec(
      "INSERT INTO document_reponses (type, slug, prenom, nom, email, origine, created_at) " +
        "VALUES ('cadrage', 'a/b', 'A', 'M', 'a@x.fr', 'reprise', '2026-09-16 11:59:00')",
    );
    const [r] = await reponsesDuDocument("cadrage", ["a/b"], d1);
    expect(r).toMatchObject({ origine: "reprise", createdAt: "2026-09-16 11:59:00" });
  });
});

describe("devis_reponses : lecture par versions et clôture", () => {
  let d1: D1Like;
  beforeEach(() => {
    ({ d1 } = dbSqlite());
  });

  it("une question ne clôt pas la proposition, une validation la clôt", async () => {
    const base = { slug: "cafa/site-8791", message: null, ...identite };
    await enregistrerReponse({ ...base, decision: "question" }, d1);
    expect(await devisClos("cafa/site-8791", d1)).toBe(false);
    await enregistrerReponse({ ...base, decision: "validation", siren: "123456789" }, d1);
    expect(await devisClos("cafa/site-8791", d1)).toBe(true);

    const rs = await reponsesDesVersions(["cafa/site-8791", "cafa/site-8791-v2"], d1);
    expect(rs.map((r) => r.decision)).toEqual(["question", "validation"]);
    expect(rs[1]).toMatchObject({ siren: "123456789", canal: "formulaire" });
  });

  it("les lignes existantes prennent l'origine « formulaire » par défaut", async () => {
    await enregistrerReponse({ slug: "x", decision: "validation", message: null, ...identite }, d1);
    const { results } = await d1
      .prepare("SELECT origine FROM devis_reponses")
      .all<{ origine: string }>();
    expect(results).toEqual([{ origine: "formulaire" }]);
  });
});

describe("lireReponses", () => {
  it("rend une liste vide sur une colonne nulle, illisible ou mal formée", () => {
    expect(lireReponses(null)).toEqual([]);
    expect(lireReponses("pas du json")).toEqual([]);
    expect(lireReponses('{"question":"x"}')).toEqual([]);
    expect(lireReponses('[{"question":"q"},{"question":"q","reponse":"r"}]')).toEqual([
      { question: "q", reponse: "r", decisif: false },
    ]);
  });
});
