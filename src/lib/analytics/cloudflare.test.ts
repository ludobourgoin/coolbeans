import { describe, expect, it, vi } from "vitest";
import { GRAPHQL_URL, LIGNES_MAX, REQUETE_JOUR, normaliserJour, sourceCloudflare, type ReponseJour } from "./cloudflare";

const SALON = "7b1613c4d8524beaae503934203801a4";
const COOLBEANS = "2ad7fb260e2a498a900a5d97d41b6853";
const REV = "4b3f282e3f8a4d90ac63fbeb41577e72";
const SECM = "7257179f83b6445d93703f1d1f305a4a";

// Réponse réelle de l'API pour le 2026-09-26, enregistrée le 2026-09-29.
const REPONSE_26_SEPTEMBRE: ReponseJour = {
  totaux: [
    { avg: { sampleInterval: 1 }, count: 1, dimensions: { siteTag: SECM }, sum: { visits: 1 } },
    { avg: { sampleInterval: 1 }, count: 4, dimensions: { siteTag: SALON }, sum: { visits: 4 } },
    { avg: { sampleInterval: 1 }, count: 3, dimensions: { siteTag: REV }, sum: { visits: 3 } },
    { avg: { sampleInterval: 1 }, count: 1, dimensions: { siteTag: COOLBEANS }, sum: { visits: 1 } },
  ],
  pages: [
    { count: 4, dimensions: { requestPath: "/", siteTag: SALON }, sum: { visits: 4 } },
    { count: 3, dimensions: { requestPath: "/", siteTag: REV }, sum: { visits: 3 } },
    { count: 1, dimensions: { requestPath: "/", siteTag: SECM }, sum: { visits: 1 } },
    { count: 1, dimensions: { requestPath: "/", siteTag: COOLBEANS }, sum: { visits: 1 } },
  ],
  provenances: [
    { count: 4, dimensions: { refererHost: "", siteTag: SALON }, sum: { visits: 4 } },
    { count: 3, dimensions: { refererHost: "", siteTag: REV }, sum: { visits: 3 } },
    { count: 1, dimensions: { refererHost: "www.ifacnet.com", siteTag: COOLBEANS }, sum: { visits: 1 } },
    { count: 1, dimensions: { refererHost: "", siteTag: SECM }, sum: { visits: 1 } },
  ],
  appareils: [
    { count: 3, dimensions: { deviceType: "desktop", siteTag: REV }, sum: { visits: 3 } },
    { count: 1, dimensions: { deviceType: "desktop", siteTag: COOLBEANS }, sum: { visits: 1 } },
    { count: 4, dimensions: { deviceType: "desktop", siteTag: SALON }, sum: { visits: 4 } },
    { count: 1, dimensions: { deviceType: "desktop", siteTag: SECM }, sum: { visits: 1 } },
  ],
  vitaux: [],
};

const vide = (): ReponseJour => ({ totaux: [], pages: [], provenances: [], appareils: [], vitaux: [] });

function groupe(
  siteTag: string,
  count: number,
  visits: number,
  dims: Record<string, string> = {},
  sampleInterval?: number,
) {
  return {
    count,
    sum: { visits },
    ...(sampleInterval === undefined ? {} : { avg: { sampleInterval } }),
    dimensions: { siteTag, ...dims },
  };
}

