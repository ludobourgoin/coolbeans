/* Le cœur de l'import des pièces Tiime (spec 2026-10-02, §2) : à partir du
   manifeste, des fiches, des PDF et des lignes déjà en base, décide quoi
   écrire. Aucun import à l'exécution : scripts/importer-pieces.mts l'importe
   sous `node --experimental-strip-types`, qui ne résout pas les imports sans
   extension. Les imports de type, eux, disparaissent. */
import type { CategoriePiece, Piece, StatutPiece, TypePiece } from "./piece";

export interface PieceManifeste {
  id: string;
  type: TypePiece;
  numero: string;
  categorie?: CategoriePiece | null;
  emise_le: string;
  echeance?: string | null;
  ht: number;
  tva: number;
  ttc: number;
  statut?: StatutPiece | null;
  reglee_le?: string | null;
  client?: string;
  organisation?: string;
  projet?: string | null;
  /** Identifiant court Linear, pour mémoire. L'import ne s'en sert pas. */
  linear?: string | null;
  raison_sociale: string;
  note?: string;
}

export interface Fiche {
  slug: string;
  genre: "client" | "organisation";
  raisonsSociales: string[];
}

export interface EntreeImport {
  manifeste: PieceManifeste[];
  fiches: Fiche[];
  /** Noms des fichiers du dossier de PDF. */
  pdfs: string[];
  existantes: Piece[];
  /** Slugs de la table PROJETS. */
  projetsConnus: readonly string[];
}

export interface PlanImport {
  nouvelles: Piece[];
  modifiees: { piece: Piece; champs: (keyof Piece)[] }[];
  inchangees: string[];
  ecartees: { id: string; motif: string }[];
  /** Nom du fichier PDF de chaque pièce à écrire, par id. */
  pdfs: Record<string, string>;
}

/** Les colonnes que l'import écrit et compare. `projet` n'y est pas : il ne
    se pose qu'à la création. */
const CHAMPS_SUIVIS: (keyof Piece)[] = [
  "type",
  "numero",
  "categorie",
  "emise_le",
  "echeance",
  "ht",
  "tva",
  "ttc",
  "statut",
  "reglee_le",
  "client",
  "organisation",
  "raison_sociale",
  "r2_key",
];

export const normaliserRaison = (texte: string): string =>
  texte.normalize("NFC").trim().replace(/\s+/g, " ").toLocaleUpperCase("fr-FR");

export const cleR2 = (id: string, dossier: string): string => `pieces/${dossier}/${id}.pdf`;

const PREFIXE_PDF: Record<TypePiece, string> = { devis: "Devis", facture: "Facture", avoir: "Avoir" };

export function pdfDeLaPiece(type: TypePiece, numero: string, pdfs: readonly string[]): string | undefined {
  const motif = new RegExp(`^${PREFIXE_PDF[type]}_${numero}_.*\\.pdf$`, "i");
  return pdfs.find((nom) => motif.test(nom));
}

/** Un réimport ne repasse jamais en « à régler » une facture réglée ou
    annulée (spec §1.4). Dans tous les autres cas, l'export Tiime fait foi. */
export function statutFinal(existant: StatutPiece | null, importe: StatutPiece | null): StatutPiece | null {
  if (importe === "a_regler" && existant !== null && existant !== "a_regler") return existant;
  return importe;
}

