import { expect, test } from "vitest";
import { peutServirFichier, serviceFichier } from "./acces";
import type { DocumentRow } from "./store";

function doc(sur: Partial<DocumentRow> = {}): DocumentRow {
  return {
    id: "d1",
    client: "amusoire",
    titre: "contrat.pdf",
    source: "fichier",
    r2_key: "documents/amusoire/abc.pdf",
    url: null,
    mime: "application/pdf",
    taille: 1234,
    date_doc: "2026-09-01",
    visible: 1,
    cree_le: "2026-09-01T10:00:00.000Z",
    cle_source: null,
    ...sur,
  };
}

const client = { connecte: true, clientCourant: "amusoire", admin: false };

test("un client reçoit son document visible", () => {
  expect(peutServirFichier({ ...client, doc: doc() })).toBe(true);
});

/* LE TEST QUI COMPTE. La liste ne montre pas la ligne masquée, mais son URL
   reste devinable : sans ce refus, un client récupère un document qu'on ne lui
   a jamais montré. */
test("un client ne reçoit pas un document masqué", () => {
  expect(peutServirFichier({ ...client, doc: doc({ visible: 0 }) })).toBe(false);
});

/* L'AUTRE TEST QUI COMPTE. */
test("un client ne reçoit pas le document d'un autre client", () => {
  expect(peutServirFichier({ ...client, doc: doc({ client: "fylgo" }) })).toBe(false);
});

test("un admin voit les documents masqués du client qu'il regarde", () => {
  expect(peutServirFichier({ ...client, admin: true, doc: doc({ visible: 0 }) })).toBe(true);
});

test("un admin ne traverse pas la frontière du workspace courant", () => {
  // Il regarde un workspace à la fois : le sélecteur fait foi, pas le rôle.
  expect(peutServirFichier({ ...client, admin: true, doc: doc({ client: "fylgo" }) })).toBe(false);
});

test("sans session, rien ne sort", () => {
  expect(peutServirFichier({ ...client, connecte: false, doc: doc() })).toBe(false);
});

test("sans client courant résolu, rien ne sort", () => {
  expect(peutServirFichier({ ...client, clientCourant: null, doc: doc() })).toBe(false);
});

test("une ligne qui n'est pas un fichier ne passe pas par cette route", () => {
  expect(peutServirFichier({ ...client, doc: doc({ source: "lien", r2_key: null }) })).toBe(false);
  expect(peutServirFichier({ ...client, doc: null })).toBe(false);
});

test("seuls les images et les PDF s'affichent dans le navigateur", () => {
  expect(serviceFichier("application/pdf", "a.pdf").contentType).toBe("application/pdf");
  expect(serviceFichier("image/png", "a.png").disposition).toMatch(/^inline/);
  // Un text/html servi inline sur l'origine du cookie de session, c'est un XSS.
  expect(serviceFichier("text/html", "piege.html").contentType).toBe("application/octet-stream");
  expect(serviceFichier("text/html", "piege.html").disposition).toMatch(/^attachment/);
  expect(serviceFichier(null, "x.bin").contentType).toBe("application/octet-stream");
});

test("un nom de fichier accentué reste lisible dans l'en-tête", () => {
  expect(serviceFichier("application/pdf", "devis été.pdf").disposition).toBe(
    "inline; filename*=UTF-8''devis%20%C3%A9t%C3%A9.pdf",
  );
});
