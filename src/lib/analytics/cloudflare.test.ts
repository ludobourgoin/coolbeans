import { describe, expect, it, vi } from "vitest";
import { GRAPHQL_URL, LIGNES_MAX, normaliserJour, sourceCloudflare, type ReponseJour } from "./cloudflare";

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
};

const vide = (): ReponseJour => ({ totaux: [], pages: [], provenances: [], appareils: [] });

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
});
