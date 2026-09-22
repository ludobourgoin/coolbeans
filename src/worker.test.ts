// Les regles de reecriture par hostname, testees sans Cloudflare.
//
// Elles ne s'observent nulle part ailleurs : en local il n'y a qu'un hote
// (localhost), et le serveur de dev refuse les en-tetes Host etrangers. Sans
// ces tests, la seule facon de verifier une regle serait de deployer.
import { beforeEach, describe, expect, it, vi } from "vitest";

// Le handler Astro est le bout de chaine : ici on veut savoir CE QU'IL RECOIT,
// pas ce qu'il rend.
const { handle } = vi.hoisted(() => ({ handle: vi.fn() }));
vi.mock("@astrojs/cloudflare/handler", () => ({ handle }));
vi.mock("./lib/portail/messagerie/ouvrir", () => ({ ouvrirLesDues: vi.fn() }));
vi.mock("./lib/portail/messagerie/publier", () => ({ publierLesDues: vi.fn() }));
vi.mock("./lib/livraisons/sync", () => ({ synchroniserLivraisons: vi.fn() }));

const { default: worker } = await import("./worker");

const appel = (url: string) =>
  (worker.fetch as (r: Request, e: unknown, c: unknown) => Promise<Response>)(
    new Request(url),
    {},
    { waitUntil: () => {} },
  );

/** Le chemin vu par Astro apres reecriture. */
const recu = () => new URL(handle.mock.calls.at(-1)![0].url).pathname;

beforeEach(() => {
  handle.mockReset();
  handle.mockImplementation(
    async (request: Request) => new Response(new URL(request.url).pathname),
  );
});

describe("hote principal", () => {
  it("renvoie l'espace sur le portail", async () => {
    const r = await appel("https://coolbeans.cc/espace/devis");
    expect(r.status).toBe(301);
    expect(r.headers.get("location")).toBe("https://my.coolbeans.cc/devis");
  });

  it("renvoie la connexion sur le portail, sans la graver dans le navigateur", async () => {
    const r = await appel("https://coolbeans.cc/connexion");
    expect(r.status).toBe(302);
    expect(r.headers.get("location")).toBe("https://my.coolbeans.cc/connexion");
  });

  it("emmene la destination avec elle", async () => {
    // /docs est protege ET servi sur l'hote principal : le middleware y pose un
    // redirect_url absolu en coolbeans.cc. La page de connexion refuse une
    // destination d'une autre origine que la sienne, donc sans ce report
    // d'hote le client atterrirait sur l'accueil du portail.
    const r = await appel(
      "https://coolbeans.cc/connexion?redirect_url=https%3A%2F%2Fcoolbeans.cc%2Fdocs%2Ffylgo",
    );
    expect(r.headers.get("location")).toBe(
      "https://my.coolbeans.cc/connexion?redirect_url=https%3A%2F%2Fmy.coolbeans.cc%2Fdocs%2Ffylgo",
    );
  });

  it("laisse passer le reste du site", async () => {
    await appel("https://coolbeans.cc/contact");
    expect(recu()).toBe("/contact");
  });

  it("laisse l'API d'auth sur l'hote principal", async () => {
    // C'est elle que la nav du site vitrine interroge pour savoir si quelqu'un
    // est connecte. La renvoyer sur my.* en ferait un appel cross-origin, donc
    // sans cookie : le bouton afficherait toujours « Se connecter ».
    await appel("https://coolbeans.cc/api/auth/get-session");
    expect(recu()).toBe("/api/auth/get-session");
  });

  it("applique les memes regles a staging", async () => {
    const r = await appel("https://staging.coolbeans.cc/connexion");
    expect(r.headers.get("location")).toBe("https://my-staging.coolbeans.cc/connexion");
  });
});

describe("hote portail", () => {
  it("sert l'accueil du portail a la racine", async () => {
    await appel("https://my.coolbeans.cc/");
    expect(recu()).toBe("/espace");
  });

  it("prefixe les pages du portail", async () => {
    await appel("https://my.coolbeans.cc/devis");
    expect(recu()).toBe("/espace/devis");
  });

  it("laisse passer la page de reprise de mot de passe", async () => {
    // Elle est publique par nature : qui a perdu son mot de passe n'a pas de
    // session. Reecrite en /espace/reinitialiser, elle tombait sous la garde
    // et renvoyait sur /connexion — le lien du mail ne menait nulle part.
    await appel("https://my.coolbeans.cc/reinitialiser?token=abc");
    expect(recu()).toBe("/reinitialiser");
    await appel("https://my.coolbeans.cc/reinitialiser/");
    expect(recu()).toBe("/reinitialiser/");
    await appel("https://my.coolbeans.cc/mot-de-passe-oublie");
    expect(recu()).toBe("/mot-de-passe-oublie");
  });

  it("garde connexion et docs a leur adresse propre", async () => {
    await appel("https://my.coolbeans.cc/connexion");
    expect(recu()).toBe("/connexion");
    await appel("https://my.coolbeans.cc/docs/fylgo");
    expect(recu()).toBe("/docs/fylgo");
  });

  it("chasse le prefixe /espace de l'URL publique", async () => {
    const r = await appel("https://my.coolbeans.cc/espace/devis");
    expect(r.status).toBe(301);
    expect(r.headers.get("location")).toBe("https://my.coolbeans.cc/devis");
  });

  it("interdit l'indexation du portail", async () => {
    const r = await appel("https://my.coolbeans.cc/robots.txt");
    expect(await r.text()).toContain("Disallow: /");
  });
});
