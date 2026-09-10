# Calendrier Livraisons : plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un cron du Worker écrit les milestones Linear datées dans un calendrier Google « Livraisons », pour que Ludo voie ses échéances de livraison dans son agenda.

**Architecture:** Quatre modules purs et testables sous `src/lib/livraisons/`, branchés en une tâche sur le handler `scheduled` existant. L'identifiant de l'événement Google est dérivé de l'identifiant de la milestone Linear, ce qui rend la synchronisation idempotente et sans état : aucune table de correspondance, aucune migration.

**Tech Stack:** Cloudflare Workers, TypeScript, WebCrypto (signature RS256 du JWT Google), API GraphQL Linear, API REST Google Calendar v3, vitest.

**Spec:** `docs/superpowers/specs/2026-09-08-calendrier-livraisons-design.md`

## Global Constraints

- **Linear n'est jamais modifié.** Aucune écriture GraphQL, aucun renommage de milestone. Le raccourci des libellés se fait à l'écriture dans le calendrier.
- Titre d'événement : `<CLÉ_TEAM>-<étiquette>`, longueur d'étiquette plafonnée à 30 caractères.
- Exclusions : milestone sans `targetDate`, projet dont `status.type` vaut `canceled`, projet nommé `Test` de la team `MOD`.
- Journal JSON sur le modèle existant : `{ "event": "livraisons_sync", "status": …, "crees": …, "maj": …, "supprimes": …, "echecs": …, "scheduled_at": … }`.
- Actif en production seulement : secrets absents, tâche sautée avec `status: "skipped_missing_secrets"`.
- Le français des commentaires et des messages de commit passe le hook `relire-francais.mjs` : pas de tiret cadratin ni demi-cadratin.
- Commits : `git add` sur les chemins exacts, jamais `git add -A` (sessions parallèles sur ce repo).

## Écart assumé avec la spec

La spec écrit « Disponibilité : `AVAILABILITY_FREE` », qui est le vocabulaire du connecteur MCP. L'API REST Google Calendar v3 nomme ce champ `transparency: "transparent"`. C'est ce dernier qui est implémenté ici. Même intention, nom réel du champ.

## Structure des fichiers

| Fichier | Responsabilité |
| --- | --- |
| `src/lib/livraisons/etiquette.ts` | Dérive l'étiquette courte et le titre. Pur, aucune dépendance. |
| `src/lib/livraisons/linear-milestones.ts` | Requête GraphQL, filtrage, projection en `Livraison[]`. |
| `src/lib/livraisons/google-calendar.ts` | Jeton OAuth, listage, écriture, suppression. |
| `src/lib/livraisons/sync.ts` | Orchestration et diff. Dépendances injectées, donc testable sans réseau. |
| `src/worker.ts` | Branchement sur le cron existant. |
| `src/worker-env.d.ts` | Déclaration des trois secrets. |
| `.dev.vars.example` | Documentation des trois secrets. |

---

## Task 0 : Worktree

Le plan touche `src/worker.ts` et `src/lib/`, donc du code partagé. Le clone principal reste le bureau.

- [ ] **Step 1 : Créer le worktree et y copier les trois éléments d'environnement**

```bash
cd ~/dev/coolbeans
git worktree add ../coolbeans-livraisons -b feat/calendrier-livraisons staging
cp .env ../coolbeans-livraisons/.env
cp .dev.vars ../coolbeans-livraisons/.dev.vars
mkdir -p ../coolbeans-livraisons/.wrangler
cp -R .wrangler/state ../coolbeans-livraisons/.wrangler/state
```

- [ ] **Step 2 : Vérifier le point de départ**

```bash
cd ../coolbeans-livraisons && pwd && git branch --show-current && git status --short
```

Attendu : le chemin du worktree, la branche `feat/calendrier-livraisons`, un arbre propre.

Toutes les commandes des tâches suivantes s'exécutent depuis ce worktree.

---

## Task 1 : Étiquette et titre

**Files:**
- Create: `src/lib/livraisons/etiquette.ts`
- Test: `src/lib/livraisons/etiquette.test.ts`

**Interfaces:**
- Consumes: rien.
- Produces:
  - `etiquetteMilestone(m: { nom: string; description?: string | null }): string`
  - `titreEvenement(cleTeam: string, etiquette: string): string`

- [ ] **Step 1 : Écrire le test qui échoue**

