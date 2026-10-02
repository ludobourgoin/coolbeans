/* Une raison sociale désigne une seule fiche, client ou revendeur (spec
   2026-10-02, §1.2). Appelée au build par src/lib/documents/charger.ts. */
import { normaliserRaison } from "./plan-import";

export function verifierRaisonsSociales(
  fiches: readonly { chemin: string; raisonsSociales: readonly string[] }[],
): string[] {
  const erreurs: string[] = [];
  const vues = new Map<string, string>();
  for (const f of fiches) {
    for (const r of f.raisonsSociales) {
      const cle = normaliserRaison(r);
      const deja = vues.get(cle);
      if (deja && deja !== f.chemin) erreurs.push(`raison sociale « ${cle} » portée par deux fiches (${deja}, ${f.chemin})`);
      else vues.set(cle, f.chemin);
    }
  }
  return erreurs;
}
