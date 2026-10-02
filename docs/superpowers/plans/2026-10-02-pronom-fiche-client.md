# Le pronom vient de la fiche client : plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Le tu ou le vous se décide une fois, sur la fiche client ou l'organisation, et s'applique aux documents, à leurs formulaires et accusés de réception, au portail et à ses mails.

**Architecture:** Une règle pure, `src/lib/documents/pronom.ts`, résout le pronom d'un document et d'un compte à partir des fiches. Deux modules minces la branchent sur `astro:content` : `src/lib/documents/pronom-contenu.ts` pour les documents, `src/lib/portail/pronom.ts` pour le portail et ses mails. Le build s'arrête si un document ne résout aucun pronom. Les libellés courts du portail deviennent neutres ; les mails qui parlent à une personne passent en double registre.

**Tech Stack:** Astro 6 (content collections, server islands), TypeScript, Zod (`astro:schema`), Vitest, Cloudflare Workers + D1, Better Auth, Resend.

**Spec:** `docs/superpowers/specs/2026-10-02-pronom-fiche-client-design.md`

## Global Constraints

- Travailler dans le worktree `~/dev/coolbeans-pronom`, branche `feat/pronom-fiche-client`. Jamais dans le clone principal. Vérifier `pwd` et `git branch --show-current` avant le premier edit.
- Jamais de `git add -A` : ajouter les chemins un par un.
- Messages de commit terminés par `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.
- La clé `tutoiement` est obligatoire sur `src/content/clients/*.yaml` et `src/content/organisations/*.yaml`, sans valeur par défaut.
- Dans un document, `tutoiement` devient facultative et sans défaut. Présente, elle surcharge la fiche.
- Résolution d'un document, dans cet ordre : la clé du document (ou de sa racine pour une version), puis l'organisation pour une proposition (`devis`) dont la fiche a une organisation différente de `coolbeans`, puis la fiche du client. Rien : erreur au build.
- Un compte : client → fiche de son workspace ; revendeur → son organisation ; admin → la fiche `coolbeans`. Seul repli autorisé : le vous, pour un compte ou un destinataire qui ne résout rien, avec un `console.warn`.
- Une variante tu ne contient ni `vous`, ni `votre`, ni `vos`, ni un impératif en `-ez`. Une variante vous ne contient ni `tu`, ni `ton`, ni `ta`, ni `tes`.
- Typographie française dans les textes affichés : espace insécable avant `:` `;` `?` `!` (`&nbsp;` en HTML).
- Rien ne part en production sans ordre explicite de Ludo. Ce plan s'arrête au push sur `staging`.

## Review Focus

- Une V2 sans `projet` ni clé hérite du pronom de sa racine : la V2 UnlockBreath doit tutoyer dans son formulaire comme la V1 (test au Task 1).
- Un cadrage à plusieurs chapitres résout son pronom chapitre par chapitre : un chapitre qui porte sa clé ne doit pas imposer son pronom aux autres (vérification manuelle au Task 3, étape de recette).
- Le témoignage Amusoire garde sa surcharge `tutoiement: false` après la migration, alors que la fiche Amusoire passe au tu (vérification au Task 2).
- Une proposition Miharu (workspace de Trigger) se résout au pronom de Trigger, pas à celui de Miharu (test au Task 1).
- Une adresse de destinataire en majuscules résout quand même son compte : la requête compare en minuscules. D1 n'est pas exercée sous Vitest : la requête se vérifie sur la base locale (Task 5, étape 9).

---

## Fichiers

| Fichier | Rôle |
|---|---|
| `src/lib/documents/pronom.ts` (créé) | La règle : `pronomDuDocument`, `pronomDuCompte`, `verifierPronoms`, `ouVous` |
| `src/lib/documents/pronom.test.ts` (créé) | Ses tests |
| `src/lib/documents/pronom-contenu.ts` (créé) | `tutoiementDe(collection, id)`, branché sur `astro:content` |
| `src/lib/portail/pronom.ts` (créé) | `pronomDuPortail(meta)`, `pronomDuDestinataire(db, email)` |
| `src/content.config.ts` | Clé obligatoire sur clients et organisations, facultative sur les documents |
| `src/content/clients/*.yaml`, `src/content/organisations/*.yaml` | Les valeurs, quatre fiches créées |
| `src/lib/documents/projet.ts`, `src/lib/documents/charger.ts` | Le garde-fou au build |
| `src/lib/portail/workspaces.ts` | Le champ `tutoiement` du workspace |
| `src/components/documents/pages/Page*.astro` (4) | Le pronom résolu remplace `data.tutoiement` |
| `src/pages/api/{devis,cadrage,livrable,temoignage}-reponse.ts` | Idem, et messages d'erreur neutres |
| Pages `src/pages/espace/*`, composants `src/components/portail/*`, `src/pages/api/messagerie/*` | Libellés neutres |
| `src/lib/portail/registre-neutre.test.ts` (créé) | Garde-fou : plus de vous dans le portail |
| `src/emails/{support-confirmation,messagerie-reponse,auth}.ts` | Double registre |
| `src/emails/registres.test.ts` (créé) | Leurs tests |
| `src/pages/api/messagerie/nouveau.ts`, `src/lib/portail/messagerie/{ouvrir,publier}.ts`, `src/lib/auth/options.ts` | Les appels de mails |
| `src/content/docs/coolbeans/04-portail.mdx`, `docs/superpowers/specs/README.md` | Documentation |
| `~/.claude/skills/proposition-commerciale/references/{composition,cadrage}.md` | La fiche se crée avant le premier document |

---

### Task 1 : la règle de résolution

**Files:**
- Create: `src/lib/documents/pronom.ts`
- Test: `src/lib/documents/pronom.test.ts`

**Interfaces:**
- Consumes: `clientDuProjet`, `HORS_NOMENCLATURE` de `nomenclature.ts` ; `cle` de `projet.ts` ; `ORGANISATION_COOLBEANS` d'`acces.ts` ; `PortalRole` de `portail/metadata.ts` ; `CollectionDocument` d'`etapes.ts`.
- Produces :
  - `type Pronom = "tu" | "vous"`
  - `interface DocumentPronom { collection: CollectionDocument; id: string; projet?: string; versionDe?: string; tutoiement?: boolean }`
  - `interface FichePronom { slug: string; cle?: string; organisation: string; tutoiement?: boolean }`
  - `interface OrganisationPronom { slug: string; tutoiement?: boolean }`
  - `interface Registres { documents: readonly DocumentPronom[]; fiches: readonly FichePronom[]; organisations: readonly OrganisationPronom[] }`
  - `interface ComptePronom { role: PortalRole; organisation: string | null; workspace: string | null }`
  - `pronomDuDocument(doc: DocumentPronom, registres: Registres): Pronom | undefined`
  - `pronomDuCompte(compte: ComptePronom, registres: Pick<Registres, "fiches" | "organisations">): Pronom | undefined`
  - `verifierPronoms(registres: Registres, horsNomenclature?: readonly string[]): string[]`
  - `ouVous(p: Pronom | undefined, quoi: string): Pronom`

- [ ] **Step 1 : écrire les tests**

Les projets cités existent dans la table `PROJETS` : `site-web-879` (CAFA, client direct), `formulaire-brochures-831` (Miharu, client de Trigger).

```ts
// src/lib/documents/pronom.test.ts
import { describe, expect, it, vi } from "vitest";
import {
  ouVous,
  pronomDuCompte,
  pronomDuDocument,
  verifierPronoms,
  type DocumentPronom,
  type Registres,
} from "./pronom";

const fiches = [
  { slug: "cafa", cle: "caf", organisation: "coolbeans", tutoiement: false },
  { slug: "miharu", cle: "mih", organisation: "trigger", tutoiement: false },
  { slug: "coolbeans", organisation: "coolbeans", tutoiement: true },
];
const organisations = [
  { slug: "coolbeans", tutoiement: true },
  { slug: "trigger", tutoiement: true },
];

const registres = (documents: DocumentPronom[]): Registres => ({ documents, fiches, organisations });

describe("pronomDuDocument", () => {
  it("la clé du document gagne sur la fiche", () => {
    const doc: DocumentPronom = { collection: "devis", id: "cafa/site-web-8791", projet: "site-web-879", tutoiement: true };
    expect(pronomDuDocument(doc, registres([doc]))).toBe("tu");
  });

  it("un client direct suit sa fiche", () => {
    const doc: DocumentPronom = { collection: "livrable", id: "cafa/site-web-8791", projet: "site-web-879" };
    expect(pronomDuDocument(doc, registres([doc]))).toBe("vous");
  });

  it("une version sans projet hérite de sa racine, clé comprise", () => {
    const racine: DocumentPronom = { collection: "devis", id: "cafa/site-web-8791", projet: "site-web-879", tutoiement: true };
    const v2: DocumentPronom = { collection: "devis", id: "cafa/site-web-v2-4106", versionDe: "cafa/site-web-8791" };
    expect(pronomDuDocument(v2, registres([racine, v2]))).toBe("tu");
  });

  it("une version sans clé hérite de la fiche de sa racine", () => {
    const racine: DocumentPronom = { collection: "devis", id: "cafa/site-web-8791", projet: "site-web-879" };
    const v2: DocumentPronom = { collection: "devis", id: "cafa/site-web-v2-4106", versionDe: "cafa/site-web-8791" };
    expect(pronomDuDocument(v2, registres([racine, v2]))).toBe("vous");
  });

  it("une proposition chez un revendeur suit l'organisation", () => {
    const doc: DocumentPronom = { collection: "devis", id: "miharu/formulaire-brochures-8314", projet: "formulaire-brochures-831" };
    expect(pronomDuDocument(doc, registres([doc]))).toBe("tu");
  });

  it("un autre document chez un revendeur suit la fiche du client final", () => {
    const doc: DocumentPronom = { collection: "livrable", id: "miharu/formulaire-brochures-8314", projet: "formulaire-brochures-831" };
    expect(pronomDuDocument(doc, registres([doc]))).toBe("vous");
  });

  it("une organisation inconnue ne résout rien", () => {
    const doc: DocumentPronom = { collection: "devis", id: "miharu/formulaire-brochures-8314", projet: "formulaire-brochures-831" };
    expect(pronomDuDocument(doc, { documents: [doc], fiches, organisations: [] })).toBeUndefined();
  });

  it("une fiche sans pronom ne résout rien", () => {
    const doc: DocumentPronom = { collection: "livrable", id: "cafa/site-web-8791", projet: "site-web-879" };
    const sansPronom = fiches.map((f) => ({ ...f, tutoiement: undefined }));
    expect(pronomDuDocument(doc, { documents: [doc], fiches: sansPronom, organisations })).toBeUndefined();
  });

  it("un document sans projet ni clé ne résout rien", () => {
    const doc: DocumentPronom = { collection: "cadrage", id: "veronique-berthet/manuscrit-bb-4812" };
    expect(pronomDuDocument(doc, registres([doc]))).toBeUndefined();
  });
});

describe("verifierPronoms", () => {
  it("nomme chaque document sans pronom", () => {
    const ok: DocumentPronom = { collection: "devis", id: "cafa/site-web-8791", projet: "site-web-879" };
    const hors: DocumentPronom = { collection: "cadrage", id: "veronique-berthet/manuscrit-bb-4812" };
    expect(verifierPronoms(registres([ok, hors]), ["cadrage/veronique-berthet/manuscrit-bb-4812"])).toEqual([
      "cadrage/veronique-berthet/manuscrit-bb-4812 : hors nomenclature, il doit porter sa propre clé tutoiement",
    ]);
  });

  it("ne dit rien quand tout résout", () => {
    const ok: DocumentPronom = { collection: "devis", id: "cafa/site-web-8791", projet: "site-web-879" };
    expect(verifierPronoms(registres([ok]))).toEqual([]);
  });
});

describe("pronomDuCompte", () => {
  it("un client suit la fiche de son workspace", () => {
    expect(pronomDuCompte({ role: "client", organisation: "coolbeans", workspace: "cafa" }, { fiches, organisations })).toBe("vous");
  });
  it("un revendeur suit son organisation", () => {
    expect(pronomDuCompte({ role: "revendeur", organisation: "trigger", workspace: null }, { fiches, organisations })).toBe("tu");
  });
  it("un admin suit la fiche coolbeans", () => {
    expect(pronomDuCompte({ role: "admin", organisation: null, workspace: null }, { fiches, organisations })).toBe("tu");
  });
  it("un client sans workspace ne résout rien", () => {
    expect(pronomDuCompte({ role: "client", organisation: "coolbeans", workspace: null }, { fiches, organisations })).toBeUndefined();
  });
});

describe("ouVous", () => {
  it("garde un pronom résolu", () => {
    expect(ouVous("tu", "test")).toBe("tu");
  });
  it("replie sur le vous et le signale", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(ouVous(undefined, "compte client")).toBe("vous");
    expect(warn).toHaveBeenCalledWith("pronom non résolu (compte client) : repli sur le vous");
    warn.mockRestore();
  });
});
```

- [ ] **Step 2 : vérifier l'échec**

Run: `npx vitest run src/lib/documents/pronom.test.ts`
Expected: FAIL, `Failed to resolve import "./pronom"`.

- [ ] **Step 3 : écrire la règle**

```ts
// src/lib/documents/pronom.ts
/* Le pronom d'un document et d'un compte (spec 2026-10-02, le pronom vient de
 * la fiche client).
 *
 * La fiche client et l'organisation portent `tutoiement`. Un document le
 * surcharge s'il le porte ; une version hérite de sa racine. Sinon : une
 * proposition dans un workspace de revendeur suit l'organisation (elle lui est
 * adressée, comme le dit acces.ts), tout autre document suit la fiche du client.
 *
 * Fonctions pures, comme acces.ts : les gabarits et les routes les appellent
 * avec les collections chargées, les tests sans astro:content.
 */
