/* Pictos des familles de documents, en SVG inline.
 *
 * Aucune favicon distante : cela signalerait à Google et à Granola quel client
 * consulte quel document, et une icône manquante casserait la page le jour où
 * le service change d'URL.
 *
 * Deux familles portent une couleur de marque, parce que c'est elle qu'on
 * reconnaît avant la forme : le rouge du PDF et le bleu de Google Docs. Les
 * autres suivent la couleur du texte, pour rester lisibles dans les deux
 * thèmes et sur une ligne atténuée.
 *
 * Granola n'a pas ici son logo officiel mais une marque de compte rendu : une
 * approximation de logo se voit, et un logo faux est pire qu'un picto sobre.
 */
import type { JSX } from "preact";
import type { FamilleDocument } from "../../../lib/portail/documents/familles";

const commun = {
  width: 18,
  height: 18,
  viewBox: "0 0 16 16",
  fill: "none",
  "aria-hidden": "true",
  focusable: "false",
} as const;

const FEUILLE = "M4 1.5h5L12.5 5v9.5h-9z";

function Pdf() {
  return (
    <svg {...commun}>
      <path d={FEUILLE} stroke="#d93025" stroke-width="1.2" stroke-linejoin="round" />
      <path d="M9 1.5V5h3.5" stroke="#d93025" stroke-width="1.2" stroke-linejoin="round" />
      <rect x="3" y="8" width="10" height="4.6" rx="1" fill="#d93025" />
      <path
        d="M4.9 11.6V9.4h.9a.65.65 0 0 1 0 1.3h-.9m3.1.9V9.4h.7c.6 0 .9.45.9 1.1s-.3 1.1-.9 1.1zm3.1 0V9.4h1.5m-1.5 1.1h1.2"
        stroke="#fff"
        stroke-width="0.75"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  );
}

function GoogleDocs() {
  return (
    <svg {...commun}>
      <path d={FEUILLE} stroke="#1a73e8" stroke-width="1.2" stroke-linejoin="round" />
      <path d="M9 1.5V5h3.5" stroke="#1a73e8" stroke-width="1.2" stroke-linejoin="round" />
      <path
        d="M5.8 7.6h4.4M5.8 9.6h4.4M5.8 11.6h2.8"
        stroke="#1a73e8"
        stroke-width="1.1"
        stroke-linecap="round"
      />
    </svg>
  );
}

function Image() {
  return (
    <svg {...commun}>
      <rect
        x="1.9"
        y="3"
        width="12.2"
        height="10"
        rx="1.4"
        stroke="currentColor"
        stroke-width="1.2"
      />
      <circle cx="5.6" cy="6.4" r="1.1" fill="currentColor" />
      <path
        d="M2.6 11.6 6 8.6l2.4 2.1L10.6 8l2.9 3"
        stroke="currentColor"
        stroke-width="1.2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  );
}

function Archive() {
  return (
    <svg {...commun}>
      <path
        d="M1.9 4.4h12.2v8.2a1.4 1.4 0 0 1-1.4 1.4H3.3a1.4 1.4 0 0 1-1.4-1.4z"
        stroke="currentColor"
        stroke-width="1.2"
        stroke-linejoin="round"
      />
      <rect
        x="1.3"
        y="2"
        width="13.4"
        height="2.4"
        rx="0.8"
        stroke="currentColor"
        stroke-width="1.2"
      />
      <path d="M6.5 7.6h3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
    </svg>
  );
}

function Granola() {
  return (
    <svg {...commun}>
      <rect
        x="2.4"
        y="1.9"
        width="11.2"
        height="12.2"
        rx="1.6"
        stroke="currentColor"
        stroke-width="1.2"
      />
      <path
        d="M5.2 5.6h5.6M5.2 8h5.6M5.2 10.4h3.2"
        stroke="currentColor"
        stroke-width="1.2"
        stroke-linecap="round"
      />
    </svg>
  );
}

function Page() {
  return (
    <svg {...commun}>
      <rect
        x="1.9"
        y="2.6"
        width="12.2"
        height="10.8"
        rx="1.4"
        stroke="currentColor"
        stroke-width="1.2"
      />
      <path d="M1.9 5.8h12.2" stroke="currentColor" stroke-width="1.2" />
      <circle cx="4" cy="4.2" r="0.65" fill="currentColor" />
      <circle cx="6" cy="4.2" r="0.65" fill="currentColor" />
    </svg>
  );
}

function Lien() {
  return (
    <svg {...commun}>
      <path
        d="M9.4 3.2h3.4v3.4M12.8 3.2 8.2 7.8"
        stroke="currentColor"
        stroke-width="1.2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <path
        d="M12 9.6v2.8a1.4 1.4 0 0 1-1.4 1.4H3.6a1.4 1.4 0 0 1-1.4-1.4V5.4A1.4 1.4 0 0 1 3.6 4h2.8"
        stroke="currentColor"
        stroke-width="1.2"
        stroke-linecap="round"
      />
    </svg>
  );
}

const PICTOS: Record<FamilleDocument, () => JSX.Element> = {
  pdf: Pdf,
  image: Image,
  archive: Archive,
  "google-docs": GoogleDocs,
  granola: Granola,
  page: Page,
  lien: Lien,
};

export function Picto({ famille }: { famille: FamilleDocument }) {
  const Composant = PICTOS[famille] ?? Lien;
  return <Composant />;
}
