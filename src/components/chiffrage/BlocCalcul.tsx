import { fmtEUR, fmtJ } from "../../lib/chiffrage/format";
import type { SectionProps } from "./ChiffrageEditor";

export default function BlocCalcul({ c, patch, catalogue, calc }: SectionProps) {
  const g = catalogue.catalog.gestion;
  const libre = c.mode === "libre";
  const affiniteLabel =
    c.affinite === "envie" ? `Affinité : remise ${catalogue.catalog.affinite.baisse} %`
    : c.affinite === "pasenvie" ? `Affinité : majoration ${catalogue.catalog.affinite.hausse} %`
    : "Affinité : neutre";

  return (
    <section class="card grid gap-4 bg-surface-subtle">
      <div class="flex flex-wrap gap-6">
        <div><span class="label">Total jours production</span>
          <p class="font-mono text-[18px] font-bold tabular-nums">{fmtJ(calc.totalJoursProduction)}</p></div>
        <div><span class="label">Sous-total au TJM cible</span>
          <p class="font-mono text-[18px] font-bold tabular-nums">{fmtEUR(calc.sousTotal)}</p></div>
        <div><span class="label">Délai estimé</span>
          <p class="font-mono text-[14px] font-bold tabular-nums">
            {calc.totalJoursProduction > 0
              ? `${fmtJ(calc.semainesTotal)} semaines (${fmtJ(calc.semainesBase)} de production + ${fmtJ(catalogue.settings.semainesMarge)} de marge)`
              : "—"}
          </p></div>
      </div>

      {!libre && (
        <>
          <div class="flex flex-wrap gap-4 border-t border-line pt-4">
            <div class="grid gap-2">
              <label class="label">Affinité avec le client</label>
              <select class="field" value={c.affinite}
                onChange={(e) => patch({ affinite: e.currentTarget.value as typeof c.affinite })}>
                <option value="neutre">Neutre</option>
                <option value="envie">Très envie de bosser avec eux (remise)</option>
                <option value="pasenvie">Pas très envie (majoration)</option>
              </select>
            </div>
            <div class="grid gap-2">
              <label class="label">Marge Coolbeans</label>
              <select class="field" value={String(c.margePct)}
                onChange={(e) => patch({ margePct: Number(e.currentTarget.value) as typeof c.margePct })}>
                <option value="0">0 %</option><option value="10">10 %</option>
                <option value="20">20 %</option><option value="30">30 %</option>
              </select>
            </div>
          </div>

          <div class="border-t border-line pt-4">
            <label class="flex items-center gap-2 text-[13px] font-bold">
              <input type="checkbox" checked={c.gestionProjet}
                onChange={(e) => patch({ gestionProjet: e.currentTarget.checked })} />
              Gestion de projet
            </label>
            <p class="mt-1 text-[13px] text-mute">
              Réunions hebdos jusqu'à la livraison dans les délais du devis, appels sporadiques,
              comptes-rendus, suivi du planning.
            </p>
            {c.gestionProjet && (
              <div class="mt-2 grid gap-1 text-[12px] text-mute">
                {calc.gestion.jours === 0 ? (
                  <p>Ajoute des pages ou du développement (pour estimer un délai), ou coche un setup, pour voir le calcul.</p>
                ) : (
                  <>
                    {calc.gestion.hebdo > 0 && (
                      <p>{fmtJ(calc.semainesTotal)} semaines de suivi à {g.coefHebdo} j = {fmtJ(calc.gestion.hebdo)} j ({fmtEUR(calc.gestion.hebdo * catalogue.settings.tjm)})</p>
                    )}
                    {calc.gestion.cms > 0 && <p>Setup CMS : forfait {fmtJ(calc.gestion.cms)} j ({fmtEUR(calc.gestion.cms * catalogue.settings.tjm)})</p>}
                    {calc.gestion.multilingue > 0 && <p>Setup multilingue : forfait {fmtJ(calc.gestion.multilingue)} j ({fmtEUR(calc.gestion.multilingue * catalogue.settings.tjm)})</p>}
                    {calc.gestion.hebergement > 0 && <p>Setup hébergement : forfait {fmtJ(calc.gestion.hebergement)} j ({fmtEUR(calc.gestion.hebergement * catalogue.settings.tjm)})</p>}
                    {calc.gestion.domaine > 0 && <p>Setup domaine/DNS : forfait {fmtJ(calc.gestion.domaine)} j ({fmtEUR(calc.gestion.domaine * catalogue.settings.tjm)})</p>}
                    <p class="font-bold text-ink">Total gestion de projet : {fmtJ(calc.gestion.jours)} j = {fmtEUR(calc.gestion.montant)}</p>
                  </>
                )}
              </div>
            )}
          </div>

          <label class="flex items-center gap-2 border-t border-line pt-4 text-[13px] font-bold">
            <input type="checkbox" checked={c.urgence} onChange={(e) => patch({ urgence: e.currentTarget.checked })} />
            Projet prioritaire / urgent (+{g.urgencePct} %)
          </label>

          <div class="flex flex-wrap gap-4 border-t border-line pt-4">
            <div class="grid min-w-[220px] flex-1 gap-2">
              <label class="label">Réduction exceptionnelle — nom</label>
              <input class="field" placeholder="ex : geste commercial, budget asso confirmé" value={c.reductionNom}
                onInput={(e) => patch({ reductionNom: e.currentTarget.value })} />
            </div>
            <div class="grid gap-2">
              <label class="label">Montant (€)</label>
              <input class="field w-[130px]" type="number" min={0} value={c.reductionMontant || ""}
                onInput={(e) => patch({ reductionMontant: Number(e.currentTarget.value) || 0 })} />
            </div>
          </div>

          <div class="grid gap-1 border-t border-line pt-4 font-mono text-[13px] tabular-nums">
            <p>Sous-total production : {fmtEUR(calc.sousTotal)}</p>
            <p>{affiniteLabel} → {fmtEUR(calc.ajusteAffinite)}</p>
            {c.gestionProjet && calc.gestion.montant > 0 && <p>Gestion de projet : + {fmtEUR(calc.gestion.montant)}</p>}
            {c.urgence && <p>Urgence (+{g.urgencePct} %) : + {fmtEUR(calc.majorationUrgence)}</p>}
            {c.margePct > 0 && <p>Marge Coolbeans (+{c.margePct} %) : + {fmtEUR(calc.margeMontant)}</p>}
            {c.reductionMontant > 0 && (
              <p>Réduction exceptionnelle{c.reductionNom ? ` (${c.reductionNom})` : ""} : − {fmtEUR(c.reductionMontant)}</p>
            )}
          </div>
        </>
      )}

      <div class="flex flex-wrap items-end gap-6 border-t border-line pt-4">
        <div><span class="label">Prix suggéré (HT)</span>
          <p class="font-mono text-[20px] font-bold tabular-nums">{fmtEUR(calc.totalSuggere)}</p></div>
        <div class="grid min-w-[160px] gap-2">
          <label class="label">Prix devis retenu (HT)</label>
          <input class="field" type="number" min={0} value={c.prixRetenu ?? ""}
            placeholder={String(Math.round(calc.totalSuggere))}
            onInput={(e) => {
              const v = e.currentTarget.value;
              patch({ prixRetenu: v === "" ? null : Number(v) });
            }} />
        </div>
        <div><span class="label">TVA (20 %)</span>
          <p class="font-mono text-[14px] tabular-nums">{fmtEUR(calc.tva)}</p></div>
        <div><span class="label">Total TTC estimé</span>
          <p class="font-mono text-[14px] tabular-nums">{fmtEUR(calc.ttc)}</p></div>
        <div><span class="label">Net après charges et IR (−{catalogue.settings.chargesPct} %)</span>
          <p class="font-mono text-[16px] font-bold tabular-nums">{fmtEUR(calc.net)}</p></div>
      </div>

      {calc.tjmVendu !== null && !libre && (
        <div class={`justify-self-start rounded-card px-4 py-2 font-mono text-[15px] font-bold tabular-nums ${
          calc.tjmVendu >= catalogue.settings.tjm ? "text-success" : "text-error"}`}>
          TJM vendu : {fmtEUR(calc.tjmVendu)} / jour —{" "}
          {calc.tjmVendu >= catalogue.settings.tjm ? "au-dessus" : "en-dessous"} de l'objectif de {fmtEUR(catalogue.settings.tjm)}
        </div>
      )}
    </section>
  );
}