import type { PortalRole } from "../portail/metadata";
import { ORGANISATION_COOLBEANS } from "./acces";
import type { CollectionDocument } from "./etapes";
import { HORS_NOMENCLATURE, clientDuProjet } from "./nomenclature";
import { cle } from "./projet";

export type Pronom = "tu" | "vous";

/** Ce que la résolution lit d'un document. */
export interface DocumentPronom {
  collection: CollectionDocument;
  id: string;
  projet?: string;
  versionDe?: string;
  tutoiement?: boolean;
}

/** Une fiche client, réduite à ce que la résolution lit. */
export interface FichePronom {
  slug: string;
  cle?: string;
  organisation: string;
  tutoiement?: boolean;
}

/** Une organisation : un revendeur, ou `coolbeans`. */
export interface OrganisationPronom {
  slug: string;
  tutoiement?: boolean;
}

export interface Registres {
  documents: readonly DocumentPronom[];
  fiches: readonly FichePronom[];
  organisations: readonly OrganisationPronom[];
}

/** Le compte connecté, ou le destinataire d'un mail. */
export interface ComptePronom {
  role: PortalRole;
  organisation: string | null;
  workspace: string | null;
}

const pronom = (tutoiement: boolean | undefined): Pronom | undefined =>
  tutoiement === undefined ? undefined : tutoiement ? "tu" : "vous";

/** Slug de la fiche qui porte le pronom de Ludo, celui des comptes admin. */
const FICHE_COOLBEANS = "coolbeans";

export function pronomDuDocument(doc: DocumentPronom, registres: Registres): Pronom | undefined {
  const racine = doc.versionDe
    ? registres.documents.find((d) => d.collection === doc.collection && d.id === doc.versionDe)
    : undefined;

  const surcharge = pronom(doc.tutoiement ?? racine?.tutoiement);
  if (surcharge) return surcharge;

  const projet = racine?.projet ?? doc.projet;
  const cleClient = projet ? clientDuProjet(projet) : undefined;
  const fiche = cleClient ? registres.fiches.find((f) => f.cle === cleClient) : undefined;
  if (!fiche) return undefined;

  if (doc.collection === "devis" && fiche.organisation !== ORGANISATION_COOLBEANS) {
    return pronom(registres.organisations.find((o) => o.slug === fiche.organisation)?.tutoiement);
  }
  return pronom(fiche.tutoiement);
}

export function pronomDuCompte(
  compte: ComptePronom,
  registres: Pick<Registres, "fiches" | "organisations">,
): Pronom | undefined {
  if (compte.role === "admin") {
    return pronom(registres.fiches.find((f) => f.slug === FICHE_COOLBEANS)?.tutoiement);
  }
  if (compte.role === "revendeur") {
    return pronom(registres.organisations.find((o) => o.slug === compte.organisation)?.tutoiement);
  }
  return pronom(registres.fiches.find((f) => f.slug === compte.workspace)?.tutoiement);
}

/** Les documents qui ne résolvent aucun pronom. Une liste vide veut dire cohérent. */
export function verifierPronoms(registres: Registres, horsNomenclature: readonly string[] = HORS_NOMENCLATURE): string[] {
  return registres.documents
    .filter((d) => !pronomDuDocument(d, registres))
    .map((d) =>
      horsNomenclature.includes(cle(d))
        ? `${cle(d)} : hors nomenclature, il doit porter sa propre clé tutoiement`
        : `${cle(d)} : aucun pronom ne se résout (clé tutoiement absente de sa fiche client ou de son organisation)`,
    );
}

/** Le seul repli autorisé : un compte ou un destinataire qui ne résout rien reçoit le vous. */
export function ouVous(p: Pronom | undefined, quoi: string): Pronom {
  if (p) return p;
  console.warn(`pronom non résolu (${quoi}) : repli sur le vous`);
  return "vous";
}
```

- [ ] **Step 4 : vérifier le succès**

Run: `npx vitest run src/lib/documents/pronom.test.ts`
Expected: PASS, 17 tests.

- [ ] **Step 5 : commit**

```bash
git add src/lib/documents/pronom.ts src/lib/documents/pronom.test.ts
git commit -m "feat(documents): résolution du pronom depuis la fiche client

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2 : les fiches portent le pronom, le build le vérifie

