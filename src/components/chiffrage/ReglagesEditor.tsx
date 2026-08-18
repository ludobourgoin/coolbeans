import { useState } from "preact/hooks";
import { actions } from "astro:actions";
import type { Reglages } from "../../lib/chiffrage/types";

/* Champ numérique, défini au niveau module : défini dans le corps du
   composant parent, son identité changerait à chaque rendu et Preact
   remonterait l'input à chaque frappe (perte de focus). */
const Num = ({ chemin, label, valeur, step = 0.5, maj }: {
  chemin: string;
  label: string;
  valeur: number;
  step?: number;
  maj: (chemin: string, valeur: unknown) => void;
}) => (
  <div class="grid gap-2">
    <label class="label">{label}</label>
    <input class="field w-[110px]" type="number" step={step} value={valeur}
      onInput={(e) => maj(chemin, Number(e.currentTarget.value) || 0)} />
  </div>
);

/* Formulaire contrôlé sur l'objet Reglages entier, sauvegardé d'un bloc
   (clé KV unique pilotage:reglages). Ces valeurs sont la source de vérité
   des prix lue par la skill devis. */
export default function ReglagesEditor({ initial }: { initial: Reglages }) {
  const [reglages, setReglages] = useState<Reglages>(initial);
  const [statut, setStatut] = useState<{ texte: string; erreur?: boolean } | null>(null);

  /* maj immuable par chemin, ex. maj("affinite.baisse", 20) */
  const maj = (chemin: string, valeur: unknown) =>
    setReglages((prev) => {
      const copie = structuredClone(prev) as unknown as Record<string, unknown>;
      const parts = chemin.split(".");
      let noeud: Record<string, unknown> = copie;
      for (const p of parts.slice(0, -1)) noeud = noeud[p] as Record<string, unknown>;
      noeud[parts.at(-1)!] = valeur;
      return copie as unknown as Reglages;
    });

  async function sauvegarder() {
    setStatut({ texte: "Enregistrement…" });
    const { error } = await actions.reglages.sauvegarder(reglages);
    setStatut(error ? { texte: error.message, erreur: true } : { texte: "Réglages enregistrés." });
  }

  const r = reglages;

  return (
    <div class="grid gap-6">
      <section class="card grid gap-4 bg-surface-subtle">
        <h2>Repères généraux</h2>
        <div class="flex flex-wrap gap-4">
          <Num chemin="tjm" label="TJM cible (€)" valeur={r.tjm} step={10} maj={maj} />
          <Num chemin="heuresJour" label="Heures / jour facturé" valeur={r.heuresJour} step={1} maj={maj} />
          <Num chemin="marcheBas" label="Marché bas (€/j)" valeur={r.marcheBas} step={10} maj={maj} />
          <Num chemin="marcheHaut" label="Marché haut (€/j)" valeur={r.marcheHaut} step={10} maj={maj} />
          <Num chemin="joursSemaine" label="Jours dispo / semaine" valeur={r.joursSemaine} maj={maj} />
          <Num chemin="semainesMarge" label="Semaines de marge" valeur={r.semainesMarge} maj={maj} />
          <Num chemin="chargesPct" label="Charges + IR (%)" valeur={r.chargesPct} step={1} maj={maj} />
        </div>
      </section>

      <section class="card grid gap-4">
        <h2>Coefficients</h2>
        <div class="flex flex-wrap gap-4">
          <Num chemin="gestionPct" label="Gestion de projet (% du total)" valeur={r.gestionPct} step={1} maj={maj} />
          <Num chemin="urgencePct" label="Urgence (%)" valeur={r.urgencePct} step={1} maj={maj} />
          <Num chemin="affinite.baisse" label="Affinité : remise (%)" valeur={r.affinite.baisse} step={5} maj={maj} />
          <Num chemin="affinite.hausse" label="Affinité : majoration (%)" valeur={r.affinite.hausse} step={5} maj={maj} />
        </div>
      </section>

      <section class="card grid gap-4">
        <h2>Cibles</h2>
        {Object.entries(r.segments).map(([key, seg]) => (
          <div class="grid gap-2 border-t border-line pt-3">
            <p class="text-[13px] font-bold">{seg.label}</p>
            <label class="flex items-center gap-2 text-[13px]">
              <input type="checkbox" checked={seg.gestionProjet}
                onChange={(e) => maj(`segments.${key}.gestionProjet`, e.currentTarget.checked)} />
              Gestion de projet cochée par défaut
            </label>
            <input class="field" value={seg.note} onInput={(e) => maj(`segments.${key}.note`, e.currentTarget.value)} />
          </div>
        ))}
      </section>

      <section class="card grid gap-4">
        <h2>Devis client — textes de base</h2>
        {([
          ["stackTechnique", "Stack technique recommandée"],
          ["conditionsReglement", "Conditions de règlement"],
          ["ceQueCaComprend", "Ce que ça comprend (une ligne par item)"],
          ["horsPerimetre", "Hors périmètre (une ligne par item)"],
          ["urgenceTooltip", "Tooltip de la majoration d'urgence"],
        ] as const).map(([key, label]) => (
          <div class="grid gap-2">
            <label class="label">{label}</label>
            <textarea class="field h-auto min-h-[90px] py-3" value={r.devisTexts[key]}
              onInput={(e) => maj(`devisTexts.${key}`, e.currentTarget.value)} />
          </div>
        ))}
      </section>

      <div class="flex items-center gap-3">
        <button type="button" class="btn" onClick={sauvegarder}>Enregistrer les réglages</button>
        {statut && (
          <p class={`text-[13px] font-medium ${statut.erreur ? "text-error" : "text-mute"}`} role="status">{statut.texte}</p>
        )}
      </div>
    </div>
  );
}