Créer `src/lib/livraisons/etiquette.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { etiquetteMilestone, titreEvenement } from "./etiquette";

const m = (nom: string, description?: string) => ({ nom, description });

describe("etiquetteMilestone", () => {
  it("coupe au premier connecteur", () => {
    expect(etiquetteMilestone(m("Intégration conforme à la maquette"))).toBe("Intégration");
    expect(etiquetteMilestone(m("Compléments de contenu et ajustements"))).toBe("Compléments de contenu");
    expect(etiquetteMilestone(m("Livrer V1 à Amusoire"))).toBe("Livrer V1");
  });

  it("coupe sur la ponctuation", () => {
    expect(etiquetteMilestone(m("Livraison finale (retours client)"))).toBe("Livraison finale");
    expect(etiquetteMilestone(m("Intégration Git + convention de branche"))).toBe("Intégration Git");
  });

  it("retire un préfixe de code", () => {
    expect(etiquetteMilestone(m("P7 · Moteur d'observations"))).toBe("Moteur d'observations");
    expect(etiquetteMilestone(m("S1 \u2014 Progression et notes"))).toBe("Progression");
  });

  it("laisse intact un nom déjà court", () => {
    expect(etiquetteMilestone(m("Mise en ligne V1"))).toBe("Mise en ligne V1");
    expect(etiquetteMilestone(m("Support & compte"))).toBe("Support & compte");
  });

  it("tronque au-delà de 30 caractères", () => {
    const long = "Reconstruction intégrale du dispositif de mesure";
    const r = etiquetteMilestone(m(long));
    expect(r.length).toBeLessThanOrEqual(30);
    expect(r.endsWith("…")).toBe(true);
  });

  it("la ligne Agenda de la description l'emporte", () => {
    expect(
      etiquetteMilestone(m("Livraison et mise en ligne", "Contexte interne.\nAgenda : Mise en ligne\nSuite.")),
    ).toBe("Mise en ligne");
  });

  it("ignore une description sans ligne Agenda", () => {
    expect(etiquetteMilestone(m("Bilan pilote (J+14)", "Rien de particulier."))).toBe("Bilan pilote");
  });
});

describe("titreEvenement", () => {
  it("préfixe par la clé de team", () => {
    expect(titreEvenement("LIT", "Intégration")).toBe("LIT-Intégration");
  });
});
```

- [ ] **Step 2 : Lancer le test et vérifier qu'il échoue**

Run : `npx vitest run src/lib/livraisons/etiquette.test.ts`
Attendu : ÉCHEC, `Failed to resolve import "./etiquette"`.

- [ ] **Step 3 : Écrire l'implémentation minimale**

Créer `src/lib/livraisons/etiquette.ts` :

```ts
// Derive l'etiquette courte affichee dans le calendrier Livraisons.
//
// Linear n'est jamais modifie : les noms de milestones restent explicites,
// parce que Ludo les relit et que le client les retrouve dans la proposition
// commerciale. Le raccourci vit ici, a l'ecriture dans l'agenda.

const MAX = 30;

// Prefixe de code en tete : "S0 <cadratin> ", "P7 <point median> ", "12- ".
// Les deux echappements sont le cadratin et le demi-cadratin, ecrits ainsi
// pour respecter la regle de redaction du depot.
const PREFIXE_CODE = /^[A-Z]?\d+\s*[·\u2014\u2013-]\s*/;

// Coupe au premier connecteur. La forme " mot" plutot que "\bmot\b" est
// deliberee : en JavaScript, \b est ASCII, donc "\ba\b" ne matcherait jamais
// le "a" accentue de "a Amusoire".
const CONNECTEUR = /\s(?:et|ou|puis|à|vers|conforme|avec|pour|afin|selon)(?=\s|$)|[(,:+]/u;

// Porte de sortie : une ligne "Agenda : ..." dans la description de la
// milestone l'emporte sur la regle de coupe. La description est interne.
const LIGNE_AGENDA = /^[ \t]*Agenda[ \t]*:[ \t]*(.+)$/im;

function tronquer(texte: string): string {
  return texte.length > MAX ? `${texte.slice(0, MAX - 1).trimEnd()}…` : texte;
}

export function etiquetteMilestone(m: { nom: string; description?: string | null }): string {
  const force = m.description?.match(LIGNE_AGENDA)?.[1]?.trim();
  if (force) return tronquer(force);

  let nom = m.nom.replace(PREFIXE_CODE, "").trim();
  const coupe = nom.match(CONNECTEUR);
  if (coupe?.index !== undefined && coupe.index > 0) {
    nom = nom.slice(0, coupe.index).trim();
  }
  return tronquer(nom);
}

export function titreEvenement(cleTeam: string, etiquette: string): string {
  return `${cleTeam}-${etiquette}`;
}
```

- [ ] **Step 4 : Lancer le test et vérifier qu'il passe**

Run : `npx vitest run src/lib/livraisons/etiquette.test.ts`
Attendu : SUCCÈS, 8 tests.

- [ ] **Step 5 : Commit**

```bash
git add src/lib/livraisons/etiquette.ts src/lib/livraisons/etiquette.test.ts
git commit -m "feat(livraisons): etiquette courte derivee du nom de milestone"
```

---

## Task 2 : Lecture des milestones Linear

**Files:**
- Create: `src/lib/livraisons/linear-milestones.ts`
- Test: `src/lib/livraisons/linear-milestones.test.ts`

**Interfaces:**
- Consumes: `etiquetteMilestone` de la Task 1 ; `graphql` de `src/lib/portail/linear-graphql.ts`.
- Produces:
  - `interface Livraison { milestoneId: string; cleTeam: string; etiquette: string; date: string; projetNom: string; projetUrl: string }`
  - `interface ProjetLinear { id: string; name: string; url: string; status: { type: string } | null; teams: { nodes: Array<{ key: string }> }; projectMilestones: { nodes: Array<{ id: string; name: string; description: string | null; targetDate: string | null }> } }`
  - `livraisonsDepuisProjets(projets: ProjetLinear[]): Livraison[]`
  - `lireLivraisons(apiKey: string): Promise<Livraison[]>`

- [ ] **Step 1 : Vérifier la forme réelle de la réponse Linear avant d'écrire le type**