**Files:**
- Modify: `src/content.config.ts` (schémas `devis`, `livrable`, `cadrage`, `temoignage`, `clients`, `organisations`)
- Modify: les 14 fiches `src/content/clients/*.yaml`, les 2 organisations `src/content/organisations/*.yaml`
- Create: `src/content/clients/{aurelie-malbec,miharu,universite-montpellier,vice-versa}.yaml`
- Modify: 9 documents (clés retirées), listés à l'étape 4
- Modify: `src/lib/documents/projet.ts` (champ `tutoiement` de `DocumentProjet`), `src/lib/documents/charger.ts`
- Modify: `src/lib/portail/workspaces.ts` (interface `PortalWorkspace`)

**Interfaces:**
- Consumes: `verifierPronoms`, `Registres` (Task 1).
- Produces: `data.tutoiement: boolean` sur les entrées `clients` et `organisations` ; `data.tutoiement?: boolean` sur les quatre collections de documents ; `DocumentProjet.tutoiement?: boolean` ; `PortalWorkspace.tutoiement?: boolean`.

- [ ] **Step 1 : les schémas**

Dans `src/content.config.ts`, remplacer les quatre occurrences de `tutoiement: z.boolean().default(false),` (collections `devis`, `livrable`, `cadrage`, `temoignage`) par :

```ts
    /* Surcharge le pronom de la fiche client (src/lib/documents/pronom.ts).
       Absente, le document hérite de sa racine, puis de sa fiche. */
    tutoiement: z.boolean().optional(),
```

