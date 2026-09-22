// La regle des cookies partages, testee seule. Elle decide silencieusement si
// une session ouverte sur le portail se voit depuis le site, et l'erreur ne se
// manifeste qu'en deploye : ni le build ni le dev en localhost ne la montrent.
import { describe, expect, it } from "vitest";
import { getCookies } from "better-auth/cookies";
import { cookiesPartages, optionsAuth } from "./options";

describe("cookiesPartages", () => {
  it("partage le cookie entre le site et le portail en production", () => {
    for (const hote of [
      "https://coolbeans.cc",
      "https://www.coolbeans.cc",
      "https://my.coolbeans.cc",
    ]) {
      expect(cookiesPartages(hote)).toEqual({
        cookiePrefix: "coolbeans",
        crossSubDomainCookies: { enabled: true, domain: ".coolbeans.cc" },
      });
    }
  });

  it("donne a staging un nom de cookie distinct", () => {
    // Les deux environnements partagent forcement le domaine .coolbeans.cc.
    // Seul le prefixe les separe : sans lui, le navigateur enverrait deux
    // cookies de meme nom et le jeton staging masquerait la session de prod.
    for (const hote of ["https://staging.coolbeans.cc", "https://my-staging.coolbeans.cc"]) {
      expect(cookiesPartages(hote)).toEqual({
        cookiePrefix: "coolbeans-staging",
        crossSubDomainCookies: { enabled: true, domain: ".coolbeans.cc" },
      });
    }
  });

  it("ne partage rien en local", () => {
    // Forcer domain=.coolbeans.cc sur localhost poserait un cookie que le
    // navigateur refuse : la connexion echouerait en dev, et nulle part ailleurs.
    expect(cookiesPartages("http://localhost:4321")).toEqual({});
    expect(cookiesPartages("http://127.0.0.1:4321")).toEqual({});
  });

  it("ne se laisse pas prendre par un domaine qui imite le notre", () => {
    expect(cookiesPartages("https://coolbeans.cc.exemple.fr")).toEqual({});
    expect(cookiesPartages("https://notcoolbeans.cc")).toEqual({});
  });

  it("degrade sans lever sur une baseURL illisible", () => {
    expect(cookiesPartages("pas-une-url")).toEqual({});
  });
});

describe("cookie de session reellement emis", () => {
  // Ce que la regle DECIDE ne vaut que si Better Auth l'APPLIQUE. On lui
  // redemande donc le cookie final : c'est ce qui signalerait une montee de
  // version ou withCloudflare qui reprendrait la main sur `advanced` et
  // laisserait retomber le cookie en host-only — panne invisible en local,
  // puisqu'il n'y a qu'un hote.
  const cookie = (baseURL: string) =>
    getCookies({ ...optionsAuth(undefined, baseURL), baseURL } as never).sessionToken;

  it("porte le domaine parent en production", () => {
    const { name, attributes } = cookie("https://my.coolbeans.cc");
    expect(attributes.domain).toBe(".coolbeans.cc");
    expect(name).toBe("__Secure-coolbeans.session_token");
    // __Secure- et non __Host- : le prefixe __Host- interdit l'attribut
    // domain, donc interdirait tout partage entre le site et le portail.
    expect(name.startsWith("__Host-")).toBe(false);
  });

  it("ne porte pas le meme nom en staging", () => {
    expect(cookie("https://my-staging.coolbeans.cc").name).toBe(
      "__Secure-coolbeans-staging.session_token",
    );
  });

  it("reste host-only en local", () => {
    expect(cookie("http://localhost:4321").attributes.domain).toBeUndefined();
  });
});
