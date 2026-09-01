# Garde admin déclarative — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendre la protection des pages admin du portail déclarative et fermée par défaut, en la déplaçant des pages vers le middleware.

**Architecture:** Une fonction pure `decisionAcces(pathname, connecte, meta)` répond `"passe" | "connexion" | "introuvable"`. Le middleware l'appelle et exécute la décision. Toute la logique testable vit hors d'Astro, comme `require-admin.ts` et `appartenances.ts` avant elle ; le middleware ne fait qu'obéir.

**Tech Stack:** Astro 7.1.6, `@astrojs/cloudflare` 14, Better Auth sur D1, Vitest 4.

**Spec:** `docs/superpowers/specs/2026-09-01-portail-garde-admin-design.md`

## Global Constraints

- Code, commentaires et noms de fonctions **en français**, comme le reste de `src/lib/portail/`.
- Les commentaires expliquent **pourquoi**, pas quoi — convention observable dans `metadata.ts` et `appartenances.ts`.
- Aucune dépendance nouvelle.
- `isAdmin` de `src/lib/portail/metadata.ts` reste l'unique source de vérité du rôle. Ne pas réimplémenter la comparaison.
- Les 4 pages admin existantes (`clients.astro`, `utilisateurs.astro`, `devis/index.astro`, `devis/reglages.astro`) **gardent leur ligne `if (!isAdmin(meta))`** et ne changent pas d'URL.
- Préfixes gardés, exactement : `/espace/admin` et `/api/admin`.
- Tests : `npx vitest run <chemin>`. Suite complète : `npm test`.
- `git add` **sélectif**, jamais `git add -A` : d'autres sessions travaillent sur ce dépôt.

---

### Task 1 : La règle de chemin

**Files:**
- Create: `src/lib/portail/garde-admin.ts`
- Test: `src/lib/portail/garde-admin.test.ts`

**Interfaces:**
- Consumes: rien.
- Produces: `estRouteProtegee(pathname: string): boolean` et `estRouteAdmin(pathname: string): boolean`.

- [ ] **Step 1: Écrire les tests qui échouent**

Créer `src/lib/portail/garde-admin.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { estRouteAdmin, estRouteProtegee } from "./garde-admin";

describe("estRouteAdmin", () => {
  it("reconnait le prefixe nu et sa forme avec slash", () => {
    expect(estRouteAdmin("/espace/admin")).toBe(true);
    expect(estRouteAdmin("/espace/admin/")).toBe(true);
  });

  it("reconnait une page sous le prefixe", () => {
    expect(estRouteAdmin("/espace/admin/finances/tresorerie")).toBe(true);
  });

  it("reconnait le prefixe d'API", () => {
    expect(estRouteAdmin("/api/admin/export")).toBe(true);
  });

  // Le piege du prefixe non ancre : sans le groupe (\/|$), "administration"
  // serait capte et une page publique deviendrait invisible aux clients.
  it("ne capte pas un chemin qui commence seulement par les memes lettres", () => {
    expect(estRouteAdmin("/espace/administration")).toBe(false);
    expect(estRouteAdmin("/api/administrateurs")).toBe(false);
  });

  it("ne capte pas les routes ordinaires du portail", () => {
    expect(estRouteAdmin("/espace")).toBe(false);
    expect(estRouteAdmin("/espace/projets")).toBe(false);
    expect(estRouteAdmin("/espace/utilisateurs")).toBe(false);
  });

  // La garde se ferme du bon cote : une casse inattendue est gardee plutot
  // qu'ignoree. Astro resout ses routes en respectant la casse, donc cette
  // URL 404 de toute facon — mais la garde ne doit pas etre ce qui en depend.
  it("garde aussi une variante de casse", () => {
    expect(estRouteAdmin("/espace/ADMIN/finances")).toBe(true);
  });
});

describe("estRouteProtegee", () => {
  it("couvre l'espace, la doc et les prefixes admin", () => {
    expect(estRouteProtegee("/espace")).toBe(true);
    expect(estRouteProtegee("/espace/projets")).toBe(true);
    expect(estRouteProtegee("/docs")).toBe(true);
    expect(estRouteProtegee("/docs/amusoire")).toBe(true);
    expect(estRouteProtegee("/api/admin/export")).toBe(true);
  });

  it("laisse passer le site public et les autres API", () => {
    expect(estRouteProtegee("/")).toBe(false);
    expect(estRouteProtegee("/devis/amusoire/site")).toBe(false);
    expect(estRouteProtegee("/api/linear-webhook")).toBe(false);
    expect(estRouteProtegee("/404")).toBe(false);
  });
});
```