// Réponse réelle de l'API pour le 2026-09-29, totaux et vitaux, enregistrée le
// 2026-09-30. Rév'olutions Douces (REV) y a une mesure de vitaux et aucun
// chargement de page.
const REPONSE_29_SEPTEMBRE: ReponseJour = {
  totaux: [
    { avg: { sampleInterval: 1 }, count: 22, dimensions: { siteTag: SECM }, sum: { visits: 6 } },
    { avg: { sampleInterval: 1 }, count: 33, dimensions: { siteTag: SALON }, sum: { visits: 20 } },
    { avg: { sampleInterval: 1 }, count: 1, dimensions: { siteTag: COOLBEANS }, sum: { visits: 1 } },
  ],
  pages: [],
  provenances: [],
  appareils: [],
  vitaux: [
    {
      avg: { sampleInterval: 1 },
      dimensions: { deviceType: "mobile", siteTag: SALON },
      sum: { clsGood: 19, clsNeedsImprovement: 0, clsPoor: 0, inpGood: 9, inpNeedsImprovement: 0, inpPoor: 0, lcpGood: 19, lcpNeedsImprovement: 3, lcpPoor: 0 },
    },
    {
      avg: { sampleInterval: 1 },
      dimensions: { deviceType: "mobile", siteTag: SECM },
      sum: { clsGood: 2, clsNeedsImprovement: 0, clsPoor: 0, inpGood: 1, inpNeedsImprovement: 0, inpPoor: 0, lcpGood: 19, lcpNeedsImprovement: 0, lcpPoor: 0 },
    },
    {
      avg: { sampleInterval: 1 },
      dimensions: { deviceType: "tablet", siteTag: SALON },
      sum: { clsGood: 2, clsNeedsImprovement: 0, clsPoor: 0, inpGood: 1, inpNeedsImprovement: 0, inpPoor: 0, lcpGood: 2, lcpNeedsImprovement: 0, lcpPoor: 0 },
    },
    {
      avg: { sampleInterval: 1 },
      dimensions: { deviceType: "desktop", siteTag: SALON },
      sum: { clsGood: 2, clsNeedsImprovement: 0, clsPoor: 0, inpGood: 0, inpNeedsImprovement: 0, inpPoor: 0, lcpGood: 4, lcpNeedsImprovement: 0, lcpPoor: 0 },
    },
    {
      avg: { sampleInterval: 1 },
      dimensions: { deviceType: "desktop", siteTag: SECM },
      sum: { clsGood: 1, clsNeedsImprovement: 0, clsPoor: 0, inpGood: 0, inpNeedsImprovement: 0, inpPoor: 0, lcpGood: 1, lcpNeedsImprovement: 0, lcpPoor: 0 },
    },
    {
      avg: { sampleInterval: 1 },
      dimensions: { deviceType: "mobile", siteTag: REV },
      sum: { clsGood: 1, clsNeedsImprovement: 0, clsPoor: 0, inpGood: 0, inpNeedsImprovement: 0, inpPoor: 0, lcpGood: 1, lcpNeedsImprovement: 0, lcpPoor: 0 },
    },
  ],
};

type Triplet = [bon: number, moyen: number, mauvais: number];

function groupeVitaux(
  siteTag: string,
  deviceType: string,
  m: { lcp?: Triplet; inp?: Triplet; cls?: Triplet },
  sampleInterval = 1,
) {
  const [lcpGood, lcpNeedsImprovement, lcpPoor] = m.lcp ?? [0, 0, 0];
  const [inpGood, inpNeedsImprovement, inpPoor] = m.inp ?? [0, 0, 0];
  const [clsGood, clsNeedsImprovement, clsPoor] = m.cls ?? [0, 0, 0];
  return {
    avg: { sampleInterval },
    sum: { lcpGood, lcpNeedsImprovement, lcpPoor, inpGood, inpNeedsImprovement, inpPoor, clsGood, clsNeedsImprovement, clsPoor },
    dimensions: { siteTag, deviceType },
  };
}

const c = (bon: number, moyen: number, mauvais: number) => ({ bon, moyen, mauvais });

