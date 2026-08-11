import { env } from "cloudflare:workers";
import type { Catalogue, Chiffrage } from "./types";
import type { DevisSnapshotData } from "./toDevis";
import { CATALOGUE_DEFAUT } from "./defaults";

export interface KVLike {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
  list(opts: { prefix: string; cursor?: string }): Promise<{ keys: { name: string }[]; list_complete: boolean; cursor?: string }>;
}

/* Typage structurel du binding : évite de dépendre de @cloudflare/workers-types
   et permet le mock en mémoire dans les tests. */
export const kv = (): KVLike => (env as unknown as { PORTAL_KV: KVLike }).PORTAL_KV;

export interface DevisPublie {
  clientSlug: string;
  projetSlug: string;
  id: string;
  versions: { n: number; publishedAt: string; data: DevisSnapshotData }[];
}

export const cleChiffrage = (id: string) => `chiffrage:${id}`;
export const cleDevis = (clientSlug: string, projetSlug: string, id: string) =>
  `devis:${clientSlug}:${projetSlug}-${id}`;

export async function getCatalogue(ns: KVLike = kv()): Promise<Catalogue> {
  const raw = await ns.get("pilotage:catalog");
  return raw ? (JSON.parse(raw) as Catalogue) : structuredClone(CATALOGUE_DEFAUT);
}

export async function saveCatalogue(c: Catalogue, ns: KVLike = kv()): Promise<void> {
  await ns.put("pilotage:catalog", JSON.stringify(c));
}

export async function getChiffrage(id: string, ns: KVLike = kv()): Promise<Chiffrage | null> {
  const raw = await ns.get(cleChiffrage(id));
  return raw ? (JSON.parse(raw) as Chiffrage) : null;
}

export async function saveChiffrage(c: Chiffrage & { id: string }, ns: KVLike = kv()): Promise<void> {
  await ns.put(cleChiffrage(c.id), JSON.stringify(c));
}

export async function deleteChiffrage(id: string, ns: KVLike = kv()): Promise<void> {
  await ns.delete(cleChiffrage(id));
}

export async function listChiffrages(ns: KVLike = kv()): Promise<Chiffrage[]> {
  const noms: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await ns.list({ prefix: "chiffrage:", cursor });
    noms.push(...page.keys.map((k) => k.name));
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  const raws = await Promise.all(noms.map((k) => ns.get(k)));
  return raws.filter((r): r is string => r !== null).map((r) => JSON.parse(r) as Chiffrage);
}

export async function genererId(
  ns: KVLike = kv(),
  tirage: () => number = () => Math.floor(1000 + Math.random() * 99000),
): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const id = String(tirage());
    if (!(await ns.get(cleChiffrage(id)))) return id;
  }
  throw new Error("Impossible de générer un identifiant libre.");
}

export async function getDevisPublieParCle(key: string, ns: KVLike = kv()): Promise<DevisPublie | null> {
  const raw = await ns.get(key);
  return raw ? (JSON.parse(raw) as DevisPublie) : null;
}

export async function publierVersion(
  c: Chiffrage & { id: string },
  data: DevisSnapshotData,
  ns: KVLike = kv(),
): Promise<{ url: string; n: number }> {
  const key = cleDevis(c.clientSlug, c.projetSlug, c.id);
  const doc: DevisPublie = (await getDevisPublieParCle(key, ns)) ?? {
    clientSlug: c.clientSlug,
    projetSlug: c.projetSlug,
    id: c.id,
    versions: [],
  };
  const n = doc.versions.length + 1;
  doc.versions.push({ n, publishedAt: data.date, data });
  await ns.put(key, JSON.stringify(doc));
  return { url: `/devis/${c.clientSlug}/${c.projetSlug}-${c.id}`, n };
}