Supprimer le commentaire devenu faux juste au-dessus de celle de `devis` (« Le formulaire de réponse et l'accusé de réception vouvoient par défaut… »).

Dans le schéma `clients`, après la clé `prenom` :

```ts
    // Le tu ou le vous, pour tout ce qui s'adresse à ce client : documents,
    // portail, mails (spec 2026-10-02). Obligatoire, sans défaut.
    tutoiement: z.boolean(),
```

Dans le schéma `organisations`, après `nom: z.string(),` :

```ts
    // Le pronom des comptes revendeur et des propositions qui leur sont
    // adressées (spec 2026-10-02). Obligatoire, sans défaut.
    tutoiement: z.boolean(),
```

- [ ] **Step 2 : les valeurs des fiches existantes**

Valeurs validées par Ludo le 2026-10-02. Lancer depuis la racine du worktree :

```bash
python3 - <<'EOF'
import re
valeurs = {
  "clients/amusoire": True, "clients/cafa": False, "clients/coolbeans": True,
  "clients/dupontdupont": True, "clients/fylgo": False, "clients/littlebox": True,
  "clients/mathilde-chevalier": True, "clients/merciyanis": True, "clients/oide": False,
  "clients/revolutions-douces": True, "clients/setencorpsmieux": True, "clients/spinoza": True,
  "clients/tielle-popcorn": True, "clients/unlockbreath": True,
  "organisations/coolbeans": True, "organisations/trigger": True,
}
for chemin, tu in valeurs.items():
    p = f"src/content/{chemin}.yaml"
    s = open(p, encoding="utf-8").read()
    assert "tutoiement:" not in s, p
    ancre = r"^organisation:.*$" if chemin.startswith("clients/") else r"^nom:.*$"
    s, n = re.subn(ancre, lambda m: m.group(0) + f"\ntutoiement: {'true' if tu else 'false'}", s, count=1, flags=re.M)
    assert n == 1, p
    open(p, "w", encoding="utf-8").write(s)
print("ok")
EOF
```

Expected: `ok`. `grep -c "^tutoiement:" src/content/clients/*.yaml src/content/organisations/*.yaml` donne 1 pour chacun des 16 fichiers.

- [ ] **Step 3 : les quatre fiches à créer**

```yaml
# src/content/clients/aurelie-malbec.yaml
# Précommande du livre, puis site vitrine. Cliente directe.
nom: Aurélie Malbec
organisation: coolbeans
tutoiement: true
cle: mal
prenom: Aurélie
```

```yaml
# src/content/clients/miharu.yaml
# Client final de Trigger : les propositions s'adressent à l'agence et
# suivent son pronom, les autres documents suivent celui-ci.
nom: Miharu
organisation: trigger
tutoiement: false
cle: mih
```

```yaml
# src/content/clients/universite-montpellier.yaml
# Projet Sérial'Générations, porté par Isabelle Tournier.
nom: Université de Montpellier
organisation: coolbeans
tutoiement: true
cle: uni
prenom: Isabelle
```

```yaml
# src/content/clients/vice-versa.yaml
# Page vitrine de Danaë.
nom: Vice Versa
organisation: coolbeans
tutoiement: true
cle: vic
prenom: Danaë
```

- [ ] **Step 4 : retirer les clés qui répètent leur fiche**

Retirer la ligne `tutoiement: true` de ces neuf documents : leur fiche dit déjà tu. Puis poser sa propre clé sur `devis/en-haut`, hors nomenclature et sans fiche : son texte vouvoie Simon.

```bash
for f in \
  devis/unlockbreath/plateforme-3271.yaml \
  devis/unlockbreath/plateforme-v2-5840.yaml \
  devis/aurelie-malbec/precommande-livre-4127.yaml \
  devis/amusoire/pack-heures-9739.yaml \
  cadrage/setencorpsmieux/reservation-en-ligne-5138.yaml \
  cadrage/aurelie-malbec/precommande-livre-6284.yaml \
  cadrage/serial-generations/stack-technique-4417.yaml \
  cadrage/serial-generations/site-web-3720.yaml \
  livrable/revolutions-douces/sites-relais-5336.yaml; do
  sed -i '' '/^tutoiement: true$/d' "src/content/$f"
done
perl -0pi -e 's/^(contact: Simon)$/$1\ntutoiement: false/m' src/content/devis/en-haut.yaml
grep -rn "^tutoiement:" src/content/devis src/content/cadrage src/content/livrable src/content/temoignage
```

Expected : quatre lignes seulement, qui restent en surcharge.

```
src/content/cadrage/veronique-berthet/manuscrit-bb-4812.yaml:…:tutoiement: true
src/content/devis/en-haut.yaml:…:tutoiement: false
src/content/livrable/veronique-berthet/manuscrit-bb-4812.yaml:…:tutoiement: true
src/content/temoignage/amusoire/refonte-site-0040.yaml:…:tutoiement: false
```

- [ ] **Step 5 : le garde-fou au build**

Dans `src/lib/documents/projet.ts`, ajouter à l'interface `DocumentProjet`, après `versionDe?: string;` :

```ts
  /** Surcharge du pronom (src/lib/documents/pronom.ts). */
  tutoiement?: boolean;
```

Dans `src/lib/documents/charger.ts`, remplacer l'import et le corps de `chargerDocuments` :

```ts
import { getCollection } from "astro:content";
import type { CollectionDocument } from "./etapes";
import { verifierCles, verifierLiensLinear } from "./nomenclature";
import { verifierPronoms } from "./pronom";
import { verifierNomenclature, type DocumentProjet } from "./projet";

const COLLECTIONS: CollectionDocument[] = ["cadrage", "devis", "livrable", "temoignage"];

export async function chargerDocuments(): Promise<DocumentProjet[]> {
  const parCollection = await Promise.all(
    COLLECTIONS.map(async (collection) =>
      (await getCollection(collection)).map(
        (e): DocumentProjet => ({
          collection,
          id: e.id,
          statut: e.data.statut,
          etape: e.data.etape,
          projet: e.data.projet,
          titreProjet: e.data.linear?.projet,
          versionDe: "versionDe" in e.data ? e.data.versionDe : undefined,
          tutoiement: e.data.tutoiement,
          date: e.data.date,
        }),
      ),
    ),
  );
  const documents = parCollection.flat();
  const fiches = (await getCollection("clients")).map((e) => ({
    slug: e.id,
    cle: e.data.cle,
    organisation: e.data.organisation,
    tutoiement: e.data.tutoiement,
  }));
  const organisations = (await getCollection("organisations")).map((e) => ({
    slug: e.id,
    tutoiement: e.data.tutoiement,
  }));
  const erreurs = [
    ...verifierNomenclature(documents),
    ...verifierCles(fiches),
    ...verifierLiensLinear(),
    ...verifierPronoms({ documents, fiches, organisations }),
  ];
  if (erreurs.length > 0) {
    throw new Error(`Nomenclature des documents client incohérente :\n- ${erreurs.join("\n- ")}`);
  }
  return documents;
}
```

Ajouter au commentaire d'en-tête du fichier : « Il vérifie enfin que chaque document résout un pronom (spec 2026-10-02). »

- [ ] **Step 6 : le workspace porte le pronom**

Dans `src/lib/portail/workspaces.ts`, interface `PortalWorkspace`, après `prenom?: string;` :

```ts
  /**
   * Le tu ou le vous du client (spec 2026-10-02). Obligatoire dans le YAML ;
   * optionnel ici pour les fiches construites à la main dans les tests.
   */
  tutoiement?: boolean;
```

- [ ] **Step 7 : vérifier**

Run: `npx vitest run && npx astro build`
Expected: tous les tests PASS ; build `Complete!`. Un build qui échoue sur « aucun pronom ne se résout » nomme le document en cause : corriger sa fiche, pas le document.

- [ ] **Step 8 : relever les documents dont le corps contredit le pronom**

Sans commit. Le résultat part à Ludo, qui décide d'éventuelles surcharges.

```bash
python3 - <<'EOF'
import re, glob
fiches = {}
for f in glob.glob("src/content/clients/*.yaml"):
    s = open(f, encoding="utf-8").read()
    c = re.search(r"^cle:\s*(\w+)", s, re.M); t = re.search(r"^tutoiement:\s*(\w+)", s, re.M)
    if c and t: fiches[c.group(1)] = t.group(1) == "true"
src = open("src/lib/documents/nomenclature.ts", encoding="utf-8").read()
projets = dict(re.findall(r'"([a-z0-9-]+)":\s*\{\s*client:\s*"([a-z]{3})"', src))
for f in sorted(glob.glob("src/content/*/*/*.yaml")):
    s = open(f, encoding="utf-8").read()
    m = re.search(r"^projet:\s*(\S+)", s, re.M)
    if not m or re.search(r"^tutoiement:", s, re.M): continue
    tu = fiches.get(projets.get(m.group(1)))
    if tu is None: continue
    ntu = len(re.findall(r"\b(tu|ton|ta|tes|toi)\b", s, re.I)); nvous = len(re.findall(r"\b(vous|votre|vos)\b", s, re.I))
    if (tu and nvous > 2 * ntu) or (not tu and ntu > 2 * nvous):
        print(f"{f}: fiche {'tu' if tu else 'vous'}, corps tu={ntu} vous={nvous}")
EOF
```

Expected : quelques lignes au plus (la refonte Amusoire au moins). Les copier dans le compte rendu à Ludo.

- [ ] **Step 9 : commit**

```bash
git add src/content.config.ts src/lib/documents/projet.ts src/lib/documents/charger.ts src/lib/portail/workspaces.ts \
  src/content/clients/*.yaml src/content/organisations/*.yaml \
  src/content/devis/unlockbreath/plateforme-3271.yaml src/content/devis/unlockbreath/plateforme-v2-5840.yaml \
  src/content/devis/aurelie-malbec/precommande-livre-4127.yaml src/content/devis/amusoire/pack-heures-9739.yaml \
  src/content/cadrage/setencorpsmieux/reservation-en-ligne-5138.yaml src/content/cadrage/aurelie-malbec/precommande-livre-6284.yaml \
  src/content/cadrage/serial-generations/stack-technique-4417.yaml src/content/cadrage/serial-generations/site-web-3720.yaml \
  src/content/livrable/revolutions-douces/sites-relais-5336.yaml src/content/devis/en-haut.yaml
git commit -m "feat(clients): le pronom se pose sur la fiche client et l'organisation

Clé obligatoire sur les fiches, facultative sur les documents, vérifiée au
build. Quatre fiches créées pour les clients de la nomenclature qui n'en
avaient pas.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3 : les documents lisent le pronom résolu

**Files:**
- Create: `src/lib/documents/pronom-contenu.ts`
- Modify: `src/components/documents/pages/{PageProposition,PageCadrage,PageLivrable,PageTemoignage}.astro`
- Modify: `src/pages/api/{devis,cadrage,livrable,temoignage}-reponse.ts`

**Interfaces:**
- Consumes: `pronomDuDocument`, `ouVous`, `Registres`, `DocumentPronom` (Task 1) ; `data.tutoiement` des collections (Task 2).
- Produces: `tutoiementDe(collection: CollectionDocument, id: string): Promise<boolean>`.

- [ ] **Step 1 : le module de chargement**

```ts
// src/lib/documents/pronom-contenu.ts
/* Le pronom d'un document, résolu depuis les collections. Non testé sous
   Vitest, où astro:content est indisponible : la règle vit dans pronom.ts,
   et le build vérifie déjà que chaque document en résout un (charger.ts). */
import { getCollection } from "astro:content";
import type { CollectionDocument } from "./etapes";
import { ouVous, pronomDuDocument, type DocumentPronom, type Registres } from "./pronom";

async function registres(collection: CollectionDocument): Promise<Registres> {
  const [entrees, fiches, organisations] = await Promise.all([
    getCollection(collection),
    getCollection("clients"),
    getCollection("organisations"),
  ]);
  return {
    documents: entrees.map(
      (e): DocumentPronom => ({
        collection,
        id: e.id,
        projet: e.data.projet,
        versionDe: "versionDe" in e.data ? e.data.versionDe : undefined,
        tutoiement: e.data.tutoiement,
      }),
    ),
    fiches: fiches.map((e) => ({
      slug: e.id,
      cle: e.data.cle,
      organisation: e.data.organisation,
      tutoiement: e.data.tutoiement,
    })),
    organisations: organisations.map((e) => ({ slug: e.id, tutoiement: e.data.tutoiement })),
  };
}

/** `true` si le document tutoie son lecteur. */
export async function tutoiementDe(collection: CollectionDocument, id: string): Promise<boolean> {
  const r = await registres(collection);
  const doc = r.documents.find((d) => d.id === id);
  return ouVous(doc ? pronomDuDocument(doc, r) : undefined, `${collection}/${id}`) === "tu";
}
```

- [ ] **Step 2 : la proposition**

Dans `PageProposition.astro`, ajouter l'import parmi ceux de `lib/documents` :

```ts
import { tutoiementDe } from "../../../lib/documents/pronom-contenu";
```

Après `const ouvert = …;`, ajouter :

```ts
// Le formulaire et le bloc des réponses visent la dernière version, celle qui engage.
const tutoiement = await tutoiementDe("devis", versions[actif].id);
```

Remplacer les deux `tutoiement={courante.tutoiement}` (sur `<DocumentReponses>` et sur `<DevisReponse>`) par `tutoiement={tutoiement}`.

- [ ] **Step 3 : le livrable**

Dans `PageLivrable.astro`, même import. Après `const ouvert = …;` :

```ts
const tutoiement = await tutoiementDe("livrable", versions[actif].id);
```

Remplacer les deux `tutoiement={courante.tutoiement}` par `tutoiement={tutoiement}`.

- [ ] **Step 4 : le témoignage**

Dans `PageTemoignage.astro`, même import. Après `const d = entry.data;` :

```ts
const tutoiement = await tutoiementDe("temoignage", entry.id);
```

Remplacer les trois `tutoiement={d.tutoiement}` par `tutoiement={tutoiement}`.

- [ ] **Step 5 : le cadrage, chapitre par chapitre**

Dans `PageCadrage.astro`, même import. Après `const ouvert = …;` :

```ts
// Un chapitre peut porter sa propre clé : le pronom se résout chapitre par chapitre.
const tutoiements: Record<string, boolean> = Object.fromEntries(
  await Promise.all(chapitres.map(async (c) => [c.id, await tutoiementDe("cadrage", c.id)] as const)),
);
```

Dans la boucle des chapitres, remplacer les deux `tutoiement={c.data.tutoiement}` par `tutoiement={tutoiements[c.id]}`.

- [ ] **Step 6 : les routes de réponse**

Dans chacune des quatre routes, ajouter l'import :

```ts
import { tutoiementDe } from "../../lib/documents/pronom-contenu";
```

Puis remplacer la clé passée à l'accusé de réception :

| Fichier | Avant | Après |
|---|---|---|
| `devis-reponse.ts` | `tutoiement: devis?.data.tutoiement,` | `tutoiement: await tutoiementDe("devis", slug),` |
| `cadrage-reponse.ts` | `tutoiement: doc.data.tutoiement,` | `tutoiement: await tutoiementDe("cadrage", doc.id),` |
| `livrable-reponse.ts` | `tutoiement: doc.data.tutoiement,` | `tutoiement: await tutoiementDe("livrable", doc.id),` |
| `temoignage-reponse.ts` | `tutoiement: doc.data.tutoiement,` | `tutoiement: await tutoiementDe("temoignage", doc.id),` |

Et rendre neutres les messages d'erreur, qui partent avant que le document soit lu :

| Avant | Après |
|---|---|
| `"Merci de renseigner votre prénom."` | `"Le prénom est obligatoire."` |
| `"Merci de renseigner votre nom."` | `"Le nom est obligatoire."` |
| `"Merci d'accepter la conservation de vos informations."` | `"La conservation des informations doit être acceptée."` |
| `"Merci de détailler vos retours dans le message."` (livrable) | `"Les retours sont à détailler dans le message."` |

- [ ] **Step 7 : vérifier**

Run: `npx vitest run && npx astro build`
Expected: PASS ; build `Complete!`.

Run : `grep -rn "data.tutoiement\|\.tutoiement}" src/components/documents/pages src/pages/api`
Expected : aucune ligne.

Recette locale (`npx astro dev --port 4338`, compte admin via `npm run comptes-locaux`, mot de passe `recette-locale`) :
- la proposition UnlockBreath, onglet V2 : le formulaire dit « Valide la proposition » ;
- la proposition de refonte CAFA : « Validez la proposition » ;
- un cadrage à plusieurs chapitres (CAFA, nom de domaine) : chaque chapitre garde son registre.

Arrêter le serveur : `npx astro dev stop`.

- [ ] **Step 8 : commit**

```bash
git add src/lib/documents/pronom-contenu.ts src/components/documents/pages/PageProposition.astro \
  src/components/documents/pages/PageCadrage.astro src/components/documents/pages/PageLivrable.astro \
  src/components/documents/pages/PageTemoignage.astro src/pages/api/devis-reponse.ts \
  src/pages/api/cadrage-reponse.ts src/pages/api/livrable-reponse.ts src/pages/api/temoignage-reponse.ts
git commit -m "feat(documents): formulaires et accusés suivent le pronom de la fiche

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4 : un portail sans vous

Les libellés du portail désignent le site ou le projet, jamais la personne. Neutres, ils ne se trompent jamais de registre, et aucune page n'a besoin du pronom.

**Files:**
- Modify: `src/pages/espace/{demandes,doc,disponibilites,ressources,index,analytics,monitoring,seo,liens}.astro`, `src/pages/espace/demandes/[id].astro`
- Modify: `src/components/portail/{PiecesJointes,VitesseSite,ChoixUrgence,MessagerieBoard}.astro`
- Modify: `src/pages/api/messagerie/{nouveau,reponse}.ts`
- Create: `src/lib/portail/registre-neutre.test.ts`

**Interfaces:**
- Consumes: rien.
- Produces: rien de typé ; le test garde la règle.

- [ ] **Step 1 : écrire le garde-fou**

```ts
// src/lib/portail/registre-neutre.test.ts
// Le portail ne s'adresse à personne en particulier : ses libellés désignent
// le site ou le projet. Un « vous » ou un impératif en -ez s'y glisse, et un
// client tutoyé se fait vouvoyer (spec 2026-10-02, le pronom de la fiche).
// Les mails, eux, passent en double registre : ils ne sont pas visés ici.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RACINES = ["src/pages/espace", "src/components/portail", "src/pages/api/messagerie"].map((r) =>
  join(process.cwd(), r),
);

function fichiers(dossier: string): string[] {
  return readdirSync(dossier, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? fichiers(join(dossier, e.name)) : /\.(astro|ts)$/.test(e.name) && !e.name.endsWith(".test.ts") ? [join(dossier, e.name)] : [],
  );
}

const COMMENTAIRE = /^\s*(\/\/|\/\*|\*|\{\/\*|<!--)/;
const VOUS = /\b(vous|votre|vos)\b/i;
const IMPERATIF = /\b(réessayez|glissez|parcourez|dites|envoyez|reconnectez|copiez|ignorez|choisissez|invitez|précisez|validez|posez|répondez)\b/i;

describe("registre neutre du portail", () => {
  it("aucun vous ni impératif vouvoyé hors commentaires", () => {
    const fautes = RACINES.flatMap(fichiers).flatMap((f) =>
      readFileSync(f, "utf-8")
        .split("\n")
        .map((ligne, i) => ({ ligne, i }))
        .filter(({ ligne }) => !COMMENTAIRE.test(ligne) && (VOUS.test(ligne) || IMPERATIF.test(ligne)))
        .map(({ ligne, i }) => `${f.replace(process.cwd() + "/", "")}:${i + 1} ${ligne.trim()}`),
    );
    expect(fautes).toEqual([]);
  });
});
```

- [ ] **Step 2 : vérifier l'échec**

Run: `npx vitest run src/lib/portail/registre-neutre.test.ts`
Expected: FAIL, la liste nomme une trentaine de lignes.

- [ ] **Step 3 : réécrire les libellés**

Remplacer chaque texte de la colonne « Avant » par celui de la colonne « Après », mot pour mot (les `&nbsp;` restent).

| Fichier | Avant | Après |
|---|---|---|
| `demandes.astro` | `Un message = un sujet. Trois sujets&nbsp;? Trois demandes séparées : on vous répondra plus vite.` (sur deux lignes) | `Un message = un sujet. Trois sujets&nbsp;? Trois demandes séparées : la réponse arrive plus vite.` |
| `demandes.astro` | `Vos demandes arriveront ici. En attendant, un email à ludo@coolbeans.cc fait tout aussi bien l'affaire.` | `Les demandes arriveront ici. En attendant, un email à ludo@coolbeans.cc fait tout aussi bien l'affaire.` |
| `demandes.astro` | `aria-labelledby="vos-demandes"` et `id="vos-demandes"` | `aria-labelledby="suivi-demandes"` et `id="suivi-demandes"` |
| `demandes.astro` | le h2 `Vos demandes` | `Suivi des demandes` |
| `demandes.astro` | `Un message = un sujet. Si vous avez deux choses à signaler, envoyez deux demandes séparées : chacune suit son propre fil, rien ne se perd en route. Plus la description est concrète (la page concernée, ce que vous attendiez, ce qui s'est passé), plus la réponse est rapide.` | `Un message = un sujet. Deux choses à signaler, deux demandes séparées : chacune suit son propre fil, rien ne se perd en route. Plus la description est concrète (la page concernée, le résultat attendu, ce qui s'est passé), plus la réponse est rapide.` |
| `demandes.astro` | `En général sous un jour ouvré. Si votre site est hors ligne ou qu'un paiement est bloqué, dites-le dans l'urgence de votre demande : ces urgences passent devant tout le reste.` | `En général sous un jour ouvré. Un site hors ligne ou un paiement bloqué se signale dans l'urgence de la demande : ces urgences passent devant tout le reste.` |
| `doc.astro` | `Le mode d'emploi de votre site.` | `Le mode d'emploi du site.` |
| `disponibilites.astro` | `Quand Coolbeans est disponible pour vos demandes, sur les six prochains mois.` | `Quand Coolbeans est disponible pour les demandes, sur les six prochains mois.` |
| `ressources.astro` | `que nous recommandons pour gérer votre site au quotidien :` | `que nous recommandons pour gérer un site au quotidien :` |
| `index.astro` | `Votre espace Coolbeans : tout ce qui touche à votre projet, au même endroit : mode d'emploi, avancement, demandes et ressources.` | `Tout ce qui touche au projet, au même endroit : mode d'emploi, avancement, demandes et ressources.` |
| `analytics.astro` | `L'audience de votre site, sans cookies.` | `L'audience du site, sans cookies.` |
| `analytics.astro` | `Les statistiques de fréquentation de votre site arriveront ici&nbsp;:` | `Les statistiques de fréquentation du site arriveront ici&nbsp;:` |
| `analytics.astro` | `Les chiffres de votre site n'ont pas pu être chargés. Réessayez dans quelques minutes.` | `Les chiffres du site n'ont pas pu être chargés. Ils reviennent en général au bout de quelques minutes.` |
| `monitoring.astro` | `Disponibilité et dernière vérification de votre site.` | `Disponibilité et dernière vérification du site.` |
| `monitoring.astro` | `Le statut de votre site en production arrivera ici :` | `Le statut du site en production arrivera ici :` |
| `seo.astro` | `L'état du référencement de votre site.` | `L'état du référencement du site.` |
| `liens.astro` | `Les accès de votre projet, au même endroit.` | `Les accès du projet, au même endroit.` |
| `liens.astro` | `Les liens de votre projet arriveront ici : site en production, environnement de test, interface d'administration de vos contenus.` | `Les liens du projet arriveront ici : site en production, environnement de test, interface d'administration des contenus.` |
| `demandes/[id].astro` | `placeholder="Votre réponse…"` | `placeholder="Réponse…"` |
| `PiecesJointes.astro` | `Glissez vos fichiers ici ou <span class="link text-ink">parcourez</span>` | `Glisser des fichiers ici ou <span class="link text-ink">parcourir</span>` |
| `VitesseSite.astro` | `Mesurée chez vos visiteurs, selon les critères de Google.` | `Mesurée chez les visiteurs du site, selon les critères de Google.` |
| `ChoixUrgence.astro` | `aide: "Quand vous aurez un moment"` | `aide: "Dès qu'un créneau se libère"` |
| `MessagerieBoard.astro` | `Vos demandes et leurs réponses s'afficheront ici.` | `Les demandes et leurs réponses s'afficheront ici.` |
| `api/messagerie/reponse.ts`, `api/messagerie/nouveau.ts` | `"Session expirée : reconnectez-vous puis réessayez."` | `"Session expirée : il faut se reconnecter, puis réessayer."` |
| `api/messagerie/nouveau.ts` | `` `Vous avez atteint la limite de ${QUOTA_PAR_JOUR} demandes pour aujourd'hui. Pour une urgence, ${CONTACT_DIRECT}.` `` | `` `Limite de ${QUOTA_PAR_JOUR} demandes atteinte pour aujourd'hui. Pour une urgence, ${CONTACT_DIRECT}.` `` |
| `api/messagerie/nouveau.ts` | `` `Aucun compte dans l'espace ${client.nom} : invitez d'abord un utilisateur.` `` | `` `Aucun compte dans l'espace ${client.nom} : un utilisateur est à inviter d'abord.` `` |

- [ ] **Step 4 : vérifier le succès**

Run: `npx vitest run src/lib/portail/registre-neutre.test.ts`
Expected: PASS. Une ligne restante non listée ci-dessus se réécrit sur le même principe : désigner le site, le projet ou la demande, jamais la personne.

- [ ] **Step 5 : commit**

```bash
git add src/lib/portail/registre-neutre.test.ts src/pages/espace/demandes.astro src/pages/espace/doc.astro \
  src/pages/espace/disponibilites.astro src/pages/espace/ressources.astro src/pages/espace/index.astro \
  src/pages/espace/analytics.astro src/pages/espace/monitoring.astro src/pages/espace/seo.astro \
  src/pages/espace/liens.astro "src/pages/espace/demandes/[id].astro" src/components/portail/PiecesJointes.astro \
  src/components/portail/VitesseSite.astro src/components/portail/ChoixUrgence.astro \
  src/components/portail/MessagerieBoard.astro src/pages/api/messagerie/reponse.ts src/pages/api/messagerie/nouveau.ts
git commit -m "feat(portail): des libellés neutres, qui ne vouvoient plus personne

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5 : les mails du portail au pronom du destinataire

**Files:**
- Create: `src/lib/portail/pronom.ts`
- Modify: `src/emails/support-confirmation.ts`, `src/emails/messagerie-reponse.ts`, `src/emails/auth.ts`
- Create: `src/emails/registres.test.ts`
- Modify: `src/pages/api/messagerie/nouveau.ts`, `src/lib/portail/messagerie/ouvrir.ts`, `src/lib/portail/messagerie/publier.ts`, `src/lib/auth/options.ts`

**Interfaces:**
- Consumes: `pronomDuCompte`, `ouVous`, `ComptePronom`, `Pronom` (Task 1) ; `data.tutoiement` des fiches et organisations (Task 2).
- Produces :
  - `pronomDuPortail(meta: PortalMetadata): Promise<Pronom>`
  - `pronomDuDestinataire(db: D1Database, email: string): Promise<Pronom>`
  - `tutoiement?: boolean` dans les props de `renderConfirmationSupport`, `renderReponseMessagerie`, `renderLienMagique`, `renderInvitation`, `renderReinitialisation`.

- [ ] **Step 1 : écrire les tests des gabarits**

```ts
// src/emails/registres.test.ts
import { describe, expect, it } from "vitest";
import { renderInvitation, renderLienMagique, renderReinitialisation } from "./auth";
import { renderReponseMessagerie } from "./messagerie-reponse";
import { renderConfirmationSupport } from "./support-confirmation";

const VOUS = /\b(vous|votre|vos)\b/i;
const IMPERATIF_VOUS = /\b(copiez|ignorez|choisissez|répondez)\b/i;
const TU = /\b(tu|ton|ta|tes|toi)\b/i;

const gabarits = (tutoiement: boolean) => [
  renderConfirmationSupport({ objet: "Bug", description: "Rien ne marche", prenom: "Thierry", tutoiement }),
  renderReponseMessagerie({ objet: "Bug", corps: "C'est corrigé.", prenom: "Thierry", urlTicket: "https://my.coolbeans.cc/demandes/1", tutoiement }),
  renderLienMagique({ url: "https://my.coolbeans.cc/x", tutoiement }),
  renderInvitation({ url: "https://my.coolbeans.cc/x", organisation: "UnlockBreath", inviteur: "Ludo", tutoiement }),
  renderReinitialisation({ url: "https://my.coolbeans.cc/x", prenom: "Thierry", tutoiement }),
];

describe("mails du portail, deux registres", () => {
  it("au tu, pas un vous ni un impératif vouvoyé", () => {
    for (const m of gabarits(true)) {
      for (const texte of [m.subject, m.text, m.html]) {
        expect(texte).not.toMatch(VOUS);
        expect(texte).not.toMatch(IMPERATIF_VOUS);
      }
    }
  });

  it("au vous par défaut, pas un tu", () => {
    for (const m of gabarits(false)) {
      for (const texte of [m.subject, m.text]) expect(texte).not.toMatch(TU);
    }
  });

  it("le vous reste celui d'aujourd'hui", () => {
    expect(renderLienMagique({ url: "https://x" }).subject).toBe("Votre lien de connexion à myCoolbeans");
    expect(renderLienMagique({ url: "https://x", tutoiement: true }).subject).toBe("Ton lien de connexion à myCoolbeans");
  });
});
```

Le test « pas un tu » ne vérifie que l'objet et le texte : le HTML contient `ta` dans des attributs (`data`, `table`) qu'une regex de mot entier ne confond pas, mais la coquille HTML est commune aux deux registres et déjà couverte par le texte.

- [ ] **Step 2 : vérifier l'échec**

Run: `npx vitest run src/emails/registres.test.ts`
Expected: FAIL (au tu, les gabarits vouvoient encore).

- [ ] **Step 3 : le mail de réponse de la messagerie**

Remplacer `renderReponseMessagerie` dans `src/emails/messagerie-reponse.ts` :

```ts
export function renderReponseMessagerie(props: {
  objet: string;
  corps: string;
  prenom?: string;
  urlTicket: string;
  /** Pronom du destinataire (src/lib/portail/pronom.ts). Vous par défaut. */
  tutoiement?: boolean;
}): EmailPret {
  const tu = props.tutoiement ?? false;
  const bonjour = props.prenom ? `Bonjour ${esc(props.prenom)},` : "Bonjour,";
  const html = renderTransactionnel({
    preheader: props.corps.slice(0, 120),
    kicker: tu ? "Ta demande" : "Votre demande",
    titre: `Re : ${esc(props.objet)}`,
    contenu: [
      p(bonjour),
      citation(esc(props.corps).replace(/\n/g, "<br>")),
      p(tu ? "Tu peux r&eacute;pondre directement depuis ton espace." : "Vous pouvez r&eacute;pondre directement depuis votre espace."),
    ].join(""),
    cta: { label: "Répondre sur le portail", url: props.urlTicket },
    piedContexte: tu
      ? "Tu re&ccedil;ois cet email car un ticket te concerne sur my.coolbeans.cc."
      : "Vous recevez cet email car un ticket vous concerne sur my.coolbeans.cc.",
  });
  return {
    subject: `Re : ${props.objet}`,
    html,
    text: `${props.prenom ? `Bonjour ${props.prenom},` : "Bonjour,"}\n\n${props.corps}\n\nRépondre : ${props.urlTicket}`,
  };
}
```

- [ ] **Step 4 : l'accusé de réception du support**

Dans `src/emails/support-confirmation.ts`, ajouter à `SupportConfirmationProps` :

```ts
  /** Pronom de l'auteur (src/lib/portail/pronom.ts). Vous par défaut. */
  tutoiement?: boolean;
```

Remplacer `const PIED = …;` et `renderConfirmationSupport` par :

```ts
const textes = (tutoiement: boolean) =>
  tutoiement
    ? {
        pied: "Tu re&ccedil;ois cet email suite &agrave; ta demande sur my.coolbeans.cc.",
        preheader: "Ta demande est bien enregistrée, je reviens vers toi rapidement.",
        accuse:
          "Ta demande est bien enregistrée et arrive directement dans mon outil de suivi. Je reviens vers toi rapidement, en général sous un jour ouvré.",
        demande: "Ta demande",
        detail: "Un détail à ajouter entre-temps&nbsp;? Réponds simplement à cet email.",
        detailTexte: "Un détail à ajouter entre-temps ? Réponds simplement à cet email.",
      }
    : {
        pied: "Vous recevez cet email suite &agrave; votre demande sur my.coolbeans.cc.",
        preheader: "Votre demande est bien enregistrée, je reviens vers vous rapidement.",
        accuse:
          "Votre demande est bien enregistrée et arrive directement dans mon outil de suivi. Je reviens vers vous rapidement, en général sous un jour ouvré.",
        demande: "Votre demande",
        detail: "Un détail à ajouter entre-temps&nbsp;? Répondez simplement à cet email.",
        detailTexte: "Un détail à ajouter entre-temps ? Répondez simplement à cet email.",
      };

/** Accusé de réception d'une demande support envoyée depuis le portail. */
export function renderConfirmationSupport(props: SupportConfirmationProps): EmailPret {
  const { objet, description, prenom, tutoiement = false } = props;
  const t = textes(tutoiement);
  const bonjour = prenom ? `Bonjour ${prenom},` : "Bonjour,";

  const html = renderTransactionnel({
    preheader: t.preheader,
    kicker: "Support · myCoolbeans",
    titre: "Bien reçu, je m'en occupe",
    contenu: [
      p(esc(bonjour)),
      p(t.accuse),
      titreSection(`${t.demande} · ${esc(objet)}`),
      citation(esc(description).replace(/\n/g, "<br>")),
      p(t.detail),
      p("À très vite,<br>Ludo"),
    ].join(""),
    piedContexte: t.pied,
  });

  const text = [
    bonjour,
    "",
    t.accuse,
    "",
    `${t.demande} · ${objet} :`,
    description,
    "",
    t.detailTexte,
    "",
    "À très vite,",
    "Ludo",
  ].join("\n");

  return { subject: `Support · bien reçu : ${objet}`, html, text };
}
```

- [ ] **Step 5 : les mails d'authentification**

Dans `src/emails/auth.ts`, remplacer tout le bloc qui va de `const PIED = "Email automatique de votre espace my.coolbeans.cc.";` jusqu'à la fin de `renderReinitialisation` (la `}` qui précède le commentaire de `envoyerMailAuth`) par :

```ts
const textes = (tutoiement: boolean) =>
  tutoiement
    ? {
        pied: "Email automatique de ton espace my.coolbeans.cc.",
        enClair: "Si le bouton ne fonctionne pas, copie cette adresse dans ton navigateur&nbsp;:",
        lien: {
          preheader: "Ton lien de connexion à myCoolbeans, valable quelques minutes.",
          titre: "Ton lien de connexion",
          corps: "Voici ton lien de connexion à ton espace. Il est valable quelques minutes et ne fonctionne qu'une fois.",
          pasMoi: "Tu n'as pas demandé cette connexion&nbsp;? Ignore cet email, rien ne se passera.",
          pasMoiTexte: "Tu n'as pas demandé cette connexion ? Ignore cet email, rien ne se passera.",
          objet: "Ton lien de connexion à myCoolbeans",
        },
        invitation: {
          de: (inviteur?: string) => (inviteur ? `${inviteur} t'ouvre` : "Nous t'ouvrons"),
          preheader: (organisation: string) => `Ton accès à l'espace ${organisation} est prêt.`,
          titre: "Ton espace t'attend",
          suite: "la documentation de ton projet, son suivi et tes demandes, au même endroit.",
          section: "Ce que tu y trouveras",
          contenu: "La doc de ton projet, l'état de ce qui est en cours, et de quoi me joindre sans passer par le mail.",
          objet: (organisation: string) => `Ton accès à ${organisation} sur myCoolbeans`,
        },
        reinit: {
          preheader: "Choisis un nouveau mot de passe pour ton espace.",
          corps: "Tu as demandé à réinitialiser le mot de passe de ton espace. Ce lien est valable une heure.",
          pasMoi: "Tu n'es pas à l'origine de cette demande&nbsp;? Ignore cet email&nbsp;: ton mot de passe actuel reste valable.",
          pasMoiTexte: "Tu n'es pas à l'origine de cette demande ? Ignore cet email : ton mot de passe actuel reste valable.",
          objet: "Réinitialiser ton mot de passe myCoolbeans",
        },
      }
    : {
        pied: "Email automatique de votre espace my.coolbeans.cc.",
        enClair: "Si le bouton ne fonctionne pas, copiez cette adresse dans votre navigateur&nbsp;:",
        lien: {
          preheader: "Votre lien de connexion à myCoolbeans, valable quelques minutes.",
          titre: "Votre lien de connexion",
          corps: "Voici votre lien de connexion à votre espace. Il est valable quelques minutes et ne fonctionne qu'une fois.",
          pasMoi: "Vous n'avez pas demandé cette connexion&nbsp;? Ignorez cet email, rien ne se passera.",
          pasMoiTexte: "Vous n'avez pas demandé cette connexion ? Ignorez cet email, rien ne se passera.",
          objet: "Votre lien de connexion à myCoolbeans",
        },
        invitation: {
          de: (inviteur?: string) => (inviteur ? `${inviteur} vous ouvre` : "Nous vous ouvrons"),
          preheader: (organisation: string) => `Votre accès à l'espace ${organisation} est prêt.`,
          titre: "Votre espace vous attend",
          suite: "la documentation de votre projet, son suivi et vos demandes, au même endroit.",
          section: "Ce que vous y trouverez",
          contenu: "La doc de votre projet, l'état de ce qui est en cours, et de quoi me joindre sans passer par le mail.",
          objet: (organisation: string) => `Votre accès à ${organisation} sur myCoolbeans`,
        },
        reinit: {
          preheader: "Choisissez un nouveau mot de passe pour votre espace.",
          corps: "Vous avez demandé à réinitialiser le mot de passe de votre espace. Ce lien est valable une heure.",
          pasMoi: "Vous n'êtes pas à l'origine de cette demande&nbsp;? Ignorez cet email&nbsp;: votre mot de passe actuel reste valable.",
          pasMoiTexte: "Vous n'êtes pas à l'origine de cette demande ? Ignorez cet email : votre mot de passe actuel reste valable.",
          objet: "Réinitialiser votre mot de passe myCoolbeans",
        },
      };