Le nom du champ de statut a changé au fil des versions de l'API. Confirmer avant de coder plutôt que de déboguer un `undefined` plus tard.

```bash
KEY=$(grep '^LINEAR_API_KEY=' .dev.vars | cut -d= -f2-) && \
curl -s https://api.linear.app/graphql -H "authorization: $KEY" \
  -H 'content-type: application/json' \
  -d '{"query":"{ projects(first: 3) { nodes { id name url status { type } teams(first: 1) { nodes { key } } projectMilestones(first: 3) { nodes { id name description targetDate } } } } }"}' \
  | head -c 1200
```

Attendu : un JSON avec `data.projects.nodes`, chaque nœud portant `status.type`, `teams.nodes[0].key` et `projectMilestones.nodes`. Si la réponse contient `errors`, corriger la requête à partir du message avant de continuer, et reporter la correction dans le Step 3.

- [ ] **Step 2 : Écrire le test qui échoue**

Créer `src/lib/livraisons/linear-milestones.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { livraisonsDepuisProjets, type ProjetLinear } from "./linear-milestones";

const projet = (
  nom: string,
  cleTeam: string,
  typeStatut: string,
  milestones: Array<{ id: string; name: string; targetDate: string | null }>,
): ProjetLinear => ({
  id: `p-${nom}`,
  name: nom,
  url: `https://linear.app/coolbeans-hq/project/${nom}`,
  status: { type: typeStatut },
  teams: { nodes: [{ key: cleTeam }] },
  projectMilestones: {
    nodes: milestones.map((m) => ({ ...m, description: null })),
  },
});

describe("livraisonsDepuisProjets", () => {
  it("projette une milestone datee", () => {
    const r = livraisonsDepuisProjets([
      projet("Site vitrine LittleBox", "LIT", "started", [
        { id: "8b6f09dd-e6bb-41fe-9bdb-617b6b85af80", name: "Intégration conforme à la maquette", targetDate: "2026-09-12" },
      ]),
    ]);
    expect(r).toEqual([
      {
        milestoneId: "8b6f09dd-e6bb-41fe-9bdb-617b6b85af80",
        cleTeam: "LIT",
        etiquette: "Intégration",
        date: "2026-09-12",
        projetNom: "Site vitrine LittleBox",
        projetUrl: "https://linear.app/coolbeans-hq/project/Site vitrine LittleBox",
      },
    ]);
  });

  it("ecarte une milestone sans date cible", () => {
    const r = livraisonsDepuisProjets([
      projet("Site web CAFA", "CAF", "backlog", [{ id: "a", name: "Livraison V1", targetDate: null }]),
    ]);
    expect(r).toEqual([]);
  });

  it("ecarte un projet annule", () => {
    const r = livraisonsDepuisProjets([
      projet("Refonte du site En Haut", "ENH", "canceled", [{ id: "b", name: "Livraison V1", targetDate: "2026-10-01" }]),
    ]);
    expect(r).toEqual([]);
  });

  it("ecarte le gabarit Test de la team MOD", () => {
    const r = livraisonsDepuisProjets([
      projet("Test", "MOD", "backlog", [{ id: "c", name: "Livraison", targetDate: "2026-10-01" }]),
    ]);
    expect(r).toEqual([]);
  });

  it("garde un projet nomme Test dans une autre team", () => {
    const r = livraisonsDepuisProjets([
      projet("Test", "COO", "backlog", [{ id: "d", name: "Livraison", targetDate: "2026-10-01" }]),
    ]);
    expect(r).toHaveLength(1);
  });

  it("ecarte un projet sans team", () => {
    const sansTeam = { ...projet("Orphelin", "X", "started", [{ id: "e", name: "Livraison", targetDate: "2026-10-01" }]), teams: { nodes: [] } };
    expect(livraisonsDepuisProjets([sansTeam])).toEqual([]);
  });

  it("tolere un statut absent", () => {
    const sansStatut = { ...projet("Sans statut", "COO", "started", [{ id: "f", name: "Livraison", targetDate: "2026-10-01" }]), status: null };
    expect(livraisonsDepuisProjets([sansStatut])).toHaveLength(1);
  });
});
```

- [ ] **Step 3 : Lancer le test et vérifier qu'il échoue**

Run : `npx vitest run src/lib/livraisons/linear-milestones.test.ts`
Attendu : ÉCHEC, `Failed to resolve import "./linear-milestones"`.

- [ ] **Step 4 : Écrire l'implémentation minimale**

Créer `src/lib/livraisons/linear-milestones.ts` :

```ts
// Lecture seule des milestones Linear datees, projetees en livraisons.
//
// Aucune mutation : ce module ne fait que lire. Le filtre "milestone sans
// date cible" n'est pas arbitraire, il traduit la regle "pas de date tant que
// l'acompte n'est pas encaisse" : une affaire non signee ne porte donc aucun
// evenement, sans que ce code connaisse la notion de signature.

import { graphql } from "../portail/linear-graphql";
import { etiquetteMilestone } from "./etiquette";

export interface Livraison {
  milestoneId: string;
  cleTeam: string;
  etiquette: string;
  date: string;
  projetNom: string;
  projetUrl: string;
}

