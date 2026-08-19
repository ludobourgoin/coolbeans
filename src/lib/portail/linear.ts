// Création des tickets support dans Linear (COO-30).
//
// Deux appels GraphQL par soumission : un pour trouver l'état Triage de la
// team, un pour créer l'issue. La spec migration Linear (§2) veut que les
// demandes client atterrissent en Triage — c'est la boîte de réception de la
// team — plutôt que directement au Backlog. Si la team n'a pas activé la
// Triage, on laisse Linear choisir son état par défaut : le ticket existe,
// c'est l'essentiel.

const LINEAR_GRAPHQL = "https://api.linear.app/graphql";

export interface SupportTicket {
  /** UUID interne de l'issue — sert de clé pour les commentaires/statuts. */
  issueId: string;
  /** Identifiant lisible, ex. « AMU-12 ». */
  identifier: string;
  /** URL du ticket dans Linear, pour l'email de notification. */
  url: string;
}

interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message: string }>;
}

async function graphql<T>(
  apiKey: string,
  query: string,
  variables: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(LINEAR_GRAPHQL, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: apiKey },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`Linear ${res.status}`);
  const payload = (await res.json()) as GraphQLResponse<T>;
  if (payload.errors?.length || !payload.data) {
    throw new Error(`Linear : ${payload.errors?.[0]?.message ?? "réponse sans data"}`);
  }
  return payload.data;
}

/** L'état Triage de la team, ou null si elle ne l'a pas activée. */
async function triageStateId(apiKey: string, teamId: string): Promise<string | null> {
  const data = await graphql<{
    team: { triageEnabled: boolean; states: { nodes: Array<{ id: string; type: string }> } };
  }>(
    apiKey,
    `query TeamTriage($teamId: String!) {
      team(id: $teamId) { triageEnabled states { nodes { id type } } }
    }`,
    { teamId },
  );
  if (!data.team.triageEnabled) return null;
  return data.team.states.nodes.find((s) => s.type === "triage")?.id ?? null;
}

export async function createSupportTicket(options: {
  apiKey: string;
  teamId: string;
  title: string;
  /** Markdown : corps de la demande + email du client + date. */
  description: string;
  /** Auto-assignation (Ludo) — spec messagerie §5. */
  assigneeId?: string;
  /** Priorité Linear 1-4 issue du champ urgence. */
  priority?: number;
}): Promise<SupportTicket> {
  const { apiKey, teamId, title, description } = options;
  const stateId = await triageStateId(apiKey, teamId);

  const data = await graphql<{
    issueCreate: {
      success: boolean;
      issue: { id: string; identifier: string; url: string } | null;
    };
  }>(
    apiKey,
    `mutation CreateSupportTicket($input: IssueCreateInput!) {
      issueCreate(input: $input) { success issue { id identifier url } }
    }`,
    {
      input: {
        teamId,
        title,
        description,
        ...(stateId ? { stateId } : {}),
        labelIds: [SUPPORT_LABEL_ID],
        ...(options.assigneeId ? { assigneeId: options.assigneeId } : {}),
        // priority=0 (« Aucune ») est intentionnellement omis ici : la spec
        // interdit cette valeur en entrée, ce n'est pas un oubli à corriger
        // en `!== undefined`.
        ...(options.priority ? { priority: options.priority } : {}),
      },
    },
  );
  const issue = data.issueCreate.issue;
  if (!data.issueCreate.success || !issue) {
    throw new Error("Linear : issueCreate a échoué sans erreur GraphQL.");
  }
  return { issueId: issue.id, identifier: issue.identifier, url: issue.url };
}

/** UUID Linear de Ludo (workspace coolbeans-hq) — auto-assignation des tickets. */
export const LUDO_LINEAR_USER_ID = "a0b540c7-877f-484b-84cf-b768b457ef36";

/**
 * Label workspace « Support » : c'est lui qui marque un ticket de messagerie,
 * et non plus un projet « Support » par team (migration du 2026-08-19).
 *
 * Un label workspace vaut pour toutes les teams, donc plus rien à mapper par
 * client : la team seule dit de quel client il s'agit. Les anciens projets
 * imposaient un UUID par fiche client, oubliable à l'onboarding, et
 * apparaissaient comme des projets sans fin dans toutes les vues.
 */
export const SUPPORT_LABEL_ID = "bceb2670-4be0-4a1c-94e9-fff822073dd3";

