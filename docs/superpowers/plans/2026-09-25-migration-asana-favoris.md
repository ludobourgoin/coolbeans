# Migration Asana vers Linear : plan d'exécution

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** importer en Triage, dans la bonne team, les 263 tâches ouvertes des douze projets Asana retenus, sans perte ni invention.

**Architecture:** des scripts Node sans dépendance lisent Asana par son API REST (jeton personnel) et écrivent dans Linear par GraphQL. Une extraction figée, une passe à blanc validée par Ludo, puis un import reprenable et un rapprochement chiffré.

**Tech Stack:** Node 22 (fetch natif, `node:test`), API REST Asana 1.0, API GraphQL Linear.

**Spec:** `docs/superpowers/specs/2026-09-25-migration-asana-favoris-design.md`

## Global Constraints

- Statut Triage de la team cible. Ni assignee, ni priorité, ni estimate, ni échéance.
- Titre : le nom Asana tel quel, sur une ligne, 255 caractères au plus. En cas de fusion, le plus complet des deux.
- Label workspace `Import Asana` sur chaque issue, `Support` en plus pour le projet support.
- Aucune création avant la validation de la passe à blanc par Ludo.
- Aucune suppression ni modification dans Asana. L'archivage n'intervient qu'après la validation de Ludo sur le côté Linear.
- Données perso hors de tout dépôt : scripts, extraction et tables vivent dans `$MIG`, le scratchpad de la session (`scratchpad/migration-asana`). Ce plan ne cite aucun contenu de tâche.
- Clés lues dans `~/dev/coolbeans/.dev.vars` : `LINEAR_API_KEY` (existante) et `ASANA_PAT` (à ajouter par Ludo, à révoquer après la migration).

## Review Focus

