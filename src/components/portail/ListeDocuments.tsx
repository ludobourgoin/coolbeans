/* Liste des documents d'un workspace.
 *
 * Île Preact et non composant Astro : la bascule de visibilité doit répondre
 * au clic sans recharger la page. Optimiste, avec retour à l'état précédent si
 * l'appel échoue, parce qu'une bascule qui ment est pire qu'une bascule lente.
 *
 * Ne reçoit JAMAIS de ligne masquée en vue client : le filtre vit dans la
 * requête SQL. Le drapeau `admin` ne commande que l'affichage des commandes,
 * il ne protège rien.
 */
import { useState } from "preact/hooks";
import { familleDocument, type FamilleDocument } from "../../lib/portail/documents/familles";
import { Picto } from "./pictos";

export interface DocumentVue {
  id: string;
  titre: string;
  source: "fichier" | "page" | "lien";
  url: string | null;
  mime: string | null;
  date_doc: string;
  visible: boolean;
  /** Sa page n'existe plus dans le repo. Signalé, jamais supprimé. */
  orpheline: boolean;
}

interface Props {
  documents: DocumentVue[];
  admin: boolean;
}

const LIBELLES: Record<FamilleDocument, string> = {
  pdf: "PDF",
  image: "Image",
  archive: "Fichier",
  "google-docs": "Google Docs",
  granola: "Compte rendu",
  page: "Page web",
  lien: "Lien",
};

function dateLisible(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

function lienDe(doc: DocumentVue): string {
  return doc.source === "fichier" ? `/api/documents/fichier/${doc.id}` : (doc.url ?? "#");
}

/* `class:list` est une directive Astro : dans une île Preact, il faut une
   chaîne. */
function cx(...valeurs: (string | false | null | undefined)[]): string {
  return valeurs.filter(Boolean).join(" ");
}

export default function ListeDocuments({ documents, admin }: Props) {
  const [lignes, setLignes] = useState(documents);
  const [enCours, setEnCours] = useState<string | null>(null);

  async function basculer(doc: DocumentVue) {
    const vise = !doc.visible;
    setEnCours(doc.id);
    setLignes((etat) => etat.map((l) => (l.id === doc.id ? { ...l, visible: vise } : l)));
    try {
      const reponse = await fetch("/api/documents/visibilite", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: doc.id, visible: vise }),
      });
      if (!reponse.ok) throw new Error(String(reponse.status));
    } catch {
      // Retour à l'état précédent : sans ça, l'écran affirme que le document
      // est visible alors que le client ne le voit pas.
      setLignes((etat) => etat.map((l) => (l.id === doc.id ? { ...l, visible: !vise } : l)));
      alert("La bascule n'a pas été enregistrée. Réessaie dans un instant.");
    } finally {
      setEnCours(null);
    }
  }

  if (lignes.length === 0) return null;

  return (
    <ul class="mt-6 grid list-none gap-0 p-0">
      {lignes.map((doc) => {
        const famille = familleDocument({ source: doc.source, mime: doc.mime, url: doc.url });
        const masque = admin && !doc.visible;
        return (
          <li
            key={doc.id}
            class="flex items-center gap-4 border-b border-line py-3 first:border-t"
          >
            <span class={cx("flex-none", masque ? "text-mute opacity-60" : "text-ink")}>
              <Picto famille={famille} />
            </span>

            <a
              href={lienDe(doc)}
              target="_blank"
              rel="noopener"
              class={cx("group grid min-w-0 flex-1 gap-0.5", masque && "opacity-60")}
            >
              <span class="truncate font-medium text-ink group-hover:underline">{doc.titre}</span>
              <span class="font-mono text-[12px] text-mute">
                {LIBELLES[famille]} · {dateLisible(doc.date_doc)}
                {doc.orpheline && " · page absente du repo"}
              </span>
            </a>

            {admin && (
              <span class="flex flex-none items-center gap-3">
                {/* Une pastille sur les SEULES lignes masquées : si toutes les
                    lignes portent un badge, plus aucune ne se remarque. */}
                {!doc.visible && (
                  <span class="rounded-full bg-surface-raise px-2 py-0.5 font-mono text-[10px] font-bold tracking-wide text-mute uppercase">
                    Masqué
                  </span>
                )}
                <button
                  type="button"
                  class="link font-mono text-[12px] disabled:opacity-50"
                  disabled={enCours === doc.id}
                  onClick={() => basculer(doc)}
                >
                  {doc.visible ? "Masquer" : "Rendre visible"}
                </button>
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