/** Le lien en toutes lettres, sous le bouton, dans une taille discrète. */
function urlEnClair(url: string, enClair: string): string {
  return p(`<span style="font-size:13px;">${enClair}<br>${lien(esc(url), url)}</span>`);
}

/** Connexion par lien magique : pas de mot de passe à retenir. */
export function renderLienMagique({ url, tutoiement = false }: { url: string; tutoiement?: boolean }): EmailPret {
  const t = textes(tutoiement);
  const html = renderTransactionnel({
    preheader: t.lien.preheader,
    kicker: "Connexion · myCoolbeans",
    titre: t.lien.titre,
    contenu: [p("Bonjour,"), p(t.lien.corps), urlEnClair(url, t.enClair), p(t.lien.pasMoi)].join(""),
    cta: { label: "Me connecter", url },
    piedContexte: t.pied,
  });
  const text = ["Bonjour,", "", t.lien.corps, "", url, "", t.lien.pasMoiTexte].join("\n");
  return { subject: t.lien.objet, html, text };
}

/** Ouverture d'un accès : quelqu'un est invité dans un espace. */
export function renderInvitation({
  url,
  organisation,
  inviteur,
  tutoiement = false,
}: {
  url: string;
  organisation: string;
  inviteur?: string;
  tutoiement?: boolean;
}): EmailPret {
  const t = textes(tutoiement);
  const de = t.invitation.de(inviteur);
  const html = renderTransactionnel({
    preheader: t.invitation.preheader(organisation),
    kicker: "Invitation · myCoolbeans",
    titre: t.invitation.titre,
    contenu: [
      p("Bonjour,"),
      p(`${esc(de)} un accès à <strong>${esc(organisation)}</strong> sur myCoolbeans&nbsp;: ${t.invitation.suite}`),
      titreSection(t.invitation.section),
      p(t.invitation.contenu),
      urlEnClair(url, t.enClair),
    ].join(""),
    cta: { label: "Ouvrir mon espace", url },
    piedContexte: t.pied,
  });
  const text = [
    "Bonjour,",
    "",
    `${de} un accès à ${organisation} sur myCoolbeans : ${t.invitation.suite}`,
    "",
    url,
    "",
    "À très vite,",
    "Ludo",
  ].join("\n");
  return { subject: t.invitation.objet(organisation), html, text };
}