/** Réponse d'un client depuis le portail → commentaire sur l'issue. */
export async function createComment(options: {
  apiKey: string;
  issueId: string;
  body: string;
}): Promise<{ id: string }> {
  const data = await graphql<{
    commentCreate: { success: boolean; comment: { id: string } | null };
  }>(
    options.apiKey,
    `mutation CreateComment($input: CommentCreateInput!) {
      commentCreate(input: $input) { success comment { id } }
    }`,
    { input: { issueId: options.issueId, body: options.body } },
  );
  if (!data.commentCreate.success || !data.commentCreate.comment) {
    throw new Error("Linear : commentCreate a échoué sans erreur GraphQL.");
  }
  return data.commentCreate.comment;
}

/**
 * Contenu ACTUEL d'un commentaire — appelé par le cron à la fin du délai de
 * grâce : c'est ce re-fetch qui fait qu'une édition corrige l'envoi et
 * qu'une suppression l'annule (spec §7). null = commentaire disparu.
 */
export async function fetchComment(
  apiKey: string,
  commentId: string,
): Promise<{ body: string; issueId: string } | null> {
  try {
    const data = await graphql<{ comment: { body: string; issue: { id: string } } | null }>(
      apiKey,
      `query Comment($id: String!) { comment(id: $id) { body issue { id } } }`,
      { id: commentId },
    );
    if (!data.comment) return null;
    return { body: data.comment.body, issueId: data.comment.issue.id };
  } catch (err) {
    // L'API Linear répond par une erreur "entity not found" plutôt que par
    // null quand le commentaire est supprimé : on traite ce cas précis comme
    // une annulation délibérée. Toute autre erreur (réseau, 429, 401...) est
    // une panne, pas une suppression : on la relance pour que le cron
    // réessaie au tick suivant, plutôt que d'annuler à tort une publication
    // légitime.
    //
    // Libellé vérifié en direct (sonde jetable, 2026-08-15) : supprimer un
    // commentaire puis le re-requêter renvoie l'erreur GraphQL exacte
    // "Entity not found: Comment" (pas de data.comment === null sans erreur).
    // Une fois enveloppée par graphql() ci-dessus ("Linear : <message>"),
    // /not found/i la matche déjà — aucun ajustement de motif nécessaire.
    if (err instanceof Error && /not found/i.test(err.message)) return null;
    throw err;
  }
}

/**
 * Issue relue au moment d'ouvrir un fil : c'est le re-fetch qui décide, jamais
 * le payload du webhook. Entre la pose du label et la fin du délai de grâce,
 * Ludo peut avoir retiré le « >> », retiré le label, ou supprimé l'issue —
 * chacun de ces gestes doit annuler l'ouverture, et seule la version courante
 * les rend visibles.
 *
 * Retourne null si l'issue n'existe plus, comme fetchComment (même traitement
 * du « not found » de l'API Linear, cf. le commentaire ci-dessus).
 */
export async function fetchIssue(
  apiKey: string,
  issueId: string,
): Promise<{ title: string; description: string | null; url: string; labelIds: string[] } | null> {
  try {
    const data = await graphql<{
      issue: {
        title: string;
        description: string | null;
        url: string;
        labels: { nodes: Array<{ id: string }> };
      } | null;
    }>(
      apiKey,
      `query Issue($id: String!) {
        issue(id: $id) { title description url labels { nodes { id } } }
      }`,
      { id: issueId },
    );
    if (!data.issue) return null;
    return {
      title: data.issue.title,
      description: data.issue.description,
      url: data.issue.url,
      labelIds: data.issue.labels.nodes.map((l) => l.id),
    };
  } catch (err) {
    if (err instanceof Error && /not found/i.test(err.message)) return null;
    throw err;
  }
}

/**
 * statusType des issues du board, archivées comprises (une issue auto-archivée
 * reste « Traité », spec §9). Un UUID absent de la Map = issue introuvable
 * (supprimée) → statut « — » côté client.
 */
export async function fetchIssueStateTypes(
  apiKey: string,
  uuids: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (uuids.length === 0) return map;
  const data = await graphql<{
    issues: { nodes: Array<{ id: string; state: { type: string } }> };
  }>(
    apiKey,
    // first: 250 : Linear tronque à 50 nœuds par défaut. Le board n'a pas
    // encore assez de tickets pour dépasser 250 non plus, mais au-delà il
    // faudra découper par lots avec la pagination (curseur `after`) déjà
    // utilisée côté board — follow-up, pas géré ici.
    `query IssueStates($ids: [ID!]!) {
      issues(filter: { id: { in: $ids } }, includeArchived: true, first: 250) {
        nodes { id state { type } }
      }
    }`,
    { ids: uuids },
  );
  for (const node of data.issues.nodes) map.set(node.id, node.state.type);
  return map;
}