function motifDEcart(p: PieceManifeste, e: EntreeImport): string | null {
  if (p.id !== `${p.type}-${p.numero}`) return `identifiant « ${p.id} » différent de « ${p.type}-${p.numero} »`;
  if (Boolean(p.client) === Boolean(p.organisation)) return "il faut un client ou une organisation, pas les deux";
  if (![p.ht, p.tva, p.ttc].every(Number.isInteger)) return "montants en centimes entiers attendus";
  if (p.ht + p.tva !== p.ttc) return "HT + TVA ne fait pas le TTC";
  const genre = p.client ? "client" : "organisation";
  const slug = (p.client ?? p.organisation) as string;
  const fiche = e.fiches.find((f) => f.genre === genre && f.slug === slug);
  if (!fiche) return `fiche ${genre === "client" ? "clients" : "organisations"}/${slug} introuvable`;
  if (!fiche.raisonsSociales.map(normaliserRaison).includes(normaliserRaison(p.raison_sociale))) {
    return `« ${p.raison_sociale.trim()} » absente des raisonsSociales de ${slug}`;
  }
  if (p.projet && !e.projetsConnus.includes(p.projet)) return `projet « ${p.projet} » absent de la table PROJETS`;
  if (!pdfDeLaPiece(p.type, p.numero, e.pdfs)) return `aucun PDF pour ${p.type} ${p.numero}`;
  return null;
}

export function planifierImport(e: EntreeImport): PlanImport {
  const plan: PlanImport = { nouvelles: [], modifiees: [], inchangees: [], ecartees: [], pdfs: {} };
  const parId = new Map(e.existantes.map((x) => [x.id, x]));
  for (const p of [...e.manifeste].sort((a, b) => a.id.localeCompare(b.id))) {
    const motif = motifDEcart(p, e);
    if (motif) {
      plan.ecartees.push({ id: p.id, motif });
      continue;
    }
    const existante = parId.get(p.id);
    const statut = statutFinal(existante?.statut ?? null, p.statut ?? null);
    const dossier = (p.client ?? p.organisation) as string;
    const finale: Piece = {
      id: p.id,
      type: p.type,
      numero: p.numero,
      categorie: p.categorie ?? null,
      emise_le: p.emise_le,
      echeance: p.echeance ?? null,
      ht: p.ht,
      tva: p.tva,
      ttc: p.ttc,
      statut,
      // La date posée dans l'admin gagne sur celle du manifeste.
      reglee_le: statut === "reglee" ? (existante?.reglee_le ?? p.reglee_le ?? null) : null,
      client: p.client ?? null,
      organisation: p.organisation ?? null,
      // L'import pose le projet à la création et n'y touche plus (spec §2).
      projet: existante ? existante.projet : (p.projet ?? null),
      raison_sociale: p.raison_sociale.trim(),
      r2_key: cleR2(p.id, dossier),
    };
    if (!existante) {
      plan.nouvelles.push(finale);
      plan.pdfs[p.id] = pdfDeLaPiece(p.type, p.numero, e.pdfs) as string;
      continue;
    }
    const champs = CHAMPS_SUIVIS.filter((c) => finale[c] !== existante[c]);
    if (champs.length === 0) {
      plan.inchangees.push(p.id);
    } else {
      plan.modifiees.push({ piece: finale, champs });
      plan.pdfs[p.id] = pdfDeLaPiece(p.type, p.numero, e.pdfs) as string;
    }
  }
  return plan;
}

const litteral = (v: unknown): string => {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number") {
    if (!Number.isInteger(v)) throw new Error(`Nombre non entier : ${v}`);
    return String(v);
  }
  return `'${String(v).replace(/'/g, "''")}'`;
};

const COLONNES: (keyof Piece)[] = ["id", ...CHAMPS_SUIVIS, "projet"];

/** Insère ou met à jour. À la mise à jour, `projet` garde sa valeur en base :
    un rattachement fait dans l'admin entre le plan et l'écriture survit. */
export function sqlEcriture(pieces: readonly Piece[]): string {
  const maj = CHAMPS_SUIVIS.map((c) => `${c} = excluded.${c}`).join(", ");
  return pieces
    .map(
      (p) =>
        `INSERT INTO pieces (${COLONNES.join(", ")}) VALUES (${COLONNES.map((c) => litteral(p[c])).join(", ")})` +
        ` ON CONFLICT (id) DO UPDATE SET ${maj}, importee_le = datetime('now');`,
    )
    .join("\n");
}
