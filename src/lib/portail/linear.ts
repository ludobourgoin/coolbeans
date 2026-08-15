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
  /** Projet « Support » de la team (spec messagerie §5). */
  projectId?: string;
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
        ...(options.projectId ? { projectId: options.projectId } : {}),
        ...(options.assigneeId ? { assigneeId: options.assigneeId } : {}),
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
  } catch {
    // L'API Linear répond par une erreur "entity not found" plutôt que par
    // null quand le commentaire est supprimé : même signification pour nous.
    return null;
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
    `query IssueStates($ids: [ID!]!) {
      issues(filter: { id: { in: $ids } }, includeArchived: true) {
        nodes { id state { type } }
      }
    }`,
    { ids: uuids },
  );
  for (const node of data.issues.nodes) map.set(node.id, node.state.type);
  return map;
}
