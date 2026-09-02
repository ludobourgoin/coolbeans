import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("cloudflare:workers", () => ({ env: {} }));

/* vi.mock est hissé en tête de fichier : les doublures doivent naître dans
   vi.hoisted, sinon la fabrique s'exécute avant leur déclaration. */
const { appels, creerSousTache, changerEtatAffaire, fetchEtatsAffaires } = vi.hoisted(() => {
  const appels: string[] = [];
  return {
    appels,
    creerSousTache: vi.fn(async () => {
      appels.push("creerSousTache");
      return { id: "uuid-tache", identifier: "CRM-99", url: "https://linear.app/x/issue/CRM-99" };
    }),
    /* Signature complète et non `async () => …` : un test lit le troisième
       argument pour vérifier qu'on n'écrit jamais « Signée » ici. */
    changerEtatAffaire: vi.fn(async (_apiKey: string, _issueId: string, _nomEtat: string) => {
      appels.push("changerEtatAffaire");
      return true;
    }),
    fetchEtatsAffaires: vi.fn(async (_apiKey: string, numeros: number[]) => {
      const map = new Map();
      for (const n of numeros) {
        if (n === 404) continue; // affaire supprimée côté Linear
        map.set(n, {
          issueId: `uuid-affaire-${n}`,
          identifier: `CRM-${n}`,
          numero: n,
          url: `https://linear.app/x/issue/CRM-${n}`,
          etat: "📝 Proposition envoyée",
          type: "started",
          position: 1000,
        });
      }
      return map;
    }),
  };
});

vi.mock("../portail/linear-crm", async (importOriginal) => {
  const reel = await importOriginal<typeof import("../portail/linear-crm")>();
  return { ...reel, fetchEtatsAffaires, creerSousTache, changerEtatAffaire };
});

import { enregistrerReponse, tacheExistante } from "./reponses";
import { D1Mock } from "./reponses.mock";
import { corpsTacheFacturation, declencherSignature, type ContexteSignature } from "./signature";

const contexte = (surcharge: Partial<ContexteSignature> = {}): ContexteSignature => ({
  slug: "revolutions-douces/salon-2026-5336",
  titre: "Site du salon Construire & Habiter Autrement",
  objet: "Site vitrine de l'édition 2026",
  affaire: "https://linear.app/coolbeans-hq/issue/CRM-46",
  total: "3 520 €",
  reglement: "40 % à la commande, le solde à la mise en ligne.",
  client: {
    prenom: "Sam",
    nom: "Klingelschmitt",
    email: "sam@example.org",
    raisonSociale: "Rév'olutions Douces",
    siren: "123456789",
    adresse: "1 rue du Salon, 34300 Agde",
    tva: null,
  },
  ...surcharge,
});