- [ ] **Step 2: Lancer les tests pour vérifier qu'ils échouent**

Run: `npx vitest run src/lib/portail/garde-admin.test.ts`
Expected: FAIL — `Failed to resolve import "./garde-admin"`.

- [ ] **Step 3: Écrire l'implémentation minimale**

Créer `src/lib/portail/garde-admin.ts` :

```ts
// Qui peut atteindre quel chemin. Fonction pure, comme appartenances.ts : elle
// ne connait ni Astro, ni la session, ni le reseau — c'est ce qui rend la
// garde testable sans base et sans build.
//
// La garde vit ici et non dans les pages parce qu'une protection qu'il faut
// penser a ecrire finit par etre oubliee. Sous ces prefixes, il n'y a rien a
// ecrire : la page est gardee parce qu'elle est la.

const ROUTES_AUTHENTIFIEES = [/^\/espace(\/|$)/, /^\/docs(\/|$)/];
const ROUTES_ADMIN = [/^\/espace\/admin(\/|$)/, /^\/api\/admin(\/|$)/];

/**
 * Le `(\/|$)` n'est pas cosmetique : sans lui, `/espace/administration`
 * tomberait sous la garde admin et disparaitrait pour les clients.
 *
 * La casse est normalisee vers le bas pour que la garde se ferme du bon cote.
 * Astro resout ses routes en respectant la casse, donc `/espace/ADMIN/x` ne
 * mene nulle part — mais faire dependre la securite de ce detail serait un
 * pari, pas une garantie.
 */
export function estRouteAdmin(pathname: string): boolean {
  const chemin = pathname.toLowerCase();
  return ROUTES_ADMIN.some((re) => re.test(chemin));
}

export function estRouteProtegee(pathname: string): boolean {
  const chemin = pathname.toLowerCase();
  return ROUTES_AUTHENTIFIEES.some((re) => re.test(chemin)) || estRouteAdmin(chemin);
}
```

- [ ] **Step 4: Lancer les tests pour vérifier qu'ils passent**

Run: `npx vitest run src/lib/portail/garde-admin.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/portail/garde-admin.ts src/lib/portail/garde-admin.test.ts
git commit -m "feat(portail): regle de chemin des routes admin, ancree et insensible a la casse"
```

---

### Task 2 : Le décideur

**Files:**
- Modify: `src/lib/portail/garde-admin.ts`
- Test: `src/lib/portail/garde-admin.test.ts`

**Interfaces:**
- Consumes: `estRouteProtegee`, `estRouteAdmin` (Task 1) ; `isAdmin` et `PortalMetadata` de `./metadata`.
- Produces: `type Decision = "passe" | "connexion" | "introuvable"` et `decisionAcces(pathname: string, connecte: boolean, meta: PortalMetadata): Decision`.

- [ ] **Step 1: Écrire les tests qui échouent**

Dans `src/lib/portail/garde-admin.test.ts`, remplacer la ligne d'import de la Task 1 par celle-ci, puis ajouter le bloc à la fin du fichier :

```ts
// remplace la ligne d'import existante
import { decisionAcces, estRouteAdmin, estRouteProtegee } from "./garde-admin";
import type { PortalMetadata } from "./metadata";

const compte = (role: PortalMetadata["role"]): PortalMetadata => ({
  role,
  organisation: "coolbeans",
  workspace: "coolbeans",
});

describe("decisionAcces", () => {
  it("laisse passer le site public, connecte ou non", () => {
    expect(decisionAcces("/", false, compte("client"))).toBe("passe");
    expect(decisionAcces("/devis/amusoire/site", false, compte("client"))).toBe("passe");
  });

  it("envoie a la connexion tout visiteur non connecte sur une route protegee", () => {
    expect(decisionAcces("/espace", false, compte("client"))).toBe("connexion");
    expect(decisionAcces("/docs/amusoire", false, compte("client"))).toBe("connexion");
  });

  // Le cas qui compte : un non-connecte sur une route admin part sur la
  // connexion, pas sur un 404. Traiter l'authentification avant l'autorisation
  // evite qu'un admin dont la session a expire se croie face a une page morte.
  it("envoie a la connexion, pas au 404, un non-connecte sur une route admin", () => {
    expect(decisionAcces("/espace/admin/finances", false, compte("admin"))).toBe("connexion");
  });

  it("laisse passer l'admin sur une route admin", () => {
    expect(decisionAcces("/espace/admin/finances", true, compte("admin"))).toBe("passe");
    expect(decisionAcces("/api/admin/export", true, compte("admin"))).toBe("passe");
  });

  it("repond introuvable a un client et a un revendeur sur une route admin", () => {
    expect(decisionAcces("/espace/admin/finances", true, compte("client"))).toBe("introuvable");
    expect(decisionAcces("/espace/admin/finances", true, compte("revendeur"))).toBe("introuvable");
    expect(decisionAcces("/api/admin/export", true, compte("client"))).toBe("introuvable");
  });

  it("laisse passer les trois roles sur une route protegee non admin", () => {
    for (const role of ["admin", "revendeur", "client"] as const) {
      expect(decisionAcces("/espace/projets", true, compte(role))).toBe("passe");
    }
  });
});
```

