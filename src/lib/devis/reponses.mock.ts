import type { D1Like, ReponseDevis } from "./reponses";

/* Mock D1 mémoire minimal : ne comprend que les requêtes du module, reconnues
   à leur préfixe. Même esprit que le mock KV de ../chiffrage/store.test.ts. */
export class D1Mock implements D1Like {
  rows: ReponseDevis[] = [];
  private prochainId = 1;
  private horloge = 0;

  prepare(sql: string) {
    const estInsert = /^\s*INSERT/i.test(sql);
    const estUpdate = /^\s*UPDATE/i.test(sql);
    const cibleTache = /linear_task_id IS NOT NULL/.test(sql);
    const cibleDerniere = /ORDER BY id DESC/.test(sql);

    const all = async <T>(args: unknown[] = []) => {
      if (estInsert || estUpdate) throw new Error(`SELECT attendu, reçu : ${sql}`);
      if (cibleTache) {
        const trouve = this.rows.find((r) => r.slug === args[0] && r.linearTaskId);
        return { results: (trouve ? [{ linearTaskId: trouve.linearTaskId }] : []) as T[] };
      }
      if (cibleDerniere) {
        const duSlug = this.rows.filter((r) => r.slug === args[0]);
        const derniere = duSlug.at(-1);
        return { results: (derniere ? [derniere] : []) as T[] };
      }
      /* Mime le GROUP BY slug + MAX(id) du vrai SQL : une ligne par slug,
         celle du plus grand id, triées par date décroissante. */
      const parSlug = new Map<string, ReponseDevis>();
      for (const r of this.rows) {
        const actuel = parSlug.get(r.slug);
        if (!actuel || r.id > actuel.id) parSlug.set(r.slug, r);
      }
      const tri = [...parSlug.values()].sort(
        (a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id,
      );
      return { results: tri as T[] };
    };

    return {
      all: <T>() => all<T>(),
      bind: (...values: unknown[]) => ({
        all: <T>() => all<T>(values),
        run: async () => {
          if (estUpdate) {
            const [taskId, id] = values as [string, number];
            const ligne = this.rows.find((r) => r.id === id);
            if (ligne) ligne.linearTaskId = taskId;
            return {};
          }
          if (!estInsert) throw new Error(`INSERT attendu, reçu : ${sql}`);
          const [slug, decision, message, prenom, nom, email, raisonSociale, siren, adresse, tva] =
            values as [
              string,
              "validation" | "question",
              string | null,
              string,
              string,
              string,
              string | null,
              string | null,
              string | null,
              string | null,
            ];
          this.rows.push({
            id: this.prochainId++,
            slug,
            decision,
            message,
            prenom,
            nom,
            email,
            raisonSociale,
            siren,
            adresse,
            tva,
            linearTaskId: null,
            createdAt: new Date(1_000_000 * this.horloge++).toISOString(),
          });
          return {};
        },
      }),
    };
  }
}
