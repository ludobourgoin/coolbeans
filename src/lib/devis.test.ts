import { describe, expect, it } from "vitest";
import {
  ancreSection,
  lignesRetenues,
  listeItem,
  remisesDe,
  riche,
  selectionDefaut,
  totaux,
  type DevisBudget,
} from "./devis";

describe("ancreSection", () => {
  it("sans version, garde l'ancre nue", () => {
    /* Devis à version unique : les liens déjà partagés restent valides. */
    expect(ancreSection("Ce que ça comprend")).toBe("ce-que-ca-comprend");
  });
  it("préfixe par la version quand il y en a plusieurs", () => {
    /* Toutes les versions d'un devis coexistent dans le même DOM, une seule
       visible. Sans préfixe, `id="budget"` est présent en double et le
       navigateur saute vers celui de la V1, masqué. */
    expect(ancreSection("Budget", 1)).toBe("v1-budget");
    expect(ancreSection("Budget", 2)).toBe("v2-budget");
  });
  it("rend des ancres distinctes d'une version à l'autre", () => {
    expect(ancreSection("Planning", 1)).not.toBe(ancreSection("Planning", 2));
  });
});

describe("listeItem", () => {
  it("normalise une chaîne", () => {
    expect(listeItem("Responsive")).toEqual({ texte: "Responsive" });
  });
  it("laisse passer l'objet avec tooltip", () => {
    expect(listeItem({ texte: "Urgence", tooltip: "+20 %" })).toEqual({
      texte: "Urgence",
      tooltip: "+20 %",
    });
  });
});

describe("riche", () => {
  it("rend un lien markdown cliquable", () => {
    expect(riche("Bijoux [dupontdupontstore.fr](https://dupontdupontstore.fr/)")).toContain(
      '<a class="link" href="https://dupontdupontstore.fr/" target="_blank" rel="noopener">dupontdupontstore.fr</a>',
    );
  });
  it("ignore un schéma autre que http(s)", () => {
    /* le YAML est écrit à la main, mais la page est publique : pas de
       javascript: qui passerait pour un lien de référence. */
    expect(riche("[clic](javascript:alert(1))")).not.toContain("<a");
  });
  it("laisse le gras et les insécables intacts", () => {
    /* \u00a0 écrit en échappement : une insécable littérale dans un fichier de
       test est invisible à la relecture et se perd au premier copier-coller. */
    expect(riche("**15 €** par an")).toBe('<b class="font-bold">15\u00a0€</b> par an');
  });
});

/* Budget composable. Le calcul est la seule chose qui protège du trou constaté
   sur CAFA — un devis validé dont le montant n'inclut pas les options prises —
   et il tourne deux fois : ici côté serveur, et en miroir dans le navigateur.
   Les deux doivent rendre le même nombre. */
const budget = (
  lignes: Array<{ label: string; prix?: number; optionnel?: boolean; defaut?: boolean }>,
  reste: Partial<DevisBudget> = {},
): DevisBudget =>
  ({
    lignes: lignes.map((l) => ({
      label: l.label,
      prix: l.prix,
      optionnel: l.optionnel ?? false,
      defaut: l.defaut ?? true,
    })),
    enAttente: false,
    ...reste,
  }) as DevisBudget;

describe("totaux — sélection d'options", () => {
  const b = budget([
    { label: "Socle", prix: 1000 },
    { label: "Option pré-cochée", prix: 300, optionnel: true, defaut: true },
    { label: "Option décochée", prix: 500, optionnel: true, defaut: false },
  ]);

  it("sans sélection, applique les défauts du YAML", () => {
    expect(totaux(b).total).toBe(1300);
  });

  it("suit la sélection quand elle est fournie", () => {
    expect(totaux(b, [2]).total).toBe(1500);
    expect(totaux(b, []).total).toBe(1000);
    expect(totaux(b, [1, 2]).total).toBe(1800);
  });

  it("ne laisse jamais retirer une ligne du socle", () => {
    /* La sélection arrive d'une page publique : un index de ligne non
       optionnelle ne doit pas pouvoir faire disparaître le socle. */
    expect(totaux(b, [0]).total).toBe(1000);
  });

  it("ignore un index hors périmètre", () => {
    expect(totaux(b, [99]).total).toBe(1000);
  });

  it("selectionDefaut rend les index pré-cochés", () => {
    expect(selectionDefaut(b)).toEqual([1]);
  });

  it("lignesRetenues garde le socle et les options cochées", () => {
    expect(lignesRetenues(b, [2]).map((l) => l.label)).toEqual(["Socle", "Option décochée"]);
  });
});

describe("totaux — remises", () => {
  it("lit encore l'ancienne forme à remise unique", () => {
    /* Douze devis publiés portent `remisePct` : ils doivent afficher le même
       montant qu'avant l'ajout des remises en cascade. */
    const b = budget([{ label: "Site", prix: 1000 }], {
      remisePct: 20,
      remiseLabel: "Tarif association",
    });
    expect(totaux(b).totalFinal).toBe(800);
    expect(remisesDe(b)).toEqual([{ label: "Tarif association", pct: 20 }]);
  });

  it("enchaîne les remises, chacune sur le reliquat de la précédente", () => {
    /* 1000 − 25 % = 750, puis 750 − 10 % = 675. Surtout pas 1000 − 35 %
       = 650 : un geste commercial se calcule après le barème, pas à côté. */
    const b = budget([{ label: "Site", prix: 1000 }], {
      remises: [
        { label: "Tarif association", pct: 25 },
        { label: "Geste commercial", pct: 10 },
      ],
    });
    const { paliers, remise, totalFinal } = totaux(b);
    expect(paliers.map((p) => p.montant)).toEqual([250, 75]);
    expect(remise).toBe(325);
    expect(totalFinal).toBe(675);
  });

  it("applique les remises au périmètre composé, pas au total maximal", () => {
    const b = budget(
      [
        { label: "Socle", prix: 1000 },
        { label: "Option", prix: 1000, optionnel: true, defaut: false },
      ],
      { remises: [{ label: "Tarif association", pct: 25 }] },
    );
    expect(totaux(b).totalFinal).toBe(750);
    expect(totaux(b, [1]).totalFinal).toBe(1500);
  });

  it("`remises` prend le pas sur `remisePct` quand les deux sont là", () => {
    const b = budget([{ label: "Site", prix: 1000 }], {
      remisePct: 50,
      remises: [{ label: "Tarif association", pct: 25 }],
    });
    expect(totaux(b).totalFinal).toBe(750);
  });
});
