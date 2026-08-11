import { fmtEUR, fmtJ } from "../../lib/chiffrage/format";
import type { SectionProps } from "./ChiffrageEditor";

export default function ModeLibre({ c, patch, catalogue, calc }: SectionProps) {
  const { tjm, marcheBas, marcheHaut } = catalogue.settings;
  const effectif = calc.tjmEffectif;
  const sousCible = effectif !== null && effectif < tjm;
  const assume = c.strategique && c.raison.trim().length > 0;

  return (
    <section class="card grid gap-3">
      <h2>Chiffrage libre — au temps passé</h2>
      <p class="text-[13px] text-mute">
        Postes libres, sans catalogue. Ce mode ne produit pas de devis client publiable.
      </p>
      {c.postes.map((p, i) => (
        <div class="grid grid-cols-[1fr_110px_110px_32px] items-center gap-2 max-[640px]:grid-cols-1">
          <input class="field" placeholder="ex : wireframes, intégration, migration" value={p.label}
            onInput={(e) => patch({ postes: c.postes.map((x, j) => (j === i ? { ...x, label: e.currentTarget.value } : x)) })} />
          <input class="field" type="number" step={0.5} min={0} placeholder="jours" value={p.jours || ""}
            onInput={(e) => patch({ postes: c.postes.map((x, j) => (j === i ? { ...x, jours: Number(e.currentTarget.value) || 0 } : x)) })} />
          <span class="text-right font-mono text-[13px] text-mute tabular-nums">{fmtEUR(p.jours * tjm)}</span>
          <button type="button" class="btn btn-ghost btn-sm" aria-label="Retirer"
            onClick={() => patch({ postes: c.postes.filter((_, j) => j !== i) })}>–</button>
        </div>
      ))}
      <button type="button" class="btn btn-outline btn-sm justify-self-start"
        onClick={() => patch({ postes: [...c.postes, { label: "", jours: 0 }] })}>
        + ajouter un poste
      </button>

      {effectif !== null && (
        <div class="flex flex-wrap items-center gap-3 border-t border-line pt-3">
          <span class="font-mono text-[16px] font-bold tabular-nums">{fmtEUR(effectif)} / jour effectif</span>
          <span class={`text-[12px] font-bold uppercase ${!sousCible ? "text-success" : assume ? "text-warning" : "text-error"}`}>
            {!sousCible ? "dans ta cible" : assume ? "sous ta cible — remise assumée" : "sous ta cible — non justifié"}
          </span>
          <span class="text-[12px] text-mute">
            {effectif < marcheBas ? "sous le marché" : effectif > marcheHaut ? "au-dessus du marché" : "dans la fourchette marché"}
            {" "}({fmtEUR(marcheBas)}–{fmtEUR(marcheHaut)} / j)
          </span>
        </div>
      )}

      <label class="flex items-center gap-2 text-[13px]">
        <input type="checkbox" checked={c.strategique}
          onChange={(e) => patch({ strategique: e.currentTarget.checked })} />
        Remise stratégique assumée
      </label>
      {sousCible && (
        <input class="field" placeholder="Raison : ex : réseau local, envie de bosser avec eux" value={c.raison}
          onInput={(e) => patch({ raison: e.currentTarget.value })} />
      )}
    </section>
  );
}
