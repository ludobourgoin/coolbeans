import { describe, expect, it } from "vitest";
import { verifierRaisonsSociales } from "./raisons-sociales";

describe("verifierRaisonsSociales", () => {
  it("accepte des raisons sociales distinctes", () => {
    expect(
      verifierRaisonsSociales([
        { chemin: "clients/fylgo", raisonsSociales: ["ABEAM DRINKS"] },
        { chemin: "organisations/trigger", raisonsSociales: ["TRIGGER"] },
      ]),
    ).toEqual([]);
  });

  it("refuse une raison sociale portée par deux fiches, casse et espaces compris", () => {
    expect(
      verifierRaisonsSociales([
        { chemin: "clients/fylgo", raisonsSociales: ["ABEAM DRINKS"] },
        { chemin: "organisations/trigger", raisonsSociales: ["abeam  drinks"] },
      ]),
    ).toEqual(["raison sociale « ABEAM DRINKS » portée par deux fiches (clients/fylgo, organisations/trigger)"]);
  });
});