describe("corpsTacheFacturation", () => {
  it("porte les coordonnées de facturation fournies, et tait les autres", () => {
    const corps = corpsTacheFacturation(contexte());
    expect(corps).toContain("Sam Klingelschmitt");
    expect(corps).toContain("sam@example.org");
    expect(corps).toContain("Rév'olutions Douces");
    expect(corps).toContain("123456789");
    expect(corps).toContain("1 rue du Salon, 34300 Agde");
    /* La TVA est absente du contexte : pas de ligne vide « TVA : ». */
    expect(corps).not.toContain("TVA intracommunautaire");
  });

  it("cite la phrase de règlement telle quelle et ne calcule aucun acompte", () => {
    const corps = corpsTacheFacturation(contexte());
    expect(corps).toContain("40 % à la commande, le solde à la mise en ligne.");
    /* Décision du 2026-09-01 : `reglement` est du texte libre, en déduire un
       montant produirait un chiffre faux un jour sur deux. Le total, lui, est
       repris tel qu'affiché. */
    expect(corps).toContain("3 520 €");
    expect(corps).not.toMatch(/acompte de \d/i);
  });

  it("signale l'absence de modalités plutôt que de laisser un blanc", () => {
    const corps = corpsTacheFacturation(contexte({ reglement: undefined }));
    expect(corps).toContain("Aucune modalité de règlement");
  });

  it("porte la check-list de facturation et le lien vers la proposition", () => {
    const corps = corpsTacheFacturation(contexte());
    expect(corps).toContain("- [ ] Créer ou vérifier le client dans Tiime");
    expect(corps).toContain("- [ ] Émettre le devis dans Tiime");
    expect(corps).toContain("- [ ] Émettre la facture d'acompte");
    expect(corps).toContain(
      "https://coolbeans.cc/devis/revolutions-douces/salon-2026-5336",
    );
  });

  it("demande les trois documents dans un seul envoi, puis le passage en Signée", () => {
    /* Le geste que la colonne ✍️ Proposition validée existe pour porter : le
       devis Tiime et la facture d'acompte ne partent pas seuls, ils partent
       avec la proposition validée, dans un seul mail. Et l'affaire ne se
       clôt en 🏆 Signée qu'à l'encaissement — dernière case de la liste,
       sinon l'affaire reste en validée pour l'éternité. */
    const corps = corpsTacheFacturation(contexte());
    expect(corps).toContain("un seul mail");
    expect(corps).toMatch(/proposition validée, devis, facture d'acompte/);
    expect(corps).toContain("À l'encaissement : passer l'affaire en 🏆 Signée");
  });
});

describe("declencherSignature", () => {
  let d1: D1Mock;

  const enregistrer = async (slug: string) => {
    await enregistrerReponse(
      { slug, decision: "validation", message: null, prenom: "S", nom: "K", email: "s@k.fr" },
      d1,
    );
    return d1.rows.at(-1)!.id;
  };

  beforeEach(() => {
    d1 = new D1Mock();
    appels.length = 0;
    vi.clearAllMocks();
  });

  it("crée la sous-tâche, l'accroche en D1, puis passe l'affaire en Proposition validée", async () => {
    const ctx = contexte();
    const id = await enregistrer(ctx.slug);
    const res = await declencherSignature("clé", ctx, id, d1);

    expect(res).toMatchObject({ statut: "cree" });
    expect(creerSousTache).toHaveBeenCalledWith(
      expect.objectContaining({
        parentId: "uuid-affaire-46",
        title: "Devis et acompte — Site du salon Construire & Habiter Autrement",
      }),
    );
    expect(changerEtatAffaire).toHaveBeenCalledWith(
      "clé",
      "uuid-affaire-46",
      "Proposition validée",
    );
    expect(await tacheExistante(ctx.slug, d1)).toBe("uuid-tache");
  });

  it("ne marque JAMAIS l'affaire signée sur la seule validation du formulaire", async () => {
    /* Une affaire signée demande deux conditions, pas une : la validation ET
       le règlement de l'acompte (règle du 2026-09-01). Le code passait
       directement en « Signée », ce qui comptait comme acquis un encaissement
       qui n'avait pas eu lieu. C'est exactement ce que la colonne
       ✍️ Proposition validée corrige — ce test empêche la régression. */
    const ctx = contexte();
    await declencherSignature("clé", ctx, await enregistrer(ctx.slug), d1);
    const etats = changerEtatAffaire.mock.calls.map((appel) => appel[2]);
    expect(etats).not.toContain("Signée");
  });

  it("crée la tâche AVANT de faire avancer l'affaire", async () => {
    /* Si Linear tombe entre les deux, mieux vaut une affaire encore en
       « Proposition envoyée » avec sa tâche de facturation qu'une affaire
       validée dont personne ne facturera jamais rien. */
    const ctx = contexte();
    await declencherSignature("clé", ctx, await enregistrer(ctx.slug), d1);
    expect(appels).toEqual(["creerSousTache", "changerEtatAffaire"]);
  });

  it("idempotent : une seconde soumission ne recrée rien", async () => {
    const ctx = contexte();
    await declencherSignature("clé", ctx, await enregistrer(ctx.slug), d1);
    vi.clearAllMocks();

    const res = await declencherSignature("clé", ctx, await enregistrer(ctx.slug), d1);
    expect(res).toEqual({ statut: "deja_traite", taskId: "uuid-tache" });
    expect(creerSousTache).not.toHaveBeenCalled();
    expect(changerEtatAffaire).not.toHaveBeenCalled();
    expect(fetchEtatsAffaires).not.toHaveBeenCalled();
  });

  it("proposition sans affaire rattachée : rien dans Linear, et on le dit", async () => {
    const ctx = contexte({ affaire: undefined });
    const res = await declencherSignature("clé", ctx, await enregistrer(ctx.slug), d1);
    expect(res).toEqual({ statut: "sans_affaire" });
    expect(creerSousTache).not.toHaveBeenCalled();
  });

  it("affaire introuvable dans Linear : signalée, jamais silencieuse", async () => {
    const ctx = contexte({ affaire: "CRM-404" });
    const res = await declencherSignature("clé", ctx, await enregistrer(ctx.slug), d1);
    expect(res).toEqual({ statut: "affaire_introuvable", numero: 404 });
    expect(creerSousTache).not.toHaveBeenCalled();
    expect(changerEtatAffaire).not.toHaveBeenCalled();
  });
});