- [ ] **Step 2: Lancer les tests pour vérifier qu'ils échouent**

Run: `npx vitest run src/lib/portail/garde-admin.test.ts`
Expected: FAIL — `decisionAcces is not a function`.

- [ ] **Step 3: Écrire l'implémentation minimale**

Dans `src/lib/portail/garde-admin.ts`, ajouter l'import **en tête de fichier**, avec les constantes :

```ts
import { isAdmin, type PortalMetadata } from "./metadata";
```

Puis ajouter à la fin du fichier :

```ts
export type Decision = "passe" | "connexion" | "introuvable";

/**
 * L'ordre des trois questions est la conception, pas un detail :
 * hors perimetre → pas connecte → pas admin. Inverser les deux dernieres
 * renverrait un 404 a un admin dont la session vient d'expirer, qui croirait
 * la page supprimee.
 */
export function decisionAcces(
  pathname: string,
  connecte: boolean,
  meta: PortalMetadata,
): Decision {
  if (!estRouteProtegee(pathname)) return "passe";
  if (!connecte) return "connexion";
  if (estRouteAdmin(pathname) && !isAdmin(meta)) return "introuvable";
  return "passe";
}
```

- [ ] **Step 4: Lancer les tests pour vérifier qu'ils passent**

Run: `npx vitest run src/lib/portail/garde-admin.test.ts`
Expected: PASS, 14 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/portail/garde-admin.ts src/lib/portail/garde-admin.test.ts
git commit -m "feat(portail): decideur d'acces, authentification avant autorisation"
```

---

### Task 3 : Brancher le middleware

**Files:**
- Modify: `src/middleware.ts:1-20`

**Interfaces:**
- Consumes: `decisionAcces`, `estRouteProtegee` (Tasks 1-2) ; `lireSession` de `./lib/auth/session`.
- Produces: rien de nouveau à l'extérieur.

**Note :** ce lot n'a pas de test automatisé — le middleware d'Astro n'est pas montable sous Vitest sans build (même contrainte que celle documentée en tête de `require-admin.ts`). Toute la logique est déjà couverte par les Tasks 1 et 2 ; ce qui reste ici est du câblage, vérifié à la main au Step 4.

- [ ] **Step 1: Remplacer la liste de chemins et le bloc de garde**

Dans `src/middleware.ts`, remplacer les lignes 1 à 20 par :

```ts
import { defineMiddleware } from "astro:middleware";
import { getActionContext } from "astro:actions";
import { lireSession } from "./lib/auth/session";
import { decisionAcces, estRouteProtegee } from "./lib/portail/garde-admin";

// Le middleware ne decide plus : il obeit. Les regles vivent dans
// src/lib/portail/garde-admin.ts, ou elles sont testables sans build Astro.
//
// Le controle par workspace (quel CLIENT voit quoi) reste dans les routes, via
// src/lib/portail/appartenances.ts — c'est une question de portee, pas de
// droit d'entree.
export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = new URL(context.request.url);

  if (estRouteProtegee(pathname)) {
    const { user, meta } = await lireSession(context);
    const decision = decisionAcces(pathname, Boolean(user), meta);

    if (decision === "connexion") {
      const signIn = new URL("/connexion", context.request.url);
      signIn.searchParams.set("redirect_url", context.request.url);
      return context.redirect(signIn.href);
    }

    // 404 plutot qu'une redirection : une redirection avouerait que la page
    // existe. Sur /espace/admin/finances, l'aveu apprend a un client que Ludo
    // tient un suivi de tresorerie et a quelle adresse.
    //
    // On reecrit vers la vraie page 404 pour que la reponse soit indiscernable
    // d'une URL morte. Pas de boucle possible : /404 n'est pas une route
    // protegee, elle ressort en "passe" au tour suivant.
    if (decision === "introuvable") {
      const rendu = await context.rewrite("/404");
      return new Response(rendu.body, { status: 404, headers: rendu.headers });
    }
  }