- Même tâche (même GID) dans deux projets du périmètre : une seule issue, qui cite l'autre projet. Test : `dédoublonnage par GID entre projets` (tâche 2).
- Nom Asana sur plusieurs lignes ou très long (URL collée) : titre sur une ligne, coupé à 255, nom complet recopié dans la description. Test : `titre multi-ligne…` (tâche 2).
- Tâche ajoutée à `projects (legacy)` ou `support` après l'inventaire : la passe à blanc s'arrête sur « Sans team » au lieu de la router au hasard (tâche 5, étape 2).
- Import interrompu (réseau, page HTML de l'API) : la relance ne recrée rien. Vérification : second passage à « créées 0 » (tâche 6, étape 3).
- Tâche sans notes, sous-tâches, commentaires ni pièces jointes : pas de section vide. Test : `tâche minimale…` (tâche 2).

---

### Task 1 : accès et bibliothèque

**Files:**
- Create: `$MIG/config.mjs`, `$MIG/lib.mjs`

**Interfaces:**
- Produces: `PROJETS`, `PAR_TACHE`, `ECARTEES`, `PROJET_SUPPORT`, `PROJET_CRM` ; `cle(nom)`, `asana(chemin)`, `asanaTout(chemin)`, `linear(query, variables, { retry })`, `lire(f)`, `ecrire(f, d)`, `existe(f)`.

- [x] **Step 1 : écrire `config.mjs`** (périmètre et routage de la spec)

```js
// Périmètre et routage de la migration Asana -> Linear, décidés avec Ludo le 2026-09-25.
// Spec : coolbeans/docs/superpowers/specs/2026-09-25-migration-asana-favoris-design.md

export const PROJETS = [
  { gid: '1211893294366483', nom: 'body', team: 'BOD' },
  { gid: '1211893293414985', nom: 'money', team: 'MON' },
  { gid: '1211893294366499', nom: 'social', team: 'SOC' },
  { gid: '1211893294366475', nom: 'adventures', team: 'ADV' },
  { gid: '1211893294366511', nom: 'environment', team: 'ENV' },
  { gid: '1208893580241097', nom: 'coolbeans', team: 'COO' },
  { gid: '1217361878516618', nom: 'Site web Coolbeans', team: 'COO' },
  { gid: '1212812786472264', nom: 'programmation', team: 'POP' },
  { gid: '1208892745306447', nom: 'tielle & popcorn', team: 'POP' },
  { gid: '1213289511494550', nom: 'projects (legacy)', team: null },
  { gid: '1216447136398892', nom: 'support', team: null },
  { gid: '1211981053231553', nom: 'crm', team: 'CRM' },
];

// Projets multi-clients : la team se décide tâche par tâche. Une tâche de ces
// projets absente d'ici arrête la passe à blanc (tâche ajoutée après l'inventaire).
export const PAR_TACHE = {
  // projects (legacy)
  '1211981053615367': 'UNL', // UnlockBreath
  '1217251069238087': 'AMU', // Vidéo KO sur LP Bars et restaus
  '1216446919392800': 'OID', // Intégration Shopify Oïde
  '1215596681546183': 'SET', // sète en corps mieux
  '1216446919392808': 'FYL', // fylgo
  '1216446919392782': 'LIT', // littlebox
  // support
  '1216447136398903': 'FYL', // fylgo / support
  '1215997231901396': 'MAT', // mathilde_ch / support
  '1215997231901398': 'SET', // sète_en_corps_mieux / support
  '1215353112755861': 'AMU', // amusoire / support
  '1215537459478233': 'TRI', // trigger / support
};

export const ECARTEES = {
  '1215822863143728': "Support merci_yanis : pas de team Linear, laissé dans Asana (décision de Ludo)",
  '1217361878516580': 'Modèle de lead du CRM : existe déjà comme template Linear 🧬 Lead',
};

export const PROJET_SUPPORT = '1216447136398892';
export const PROJET_CRM = '1211981053231553';
```

- [x] **Step 2 : écrire `lib.mjs`**

```js
// Accès Asana (REST, jeton personnel) et Linear (GraphQL). Les clés se lisent
// dans coolbeans/.dev.vars : ASANA_PAT et LINEAR_API_KEY. Rien n'est affiché.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const DIR = dirname(fileURLToPath(import.meta.url));
const VARS = '/Users/ludovicbourgoin/dev/coolbeans/.dev.vars';

export function cle(nom) {
  const m = readFileSync(VARS, 'utf8').match(new RegExp(`^${nom}\\s*=\\s*"?([^"\\n]+)"?`, 'm'));
  if (!m) throw new Error(`${nom} absente de ${VARS}`);
  return m[1].trim();
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// GET Asana avec attente sur 429 (limite de débit) et relance sur 5xx.
export async function asana(chemin) {
  const url = chemin.startsWith('http') ? chemin : `https://app.asana.com/api/1.0${chemin}`;
  for (let essai = 1; essai <= 8; essai++) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${cle('ASANA_PAT')}` } });
    if (res.status === 429) { await sleep(Number(res.headers.get('retry-after') || 30) * 1000); continue; }
    if (res.status >= 500) { await sleep(2000 * essai); continue; }
    const j = await res.json();
    if (!res.ok) throw new Error(`Asana ${res.status} sur ${url} : ${JSON.stringify(j.errors)}`);
    return j;
  }
  throw new Error(`Asana : 8 échecs sur ${url}`);
}

// Toutes les pages d'une liste Asana.
export async function asanaTout(chemin) {
  const out = [];
  let offset = null;
  do {
    const sep = chemin.includes('?') ? '&' : '?';
    const j = await asana(`${chemin}${sep}limit=100${offset ? `&offset=${offset}` : ''}`);
    out.push(...j.data);
    offset = j.next_page?.offset ?? null;
  } while (offset);
  return out;
}

// GraphQL Linear. Une lecture se relance si la réponse n'est pas du JSON.
// Une mutation (retry: false) ne se relance jamais : elle a pu aboutir côté
// serveur, et c'est l'importeur qui vérifie l'existence avant de recréer.
export async function linear(query, variables = {}, { retry = true } = {}) {
  const essais = retry ? 5 : 1;
  for (let essai = 1; essai <= essais; essai++) {
    const res = await fetch('https://api.linear.app/graphql', {
      method: 'POST',
      headers: { Authorization: cle('LINEAR_API_KEY'), 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables }),
    });
    const txt = await res.text();
    let j;
    try { j = JSON.parse(txt); } catch { if (essai < essais) { await sleep(3000 * essai); continue; } throw new Error(`Linear : réponse non JSON (HTTP ${res.status})`); }
    if (j.errors) throw new Error(`Linear : ${JSON.stringify(j.errors).slice(0, 500)}`);
    return j.data;
  }
  throw new Error('Linear : réponses non JSON');
}

export const lire = (f) => JSON.parse(readFileSync(join(DIR, f), 'utf8'));
export const ecrire = (f, d) => writeFileSync(join(DIR, f), typeof d === 'string' ? d : JSON.stringify(d, null, 2));
export const existe = (f) => existsSync(join(DIR, f));
```

- [ ] **Step 3 : Ludo ajoute son jeton Asana.** Il le crée dans la console développeur d'Asana (https://app.asana.com/0/my-apps, « Personal access token ») et l'ajoute sur une ligne `ASANA_PAT=…` de `~/dev/coolbeans/.dev.vars`.

- [ ] **Step 4 : vérifier l'accès**

Run: `cd $MIG && node -e "import('./lib.mjs').then(async (l) => console.log((await l.asana('/users/me')).data.name))"`
Expected: le nom du compte Asana de Ludo.

### Task 2 : descriptions et dédoublonnage par GID

**Files:**
- Create: `$MIG/description.mjs`, `$MIG/fusion.mjs`
- Test: `$MIG/description.test.mjs`

**Interfaces:**
- Produces: `titreLinear(nom) -> string` ; `construireDescription(tache, { projets, doublonDe, fusionnee }) -> string` ; `fusionnerParGid(listes) -> { taches, doublonsGid }`.

- [x] **Step 1 : écrire les tests**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { titreLinear, construireDescription } from './description.mjs';
import { fusionnerParGid } from './fusion.mjs';

const projets = { P1: 'body', P2: 'social' };
const base = (x = {}) => ({
  gid: '1', name: 'Prendre rdv orl', notes: '', projet: 'P1', section: '📦 mess',
  due_on: null, created_at: '2026-05-02T10:00:00.000Z', permalink_url: 'https://app.asana.com/t/1',
  sousTaches: [], commentaires: [], piecesJointes: [], aussiDans: [], ...x,
});

test('tâche minimale : bloc Asana seul, aucune section vide', () => {
  const d = construireDescription(base(), { projets });
  assert.match(d, /## Asana/);
  assert.match(d, /Échéance d'origine : aucune/);
  assert.match(d, /Source : https:\/\/app\.asana\.com\/t\/1/);
  assert.match(d, /Projet : body · section 📦 mess/);
  assert.doesNotMatch(d, /## Sous-tâches|## Commentaires|## Pièces jointes/);
});

test('titre multi-ligne ramené sur une ligne, titre long coupé à 255, nom complet gardé', () => {
  assert.equal(titreLinear('MJC Poussan : Fauteuils\nCapacité mon 100'), 'MJC Poussan : Fauteuils Capacité mon 100');
  const long = 'x'.repeat(300);
  assert.equal(titreLinear(long).length, 255);
  assert.ok(titreLinear(long).endsWith('…'));
  assert.match(construireDescription(base({ name: long }), { projets }), /Nom Asana complet : x{300}/);
  assert.doesNotMatch(construireDescription(base(), { projets }), /Nom Asana complet/);
});

test('notes en tête, sous-tâches imbriquées en check-list, commentaires et pièces jointes', () => {
  const d = construireDescription(base({
    notes: 'Reco Dr X\n',
    sousTaches: [{ name: 'Sleep', completed: false, sousTaches: [{ name: 'Tracker', completed: true, sousTaches: [] }] }],
    commentaires: [{ auteur: 'Ludovic Bourgoin', date: '2026-06-01', texte: 'Relancé' }],
    piecesJointes: [{ nom: 'ordonnance.pdf', lien: 'https://app.asana.com/a/9' }],
  }), { projets });
  assert.ok(d.startsWith('Reco Dr X\n'));
  assert.match(d, /## Sous-tâches\n- \[ \] Sleep\n  - \[x\] Tracker/);
  assert.match(d, /\*\*Ludovic Bourgoin, 2026-06-01\*\* : Relancé/);
  assert.match(d, /- \[ordonnance\.pdf\]\(https:\/\/app\.asana\.com\/a\/9\)/);
});

test('échéance, doublon probable et projets multiples', () => {
  const d = construireDescription(base({ due_on: '2026-08-12', aussiDans: ['P2'] }), {
    projets, doublonDe: { identifiant: 'ADV-1', url: 'https://linear.app/x/ADV-1' },
  });
  assert.match(d, /Échéance d'origine : 2026-08-12/);
  assert.match(d, /Aussi dans : social/);
  assert.match(d, /Doublon probable de ADV-1 : https:\/\/linear\.app\/x\/ADV-1/);
});

test('fusion : les deux sources, les deux contenus', () => {
  const fus = base({ gid: '2', name: 'Assurance Chapka', notes: 'Souscrire avant départ', permalink_url: 'https://app.asana.com/t/2' });
  const d = construireDescription(base({ name: 'Assurance Chapka (3 mois)', notes: 'Bac 3' }), { projets, fusionnee: fus });
  assert.match(d, /Fusion de deux tâches Asana : https:\/\/app\.asana\.com\/t\/1, https:\/\/app\.asana\.com\/t\/2/);
  assert.match(d, /## Tâche Asana fusionnée : Assurance Chapka/);
  assert.match(d, /Bac 3/);
  assert.match(d, /Souscrire avant départ/);
});

test('dédoublonnage par GID entre projets', () => {
  const { taches, doublonsGid } = fusionnerParGid([
    [{ gid: 'A', projet: 'P1' }, { gid: 'B', projet: 'P1' }],
    [{ gid: 'A', projet: 'P2' }],
  ]);
  assert.equal(taches.length, 2);
  assert.equal(doublonsGid, 1);
  assert.deepEqual(taches.find((t) => t.gid === 'A').aussiDans, ['P2']);
});
```

- [x] **Step 2 : les lancer, ils échouent** (modules absents)

Run: `cd $MIG && node --test description.test.mjs`
Expected: FAIL, modules introuvables.

- [x] **Step 3 : écrire `fusion.mjs` et `description.mjs`**

```js
// Une même tâche Asana (même GID) peut vivre dans deux projets du périmètre :
// elle ne devient qu'une issue, et garde la trace des autres projets.
export function fusionnerParGid(listes) {
  const vus = new Map();
  let doublonsGid = 0;
  for (const liste of listes) {
    for (const t of liste) {
      if (vus.has(t.gid)) { vus.get(t.gid).aussiDans.push(t.projet); doublonsGid++; continue; }
      vus.set(t.gid, { ...t, aussiDans: [] });
    }
  }
  return { taches: [...vus.values()], doublonsGid };
}
```

```js
// Titre et description d'une issue Linear à partir d'une tâche Asana extraite.
// Rien n'est réécrit : le texte Asana passe tel quel, seule la mise en forme change.
const NBSP = ' ';

export function titreLinear(nom) {
  const t = nom.replace(/\s*\n\s*/g, ' ').replace(/\s{2,}/g, ' ').trim();
  return t.length > 255 ? `${t.slice(0, 254)}…` : t;
}

function checklist(sous, niveau = 0) {
  return (sous ?? []).flatMap((s) => [
    `${'  '.repeat(niveau)}- [${s.completed ? 'x' : ' '}] ${titreLinear(s.name)}`,
    ...checklist(s.sousTaches, niveau + 1),
  ]);
}

function blocAsana(t, nom) {
  return [
    `- Projet${NBSP}: ${nom(t.projet)}${t.section ? ` · section ${t.section}` : ''}`,
    `- Échéance d'origine${NBSP}: ${t.due_on ?? 'aucune'}`,
    `- Créée le ${t.created_at.slice(0, 10)}`,
    `- Source${NBSP}: ${t.permalink_url}`,
    ...(t.aussiDans?.length ? [`- Aussi dans${NBSP}: ${t.aussiDans.map(nom).join(', ')}`] : []),
  ];
}

function contenus(t) {
  const out = [];
  if (t.sousTaches?.length) out.push('## Sous-tâches', ...checklist(t.sousTaches), '');
  if (t.commentaires?.length) out.push('## Commentaires', ...t.commentaires.flatMap((c) => [`**${c.auteur}, ${c.date}**${NBSP}: ${c.texte}`, '']));
  if (t.piecesJointes?.length) out.push('## Pièces jointes', ...t.piecesJointes.map((p) => `- [${p.nom}](${p.lien})`), '');
  return out;
}

function tete(t) {
  const out = [];
  if (t.notes?.trim()) out.push(t.notes.trim(), '');
  if (titreLinear(t.name) !== t.name.trim()) out.push(`Nom Asana complet${NBSP}: ${t.name.trim()}`, '');
  return out;
}

export function construireDescription(t, { projets, doublonDe = null, fusionnee = null }) {
  const nom = (gid) => projets[gid] ?? gid;
  const lignes = [...tete(t), '## Asana', ...blocAsana(t, nom)];
  if (doublonDe) lignes.push(`- Doublon probable de ${doublonDe.identifiant}${NBSP}: ${doublonDe.url}`);
  if (fusionnee) lignes.push(`- Fusion de deux tâches Asana${NBSP}: ${t.permalink_url}, ${fusionnee.permalink_url}`);
  lignes.push('', ...contenus(t));
  if (fusionnee) {
    lignes.push('---', '', `## Tâche Asana fusionnée${NBSP}: ${titreLinear(fusionnee.name)}`, '',
      ...tete(fusionnee), ...blocAsana(fusionnee, nom), '', ...contenus(fusionnee));
  }
  return `${lignes.join('\n').replace(/\n{3,}/g, '\n\n').trim()}\n`;
}
```

- [x] **Step 4 : les relancer**

Run: `cd $MIG && node --test description.test.mjs`
Expected: `# pass 6`, `# fail 0`.

### Task 3 : extraction

**Files:**
- Create: `$MIG/extraire.mjs`
- Produit : `$MIG/extraction.json`

**Interfaces:**
- Consumes: `asanaTout`, `ecrire`, `PROJETS`, `fusionnerParGid`.
- Produces: `extraction.json`, tableau de tâches `{ gid, name, notes, created_at, due_on, permalink_url, projet, section, parent, sousTaches, commentaires, piecesJointes, aussiDans }`.

- [x] **Step 1 : écrire `extraire.mjs`**

```js
// Étape 1 : extraction complète des tâches ouvertes du périmètre -> extraction.json
// Lecture seule côté Asana.
import { asanaTout, ecrire } from './lib.mjs';
import { PROJETS } from './config.mjs';
import { fusionnerParGid } from './fusion.mjs';

const CHAMPS = 'name,notes,created_at,due_on,permalink_url,completed,parent.gid,memberships.project.gid,memberships.section.name,num_subtasks';

async function sousTaches(gid, profondeur) {
  const subs = await asanaTout(`/tasks/${gid}/subtasks?opt_fields=name,completed,num_subtasks`);
  for (const s of subs) s.sousTaches = profondeur < 3 && s.num_subtasks ? await sousTaches(s.gid, profondeur + 1) : [];
  return subs;
}

const compter = (l) => (l ?? []).reduce((n, s) => n + 1 + compter(s.sousTaches), 0);

const listes = [];
for (const p of PROJETS) {
  const taches = await asanaTout(`/projects/${p.gid}/tasks?completed_since=now&opt_fields=${CHAMPS}`);
  for (const t of taches) {
    t.projet = p.gid;
    t.section = t.memberships?.find((m) => m.project?.gid === p.gid)?.section?.name ?? null;
    t.parent = t.parent?.gid ?? null;
    t.sousTaches = t.num_subtasks ? await sousTaches(t.gid, 1) : [];
    const stories = await asanaTout(`/tasks/${t.gid}/stories?opt_fields=resource_subtype,text,created_at,created_by.name`);
    t.commentaires = stories
      .filter((s) => s.resource_subtype === 'comment_added')
      .map((s) => ({ auteur: s.created_by?.name ?? 'inconnu', date: s.created_at.slice(0, 10), texte: s.text }));
    const pj = await asanaTout(`/attachments?parent=${t.gid}&opt_fields=name,permanent_url,view_url`);
    t.piecesJointes = pj.map((a) => ({ nom: a.name, lien: a.permanent_url || a.view_url }));
    delete t.memberships;
  }
  listes.push(taches);
  console.log(`${p.nom} : ${taches.length} ouvertes`);
}

const { taches, doublonsGid } = fusionnerParGid(listes);
ecrire('extraction.json', taches);
console.log(`TOTAL : ${taches.length} tâches uniques (${doublonsGid} présentes dans deux projets), `
  + `${taches.reduce((n, t) => n + compter(t.sousTaches), 0)} sous-tâches, `
  + `${taches.reduce((n, t) => n + t.commentaires.length, 0)} commentaires, `
  + `${taches.reduce((n, t) => n + t.piecesJointes.length, 0)} pièces jointes, `
  + `${taches.filter((t) => t.parent).length} tâches qui sont aussi des sous-tâches`);
```

- [ ] **Step 2 : lancer l'extraction**

Run: `cd $MIG && node extraire.mjs`
Expected: un compte par projet proche de l'inventaire (8, 5, 11, 13, 9, 50, 4, 19, 111, 6, 6, 21) et un total d'environ 263. Tout écart se signale à Ludo avant la suite.

### Task 4 : candidats aux fusions et aux doublons

**Files:**
- Create: `$MIG/routage.mjs`, `$MIG/linear-existant.mjs`, `$MIG/candidats.mjs`
- Produit : `$MIG/linear-existant.json`, `$MIG/candidats.json`, puis `$MIG/decisions.json` écrit à la main

**Interfaces:**
- Produces: `teamDe(tache)`, `similarite(a, b)` ; `decisions.json` au format `{ fusions: [[gidGardé, gidFusionné]], doublons: { gid: "ADV-1" }, ecartees: { gid: "motif" } }`.

- [x] **Step 1 : écrire `routage.mjs`, `linear-existant.mjs` et `candidats.mjs`**

```js
// Routage d'une tâche vers sa team, et similarité de titres pour repérer les doublons.
import { PROJETS, PAR_TACHE } from './config.mjs';

const mots = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/https?:\S+/g, ' ').replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter((w) => w.length > 2);
export const similarite = (a, b) => {
  const A = new Set(mots(a)); const B = new Set(mots(b));
  if (!A.size || !B.size) return 0;
  let inter = 0; for (const w of A) if (B.has(w)) inter++;
  return inter / Math.min(A.size, B.size);
};
export const teamDe = (t) => PAR_TACHE[t.gid] ?? PROJETS.find((p) => p.gid === t.projet)?.team ?? null;
```

```js
// Étape 2a : issues Linear existantes des teams cibles -> linear-existant.json
// Sert à repérer les doublons probables. Lecture seule.
import { linear, ecrire } from './lib.mjs';
import { PROJETS, PAR_TACHE } from './config.mjs';

const teams = [...new Set([...PROJETS.map((p) => p.team), ...Object.values(PAR_TACHE)].filter(Boolean))];
const out = {};
for (const key of teams) {
  out[key] = [];
  let after = null;
  do {
    const d = await linear(`query($k:String!,$a:String){ issues(first:100, after:$a, filter:{ team:{ key:{ eq:$k } } }){
      nodes{ identifier title url state{ type } } pageInfo{ hasNextPage endCursor } } }`, { k: key, a: after });
    out[key].push(...d.issues.nodes.map((i) => ({ identifier: i.identifier, title: i.title, url: i.url, etat: i.state.type })));
    after = d.issues.pageInfo.hasNextPage ? d.issues.pageInfo.endCursor : null;
  } while (after);
  console.log(`${key} : ${out[key].length} issues`);
}
ecrire('linear-existant.json', out);
```

```js
// Étape 2b : candidats aux fusions (doublons internes à Asana) et aux doublons
// avec Linear -> candidats.json. Ce ne sont que des candidats : la décision
// s'écrit à la main dans decisions.json, puis Ludo la voit dans la passe à blanc.
import { lire, ecrire, linear } from './lib.mjs';
import { PROJETS, ECARTEES, PROJET_CRM } from './config.mjs';
import { similarite, teamDe } from './routage.mjs';

const taches = lire('extraction.json').filter((t) => !ECARTEES[t.gid]);
const lin = lire('linear-existant.json');
const nomProjet = (gid) => PROJETS.find((p) => p.gid === gid)?.nom;

const sansTeam = taches.filter((t) => !teamDe(t)).map((t) => ({ gid: t.gid, nom: t.name, projet: nomProjet(t.projet) }));

const internes = [];
for (let i = 0; i < taches.length; i++) for (let j = i + 1; j < taches.length; j++) {
  const s = similarite(taches[i].name, taches[j].name);
  if (s >= 0.6) internes.push({ s: +s.toFixed(2), a: [taches[i].gid, taches[i].name, nomProjet(taches[i].projet)], b: [taches[j].gid, taches[j].name, nomProjet(taches[j].projet)] });
}

const avecLinear = [];
for (const t of taches) {
  const key = teamDe(t); if (!key) continue;
  const seuil = t.projet === PROJET_CRM ? 0.34 : 0.6;
  const proches = (lin[key] ?? []).map((i) => ({ ...i, s: similarite(t.name, i.title) }))
    .filter((i) => i.s >= seuil).sort((x, y) => y.s - x.s).slice(0, 3);
  if (proches.length || t.projet === PROJET_CRM) avecLinear.push({ gid: t.gid, nom: t.name, team: key, proches: proches.map((p) => `${p.identifier} (${p.s.toFixed(2)}, ${p.etat}) ${p.title}`) });
}

// Liens déjà posés : une issue Linear active dont la description cite le GID
// de la tâche (migrations précédentes, CRM du 2026-08-16 notamment).
const dejaLiees = [];
for (const t of taches) {
  const d = await linear(`query($s:String!){ issues(first:5, filter:{ description:{ contains:$s } }){ nodes{ identifier title state{ type } } } }`, { s: t.gid });
  if (d.issues.nodes.length) dejaLiees.push({ gid: t.gid, nom: t.name, projet: nomProjet(t.projet), issues: d.issues.nodes.map((i) => `${i.identifier} (${i.state.type}) ${i.title}`) });
}

const sousTachesAussi = taches.filter((t) => t.parent).map((t) => ({ gid: t.gid, nom: t.name, parent: t.parent }));

ecrire('candidats.json', { sansTeam, internes, avecLinear, dejaLiees, sousTachesAussi });
console.log(`sans team : ${sansTeam.length} | paires internes : ${internes.length} | proches de Linear : ${avecLinear.length} | déjà liées par GID : ${dejaLiees.length} | tâches aussi sous-tâches : ${sousTachesAussi.length}`);
```

- [ ] **Step 2 : lancer**

Run: `cd $MIG && node linear-existant.mjs && node candidats.mjs`
Expected: `sans team : 0`, puis les comptes de paires internes, de proches de Linear et de tâches déjà liées par GID.

- [ ] **Step 3 : écrire `decisions.json`.** Relire chaque candidat de `candidats.json` et trancher : fusion quand deux tâches Asana décrivent le même geste ; doublon probable quand une issue Linear active couvre la tâche ; écartée pour une tâche CRM déjà migrée (motif : « déjà migrée : CRM-n »). Dans le doute, ni fusion ni écart : la tâche passe telle quelle, et Ludo tranche au tri.

### Task 5 : passe à blanc

**Files:**
- Create: `$MIG/plan-import.mjs`
- Produit : `$MIG/plan-import.json`, `$MIG/passe-a-blanc.md`

- [x] **Step 1 : écrire `plan-import.mjs`**

```js
// Étape 3 : passe à blanc. Construit plan-import.json (ce qui sera créé) et
// passe-a-blanc.md (ce que Ludo valide). Ne crée rien dans Linear.
// decisions.json : { fusions: [[gidGardé, gidFusionné]], doublons: { gid: "ADV-1" }, ecartees: { gid: "motif" } }
import { lire, ecrire } from './lib.mjs';
import { PROJETS, ECARTEES, PROJET_SUPPORT } from './config.mjs';
import { teamDe } from './routage.mjs';
import { titreLinear, construireDescription } from './description.mjs';

const taches = lire('extraction.json');
const dec = lire('decisions.json');
const lin = lire('linear-existant.json');
const projets = Object.fromEntries(PROJETS.map((p) => [p.gid, p.nom]));
const parGid = new Map(taches.map((t) => [t.gid, t]));
const urlDe = (id) => Object.values(lin).flat().find((i) => i.identifier === id)?.url ?? null;
const ecartees = { ...ECARTEES, ...dec.ecartees };
const fusionneeDans = new Map(dec.fusions.map(([g, f]) => [f, g]));

for (const [g, f] of dec.fusions) if (!parGid.has(g) || !parGid.has(f)) throw new Error(`Fusion sur un GID inconnu : ${g} / ${f}`);
for (const [g, id] of Object.entries(dec.doublons)) if (!urlDe(id)) throw new Error(`Doublon vers une issue inconnue : ${g} -> ${id}`);

const items = [];
for (const t of taches) {
  if (ecartees[t.gid] || fusionneeDans.has(t.gid)) continue;
  const f = dec.fusions.find(([g]) => g === t.gid);
  const fusionnee = f ? parGid.get(f[1]) : null;
  const doublonDe = dec.doublons[t.gid] ? { identifiant: dec.doublons[t.gid], url: urlDe(dec.doublons[t.gid]) } : null;
  const team = teamDe(t);
  if (!team) throw new Error(`Sans team, à trancher avec Ludo : ${t.gid} ${t.name}`);
  const nom = fusionnee && fusionnee.name.trim().length > t.name.trim().length ? fusionnee.name : t.name;
  items.push({
    gids: fusionnee ? [t.gid, fusionnee.gid] : [t.gid],
    source: t.permalink_url,
    team,
    titre: titreLinear(nom),
    support: t.projet === PROJET_SUPPORT,
    projet: projets[t.projet],
    section: t.section,
    doublon: doublonDe?.identifiant ?? null,
    description: construireDescription(t, { projets, doublonDe, fusionnee }),
  });
}

const couverts = new Set(items.flatMap((i) => i.gids));
const nEcartees = taches.filter((t) => ecartees[t.gid]).length;
if (couverts.size + nEcartees !== taches.length) throw new Error(`Rapprochement faux : ${couverts.size} couvertes + ${nEcartees} écartées ≠ ${taches.length}`);
ecrire('plan-import.json', items);

const cell = (s) => String(s ?? '').replace(/\|/g, '\\|');
const lignes = [
  '# Passe à blanc : migration Asana -> Linear', '',
  `${taches.length} tâches extraites = ${items.length} issues à créer (dont ${dec.fusions.length} fusions de deux tâches) + ${nEcartees} écartées.`, '',
];
for (const team of [...new Set(items.map((i) => i.team))].sort()) {
  const it = items.filter((i) => i.team === team);
  lignes.push(`## ${team} (${it.length})`, '', '| Titre | Projet · section | Fusion | Doublon probable |', '|---|---|---|---|');
  for (const i of it) lignes.push(`| ${cell(i.titre)} | ${cell(i.projet)} · ${cell(i.section)} | ${i.gids.length > 1 ? 'oui' : ''} | ${i.doublon ?? ''} |`);
  lignes.push('');
}
lignes.push('## Écartées', '', '| Tâche | Projet | Motif |', '|---|---|---|');
for (const t of taches.filter((x) => ecartees[x.gid])) lignes.push(`| ${cell(titreLinear(t.name))} | ${cell(projets[t.projet])} | ${cell(ecartees[t.gid])} |`);
lignes.push('', '## Fusions', '');
for (const [g, f] of dec.fusions) lignes.push(`- « ${titreLinear(parGid.get(g).name)} » + « ${titreLinear(parGid.get(f).name)} »`);
ecrire('passe-a-blanc.md', `${lignes.join('\n')}\n`);
console.log(`${items.length} issues à créer, ${nEcartees} écartées, ${dec.fusions.length} fusions. Voir passe-a-blanc.md`);
```

- [ ] **Step 2 : lancer**

Run: `cd $MIG && node plan-import.mjs`
Expected: « N issues à créer, M écartées, F fusions ». Le script s'arrête sur une tâche sans team ou sur un rapprochement faux.

- [ ] **Step 3 : soumettre `passe-a-blanc.md` à Ludo, plus deux descriptions complètes prises au hasard.** Rien ne part avant sa validation. Ses corrections vont dans `decisions.json` ou `config.mjs`, puis on relance l'étape 2.

### Task 6 : import

**Files:**
- Create: `$MIG/importer.mjs`
- Produit : `$MIG/correspondance.json` (GID Asana -> identifiant Linear)

- [x] **Step 1 : écrire `importer.mjs`**

```js
// Étape 4 : import en Triage, APRÈS validation de la passe à blanc par Ludo.
// Reprenable : une tâche déjà créée (correspondance.json, ou issue portant le
// label « Import Asana » et citant la source) n'est jamais recréée.
import { linear, lire, ecrire, existe } from './lib.mjs';

const items = lire('plan-import.json');
const corr = existe('correspondance.json') ? lire('correspondance.json') : {};

const labelSansTeam = async (nom) => (await linear(`query($n:String!){ issueLabels(filter:{ name:{ eq:$n } }){ nodes{ id team{ id } } } }`, { n: nom }))
  .issueLabels.nodes.find((l) => !l.team) ?? null;

let label = await labelSansTeam('Import Asana');
if (!label) {
  label = (await linear(`mutation{ issueLabelCreate(input:{ name:"Import Asana", color:"#F2994A",
    description:"Issue importée d'Asana le 2026-09-25, à trier. Retirer le label une fois triée." }){ issueLabel{ id } } }`, {}, { retry: false }))
    .issueLabelCreate.issueLabel;
  console.log('label « Import Asana » créé');
}
const support = await labelSansTeam('Support');
if (!support) throw new Error('Label workspace « Support » introuvable');

const teams = {};
for (const key of new Set(items.map((i) => i.team))) {
  const t = (await linear(`query($k:String!){ teams(filter:{ key:{ eq:$k } }){ nodes{ id triageIssueState{ id } } } }`, { k: key })).teams.nodes[0];
  if (!t?.triageIssueState) throw new Error(`Team ${key} sans Triage`);
  teams[key] = t;
}

let crees = 0; let deja = 0;
for (const it of items) {
  if (corr[it.gids[0]]) { deja++; continue; }
  const exist = (await linear(`query($s:String!){ issues(first:1, filter:{ description:{ contains:$s }, labels:{ some:{ name:{ eq:"Import Asana" } } } }){ nodes{ identifier } } }`, { s: it.source })).issues.nodes[0];
  if (exist) { for (const g of it.gids) corr[g] = exist.identifier; ecrire('correspondance.json', corr); deja++; continue; }
  const r = await linear(`mutation($i:IssueCreateInput!){ issueCreate(input:$i){ issue{ identifier } } }`, {
    i: { teamId: teams[it.team].id, stateId: teams[it.team].triageIssueState.id, title: it.titre, description: it.description,
      labelIds: [label.id, ...(it.support ? [support.id] : [])] },
  }, { retry: false });
  for (const g of it.gids) corr[g] = r.issueCreate.issue.identifier;
  ecrire('correspondance.json', corr);
  crees++;
  if (crees % 25 === 0) console.log(`${crees} créées…`);
}
console.log(`créées ${crees}, déjà présentes ${deja}, total prévu ${items.length}`);
```

- [ ] **Step 2 : lancer l'import**

Run: `cd $MIG && node importer.mjs`
Expected: « créées N, déjà présentes 0, total prévu N ».

- [ ] **Step 3 : relancer pour vérifier la reprise**

Run: `cd $MIG && node importer.mjs`
Expected: « créées 0, déjà présentes N ».

### Task 7 : rapprochement et vue de tri

**Files:**
- Create: `$MIG/rapprochement.mjs`, `$MIG/vue.mjs`
- Produit : `$MIG/rapport.md`

- [x] **Step 1 : écrire `rapprochement.mjs` et `vue.mjs`**

```js
// Étape 5 : rapprochement. Chaque tâche extraite est soit dans une issue en
// Triage portant le label « Import Asana », soit écartée avec son motif.
import { linear, lire, ecrire } from './lib.mjs';
import { ECARTEES } from './config.mjs';

const taches = lire('extraction.json');
const corr = lire('correspondance.json');
const dec = lire('decisions.json');
const ecartees = { ...ECARTEES, ...dec.ecartees };

const manquantes = taches.filter((t) => !corr[t.gid] && !ecartees[t.gid]);
const ids = [...new Set(Object.values(corr))];
const anomalies = [];
for (const id of ids) {
  const i = (await linear(`query($id:String!){ issue(id:$id){ identifier state{ type } labels{ nodes{ name } } } }`, { id })).issue;
  if (!i) { anomalies.push(`${id} introuvable`); continue; }
  if (i.state.type !== 'triage') anomalies.push(`${id} hors Triage (${i.state.type})`);
  if (!i.labels.nodes.some((l) => l.name === 'Import Asana')) anomalies.push(`${id} sans label Import Asana`);
}

const rapport = [
  '# Rapprochement de la migration Asana', '',
  `- Tâches extraites : ${taches.length}`,
  `- Issues créées : ${ids.length} (dont ${dec.fusions.length} fusions de deux tâches)`,
  `- Tâches écartées : ${taches.filter((t) => ecartees[t.gid]).length}`,
  `- Tâches manquantes : ${manquantes.length}`,
  `- Anomalies : ${anomalies.length}`, '',
  ...manquantes.map((t) => `- MANQUANTE ${t.gid} ${t.name}`),
  ...anomalies.map((a) => `- ANOMALIE ${a}`),
].join('\n');
ecrire('rapport.md', `${rapport}\n`);
console.log(rapport);
if (manquantes.length || anomalies.length) process.exitCode = 1;
```

```js
// Étape 6 : vue de tri « Import Asana à trier », en liste groupée par team.
// La valeur de groupement « team » n'a jamais été relue sur une vue faite à la
// main : Ludo vérifie le rendu à l'écran (les préférences ne sont pas validées par l'API).
import { linear } from './lib.mjs';

const existante = (await linear(`{ customViews(filter:{ name:{ eq:"Import Asana à trier" } }){ nodes{ id } } }`)).customViews.nodes[0];
const vue = existante ?? (await linear(`mutation($i:CustomViewCreateInput!){ customViewCreate(input:$i){ customView{ id } } }`, {
  i: {
    name: 'Import Asana à trier',
    description: "Issues importées d'Asana le 2026-09-25, encore en Triage.",
    shared: true,
    filterData: { and: [{ labels: { some: { name: { eq: 'Import Asana' } } } }, { state: { type: { eq: 'triage' } } }] },
  },
}, { retry: false })).customViewCreate.customView;

const prefs = { layout: 'list', issueGrouping: 'team', issueSubGrouping: 'none', viewOrdering: 'createdAt', showSubTeamIssues: true, showTriageIssues: true,
  fieldId: true, fieldStatus: true, fieldLabels: true, fieldDateCreated: true, fieldEstimate: true, fieldPriority: true, fieldDueDate: true };
for (const type of ['organization', 'user']) {
  await linear(`mutation($i:ViewPreferencesCreateInput!){ viewPreferencesCreate(input:$i){ success } }`, { i: { type, viewType: 'customView', customViewId: vue.id, preferences: prefs } }, { retry: false });
}
const n = (await linear(`query($id:String!){ customView(id:$id){ issues(first:250){ nodes{ id } } } }`, { id: vue.id })).customView.issues.nodes.length;
console.log(`vue ${vue.id} : ${n} issues visibles par l'API`);
```

- [ ] **Step 2 : lancer**

Run: `cd $MIG && node rapprochement.mjs && node vue.mjs`
Expected: `Tâches manquantes : 0`, `Anomalies : 0`, puis l'identifiant de la vue « Import Asana à trier ». Ludo vérifie à l'écran le groupement par team.

- [ ] **Step 3 : rendre le rapport à Ludo**, avec le lien de la vue.

### Task 8 : archivage d'Asana (après validation de Ludo)

**Files:**
- Create: `$MIG/archiver.mjs`

- [x] **Step 1 : écrire `archiver.mjs`**

```js
// Étape 7 : archivage des douze projets Asana, UNIQUEMENT après validation de
// Ludo sur le côté Linear. Archiver n'efface rien : un projet archivé se restaure.
// Usage : node archiver.mjs --confirme
import { cle } from './lib.mjs';
import { PROJETS } from './config.mjs';

if (!process.argv.includes('--confirme')) {
  console.log('Refus : relancer avec --confirme, après la validation de Ludo.');
  process.exit(1);
}
for (const p of PROJETS) {
  const res = await fetch(`https://app.asana.com/api/1.0/projects/${p.gid}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${cle('ASANA_PAT')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: { archived: true } }),
  });
  const j = await res.json();
  console.log(`${p.nom} : ${res.ok && j.data?.archived ? 'archivé' : `ÉCHEC ${res.status} ${JSON.stringify(j.errors)}`}`);
}
```

- [ ] **Step 2 : sur l'ordre de Ludo seulement**

Run: `cd $MIG && node archiver.mjs --confirme`
Expected: « archivé » pour les douze projets.

- [ ] **Step 3 : rappeler à Ludo de révoquer `ASANA_PAT`** dans la console développeur d'Asana, puis retirer la ligne de `.dev.vars`.
