// Accès KV du module Projets.
//
// Le binding est TOUJOURS passé en argument : c'est ce qui permet de le
// remplacer par une Map en test, et de partager le même code entre le handler
// scheduled (qui reçoit `env`) et les pages Astro. `portalKv()` n'est qu'une
// commodité pour les appelants qui n'ont pas d'`env` sous la main.

import { env } from "cloudflare:workers";
import { hashSnapshot } from "./snapshot";
import type { SyncReport, TeamSnapshot, TeamSnapshotBody } from "./types";

/** Typage structurel du binding : pas de dépendance à @cloudflare/workers-types. */
export interface PortalKV {
  get(key: string): Promise<string | null>;
  getWithMetadata<M>(key: string): Promise<{ value: string | null; metadata: M | null }>;
  put(key: string, value: string, options?: { metadata?: unknown }): Promise<void>;
}

export const portalKv = (): PortalKV => (env as unknown as { PORTAL_KV: PortalKV }).PORTAL_KV;

export const teamKey = (gid: string) => `team:${gid}`;

/** Résumé technique du sync. JAMAIS exposé au client (corrections §3). */
export const LAST_SYNC_KEY = "meta:last_sync";

export interface SnapshotMetadata {
  hash: string;
  synced_at: string;
}

/**
 * Écriture conditionnelle au hash du contenu (corrections §3).
 *
 * Ce n'est plus une question de quota depuis le passage au plan payant (1 M
 * d'écritures par mois incluses) : c'est ce qui fait de « Dernière mise à jour »
 * la date du dernier CHANGEMENT et non de la dernière vérification. Le hash
 * porte sur le corps SANS `synced_at`, sans quoi il différerait à chaque passage.
 *
 * Nuance sur la lecture : `getWithMetadata` rapatrie aussi la valeur et coûte
 * le même unique subrequest qu'un `get`. L'économie réelle est de ne pas
 * `JSON.parse` un snapshot inchangé, et surtout de ne pas écrire.
 */
export async function writeSnapshotIfChanged(
  kv: PortalKV,
  body: TeamSnapshotBody,
  now: string,
): Promise<{ written: boolean; hash: string }> {
  const hash = await hashSnapshot(body);
  const { metadata } = await kv.getWithMetadata<SnapshotMetadata>(teamKey(body.team_gid));

  if (metadata?.hash === hash) return { written: false, hash };

  const snapshot: TeamSnapshot = { ...body, synced_at: now };
  await kv.put(teamKey(body.team_gid), JSON.stringify(snapshot), {
    metadata: { hash, synced_at: now } satisfies SnapshotMetadata,
  });
  return { written: true, hash };
}

/**
 * Ne lève jamais : une clé absente ou une valeur illisible donne `null`, ce qui
 * mène à l'empty state « synchronisation en cours » plutôt qu'à une 500.
 */
export async function readTeamSnapshot(kv: PortalKV, gid: string): Promise<TeamSnapshot | null> {
  const raw = await kv.get(teamKey(gid));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as TeamSnapshot;
  } catch {
    return null;
  }
}

/** Écrit à chaque passage : 288 écritures/jour, indépendantes du nombre de clients. */
export async function writeSyncReport(kv: PortalKV, report: SyncReport): Promise<void> {
  await kv.put(LAST_SYNC_KEY, JSON.stringify(report));
}