describe("normaliserJour", () => {
  it("rend un JourAnalytics par site, sur une réponse réelle", () => {
    const jours = normaliserJour("2026-09-26", REPONSE_26_SEPTEMBRE);
    expect(jours).toHaveLength(4);
    expect(jours.find((j) => j.siteTag === SALON)).toEqual({
      siteTag: SALON,
      jour: "2026-09-26",
      visites: 4,
      pagesVues: 4,
      echantillon: 1,
      pages: [{ valeur: "/", visites: 4, pagesVues: 4 }],
      provenances: [{ valeur: "", visites: 4, pagesVues: 4 }],
      appareils: [{ valeur: "desktop", visites: 4, pagesVues: 4 }],
      vitaux: [],
    });
    expect(jours.find((j) => j.siteTag === COOLBEANS)?.provenances).toEqual([
      { valeur: "www.ifacnet.com", visites: 1, pagesVues: 1 },
    ]);
  });

  it("écarte la navigation interne, que Cloudflare compte à 0 visite", () => {
    const r = vide();
    r.totaux.push(groupe(SALON, 5, 2, {}, 1));
    r.provenances.push(
      groupe(SALON, 3, 0, { refererHost: "construire-habiter-autrement.org" }),
      groupe(SALON, 2, 2, { refererHost: "" }),
    );
    expect(normaliserJour("2026-09-26", r)[0].provenances).toEqual([
      { valeur: "", visites: 2, pagesVues: 2 },
    ]);
  });

  it("range un appareil vide dans « autre » et fusionne les doublons", () => {
    const r = vide();
    r.totaux.push(groupe(SALON, 3, 3, {}, 1));
    r.appareils.push(
      groupe(SALON, 1, 1, { deviceType: "" }),
      groupe(SALON, 2, 2, { deviceType: "autre" }),
    );
    expect(normaliserJour("2026-09-26", r)[0].appareils).toEqual([
      { valeur: "autre", visites: 3, pagesVues: 3 },
    ]);
  });

  it("range tout deviceType hors mobile/desktop/tablet dans « autre », y compris smarttv", () => {
    const r = vide();
    r.totaux.push(groupe(SALON, 3, 3, {}, 1));
    r.appareils.push(
      groupe(SALON, 1, 1, { deviceType: "smarttv" }),
      groupe(SALON, 2, 2, { deviceType: "" }),
    );
    expect(normaliserJour("2026-09-26", r)[0].appareils).toEqual([
      { valeur: "autre", visites: 3, pagesVues: 3 },
    ]);
  });

  it("range un chemin vide sous « / »", () => {
    const r = vide();
    r.totaux.push(groupe(SALON, 1, 1, {}, 1));
    r.pages.push(groupe(SALON, 1, 1, { requestPath: "" }));
    expect(normaliserJour("2026-09-26", r)[0].pages).toEqual([
      { valeur: "/", visites: 1, pagesVues: 1 },
    ]);
  });

  it("arrondit l'échantillonnage au-dessus : 1 exact, 10 estimé", () => {
    const r = vide();
    r.totaux.push(groupe(SALON, 10, 10, {}, 10), groupe(COOLBEANS, 3, 3, {}, 1.5), groupe(REV, 1, 1));
    const jours = normaliserJour("2026-09-26", r);
    expect(jours.find((j) => j.siteTag === SALON)?.echantillon).toBe(10);
    expect(jours.find((j) => j.siteTag === COOLBEANS)?.echantillon).toBe(2);
    expect(jours.find((j) => j.siteTag === REV)?.echantillon).toBe(1);
  });

  it("ignore une répartition dont le site n'a pas de total", () => {
    const r = vide();
    r.pages.push(groupe(SALON, 1, 1, { requestPath: "/" }));
    expect(normaliserJour("2026-09-26", r)).toEqual([]);
  });

  it("plafonne les pages à LIGNES_MAX par site, les plus vues gardées, les totaux du site intacts", () => {
    const r = vide();
    r.totaux.push(groupe(SALON, 999, 999, {}, 1));
    for (let i = 0; i < 150; i++) {
      r.pages.push(groupe(SALON, 150 - i, 150 - i, { requestPath: `/p${String(i).padStart(3, "0")}` }));
    }
    const site = normaliserJour("2026-09-26", r).find((j) => j.siteTag === SALON)!;
    expect(site.visites).toBe(999);
    expect(site.pagesVues).toBe(999);
    expect(site.pages).toHaveLength(LIGNES_MAX);
    expect(site.pages.map((p) => p.pagesVues)).toEqual(
      Array.from({ length: LIGNES_MAX }, (_, i) => 150 - i),
    );
  });
});