/** Mot de passe oublié. */
export function renderReinitialisation({
  url,
  prenom,
  tutoiement = false,
}: {
  url: string;
  prenom?: string;
  tutoiement?: boolean;
}): EmailPret {
  const t = textes(tutoiement);
  const bonjour = prenom ? `Bonjour ${prenom},` : "Bonjour,";
  const html = renderTransactionnel({
    preheader: t.reinit.preheader,
    kicker: "Mot de passe · myCoolbeans",
    titre: "Choisir un nouveau mot de passe",
    contenu: [p(esc(bonjour)), p(t.reinit.corps), urlEnClair(url, t.enClair), p(t.reinit.pasMoi)].join(""),
    cta: { label: "Choisir un nouveau mot de passe", url },
    piedContexte: t.pied,
  });
  const text = [bonjour, "", t.reinit.corps, "", url, "", t.reinit.pasMoiTexte].join("\n");
  return { subject: t.reinit.objet, html, text };
}
```

- [ ] **Step 6 : vérifier les gabarits**

Run: `npx vitest run src/emails`
Expected: PASS, `registres.test.ts` et `devis-confirmation.test.ts` compris.

- [ ] **Step 7 : le pronom du portail et du destinataire**

```ts
// src/lib/portail/pronom.ts
/* Le pronom du portail : celui de la personne connectée, ou du destinataire
   d'un mail. La règle vit dans documents/pronom.ts ; ce module charge les
   fiches et lit le compte. Non testé sous Vitest (astro:content, D1). */