export interface ProjetLinear {
  id: string;
  name: string;
  url: string;
  status: { type: string } | null;
  teams: { nodes: Array<{ key: string }> };
  projectMilestones: {
    nodes: Array<{ id: string; name: string; description: string | null; targetDate: string | null }>;
  };
}

const REQUETE = `
  query Livraisons {
    projects(first: 250) {
      nodes {
        id
        name
        url
        status { type }
        teams(first: 1) { nodes { key } }
        projectMilestones(first: 50) {
          nodes { id name description targetDate }
        }
      }
    }
  }
`;

export function livraisonsDepuisProjets(projets: ProjetLinear[]): Livraison[] {
  const livraisons: Livraison[] = [];
  for (const projet of projets) {
    if (projet.status?.type === "canceled") continue;
    const cleTeam = projet.teams.nodes[0]?.key;
    if (!cleTeam) continue;
    // Gabarit du modele client : jamais un engagement reel.
    if (cleTeam === "MOD" && projet.name === "Test") continue;

    for (const milestone of projet.projectMilestones.nodes) {
      if (!milestone.targetDate) continue;
      livraisons.push({
        milestoneId: milestone.id,
        cleTeam,
        etiquette: etiquetteMilestone(milestone),
        date: milestone.targetDate,
        projetNom: projet.name,
        projetUrl: projet.url,
      });
    }
  }
  return livraisons;
}

export async function lireLivraisons(apiKey: string): Promise<Livraison[]> {
  const data = await graphql<{ projects: { nodes: ProjetLinear[] } }>(apiKey, REQUETE, {});
  return livraisonsDepuisProjets(data.projects.nodes);
}
```

- [ ] **Step 5 : Lancer le test et vérifier qu'il passe**

Run : `npx vitest run src/lib/livraisons/linear-milestones.test.ts`
Attendu : SUCCÈS, 7 tests.

- [ ] **Step 6 : Commit**

```bash
git add src/lib/livraisons/linear-milestones.ts src/lib/livraisons/linear-milestones.test.ts
git commit -m "feat(livraisons): lecture des milestones Linear datees"
```

---

## Task 3 : Client Google Calendar

**Files:**
- Create: `src/lib/livraisons/google-calendar.ts`
- Test: `src/lib/livraisons/google-calendar.test.ts`

**Interfaces:**
- Consumes: `Livraison` et `titreEvenement` des tâches 1 et 2.
- Produces:
  - `idEvenement(milestoneId: string): string`
  - `lendemain(iso: string): string`
  - `corpsEvenement(l: Livraison): Record<string, unknown>`
  - `jetonAcces(email: string, clePriveeBase64: string): Promise<string>`
  - `listerIdsLivraisons(jeton: string, calendarId: string): Promise<string[]>`
  - `ecrireEvenement(jeton: string, calendarId: string, l: Livraison): Promise<"cree" | "maj">`
  - `supprimerEvenement(jeton: string, calendarId: string, id: string): Promise<void>`

- [ ] **Step 1 : Écrire le test qui échoue**

Seules les fonctions pures sont testées. Le jeton et les appels réseau se recettent en production, pas en test unitaire.

Créer `src/lib/livraisons/google-calendar.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { corpsEvenement, idEvenement, lendemain } from "./google-calendar";
import type { Livraison } from "./linear-milestones";

const L: Livraison = {
  milestoneId: "8b6f09dd-e6bb-41fe-9bdb-617b6b85af80",
  cleTeam: "LIT",
  etiquette: "Intégration",
  date: "2026-09-12",
  projetNom: "Site vitrine LittleBox",
  projetUrl: "https://linear.app/coolbeans-hq/project/littlebox",
};

describe("idEvenement", () => {
  it("derive un identifiant valide pour Google", () => {
    const id = idEvenement(L.milestoneId);
    expect(id).toBe("lm8b6f09dde6bb41fe9bdb617b6b85af80");
    // Google n'accepte que les caracteres a-v et 0-9, longueur 5 a 1024.
    expect(id).toMatch(/^[a-v0-9]{5,1024}$/);
  });

  it("est stable", () => {
    expect(idEvenement(L.milestoneId)).toBe(idEvenement(L.milestoneId));
  });
});

describe("lendemain", () => {
  it("ajoute un jour", () => {
    expect(lendemain("2026-09-12")).toBe("2026-09-13");
  });

  it("franchit une fin de mois", () => {
    expect(lendemain("2026-09-30")).toBe("2026-10-01");
  });

  it("franchit une fin d'annee", () => {
    expect(lendemain("2026-12-31")).toBe("2027-01-01");
  });
});

describe("corpsEvenement", () => {
  it("compose un evenement journee entiere marque livraisons", () => {
    expect(corpsEvenement(L)).toEqual({
      id: "lm8b6f09dde6bb41fe9bdb617b6b85af80",
      summary: "LIT-Intégration",
      description: 'Site vitrine LittleBox\nhttps://linear.app/coolbeans-hq/project/littlebox',
      start: { date: "2026-09-12" },
      end: { date: "2026-09-13" },
      transparency: "transparent",
      extendedProperties: { private: { source: "livraisons" } },
    });
  });
});
```

- [ ] **Step 2 : Lancer le test et vérifier qu'il échoue**

Run : `npx vitest run src/lib/livraisons/google-calendar.test.ts`
Attendu : ÉCHEC, `Failed to resolve import "./google-calendar"`.

- [ ] **Step 3 : Écrire l'implémentation minimale**

Créer `src/lib/livraisons/google-calendar.ts` :

```ts
// Client Google Calendar v3 pour le calendrier Livraisons.
//
// Compte de service sans delegation a l'echelle du domaine : le calendrier est
// partage a la main avec l'adresse du compte de service. Le jeton est signe
// ici en WebCrypto, sans dependance ajoutee.
//
// L'identifiant de l'evenement est derive de celui de la milestone Linear :
// creer et mettre a jour deviennent la meme operation, et aucune table de
// correspondance n'est tenue.

