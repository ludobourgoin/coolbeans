import { useState } from "preact/hooks";
import { actions } from "astro:actions";
import { calculer } from "../../lib/chiffrage/calc";
import type { Catalogue, Chiffrage } from "../../lib/chiffrage/types";
import type { CalcResult } from "../../lib/chiffrage/calc";
import Configurateur from "./Configurateur";
import BlocCalcul from "./BlocCalcul";

export interface SectionProps {
  c: Chiffrage;
  patch: (p: Partial<Chiffrage>) => void;
  catalogue: Catalogue;
  calc: CalcResult;
}

export default function ChiffrageEditor({ initial, catalogue }: { initial: Chiffrage; catalogue: Catalogue }) {
  const [c, setC] = useState<Chiffrage>(initial);
  const [statut, setStatut] = useState<{ texte: string; erreur?: boolean } | null>(null);
  const [urlPubliee, setUrlPubliee] = useState<string | null>(null);
  const patch = (p: Partial<Chiffrage>) => setC((prev) => ({ ...prev, ...p }));
  const calc = calculer(c, catalogue);

  async function sauvegarder(): Promise<string | null> {
    setStatut({ texte: "Enregistrement…" });
    const { data, error } = await actions.chiffrages.sauvegarder(c);
    if (error) { setStatut({ texte: error.message, erreur: true }); return null; }
    if (!c.id) history.replaceState(null, "", `/espace/chiffrages/${data.id}`);
    setC((prev) => ({ ...prev, ...data }));
    setStatut({ texte: "Chiffrage enregistré." });
    return data.id;
  }

  async function publier() {
    const id = await sauvegarder();
    if (!id) return;
    setStatut({ texte: "Publication…" });
    const { data, error } = await actions.chiffrages.publier({ id });
    if (error) { setStatut({ texte: error.message, erreur: true }); return; }
    setC((prev) => ({ ...prev, publishedVersions: data.version }));
    setUrlPubliee(data.url);
    setStatut({ texte: `Version ${data.version} publiée.` });
  }

  return (
    <div class="grid gap-6">
      <p class="label rounded-control bg-surface-subtle px-4 py-2 justify-self-start">
        Tous les montants sont HT — TVA 20 % en supplément
      </p>

      <section class="card grid gap-4">
        <h2>Client / projet</h2>
        <input class="field" placeholder="Nom du client ou du projet" value={c.nom}
          onInput={(e) => patch({ nom: e.currentTarget.value })} />
        <div class="grid grid-cols-2 gap-4 max-[640px]:grid-cols-1">
          <div class="grid gap-2">
            <label class="label">Slug client (URL)</label>
            <input class="field" placeholder="atelier-vasseur" value={c.clientSlug}
              disabled={c.publishedVersions > 0}
              onInput={(e) => patch({ clientSlug: e.currentTarget.value })} />
          </div>
          <div class="grid gap-2">
            <label class="label">Slug projet (URL)</label>
            <input class="field" placeholder="refonte-site" value={c.projetSlug}
              disabled={c.publishedVersions > 0}
              onInput={(e) => patch({ projetSlug: e.currentTarget.value })} />
          </div>
        </div>
        {c.publishedVersions > 0 && (
          <p class="text-[13px] text-mute">Slugs figés : ce devis est publié (V{c.publishedVersions}), son URL ne bouge plus.</p>
        )}
        <div class="flex gap-2">
          <button type="button" class={`btn btn-sm ${c.mode === "configurateur" ? "" : "btn-outline"}`}
            onClick={() => patch({ mode: "configurateur" })}>Configurateur</button>
          <button type="button" class={`btn btn-sm ${c.mode === "libre" ? "" : "btn-outline"}`}
            onClick={() => patch({ mode: "libre" })}>Chiffrage libre</button>
        </div>
      </section>

      {c.mode === "configurateur" && <Configurateur c={c} patch={patch} catalogue={catalogue} calc={calc} />}
      {/* Task 8 branche ici <ModeLibre> et <DevisPreview> */}

      <BlocCalcul c={c} patch={patch} catalogue={catalogue} calc={calc} />

      <div class="flex flex-wrap items-center gap-3">
        <button type="button" class="btn" onClick={sauvegarder}>Enregistrer</button>
        {c.mode === "configurateur" && (
          <button type="button" class="btn btn-outline" onClick={publier}>
            Publier{c.publishedVersions > 0 ? ` (V${c.publishedVersions + 1})` : ""}
          </button>
        )}
        {statut && (
          <p class={`text-[13px] font-medium ${statut.erreur ? "text-error" : "text-mute"}`} role="status">
            {statut.texte}
          </p>
        )}
      </div>
      {urlPubliee && (
        <p class="text-[13px]">
          Devis publié : <a class="link" href={urlPubliee} target="_blank" rel="noopener">{urlPubliee}</a>
        </p>
      )}
    </div>
  );
}
