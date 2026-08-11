import type { Niveau, Pack, PageLigne } from "../../lib/chiffrage/types";
import { fmtEUR, fmtJ } from "../../lib/chiffrage/format";
import type { SectionProps } from "./ChiffrageEditor";

const SUGGESTIONS_DEV: { label: string; level: Pack }[] = [
  { label: "Scénario Make / n8n", level: "pack2" },
  { label: "Connexion API tierce", level: "pack2" },
  { label: "Script JS custom (simulateur, calculateur)", level: "pack3" },
  { label: "Automatisation email / CRM", level: "pack1" },
];

export default function Configurateur({ c, patch, catalogue, calc }: SectionProps) {
  const tjm = catalogue.settings.tjm;
  const majPage = (i: number, p: Partial<PageLigne>) =>
    patch({ pages: c.pages.map((l, j) => (j === i ? { ...l, ...p } : l)) });

  const setups = [
    { key: "setupCms" as const, cat: "cms" as const, label: "Setup CMS" },
    { key: "setupMultilingue" as const, cat: "multilingue" as const, label: "Setup multilingue" },
    { key: "setupHebergement" as const, cat: "hebergement" as const, label: "Setup hébergement" },
    { key: "setupDomaine" as const, cat: "domaine" as const, label: "Setup domaine et DNS" },
  ];

  return (
    <>
      <section class="card grid gap-3">
        <h2>Cible</h2>
        <div class="grid grid-cols-5 gap-2 max-[880px]:grid-cols-2">
          {Object.entries(catalogue.segments).map(([key, s]) => (
            <button type="button"
              class={`rounded-card border p-3 text-left ${c.segment === key ? "border-line-strong bg-surface-subtle" : "border-line"}`}
              onClick={() => patch({ segment: key, gestionProjet: s.gestionProjet })}>
              <span class="block text-[13px] font-bold">{s.label}</span>
              <span class="block text-[12px] text-mute">{s.desc}</span>
            </button>
          ))}
        </div>
        <p class="text-[13px] text-mute">{catalogue.segments[c.segment]?.note}</p>
      </section>

      <section class="card grid gap-3">
        <h2>Pages</h2>
        <p class="text-[13px] text-mute">
          Une ligne par page ; coche ce que tu factures (UX, UI, intégration). Laisser cette
          section vide est normal pour une mission sans pages (automatisation, optimisation
          ponctuelle…) : utilise Développement sur mesure ou Lignes libres.
        </p>
        {c.pages.map((p, i) => (
          <div class="grid grid-cols-[1fr_130px_auto_130px_32px] items-center gap-2 max-[760px]:grid-cols-1">
            <input class="field" placeholder="ex : page accueil" value={p.label}
              onInput={(e) => majPage(i, { label: e.currentTarget.value })} />
            <select class="field" value={p.niveau}
              onChange={(e) => majPage(i, { niveau: e.currentTarget.value as Niveau })}>
              <option value="simple">Simple</option>
              <option value="standard">Standard</option>
              <option value="complexe">Complexe</option>
            </select>
            <div class="flex gap-3 text-[13px]">
              <label class="flex items-center gap-1">
                <input type="checkbox" checked={p.ux} onChange={(e) => majPage(i, { ux: e.currentTarget.checked })} /> UX
              </label>
              <label class="flex items-center gap-1">
                <input type="checkbox" checked={p.ui} onChange={(e) => majPage(i, { ui: e.currentTarget.checked })} /> UI
              </label>
              <label class="flex items-center gap-1">
                <input type="checkbox" checked={p.integ} onChange={(e) => majPage(i, { integ: e.currentTarget.checked })} /> Intégration
              </label>
            </div>
            <span class="text-right font-mono text-[13px] tabular-nums">
              {fmtJ(calc.joursPages[i])} j · {fmtEUR(calc.joursPages[i] * tjm)}
            </span>
            <button type="button" class="btn btn-ghost btn-sm" aria-label="Retirer"
              onClick={() => patch({ pages: c.pages.filter((_, j) => j !== i) })}>–</button>
          </div>
        ))}
        <button type="button" class="btn btn-outline btn-sm justify-self-start"
          onClick={() => patch({ pages: [...c.pages, { label: "", niveau: "standard", ux: true, ui: true, integ: true }] })}>
          + ajouter une page
        </button>
      </section>

      <section class="card grid gap-3">
        <h2>Développement sur mesure</h2>
        <div class="flex flex-wrap gap-2">
          {SUGGESTIONS_DEV.map((s) => (
            <button type="button" class="btn btn-outline btn-sm"
              onClick={() => patch({ devLines: [...c.devLines, { ...s }] })}>{s.label}</button>
          ))}
        </div>
        {c.devLines.map((l, i) => (
          <div class="grid grid-cols-[1fr_190px_130px_32px] items-center gap-2 max-[720px]:grid-cols-1">
            <input class="field" placeholder="ex : formulaire complexe, API" value={l.label}
              onInput={(e) => patch({ devLines: c.devLines.map((d, j) => (j === i ? { ...d, label: e.currentTarget.value } : d)) })} />
            <select class="field" value={l.level}
              onChange={(e) => patch({ devLines: c.devLines.map((d, j) => (j === i ? { ...d, level: e.currentTarget.value as Pack } : d)) })}>
              <option value="pack1">Pack 1 (1 demi-j)</option>
              <option value="pack2">Pack 2 (2 demi-j)</option>
              <option value="pack3">Pack 3 (3 demi-j)</option>
              <option value="pack4">Pack 4 (4 demi-j)</option>
            </select>
            <span class="text-right font-mono text-[13px] tabular-nums">
              {fmtJ(calc.joursDev[i])} j · {fmtEUR(calc.joursDev[i] * tjm)}
            </span>
            <button type="button" class="btn btn-ghost btn-sm" aria-label="Retirer"
              onClick={() => patch({ devLines: c.devLines.filter((_, j) => j !== i) })}>–</button>
          </div>
        ))}
        <button type="button" class="btn btn-outline btn-sm justify-self-start"
          onClick={() => patch({ devLines: [...c.devLines, { label: "", level: "pack1" }] })}>
          + ajouter un développement
        </button>
      </section>

      <section class="card grid gap-3">
        <h2>Setup et autres besoins</h2>
        {setups.map(({ key, cat: k, label }) => (
          <label class="flex items-center gap-2 text-[14px]">
            <input type="checkbox" checked={c[key]} onChange={(e) => patch({ [key]: e.currentTarget.checked } as never)} />
            {label}
            <span class="font-mono text-[12px] text-mute tabular-nums">
              ({fmtJ(catalogue.catalog.setup[k].jours)} j · {fmtEUR(catalogue.catalog.setup[k].jours * tjm)})
            </span>
          </label>
        ))}
        {c.setupMultilingue && (
          <p class="text-[13px] text-warning">
            Poste historiquement sous-estimé : routing i18n, champs CMS dupliqués, sélecteur de
            langue, hreflang, sitemaps localisés, traduction des chaînes d'interface. Vérifie le
            nombre de jours avant de valider.
          </p>
        )}
        <p class="label mt-2">Lignes libres</p>
        {c.autres.map((l, i) => (
          <div class="grid grid-cols-[1fr_110px_110px_32px] items-center gap-2 max-[640px]:grid-cols-1">
            <input class="field" placeholder="ex : formation client, migration de contenus" value={l.label}
              onInput={(e) => patch({ autres: c.autres.map((a, j) => (j === i ? { ...a, label: e.currentTarget.value } : a)) })} />
            <input class="field" type="number" step={0.5} min={0} placeholder="jours" value={l.jours || ""}
              onInput={(e) => patch({ autres: c.autres.map((a, j) => (j === i ? { ...a, jours: Number(e.currentTarget.value) || 0 } : a)) })} />
            <span class="text-right font-mono text-[13px] text-mute tabular-nums">{fmtEUR(l.jours * tjm)}</span>
            <button type="button" class="btn btn-ghost btn-sm" aria-label="Retirer"
              onClick={() => patch({ autres: c.autres.filter((_, j) => j !== i) })}>–</button>
          </div>
        ))}
        <button type="button" class="btn btn-outline btn-sm justify-self-start"
          onClick={() => patch({ autres: [...c.autres, { label: "", jours: 0 }] })}>
          + ajouter une ligne libre
        </button>
      </section>

      <section class="card grid gap-3">
        <h2>Objectif (devis client)</h2>
        <textarea class="field h-auto min-h-[80px] py-3" value={c.objectif}
          placeholder="En une ou deux phrases : ce que ce projet change pour le client, pas ce que tu vas construire techniquement."
          onInput={(e) => patch({ objectif: e.currentTarget.value })} />
      </section>
    </>
  );
}