import { ouVous, pronomDuCompte, type ComptePronom, type Pronom } from "../documents/pronom";
import type { PortalMetadata, PortalRole } from "./metadata";

async function registres() {
  const { getCollection } = await import("astro:content");
  const [fiches, organisations] = await Promise.all([getCollection("clients"), getCollection("organisations")]);
  return {
    fiches: fiches.map((e) => ({
      slug: e.id,
      cle: e.data.cle,
      organisation: e.data.organisation,
      tutoiement: e.data.tutoiement,
    })),
    organisations: organisations.map((e) => ({ slug: e.id, tutoiement: e.data.tutoiement })),
  };
}

/** Le pronom de la personne connectée. */
export async function pronomDuPortail(meta: PortalMetadata): Promise<Pronom> {
  return ouVous(pronomDuCompte(meta, await registres()), `compte ${meta.role}`);
}

/**
 * Le pronom du destinataire d'un mail, d'après son compte. Même jointure que
 * listerUtilisateurs (utilisateurs.ts). L'adresse se compare en minuscules :
 * Better Auth la stocke telle que saisie à l'invitation.
 */
export async function pronomDuDestinataire(db: D1Database, email: string): Promise<Pronom> {
  const ligne = await db
    .prepare(
      `SELECT u.portalRole AS role, o.slug AS organisation, t.slug AS workspace
         FROM user u
         LEFT JOIN member m ON m.userId = u.id
         LEFT JOIN organization o ON o.id = m.organizationId
         LEFT JOIN teamMember tm ON tm.userId = u.id
         LEFT JOIN team t ON t.id = tm.teamId
        WHERE lower(u.email) = lower(?1)
        LIMIT 1`,
    )
    .bind(email)
    .first<{ role: string; organisation: string | null; workspace: string | null }>();
  if (!ligne) return ouVous(undefined, "destinataire sans compte");
  const compte: ComptePronom = {
    role: (["admin", "revendeur", "client"].includes(ligne.role) ? ligne.role : "client") as PortalRole,
    organisation: ligne.organisation,
    workspace: ligne.workspace,
  };
  return ouVous(pronomDuCompte(compte, await registres()), `destinataire ${compte.role}`);
}
```

- [ ] **Step 8 : brancher les appels**

`src/pages/api/messagerie/nouveau.ts` : ajouter `import { pronomDuPortail } from "../../../lib/portail/pronom";`, puis dans l'appel à `renderConfirmationSupport`, après `prenom: prenomEmail,` :

```ts
        tutoiement: (await pronomDuPortail(meta)) === "tu",
