import { toDevis } from "../../lib/chiffrage/toDevis";
import { fmtEUR } from "../../lib/chiffrage/format";
import type { SectionProps } from "./ChiffrageEditor";

/* Aperçu fidèle au contenu (sections conditionnelles, un seul total) ; la mise
   en forme finale est celle de DevisCorps sur la page publique. */
export default function DevisPreview({ c, catalogue, calc }: SectionProps) {
  let apercu: ReturnType<typeof toDevis> | null = null;
  try {
    apercu = toDevis(
      { ...c, prixRetenu: c.prixRetenu ?? calc.totalSuggere },
      catalogue, calc, new Date().toISOString(),
    );
  } catch {
    apercu = null;
  }

  if (!apercu || (calc.totalJoursProduction <= 0 && !c.objectif.trim())) {
    return (
      <section class="card">
        <h2>Aperçu devis client</h2>
        <p class="mt-2 text-[14px] text-mute">Remplis le configurateur pour voir le devis prendre forme ici.</p>
      </section>
    );
  }

  return (
    <section class="card grid gap-4">
      <h2>Aperçu devis client</h2>
      <div>
        <p class="label">Proposition commerciale</p>
        <p class="text-[18px] font-bold">{apercu.titre || "Sans titre"}</p>
        {apercu.objet && <p class="text-[14px] text-mute">{apercu.objet}</p>}
      </div>
      {apercu.sections.map((s) => (
        <div class="grid grid-cols-[140px_1fr] gap-4 border-t border-line pt-3 max-[640px]:grid-cols-1">
          <p class="label">{s.titre}</p>
          <div class="grid gap-1 text-[14px]">
            {s.texte && <p>{s.texte}</p>}
            {s.liste && s.liste.map((item) => <p>· {item}</p>)}
            {s.budget && (
              <>
                <p class="font-mono text-[18px] font-bold tabular-nums">
                  {fmtEUR(s.budget.lignes[0]?.prix ?? 0)} HT
                </p>
                {s.budget.reglement && <p class="text-mute">{s.budget.reglement}</p>}
              </>
            )}
          </div>
        </div>
      ))}
    </section>
  );
}