import { titreEvenement, type Livraison } from "./linear-milestones";

const API = "https://www.googleapis.com/calendar/v3/calendars";
const SCOPE = "https://www.googleapis.com/auth/calendar.events";
const MARQUE = "livraisons";

export function idEvenement(milestoneId: string): string {
  return `lm${milestoneId.replace(/-/g, "")}`;
}

export function lendemain(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function corpsEvenement(l: Livraison): Record<string, unknown> {
  return {
    id: idEvenement(l.milestoneId),
    summary: titreEvenement(l.cleTeam, l.etiquette),
    description: `${l.projetNom}\n${l.projetUrl}`,
    start: { date: l.date },
    end: { date: lendemain(l.date) },
    // Une echeance borne le temps, elle ne l'occupe pas : la marquer occupee
    // fausserait toute recherche de creneau.
    transparency: "transparent",
    extendedProperties: { private: { source: MARQUE } },
  };
}

function base64url(octets: Uint8Array): string {
  let binaire = "";
  for (const o of octets) binaire += String.fromCharCode(o);
  return btoa(binaire).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

const texteEnBase64url = (t: string) => base64url(new TextEncoder().encode(t));

async function importerCle(clePriveeBase64: string): Promise<CryptoKey> {
  const pem = atob(clePriveeBase64);
  const corps = pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const der = Uint8Array.from(atob(corps), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey(
    "pkcs8",
    der,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

export async function jetonAcces(email: string, clePriveeBase64: string): Promise<string> {
  const maintenant = Math.floor(Date.now() / 1000);
  const entete = texteEnBase64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const charge = texteEnBase64url(
    JSON.stringify({
      iss: email,
      scope: SCOPE,
      aud: "https://oauth2.googleapis.com/token",
      iat: maintenant,
      exp: maintenant + 3600,
    }),
  );
  const cle = await importerCle(clePriveeBase64);
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cle,
    new TextEncoder().encode(`${entete}.${charge}`),
  );
  const assertion = `${entete}.${charge}.${base64url(new Uint8Array(signature))}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!res.ok) throw new Error(`Google token ${res.status} : ${await res.text()}`);
  const { access_token } = (await res.json()) as { access_token?: string };
  if (!access_token) throw new Error("Google token : reponse sans access_token");
  return access_token;
}

export async function listerIdsLivraisons(jeton: string, calendarId: string): Promise<string[]> {
  const ids: string[] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({
      privateExtendedProperty: `source=${MARQUE}`,
      maxResults: "2500",
      showDeleted: "false",
      fields: "items(id),nextPageToken",
    });
    if (pageToken) params.set("pageToken", pageToken);
    const res = await fetch(`${API}/${encodeURIComponent(calendarId)}/events?${params}`, {
      headers: { authorization: `Bearer ${jeton}` },
    });
    if (!res.ok) throw new Error(`Google list ${res.status} : ${await res.text()}`);
    const page = (await res.json()) as { items?: Array<{ id: string }>; nextPageToken?: string };
    for (const item of page.items ?? []) ids.push(item.id);
    pageToken = page.nextPageToken;
  } while (pageToken);
  return ids;
}

export async function ecrireEvenement(
  jeton: string,
  calendarId: string,
  l: Livraison,
): Promise<"cree" | "maj"> {
  const corps = corpsEvenement(l);
  const base = `${API}/${encodeURIComponent(calendarId)}/events`;
  const entetes = { authorization: `Bearer ${jeton}`, "content-type": "application/json" };

  const maj = await fetch(`${base}/${idEvenement(l.milestoneId)}`, {
    method: "PUT",
    headers: entetes,
    body: JSON.stringify(corps),
  });
  if (maj.ok) return "maj";
  if (maj.status !== 404) throw new Error(`Google put ${maj.status} : ${await maj.text()}`);

  const creation = await fetch(base, { method: "POST", headers: entetes, body: JSON.stringify(corps) });
  if (!creation.ok) throw new Error(`Google post ${creation.status} : ${await creation.text()}`);
  return "cree";
}

export async function supprimerEvenement(
  jeton: string,
  calendarId: string,
  id: string,
): Promise<void> {
  const res = await fetch(`${API}/${encodeURIComponent(calendarId)}/events/${id}`, {
    method: "DELETE",
    headers: { authorization: `Bearer ${jeton}` },
  });
  // 404 et 410 : l'evenement est deja parti, l'intention est satisfaite.
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    throw new Error(`Google delete ${res.status} : ${await res.text()}`);
  }
}
```

- [ ] **Step 4 : Réexporter `titreEvenement` depuis `linear-milestones.ts`**

Le client importe `titreEvenement` depuis `linear-milestones` pour ne dépendre que d'un module. Ajouter la réexportation en tête de `src/lib/livraisons/linear-milestones.ts`, sous les imports existants :

```ts
export { titreEvenement } from "./etiquette";
```

- [ ] **Step 5 : Lancer le test et vérifier qu'il passe**

Run : `npx vitest run src/lib/livraisons/google-calendar.test.ts`
Attendu : SUCCÈS, 6 tests.

- [ ] **Step 6 : Commit**

```bash
git add src/lib/livraisons/google-calendar.ts src/lib/livraisons/google-calendar.test.ts src/lib/livraisons/linear-milestones.ts
git commit -m "feat(livraisons): client Google Calendar signe en WebCrypto"
```

---

## Task 4 : Orchestration et diff

**Files:**
- Create: `src/lib/livraisons/sync.ts`
- Test: `src/lib/livraisons/sync.test.ts`

**Interfaces:**
- Consumes: `Livraison` (Task 2), `idEvenement`, `jetonAcces`, `listerIdsLivraisons`, `ecrireEvenement`, `supprimerEvenement` (Task 3), `lireLivraisons` (Task 2).
- Produces:
  - `interface ResultatSync { crees: number; maj: number; supprimes: number; echecs: number }`
  - `interface DepsSync { lireLivraisons: () => Promise<Livraison[]>; listerIds: () => Promise<string[]>; ecrire: (l: Livraison) => Promise<"cree" | "maj">; supprimer: (id: string) => Promise<void> }`
  - `reconcilier(deps: DepsSync): Promise<ResultatSync>`
  - `synchroniserLivraisons(o: { apiKey: string; email: string; clePriveeBase64: string; calendarId: string }): Promise<ResultatSync>`

- [ ] **Step 1 : Écrire le test qui échoue**

Créer `src/lib/livraisons/sync.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { reconcilier } from "./sync";
import type { Livraison } from "./linear-milestones";

const livraison = (milestoneId: string): Livraison => ({
  milestoneId,
  cleTeam: "LIT",
  etiquette: "Intégration",
  date: "2026-09-12",
  projetNom: "Site vitrine LittleBox",
  projetUrl: "https://linear.app/coolbeans-hq/project/littlebox",
});

const deps = (o: {
  livraisons: Livraison[];
  ids: string[];
  ecrire?: (l: Livraison) => Promise<"cree" | "maj">;
}) => {
  const supprimes: string[] = [];
  return {
    supprimes,
    d: {
      lireLivraisons: async () => o.livraisons,
      listerIds: async () => o.ids,
      ecrire: o.ecrire ?? (async () => "maj" as const),
      supprimer: async (id: string) => {
        supprimes.push(id);
      },
    },
  };
};

describe("reconcilier", () => {
  it("cree ce qui manque", async () => {
    const { d } = deps({ livraisons: [livraison("aaaa-bbbb")], ids: [], ecrire: async () => "cree" });
    expect(await reconcilier(d)).toEqual({ crees: 1, maj: 0, supprimes: 0, echecs: 0 });
  });

  it("met a jour ce qui existe deja", async () => {
    const { d } = deps({ livraisons: [livraison("aaaa-bbbb")], ids: ["lmaaaabbbb"] });
    expect(await reconcilier(d)).toEqual({ crees: 0, maj: 1, supprimes: 0, echecs: 0 });
  });

  it("supprime un orphelin", async () => {
    const { d, supprimes } = deps({ livraisons: [], ids: ["lmvieux"] });
    expect(await reconcilier(d)).toEqual({ crees: 0, maj: 0, supprimes: 1, echecs: 0 });
    expect(supprimes).toEqual(["lmvieux"]);
  });

  it("ne supprime pas un evenement encore cible", async () => {
    const { d, supprimes } = deps({ livraisons: [livraison("aaaa-bbbb")], ids: ["lmaaaabbbb"] });
    await reconcilier(d);
    expect(supprimes).toEqual([]);
  });

  it("compte un echec isole sans interrompre le reste", async () => {
    const { d } = deps({
      livraisons: [livraison("aaaa-bbbb"), livraison("cccc-dddd")],
      ids: [],
      ecrire: async (l) => {
        if (l.milestoneId === "aaaa-bbbb") throw new Error("boom");
        return "cree";
      },
    });
    expect(await reconcilier(d)).toEqual({ crees: 1, maj: 0, supprimes: 0, echecs: 1 });
  });
});
```

- [ ] **Step 2 : Lancer le test et vérifier qu'il échoue**

Run : `npx vitest run src/lib/livraisons/sync.test.ts`
Attendu : ÉCHEC, `Failed to resolve import "./sync"`.

- [ ] **Step 3 : Écrire l'implémentation minimale**

Créer `src/lib/livraisons/sync.ts` :

```ts
// Orchestration de la synchronisation Linear vers le calendrier Livraisons.
//
// Les dependances sont injectees pour que le diff se teste sans reseau.
// Un echec sur un evenement isole est compte et n'interrompt pas le reste :
// une milestone au nom pathologique ne doit pas geler tout le calendrier.

import {
  ecrireEvenement,
  idEvenement,
  jetonAcces,
  listerIdsLivraisons,
  supprimerEvenement,
} from "./google-calendar";
import { lireLivraisons, type Livraison } from "./linear-milestones";

export interface ResultatSync {
  crees: number;
  maj: number;
  supprimes: number;
  echecs: number;
}

export interface DepsSync {
  lireLivraisons: () => Promise<Livraison[]>;
  listerIds: () => Promise<string[]>;
  ecrire: (l: Livraison) => Promise<"cree" | "maj">;
  supprimer: (id: string) => Promise<void>;
}

export async function reconcilier(deps: DepsSync): Promise<ResultatSync> {
  const [livraisons, idsExistants] = await Promise.all([deps.lireLivraisons(), deps.listerIds()]);
  const resultat: ResultatSync = { crees: 0, maj: 0, supprimes: 0, echecs: 0 };

  const cibles = new Set<string>();
  for (const l of livraisons) {
    cibles.add(idEvenement(l.milestoneId));
    try {
      const issue = await deps.ecrire(l);
      if (issue === "cree") resultat.crees += 1;
      else resultat.maj += 1;
    } catch {
      resultat.echecs += 1;
    }
  }

  for (const id of idsExistants) {
    if (cibles.has(id)) continue;
    try {
      await deps.supprimer(id);
      resultat.supprimes += 1;
    } catch {
      resultat.echecs += 1;
    }
  }

  return resultat;
}

export async function synchroniserLivraisons(o: {
  apiKey: string;
  email: string;
  clePriveeBase64: string;
  calendarId: string;
}): Promise<ResultatSync> {
  const jeton = await jetonAcces(o.email, o.clePriveeBase64);
  return reconcilier({
    lireLivraisons: () => lireLivraisons(o.apiKey),
    listerIds: () => listerIdsLivraisons(jeton, o.calendarId),
    ecrire: (l) => ecrireEvenement(jeton, o.calendarId, l),
    supprimer: (id) => supprimerEvenement(jeton, o.calendarId, id),
  });
}
```

- [ ] **Step 4 : Lancer le test et vérifier qu'il passe**

Run : `npx vitest run src/lib/livraisons/sync.test.ts`
Attendu : SUCCÈS, 5 tests.

- [ ] **Step 5 : Commit**

```bash
git add src/lib/livraisons/sync.ts src/lib/livraisons/sync.test.ts
git commit -m "feat(livraisons): reconciliation idempotente sans etat"
```

---

## Task 5 : Branchement sur le cron et déclaration des secrets

**Files:**
- Modify: `src/worker.ts:113` (fin du handler `scheduled`)
- Modify: `src/worker-env.d.ts:48` (fin de `PortalSecrets`)
- Modify: `.dev.vars.example`

**Interfaces:**
- Consumes: `synchroniserLivraisons` (Task 4).
- Produces: rien pour d'autres tâches.

- [ ] **Step 1 : Déclarer les trois secrets**

Dans `src/worker-env.d.ts`, ajouter à l'intérieur de `interface PortalSecrets`, après `BETTER_AUTH_SECRET` :

```ts
  /**
   * Compte de service Google (adresse en @…iam.gserviceaccount.com) : ecriture
   * du calendrier Livraisons depuis le cron. `wrangler secret put
   * GOOGLE_SA_EMAIL`, production uniquement.
   */
  GOOGLE_SA_EMAIL?: string;

  /**
   * Cle privee PEM du compte de service, encodee en base64 pour survivre au
   * passage d'une valeur multiligne en secret. `wrangler secret put
   * GOOGLE_SA_PRIVATE_KEY`, production uniquement.
   */
  GOOGLE_SA_PRIVATE_KEY?: string;

  /**
   * Identifiant du calendrier Google « Livraisons » (Parametres du calendrier
   * > Integrer le calendrier). `wrangler secret put
   * GOOGLE_CALENDAR_LIVRAISONS_ID`, production uniquement.
   */
  GOOGLE_CALENDAR_LIVRAISONS_ID?: string;
```

- [ ] **Step 2 : Documenter les secrets dans `.dev.vars.example`**

Ajouter en fin de fichier :

```
# Calendrier Google « Livraisons » : le cron y ecrit les milestones Linear
# datees. Production uniquement, laisser vide en local et en staging (la tache
# se saute d'elle-meme). La cle privee est le champ `private_key` du JSON du
# compte de service, encode en base64.
GOOGLE_SA_EMAIL=
GOOGLE_SA_PRIVATE_KEY=
GOOGLE_CALENDAR_LIVRAISONS_ID=
```

- [ ] **Step 3 : Brancher la tâche sur le cron**

Dans `src/worker.ts`, ajouter l'import sous les deux imports de messagerie existants (ligne 19) :

```ts
import { synchroniserLivraisons } from "./lib/livraisons/sync";
```

Puis, à la fin du handler `scheduled`, juste avant sa fermeture (après le second `ctx.waitUntil`, ligne 112) :

```ts
    // Calendrier Livraisons : le cron tourne toutes les 5 minutes, la
    // synchronisation ne s'execute qu'au premier passage de chaque heure.
    // Production uniquement : sans les secrets Google la tache se saute, ce
    // qui evite que staging et prod se disputent le meme agenda.
    if (new Date(controller.scheduledTime).getUTCMinutes() < 5) {
      if (!env.LINEAR_API_KEY || !env.GOOGLE_SA_EMAIL || !env.GOOGLE_SA_PRIVATE_KEY || !env.GOOGLE_CALENDAR_LIVRAISONS_ID) {
        console.log(JSON.stringify({ event: "livraisons_sync", status: "skipped_missing_secrets", scheduled_at: scheduledAt }));
      } else {
        ctx.waitUntil(
          synchroniserLivraisons({
            apiKey: env.LINEAR_API_KEY,
            email: env.GOOGLE_SA_EMAIL,
            clePriveeBase64: env.GOOGLE_SA_PRIVATE_KEY,
            calendarId: env.GOOGLE_CALENDAR_LIVRAISONS_ID,
          })
            .then((r) =>
              console.log(JSON.stringify({ event: "livraisons_sync", status: "ok", ...r, scheduled_at: scheduledAt })),
            )
            .catch((err) =>
              console.log(JSON.stringify({ event: "livraisons_sync", status: "error", message: String(err), scheduled_at: scheduledAt })),
            ),
        );
      }
    }
```

Attention : le garde de la messagerie en tête du handler fait `return` quand `PORTAL_DB` manque. Vérifier que ce `return` reste au-dessus, et que le nouveau bloc est bien après lui. Si un jour la synchronisation doit tourner sans base D1, ce garde devra être déplacé ; ce n'est pas le cas aujourd'hui, la production a les deux.

- [ ] **Step 4 : Vérifier la compilation et la suite complète**

Run : `npx tsc --noEmit && npx vitest run`
Attendu : aucune erreur de type, tous les tests passent, dont les 26 nouveaux.

- [ ] **Step 5 : Commit**

```bash
git add src/worker.ts src/worker-env.d.ts .dev.vars.example
git commit -m "feat(livraisons): branchement horaire sur le cron du Worker"
```

---

## Task 6 : Recette et mise en production

Cette tâche demande des gestes qui ne se parallélisent jamais et un ordre explicite de Ludo. Ne rien exécuter sans lui.

- [ ] **Step 1 : Faire poser les trois secrets en production**

Ludo exécute lui-même, les valeurs ne transitent pas par la conversation :

```bash
python3 -c "import json,base64,sys;print(base64.b64encode(json.load(open(sys.argv[1]))['private_key'].encode()).decode())" ~/Downloads/<fichier>.json | npx wrangler secret put GOOGLE_SA_PRIVATE_KEY
npx wrangler secret put GOOGLE_SA_EMAIL
npx wrangler secret put GOOGLE_CALENDAR_LIVRAISONS_ID
```

- [ ] **Step 2 : Merger dans `staging` et vérifier le build**

```bash
cd ~/dev/coolbeans && git merge feat/calendrier-livraisons && git push
```

Le build Workers Builds prend environ 6 minutes. Un build rouge fige la prod sans signal : vérifier qu'il est vert avant d'aller plus loin.

- [ ] **Step 3 : Demander l'ordre de publication en production**

Lister `git log main..staging` et le faire valider par Ludo. Aucun merge vers `main` sans son ordre explicite.

- [ ] **Step 4 : Vérifier la première exécution**

Après le déploiement en production, attendre le premier passage horaire du cron, puis lire le journal :

```bash
npx wrangler tail --format json | grep livraisons_sync
```

Attendu : une ligne `status: "ok"` avec `crees` égal au nombre de milestones datées, `supprimes` à 0, `echecs` à 0.

- [ ] **Step 5 : Relire le calendrier et poser les libellés de rattrapage**

Ouvrir le calendrier Livraisons et vérifier les titres. Pour les deux cas connus, ajouter une ligne dans la description de la milestone Linear (le nom, lui, ne bouge pas) :

- `Site vitrine LittleBox` > `Livraison et mise en ligne` : `Agenda : Mise en ligne`
- `Portail myCoolbeans` > `P12 · Sortie, export et contractuel` : `Agenda : Sortie et export`

- [ ] **Step 6 : Nettoyer le worktree**

```bash
cd ~/dev/coolbeans && git worktree remove ../coolbeans-livraisons && git branch -d feat/calendrier-livraisons
```

---

## Auto-revue

**Couverture de la spec.** Chaque section a sa tâche : contenu et filtre (Task 2), format de l'événement (Task 3), normalisation du nom (Task 1), réconciliation sans état (Tasks 3 et 4), authentification Google (Task 3), cadence et environnements (Task 5), secrets (Task 5), erreurs et journalisation (Tasks 4 et 5), tests (Tasks 1 à 4), gestes manuels (Task 6).

**Écart relevé et tranché.** La spec dit `AVAILABILITY_FREE`, l'API dit `transparency: "transparent"`. Documenté en tête de plan, implémenté avec le nom réel.

**Cohérence des types.** `Livraison` est défini en Task 2 et consommé tel quel en Tasks 3 et 4. `titreEvenement` est défini en Task 1 et réexporté par `linear-milestones.ts` en Task 3 Step 4, ce qui évite au client Google d'importer deux modules. `idEvenement` est défini en Task 3 et réutilisé en Task 4 pour construire l'ensemble des cibles, avec la même dérivation des deux côtés.

**Point de fragilité connu.** Le nom du champ de statut de projet dans l'API Linear est vérifié en Task 2 Step 1 avant d'écrire le code, plutôt que supposé.
