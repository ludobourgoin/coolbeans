import { MODIFICATEURS_DEFAUT } from "./defaults";
import type { ModificateursProjet, Reduction } from "./types";

export interface BlocChiffrage {
  contact: { nom: string; email: string | null; copies: string[] };
  mods: ModificateursProjet;
  prixCible: string | null;
  echeancier: string | null;
  validite: string | null;
  notes: string | null;
  present: boolean;
}

const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
const oui = (v: string) => /^oui/i.test(v.trim());

function parseReduction(v: string): Reduction | null {
  const [nom, valeur] = v.split("·").map((s) => s.trim());
  if (!nom) return null;
  if (!valeur) return { nom };
  const n = parseFloat(valeur.replace(",", "."));
  if (Number.isNaN(n)) return { nom };
  return valeur.includes("%") ? { nom, pct: n } : { nom, montant: n };
}

export function parseBlocChiffrage(description: string): BlocChiffrage {
  const vide: BlocChiffrage = {
    contact: { nom: "", email: null, copies: [] },
    mods: structuredClone(MODIFICATEURS_DEFAUT),
    prixCible: null, echeancier: null, validite: null, notes: null,
    present: false,
  };
  const m = description.match(/^## Chiffrage\s*$([\s\S]*?)(?=^## |$(?![\s\S]))/m);
  if (!m) return vide;

  const b = { ...vide, present: true, mods: structuredClone(MODIFICATEURS_DEFAUT) };
  /* \r?\n : une description collée depuis Windows/Outlook arrive en CRLF, et
     un \r résiduel ferait échouer silencieusement chaque ligne clé:valeur. */
  for (const ligne of m[1].split(/\r?\n/)) {
    /* [-*] : Linear resérialise les puces markdown en `*` — un bloc collé ou
       réécrit par l'API arriverait en `* clé : valeur` et serait ignoré. */
    const kv = ligne.match(/^\s*[-*] ([^:]+):(.*)$/);
    if (!kv) continue;
    const cle = kv[1].trim().toLowerCase();
    const v = kv[2].trim();
    if (!v) continue;
    if (cle.startsWith("contact")) {
      const emails = v.match(EMAIL) ?? [];
      b.contact = {
        nom: v.split(/[<(]/)[0].trim(),
        email: emails[0] ?? null,
        copies: emails.slice(1),
      };
    } else if (cle.startsWith("segment")) b.mods.segment = v.toLowerCase();
    else if (cle.startsWith("affinit")) {
      const a = v.toLowerCase();
      if (a === "envie" || a === "pasenvie" || a === "neutre") b.mods.affinite = a;
    } else if (cle.startsWith("gestion")) b.mods.gestionProjet = oui(v);
    else if (cle.startsWith("urgence")) b.mods.urgence = oui(v);
    else if (cle.startsWith("marge")) {
      const n = parseInt(v, 10);
      if ([0, 10, 20, 30].includes(n)) b.mods.margePct = n as 0 | 10 | 20 | 30;
    } else if (cle.startsWith("réduction") || cle.startsWith("reduction"))
      b.mods.reduction = parseReduction(v);
    else if (cle.startsWith("prix cible")) b.prixCible = v;
    else if (cle.startsWith("échéancier") || cle.startsWith("echeancier")) b.echeancier = v;
    else if (cle.startsWith("validité") || cle.startsWith("validite")) b.validite = v;
    else if (cle.startsWith("notes")) b.notes = v;
  }
  return b;
}
