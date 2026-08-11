import { useState } from "preact/hooks";
import { actions } from "astro:actions";
import type { Catalogue } from "../../lib/chiffrage/types";

/* Formulaire contrôlé sur l'objet Catalogue entier, sauvegardé d'un bloc
   (clé KV unique pilotage:catalog). */
export default function CatalogueEditor({ initial }: { initial: Catalogue }) {
  const [cat, setCat] = useState<Catalogue>(initial);
  const [statut, setStatut] = useState<{ texte: string; erreur?: boolean } | null>(null);

  /* maj immuable par chemin, ex. maj("catalog.design.simple", 0.5) */
  const maj = (chemin: string, valeur: unknown) =>
    setCat((prev) => {
      const copie = structuredClone(prev) as unknown as Record<string, unknown>;
      const parts = chemin.split(".");
      let noeud: Record<string, unknown> = copie;
      for (const p of parts.slice(0, -1)) noeud = noeud[p] as Record<string, unknown>;
      noeud[parts.at(-1)!] = valeur;
      return copie as unknown as Catalogue;
    });

  const Num = ({ chemin, label, valeur, step = 0.5 }: { chemin: string; label: string; valeur: number; step?: number }) => (
    <div class="grid gap-2">
      <label class="label">{label}</label>
      <input class="field w-[110px]" type="number" step={step} value={valeur}
        onInput={(e) => maj(chemin, Number(e.currentTarget.value) || 0)} />
    </div>
  );

  async function sauvegarder() {
    setStatut({ texte: "Enregistrement…" });
    const { error } = await actions.catalogue.sauvegarder(cat);
    setStatut(error ? { texte: error.message, erreur: true } : { texte: "Catalogue enregistré." });
  }

  const s = cat.settings;
  const k = cat.catalog;

  return (
    <div class="grid gap-6">
      <section class="card grid gap-4 bg-surface-subtle">
        <h2>Repères généraux</h2>
        <div class="flex flex-wrap gap-4">
          <Num chemin="settings.tjm" label="TJM cible (€)" valeur={s.tjm} step={10} />
          <Num chemin="settings.demi" label="Demi-journée mini (€)" valeur={s.demi} step={10} />
          <Num chemin="settings.marcheBas" label="Marché bas (€/j)" valeur={s.marcheBas} step={10} />
          <Num chemin="settings.marcheHaut" label="Marché haut (€/j)" valeur={s.marcheHaut} step={10} />
          <Num chemin="settings.joursSemaine" label="Jours dispo / semaine" valeur={s.joursSemaine} />
          <Num chemin="settings.semainesMarge" label="Semaines de marge" valeur={s.semainesMarge} />
          <Num chemin="settings.chargesPct" label="Charges + IR (%)" valeur={s.chargesPct} step={1} />
        </div>
      </section>

      <section class="card grid gap-4">
        <h2>Pages — jours par niveau</h2>
        <div class="flex flex-wrap gap-4">
          <Num chemin="catalog.design.simple" label="Design simple" valeur={k.design.simple} />
          <Num chemin="catalog.design.standard" label="Design standard" valeur={k.design.standard} />
          <Num chemin="catalog.design.complexe" label="Design complexe" valeur={k.design.complexe} />
          <Num chemin="catalog.design.portee.ux" label="UX seul (%)" valeur={k.design.portee.ux} step={5} />
          <Num chemin="catalog.design.portee.ui" label="UI seul (%)" valeur={k.design.portee.ui} step={5} />
        </div>
        <div class="flex flex-wrap gap-4">
          <Num chemin="catalog.integration.simple" label="Intégration simple" valeur={k.integration.simple} />
          <Num chemin="catalog.integration.standard" label="Intégration standard" valeur={k.integration.standard} />
          <Num chemin="catalog.integration.complexe" label="Intégration complexe" valeur={k.integration.complexe} />
        </div>
      </section>

      <section class="card grid gap-4">
        <h2>Développement sur mesure — jours par pack</h2>
        <div class="flex flex-wrap gap-4">
          <Num chemin="catalog.dev.pack1" label="Pack 1 (1 demi-j)" valeur={k.dev.pack1} />
          <Num chemin="catalog.dev.pack2" label="Pack 2 (2 demi-j)" valeur={k.dev.pack2} />
          <Num chemin="catalog.dev.pack3" label="Pack 3 (3 demi-j)" valeur={k.dev.pack3} />
          <Num chemin="catalog.dev.pack4" label="Pack 4 (4 demi-j)" valeur={k.dev.pack4} />
        </div>
      </section>

      <section class="card grid gap-4">
        <h2>Setup — jours et langage client</h2>
        {(["cms", "multilingue", "hebergement", "domaine"] as const).map((key) => (
          <div class="flex flex-wrap items-end gap-4">
            <Num chemin={`catalog.setup.${key}.jours`} label={`${key} (jours)`} valeur={k.setup[key].jours} step={0.25} />
            <div class="grid min-w-[260px] flex-1 gap-2">
              <label class="label">Libellé client</label>
              <input class="field" value={k.setup[key].clientLabel}
                onInput={(e) => maj(`catalog.setup.${key}.clientLabel`, e.currentTarget.value)} />
            </div>
          </div>
        ))}
      </section>

      <section class="card grid gap-4">
        <h2>Gestion de projet, urgence, affinité</h2>
        <div class="flex flex-wrap gap-4">
          <Num chemin="catalog.gestion.coefHebdo" label="Jours de suivi / semaine" valeur={k.gestion.coefHebdo} step={0.05} />
          <Num chemin="catalog.gestion.forfaitCMS" label="Forfait CMS (j)" valeur={k.gestion.forfaitCMS} />
          <Num chemin="catalog.gestion.forfaitMultilingue" label="Forfait multilingue (j)" valeur={k.gestion.forfaitMultilingue} />
          <Num chemin="catalog.gestion.forfaitHebergement" label="Forfait hébergement (j)" valeur={k.gestion.forfaitHebergement} step={0.25} />
          <Num chemin="catalog.gestion.forfaitDomaine" label="Forfait domaine/DNS (j)" valeur={k.gestion.forfaitDomaine} step={0.25} />
          <Num chemin="catalog.gestion.urgencePct" label="Urgence (%)" valeur={k.gestion.urgencePct} step={1} />
          <Num chemin="catalog.affinite.baisse" label="Affinité : remise (%)" valeur={k.affinite.baisse} step={5} />
          <Num chemin="catalog.affinite.hausse" label="Affinité : majoration (%)" valeur={k.affinite.hausse} step={5} />
        </div>
      </section>

      <section class="card grid gap-4">
        <h2>Cibles</h2>
        {Object.entries(cat.segments).map(([key, seg]) => (
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
          ["stackTechnique", "Stack technique"],
          ["conditionsReglement", "Conditions de règlement"],
          ["ceQueCaComprend", "Ce que ça comprend (une ligne par item)"],
          ["horsPerimetre", "Hors périmètre (une ligne par item)"],
        ] as const).map(([key, label]) => (
          <div class="grid gap-2">
            <label class="label">{label}</label>
            <textarea class="field h-auto min-h-[90px] py-3" value={k.devisTexts[key]}
              onInput={(e) => maj(`catalog.devisTexts.${key}`, e.currentTarget.value)} />
          </div>
        ))}
      </section>

      <div class="flex items-center gap-3">
        <button type="button" class="btn" onClick={sauvegarder}>Enregistrer le catalogue</button>
        {statut && (
          <p class={`text-[13px] font-medium ${statut.erreur ? "text-error" : "text-mute"}`} role="status">{statut.texte}</p>
        )}
      </div>
    </div>
  );
}
