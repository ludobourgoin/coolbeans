// Client GraphQL Linear, partagé par les modules du portail.
//
// Extrait de linear.ts (spec 2026-09-01) : ce fichier ne parle que de support
// et de messagerie, et le module CRM avait besoin du même transport. Plutôt
// que d'exporter une fonction privée depuis un module au sujet différent, le
// transport vit seul.

const LINEAR_GRAPHQL = "https://api.linear.app/graphql";

interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message: string }>;
}

export async function graphql<T>(
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