```

Le reste du fichier — le bloc `getActionContext` et son commentaire, puis `return next();` — reste **inchangé**.

- [ ] **Step 2: Vérifier que la suite de tests reste verte**

Run: `npm test`
Expected: PASS. Aucun test existant ne monte le middleware ; s'il y a du rouge, c'est une régression d'import à corriger avant d'aller plus loin.

- [ ] **Step 3: Vérifier le typage et le build**

Run: `npx astro check`
Expected: 0 error. `context.rewrite` existe depuis Astro 4.13 ; en 7.1.6 il renvoie bien `Promise<Response>`.

- [ ] **Step 4: Vérification manuelle**

Lancer `npm run dev`, puis, connecté en admin, ouvrir `/espace/projets` : la page s'affiche. Ouvrir `/espace/administration` : 404 normal d'Astro, pas la garde. Déconnecté, ouvrir `/espace` : redirection vers `/connexion`.

Le cas « client sur route admin » ne se teste qu'au Task 4, faute de page à viser.

- [ ] **Step 5: Commit**

```bash
git add src/middleware.ts
git commit -m "feat(portail): garde admin au middleware, 404 de marque plutot qu'une redirection"
```

---

### Task 4 : La page d'accueil admin et le test d'énumération

**Files:**
- Create: `src/pages/espace/admin/index.astro`
- Create: `src/lib/portail/pages-admin.test.ts`
- Modify: `src/lib/portail/nav.ts:167-176`

**Interfaces:**
- Consumes: `estRouteAdmin` (Task 1).
- Produces: la route `/espace/admin`, premier occupant du préfixe.

- [ ] **Step 1: Écrire le test d'énumération, qui échoue**

Créer `src/lib/portail/pages-admin.test.ts` :

```ts
// Ce test protege la REGLE, pas le placement des fichiers : une page rangee
// sous src/pages/espace/admin/ est gardee par construction. Ce qu'il attrape,
// c'est le jour ou quelqu'un retouche le prefixe dans garde-admin.ts et fait
// silencieusement sortir des pages existantes de la garde.
//
// Il ne protege PAS contre une page sensible creee AILLEURS. Cette regle-la
// est editoriale et vit dans la spec : toute donnee financiere sous
// /espace/admin/finances/, sans exception.

import { readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";
import { estRouteAdmin } from "./garde-admin";

const RACINE = join(process.cwd(), "src", "pages", "espace", "admin");

function fichiersDePage(dossier: string): string[] {
  return readdirSync(dossier, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? fichiersDePage(join(dossier, e.name))
      : e.name.endsWith(".astro")
        ? [join(dossier, e.name)]
        : [],
  );
}

function routeDe(fichier: string): string {
  const rel = relative(RACINE, fichier).split(sep).join("/");
  const sansExt = rel.replace(/\.astro$/, "");
  const sansIndex = sansExt.replace(/(^|\/)index$/, "");
  return `/espace/admin${sansIndex ? `/${sansIndex}` : ""}`;
}

describe("pages sous le prefixe admin", () => {
  const pages = fichiersDePage(RACINE);

  // Un dossier vide rendrait le it.each suivant vacide : il passerait sans
  // rien verifier, ce qui est pire qu'un test absent.
  it("il y a au moins une page sous le prefixe", () => {
    expect(pages.length).toBeGreaterThan(0);
  });

  it.each(pages)("%s tombe sous la garde admin", (fichier) => {
    expect(estRouteAdmin(routeDe(fichier))).toBe(true);
  });
});
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `npx vitest run src/lib/portail/pages-admin.test.ts`
Expected: FAIL — `ENOENT: no such file or directory` sur `src/pages/espace/admin`.

- [ ] **Step 3: Créer la page d'accueil admin**

Créer `src/pages/espace/admin/index.astro` :

```astro
---
// Premier occupant du prefixe /espace/admin/. Sommaire des outils reserves.
//
// Pas de `if (!isAdmin(meta))` ici, contrairement a clients.astro : c'est tout
// l'objet du chantier. La garde est dans le middleware, portee par le chemin.
// Voir docs/superpowers/specs/2026-09-01-portail-garde-admin-design.md
export const prerender = false;

import EspaceLayout from "../../../layouts/EspaceLayout.astro";

// Une page derriere une garde ne doit jamais atterrir dans un cache
// intermediaire : meme regle que clients.astro et utilisateurs.astro.
Astro.response.headers.set("Cache-Control", "no-store");

const outils = [
  { titre: "Mes clients", href: "/espace/clients", detail: "Le registre des workspaces et leur activite." },
  { titre: "Utilisateurs", href: "/espace/utilisateurs", detail: "Ouvrir, modifier ou fermer un acces." },
  { titre: "Devis", href: "/espace/devis", detail: "Cockpit des chiffrages et des reponses." },
];
---

<EspaceLayout title="Admin">
  <h1>Admin</h1>
  <p class="sub">Les outils reserves a l'administrateur du portail.</p>

  <ul class="outils">
    {outils.map((o) => (
      <li>
        <a href={o.href}>{o.titre}</a>
        <p>{o.detail}</p>
      </li>
    ))}
  </ul>
</EspaceLayout>

<style>
  /* Grille sobre : les cartes du portail se dessinent avec les tokens de
     global.css, jamais avec des valeurs en dur. Ne pas nommer ces classes
     `.card` — `doc.css` porte deja `.doc-root .card`, de specificite (0,2,0),
     qui gagnerait contre tout utilitaire pose ici. */
  .outils {
    display: grid;
    gap: var(--space-3x);
    margin-top: var(--space-6x);
    padding: 0;
    list-style: none;
  }
  @media (min-width: 640px) {
    .outils { grid-template-columns: 1fr 1fr; }
  }
  .outils li {
    border: 1px solid var(--line);
    border-radius: var(--radius-card);
    background: var(--surface);
    padding: var(--space-4x);
  }
  .outils a { color: var(--ink); font-weight: 500; text-decoration: none; }
  .outils p { margin: var(--space-2x) 0 0; color: var(--mute); font-size: 14px; }
</style>
```

Le modèle d'en-tête vient de `src/pages/espace/clients.astro`, qui fait foi si quelque chose diverge — à ceci près que la garde en ligne y est présente et doit rester **absente** ici.

- [ ] **Step 4: Lancer le test pour vérifier qu'il passe**

Run: `npx vitest run src/lib/portail/pages-admin.test.ts`
Expected: PASS, 2 tests (le garde-fou du dossier non vide, et `/espace/admin` sous la garde).

- [ ] **Step 5: Ajouter l'entrée de navigation**

Dans `src/lib/portail/nav.ts`, section `key: "admin"`, ajouter la page en **tête** de la liste :

```ts
    pages: [
      { label: "Accueil admin", path: "/admin", flag: "live" },
      { label: "Mes clients", path: "/clients", flag: "wip" }, // COO-81
      { label: "Utilisateurs", path: "/utilisateurs", flag: "live" },
      { label: "Devis", path: "/devis", flag: "live" },
    ],
```

- [ ] **Step 6: Lancer les tests de navigation**

Run: `npx vitest run src/lib/portail/nav.test.ts`
Expected: possible FAIL si un test compte les entrées de la section admin. Dans ce cas, mettre à jour l'attente du test — l'ajout est voulu — et non l'inverse.

- [ ] **Step 7: Vérification manuelle du cas central**

Lancer `npm run dev`. Connecté en admin, ouvrir `/espace/admin` : la page s'affiche et « Accueil admin » apparaît dans la nav. Se connecter avec un compte client (les comptes de test existent en base, voir `src/lib/portail/comptes.ts`), ouvrir `/espace/admin` : la page 404 de marque s'affiche, statut 404, et la section Admin est absente de la nav.

C'est la seule vérification qui prouve le chantier de bout en bout. Ne pas la sauter.

- [ ] **Step 8: Suite complète et commit**

Run: `npm test && npx astro check`
Expected: PASS, 0 error.

```bash
git add src/pages/espace/admin/index.astro src/lib/portail/pages-admin.test.ts src/lib/portail/nav.ts
git commit -m "feat(portail): page d'accueil admin sous le prefixe garde, et son test d'enumeration"
```

---

## Ce que ce plan ne fait pas

- Il ne migre pas `clients`, `utilisateurs`, `devis` sous le préfixe. Leurs URL et leurs gardes en ligne restent telles quelles.
- Il n'audite pas les 6 routes d'API existantes (`linear-webhook`, `devis-reponse`, `messagerie/*`, `auth/*`). Le préfixe `/api/admin/` est posé pour l'avenir ; les routes actuelles conservent leur propre contrôle.
- Il ne crée aucune page de finances. C'est le lot suivant, et il ne commence qu'une fois celui-ci vert.

**Règle transmise au lot suivant, issue de la spec §« La donnée financière ne quitte pas le serveur » :** les fichiers de `src/content/finances/` sont lus dans le frontmatter et ne sont jamais passés en props à un composant hydraté (`client:*`). Un tri ou un filtre se fait sur le DOM déjà rendu. Sans cette règle, la garde de route ne sert à rien : la donnée serait déjà dans la page servie.