describe("normaliserJour, Core Web Vitals", () => {
  it("rattache les vitaux à leur site et à leur appareil, sur une réponse réelle", () => {
    const jours = normaliserJour("2026-09-29", REPONSE_29_SEPTEMBRE);
    const salon = jours.find((j) => j.siteTag === SALON)!;
    expect(salon.vitaux).toHaveLength(3);
    expect(salon.vitaux).toEqual(
      expect.arrayContaining([
        { appareil: "mobile", lcp: c(19, 3, 0), inp: c(9, 0, 0), cls: c(19, 0, 0) },
        { appareil: "tablet", lcp: c(2, 0, 0), inp: c(1, 0, 0), cls: c(2, 0, 0) },
        { appareil: "desktop", lcp: c(4, 0, 0), inp: c(0, 0, 0), cls: c(2, 0, 0) },
      ]),
    );
    expect(salon.visites).toBe(20);
    expect(jours.find((j) => j.siteTag === COOLBEANS)?.vitaux).toEqual([]);
  });

  it("garde les vitaux d'un site sans aucun chargement de page ce jour-là, à 0 visite", () => {
    const rev = normaliserJour("2026-09-29", REPONSE_29_SEPTEMBRE).find((j) => j.siteTag === REV);
    expect(rev).toEqual({
      siteTag: REV,
      jour: "2026-09-29",
      visites: 0,
      pagesVues: 0,
      echantillon: 1,
      pages: [],
      provenances: [],
      appareils: [],
      vitaux: [{ appareil: "mobile", lcp: c(1, 0, 0), inp: c(0, 0, 0), cls: c(1, 0, 0) }],
    });
  });

  it("range un deviceType inconnu dans « autre » et cumule les groupes du même appareil", () => {
    const r = vide();
    r.totaux.push(groupe(SALON, 3, 3, {}, 1));
    r.vitaux.push(
      groupeVitaux(SALON, "smarttv", { lcp: [1, 0, 0] }),
      groupeVitaux(SALON, "", { lcp: [0, 1, 0], cls: [2, 0, 0] }),
    );
    expect(normaliserJour("2026-09-29", r)[0].vitaux).toEqual([
      { appareil: "autre", lcp: c(1, 1, 0), inp: c(0, 0, 0), cls: c(2, 0, 0) },
    ]);
  });

  it("écarte un groupe sans aucune mesure de LCP, INP ou CLS", () => {
    const r = vide();
    r.totaux.push(groupe(SALON, 3, 3, {}, 1));
    r.vitaux.push(groupeVitaux(SALON, "mobile", {}));
    expect(normaliserJour("2026-09-29", r)[0].vitaux).toEqual([]);
  });

  it("n'invente aucun site pour un groupe de vitaux vide", () => {
    const r = vide();
    r.vitaux.push(groupeVitaux(SALON, "mobile", {}));
    expect(normaliserJour("2026-09-29", r)).toEqual([]);
  });

  it("marque le jour estimé dès que le trafic ou les vitaux le sont", () => {
    const r = vide();
    r.totaux.push(groupe(SALON, 3, 3, {}, 1), groupe(COOLBEANS, 3, 3, {}, 10));
    r.vitaux.push(
      groupeVitaux(SALON, "mobile", { lcp: [1, 0, 0] }, 10),
      groupeVitaux(COOLBEANS, "mobile", { lcp: [1, 0, 0] }, 1),
    );
    const jours = normaliserJour("2026-09-29", r);
    expect(jours.find((j) => j.siteTag === SALON)?.echantillon).toBe(10);
    expect(jours.find((j) => j.siteTag === COOLBEANS)?.echantillon).toBe(10);
  });
});

describe("sourceCloudflare", () => {
  const repondre = (corps: unknown, status = 200) =>
    vi.fn(async () => new Response(JSON.stringify(corps), { status }));

  it("interroge l'API GraphQL pour un jour, avec le jeton", async () => {
    const fetch = repondre({ data: { viewer: { accounts: [REPONSE_26_SEPTEMBRE] } }, errors: null });
    const jours = await sourceCloudflare({ token: "jeton", compte: "c9736", fetch })("2026-09-26");
    expect(jours).toHaveLength(4);
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(GRAPHQL_URL);
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer jeton");
    expect(JSON.parse(init.body as string).variables).toEqual({ compte: "c9736", jour: "2026-09-26" });
  });

  it("lève sur une erreur GraphQL, avec le message de l'API", async () => {
    const fetch = repondre({ data: null, errors: [{ message: "not authorized for that account" }] });
    await expect(sourceCloudflare({ token: "x", compte: "y", fetch })("2026-09-26")).rejects.toThrow(
      "not authorized for that account",
    );
  });

  it("lève sur une réponse HTTP en erreur", async () => {
    const fetch = repondre({}, 500);
    await expect(sourceCloudflare({ token: "x", compte: "y", fetch })("2026-09-26")).rejects.toThrow(
      "HTTP 500",
    );
  });

  it("porte un signal d'abandon sur la requête, pour ne jamais bloquer le cron", async () => {
    const fetch = repondre({ data: { viewer: { accounts: [REPONSE_26_SEPTEMBRE] } }, errors: null });
    await sourceCloudflare({ token: "jeton", compte: "c9736", fetch })("2026-09-26");
    const [, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("lève si le compte manque dans la réponse", async () => {
    const fetch = repondre({ data: { viewer: { accounts: [] } } });
    await expect(sourceCloudflare({ token: "x", compte: "y", fetch })("2026-09-26")).rejects.toThrow(
      "compte introuvable",
    );
  });

  it("demande les vitaux dans la même requête que le trafic", async () => {
    const fetch = repondre({ data: { viewer: { accounts: [REPONSE_29_SEPTEMBRE] } }, errors: null });
    const jours = await sourceCloudflare({ token: "jeton", compte: "c9736", fetch })("2026-09-29");
    expect(fetch).toHaveBeenCalledOnce();
    const [, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(init.body as string).query).toBe(REQUETE_JOUR);
    expect(REQUETE_JOUR).toContain("vitaux: rumWebVitalsEventsAdaptiveGroups");
    expect(jours.find((j) => j.siteTag === SALON)?.vitaux).toHaveLength(3);
  });
});
