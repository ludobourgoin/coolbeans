import { env } from "cloudflare:workers";
import type { Reglages, Segment } from "./types";
import { REGLAGES_DEFAUT } from "./defaults";

export interface KVLike {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
  list(opts: { prefix: string; cursor?: string }): Promise<{ keys: { name: string }[]; list_complete: boolean; cursor?: string }>;
}

/* Typage structurel du binding : évite de dépendre de @cloudflare/workers-types
   et permet le mock en mémoire dans les tests. */
export const kv = (): KVLike => (env as unknown as { PORTAL_KV: KVLike }).PORTAL_KV;

const CLE_REGLAGES = "pilotage:reglages";
const CLE_CATALOGUE_LEGACY = "pilotage:catalog";

/* Ancien format `pilotage:catalog`, tel que stocké avant le chantier cockpit-devis.
   Ne sert qu'à la migration douce de lecture ; jamais réécrit ni supprimé ici. */
interface CatalogueLegacy {
  settings: {
    tjm: number;
    marcheBas: number;
    marcheHaut: number;
    joursSemaine: number;
    semainesMarge: number;
    chargesPct: number;
  };
  catalog: {
    affinite: { baisse: number; hausse: number };
    gestion: { urgencePct: number };
    devisTexts: {
      stackTechnique: string;
      conditionsReglement: string;
      ceQueCaComprend: string;
      horsPerimetre: string;
    };
  };
  segments: Record<string, Segment>;
}

function migrerDepuisCatalogueLegacy(legacy: CatalogueLegacy): Reglages {
  return {
    tjm: legacy.settings.tjm,
    heuresJour: REGLAGES_DEFAUT.heuresJour,
    marcheBas: legacy.settings.marcheBas,
    marcheHaut: legacy.settings.marcheHaut,
    joursSemaine: legacy.settings.joursSemaine,
    semainesMarge: legacy.settings.semainesMarge,
    chargesPct: legacy.settings.chargesPct,
    gestionPct: REGLAGES_DEFAUT.gestionPct,
    urgencePct: legacy.catalog.gestion.urgencePct,
    affinite: legacy.catalog.affinite,
    segments: legacy.segments,
    devisTexts: {
      stackTechnique: legacy.catalog.devisTexts.stackTechnique,
      conditionsReglement: legacy.catalog.devisTexts.conditionsReglement,
      ceQueCaComprend: legacy.catalog.devisTexts.ceQueCaComprend,
      horsPerimetre: legacy.catalog.devisTexts.horsPerimetre,
      urgenceTooltip: REGLAGES_DEFAUT.devisTexts.urgenceTooltip,
    },
  };
}

/* Parse défensif : une entrée KV corrompue ne doit jamais faire planter le
   consommateur, seulement dégrader vers le prochain repli (legacy puis défauts). */
function parseJson<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function getReglages(ns: KVLike = kv()): Promise<Reglages> {
  const raw = await ns.get(CLE_REGLAGES);
  const reglages = raw ? parseJson<Reglages>(raw) : null;
  if (reglages) return reglages;

  const legacyRaw = await ns.get(CLE_CATALOGUE_LEGACY);
  const legacy = legacyRaw ? parseJson<CatalogueLegacy>(legacyRaw) : null;
  if (legacy) return migrerDepuisCatalogueLegacy(legacy);

  return structuredClone(REGLAGES_DEFAUT);
}

export async function saveReglages(r: Reglages, ns: KVLike = kv()): Promise<void> {
  await ns.put(CLE_REGLAGES, JSON.stringify(r));
}
