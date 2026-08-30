// Comptes du portail rattachés à un workspace, lus dans D1.
//
// Remplace les appels `clerkClient(...).users.getUserList()` laissés par la
// phase A de la migration Better Auth. L'appartenance d'un compte à un client
// n'est plus une clé de `publicMetadata` mais une ligne de `teamMember` : la
// jointure vit ici, et nulle part ailleurs — même règle que la traduction
// id → slug, confinée à src/lib/auth/session.ts.
//
// Le webhook Linear appelle ces fonctions hors de tout contexte Astro : elles
// prennent donc le binding D1 en argument plutôt que de le lire dans un
// `locals`.

/** Better Auth ne stocke qu'un `name` : pas de champ prénom séparé. */
export interface ComptePortail {
  id: string;
  nom: string;
  email: string;
  /** Premier mot de `nom`. Vide si le nom l'est — jamais `undefined`, les
      appelants l'injectent dans « Bonjour {prenom}, » et un `undefined`
      y écrirait le mot. */
  prenom: string;
}

interface LigneCompte {
  id: string;
  name: string | null;
  email: string;
}

/**
 * Prénom affichable à partir du `name` Better Auth.
 *
 * Exportée parce que la session (src/lib/auth/session.ts) rend le même `name`
 * brut : les pages qui saluent l'utilisateur connecté doivent le découper de
 * la même façon que celles qui listent les comptes d'un client, sinon le même
 * compte s'appelle « Marie » à un endroit et « Marie Dupont » à un autre.
 */
export function prenomDe(name: string | null | undefined): string {
  return (name ?? "").trim().split(/\s+/)[0] ?? "";
}

function toCompte(row: LigneCompte): ComptePortail {
  return {
    id: row.id,
    nom: row.name ?? "",
    email: row.email,
    prenom: prenomDe(row.name),
  };
}

const CHAMPS = `u.id AS id, u.name AS name, u.email AS email`;

/**
 * Tous les comptes rattachés au workspace `slug`, triés par nom.
 *
 * Rend une liste vide si le workspace n'existe pas ou n'a aucun membre : c'est
 * un état normal (client créé, comptes pas encore ouverts), pas une erreur.
 */
export async function comptesDuWorkspace(db: D1Database, slug: string): Promise<ComptePortail[]> {
  const { results } = await db
    .prepare(
      `SELECT ${CHAMPS}
         FROM teamMember tm
         JOIN team t ON t.id = tm.teamId
         JOIN "user" u ON u.id = tm.userId
        WHERE t.slug = ?1
        ORDER BY u.name`,
    )
    .bind(slug)
    .all<LigneCompte>();
  return (results ?? []).map(toCompte);
}

/**
 * Un compte précis, à condition qu'il appartienne au workspace `slug`.
 *
 * L'appartenance est DANS la requête, pas vérifiée après coup par l'appelant :
 * c'est le garde-fou du chemin admin « créer au nom d'un client ». Un id forgé
 * ou périmé pointant vers un compte d'un AUTRE client rend `null` ici, sans
 * qu'aucun appelant ait à y penser.
 */
export async function compteDuWorkspace(
  db: D1Database,
  userId: string,
  slug: string,
): Promise<ComptePortail | null> {
  const row = await db
    .prepare(
      `SELECT ${CHAMPS}
         FROM teamMember tm
         JOIN team t ON t.id = tm.teamId
         JOIN "user" u ON u.id = tm.userId
        WHERE t.slug = ?1 AND u.id = ?2`,
    )
    .bind(slug, userId)
    .first<LigneCompte>();
  return row ? toCompte(row) : null;
}
