// Contraintes des pièces jointes (spec §4) et nommage des clés R2. Le nom
// d'origine du fichier ne sert JAMAIS de clé (traversée, collisions,
// caractères exotiques) : il est conservé en métadonnée D1 pour l'affichage.

export const MAX_FICHIERS = 3;
export const MAX_TAILLE = 10 * 1024 * 1024; // 10 Mo

export function validerFichiers(files: File[]): string | null {
  if (files.length > MAX_FICHIERS) {
    return `Au maximum ${MAX_FICHIERS} fichiers par message.`;
  }
  for (const f of files) {
    if (f.size > MAX_TAILLE) return `Chaque fichier doit faire moins de 10 Mo (« ${f.name} »).`;
  }
  return null;
}

export function cleR2(client: string, ticketId: string, filename: string): string {
  const ext = /\.([a-zA-Z0-9]+)$/.exec(filename)?.[1]?.toLowerCase() ?? "bin";
  return `messagerie/${client}/${ticketId}/${crypto.randomUUID()}.${ext}`;
}
