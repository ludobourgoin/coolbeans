/* Rejoue la migration contre SQLite, à travers la même façade D1 que
   src/lib/documents/reponses.sqlite.test.ts, et y écrit le vrai manifeste du
   2026-10-02 par le SQL du planificateur : le SQL généré doit s'exécuter. */
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { D1Like } from "../devis/reponses";
import { planifierImport, sqlEcriture, type Fiche, type PieceManifeste } from "./plan-import";
import {
  annulerReglement,
  lireSansPanne,
  marquerReglee,
  pieceParId,
  piecesDuProjet,
  rattacher,
  toutesLesPieces,
} from "./store";

const lire = (chemin: string) => readFileSync(fileURLToPath(new URL(chemin, import.meta.url)), "utf8");
const manifeste = JSON.parse(lire("../../../scripts/pieces/tiime-2026-10-02.json")).pieces as PieceManifeste[];

function dbSqlite({ migree = true } = {}) {
  const sqlite = new DatabaseSync(":memory:");
  if (migree) sqlite.exec(lire("../../../migrations/0014_pieces.sql"));
  const requete = (sql: string, binds: unknown[] = []) => {
    const stmt = sqlite.prepare(sql);
    return {
      run: async () => stmt.run(...(binds as never[])),
      all: async <T>() => ({ results: stmt.all(...(binds as never[])) as T[] }),
    };
  };
  const d1: D1Like = {
    prepare: (sql: string) => ({ bind: (...binds: unknown[]) => requete(sql, binds), all: <T>() => requete(sql).all<T>() }),
  };
  return { d1, sqlite };
}

// Fiches et PDF tirés du manifeste lui-même : ce test vérifie le SQL et les
// lectures, pas la correspondance avec les fiches YAML (tâche 4).
const fiches: Fiche[] = [...new Map(manifeste.map((p) => [`${p.client ?? p.organisation}`, p])).values()].map((p) => ({
  slug: (p.client ?? p.organisation) as string,
  genre: p.client ? "client" : "organisation",
  raisonsSociales: [p.raison_sociale],
}));
const pdfs = manifeste.map((p) => `${p.type === "devis" ? "Devis" : "Facture"}_${p.numero}_Coolbeans.pdf`);
const projetsConnus = manifeste.flatMap((p) => (p.projet ? [p.projet] : []));

describe("table pieces (D1)", () => {
  let d1: D1Like;
  let sqlite: DatabaseSync;
  beforeEach(() => {
    ({ d1, sqlite } = dbSqlite());
    const plan = planifierImport({ manifeste, fiches, pdfs, existantes: [], projetsConnus });
    expect(plan.ecartees).toEqual([]);
    sqlite.exec(sqlEcriture(plan.nouvelles));
  });

  it("reçoit les 23 pièces du premier import", async () => {
    expect(await toutesLesPieces(d1)).toHaveLength(23);
  });

  it("lit les pièces d'un projet, de la plus ancienne à la plus récente", async () => {
    const ids = (await piecesDuProjet(d1, "fylgo", "boutique-shopify-390")).map((p) => p.id);
    expect(ids).toEqual(["devis-004330", "facture-024617", "facture-024624"]);
  });

  it("ne sert jamais une pièce adressée à un revendeur dans un projet client", async () => {
    expect(await piecesDuProjet(d1, "amusoire", "refonte-432")).toEqual([]);
    expect((await pieceParId(d1, "facture-024622"))?.organisation).toBe("trigger");
  });

  it("laisse le doublon 24615 hors de tout projet", async () => {
    expect((await pieceParId(d1, "facture-024615"))?.projet).toBeNull();
  });

  it("refuse une ligne sans client ni organisation", () => {
    expect(() =>
      sqlite.exec(
        "INSERT INTO pieces (id, type, numero, emise_le, ht, tva, ttc, raison_sociale, r2_key) VALUES ('devis-1', 'devis', '1', '2026-01-01', 1, 0, 1, 'X', 'k')",
      ),
    ).toThrow();
  });

  it("accepte un avoir aux montants négatifs", () => {
    expect(() =>
      sqlite.exec(
        "INSERT INTO pieces (id, type, numero, emise_le, ht, tva, ttc, client, raison_sociale, r2_key) VALUES ('avoir-000001', 'avoir', '000001', '2026-01-01', -100, -20, -120, 'fylgo', 'ABEAM DRINKS', 'k')",
      ),
    ).not.toThrow();
  });

  it("rattache, marque réglée puis annule le règlement", async () => {
    await rattacher(d1, "facture-024615", "accueil-mega-menu-246");
    await marquerReglee(d1, "facture-024624", "2026-10-05");
    let p = await pieceParId(d1, "facture-024624");
    expect(p).toMatchObject({ statut: "reglee", reglee_le: "2026-10-05" });
    await annulerReglement(d1, "facture-024624");
    p = await pieceParId(d1, "facture-024624");
    expect(p).toMatchObject({ statut: "a_regler", reglee_le: null });
    expect((await pieceParId(d1, "facture-024615"))?.projet).toBe("accueil-mega-menu-246");
  });

  it("ne marque jamais un devis comme réglé", async () => {
    await marquerReglee(d1, "devis-004330", "2026-10-05");
    expect((await pieceParId(d1, "devis-004330"))?.statut).toBeNull();
  });
});

describe("lireSansPanne", () => {
  it("rend le repli quand la table manque, au lieu de lever", async () => {
    const erreur = vi.spyOn(console, "error").mockImplementation(() => {});
    const { d1 } = dbSqlite({ migree: false });
    expect(await lireSansPanne(() => toutesLesPieces(d1), null)).toBeNull();
    expect(await lireSansPanne(() => pieceParId(d1, "facture-024624"), null)).toBeNull();
    expect(erreur).toHaveBeenCalledTimes(2);
    erreur.mockRestore();
  });

  it("rend la lecture quand la table répond", async () => {
    const { d1 } = dbSqlite();
    expect(await lireSansPanne(() => toutesLesPieces(d1), null)).toEqual([]);
  });
});
