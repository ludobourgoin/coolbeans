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
}): Promise<SupportTicket> {
  const { apiKey, teamId, title, description } = options;
  const stateId = await triageStateId(apiKey, teamId);

  const data = await graphql<{
    issueCreate: { success: boolean; issue: { identifier: string; url: string } | null };
  }>(
    apiKey,
    `mutation CreateSupportTicket($input: IssueCreateInput!) {
      issueCreate(input: $input) { success issue { identifier url } }
    }`,
    { input: { teamId, title, description, ...(stateId ? { stateId } : {}) } },
  );
  const issue = data.issueCreate.issue;
  if (!data.issueCreate.success || !issue) {
    throw new Error("Linear : issueCreate a échoué sans erreur GraphQL.");
  }
  return issue;
}