```

`src/lib/portail/messagerie/ouvrir.ts` : ajouter `import { pronomDuDestinataire } from "../pronom";`, puis dans l'appel à `renderReponseMessagerie`, après `urlTicket: …,` :

```ts
        tutoiement: (await pronomDuDestinataire(db, due.destinataire_email)) === "tu",
```

`src/lib/portail/messagerie/publier.ts` : même import, et après `urlTicket: …,` :

```ts
            tutoiement: (await pronomDuDestinataire(db, ticket.author_email)) === "tu",
```

`src/lib/auth/options.ts` : ajouter `import { pronomDuDestinataire } from "../portail/pronom";`. Puis :

- dans `sendResetPassword`, remplacer `renderReinitialisation({ url, prenom: user.name })` par
  `renderReinitialisation({ url, prenom: user.name, tutoiement: (await pronomDuDestinataire(env.PORTAL_DB, user.email)) === "tu" })` ;
- dans `sendMagicLink`, juste après la ligne `if (deposerLien(…)) return;`, ajouter
  `const tutoiement = (await pronomDuDestinataire(env.PORTAL_DB, email)) === "tu";`
  puis passer `tutoiement` à `renderInvitation({ … })` et à `renderLienMagique({ url, tutoiement })` ;
- dans `sendInvitationEmail`, passer `tutoiement: (await pronomDuDestinataire(env.PORTAL_DB, data.email)) === "tu"` à `renderInvitation`.

Le compte existe déjà quand le mail d'invitation part : l'action `inviter` le crée avant d'appeler `signInMagicLink`. Il porte donc déjà son rôle et son workspace.

- [ ] **Step 9 : vérifier**

Run: `npx vitest run && npx astro build`
Expected: PASS ; build `Complete!`.

Vérifier la requête du destinataire sur la base D1 locale, sans envoyer de mail : en local, Resend envoie de vrais messages, et aucune adresse de vrai client ne doit servir de test.

```bash
npm run comptes-locaux
npx wrangler d1 execute coolbeans-portal --local --command "SELECT u.portalRole AS role, o.slug AS organisation, t.slug AS workspace FROM user u LEFT JOIN member m ON m.userId = u.id LEFT JOIN organization o ON o.id = m.organizationId LEFT JOIN teamMember tm ON tm.userId = u.id LEFT JOIN team t ON t.id = tm.teamId WHERE lower(u.email) = lower('CLIENT-CAFA@LOCAL.TEST') LIMIT 1"
```

Expected : une ligne `client | coolbeans | cafa`. CAFA vouvoie, Amusoire (`client-amusoire@local.test`) tutoie.

- [ ] **Step 10 : commit**

```bash
git add src/lib/portail/pronom.ts src/emails/support-confirmation.ts src/emails/messagerie-reponse.ts \
  src/emails/auth.ts src/emails/registres.test.ts src/pages/api/messagerie/nouveau.ts \
  src/lib/portail/messagerie/ouvrir.ts src/lib/portail/messagerie/publier.ts src/lib/auth/options.ts
git commit -m "feat(portail): les mails suivent le pronom de leur destinataire

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6 : documentation, skill, livraison sur staging

**Files:**
- Modify: `src/content/docs/coolbeans/04-portail.mdx`, `docs/superpowers/specs/README.md`
- Modify: `~/.claude/skills/proposition-commerciale/references/composition.md`, `~/.claude/skills/proposition-commerciale/references/cadrage.md`

- [ ] **Step 1 : la doc du portail**

Dans `04-portail.mdx`, ajouter avant `## Référence technique` :

```mdx
## Le tu ou le vous

Chaque fiche client (`src/content/clients/<slug>.yaml`) et chaque organisation
(`src/content/organisations/<slug>.yaml`) porte `tutoiement: true` ou `false`.
La clé est obligatoire : sans elle, le build échoue.

- Un document hérite du pronom de sa fiche. Une version hérite de sa racine.
- Chez un revendeur, la proposition suit le pronom de l'organisation, les autres documents celui du client final.
- Un document peut surcharger sa fiche avec sa propre clé `tutoiement`. Le témoignage Amusoire le fait.
- Les mails du portail suivent le compte du destinataire : un client sa fiche, un revendeur son organisation, un admin la fiche Coolbeans.
- Les libellés du portail sont neutres : ils désignent le site ou le projet, jamais la personne.

La règle vit dans `src/lib/documents/pronom.ts`.
```

Dans la même page, le titre `## Ce que vous pouvez modifier vous-même` reste : la doc Coolbeans vouvoie le lecteur de la doc, ce n'est pas le portail.

- [ ] **Step 2 : la skill de proposition**

Dans `~/.claude/skills/proposition-commerciale/references/composition.md`, ajouter en tête de la section qui décrit le YAML :

```md
- **La fiche client avant le premier document.** Résoudre le client du projet
  (`clientDuProjet` dans `src/lib/documents/nomenclature.ts`). Si sa fiche
  `src/content/clients/<slug>.yaml` manque, la créer avec `nom`,
  `organisation`, `cle`, `prenom` et `tutoiement`, en posant la question du
  pronom à Ludo par une question interactive, une seule fois. Ne rien composer
  avant. Le YAML du document n'écrit plus `tutoiement` : il hérite de la fiche,
  sauf surcharge assumée.
```

Ajouter le même paragraphe dans `references/cadrage.md`.

Puis sauvegarder les dotfiles, comme le veut la règle de `/dev/CLAUDE.md` :

```bash
cd ~/dev/dotfiles && ./backup.sh && git add -A && git commit -m "backup: skill proposition-commerciale, fiche client avant le premier document" && git push
```

- [ ] **Step 3 : l'index des specs**

Dans `docs/superpowers/specs/README.md`, ligne de `2026-10-02-pronom-fiche-client-design.md`, remplacer le statut par :
`Implémentée sur staging ; reste la recette de Ludo, puis l'archivage avec la doc`.

- [ ] **Step 4 : vérifier, puis livrer sur staging**

```bash
npx vitest run && npx astro build
git add src/content/docs/coolbeans/04-portail.mdx docs/superpowers/specs/README.md
git commit -m "docs(portail): le tu ou le vous vient de la fiche client

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
git fetch origin && git rebase origin/staging && git push origin HEAD:staging
```

Expected: le hook pre-push affiche `build vert`. Vérifier ensuite le build Cloudflare de `coolbeans-staging`.

S'arrêter là. La production attend l'ordre de Ludo.
