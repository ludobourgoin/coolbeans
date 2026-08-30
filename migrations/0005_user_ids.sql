-- Renommage des colonnes d'identifiant utilisateur (spec 2026-08-19 §5.2).
--
-- Ces colonnes portaient des identifiants Clerk. Depuis la bascule Better
-- Auth, le nom ne dit plus la verite : un identifiant y vit toujours, mais il
-- vient d'ailleurs. Le nom neutre survivra au prochain changement de brique
-- d'authentification.
--
-- Le plan prevoyait ici un remap Clerk -> Better Auth de l'identifiant de
-- Ludo. Il est sans objet : au 2026-08-30, `tickets` et `pending_publications`
-- sont vides en production comme en staging. Rien a remapper, donc rien qui
-- puisse se remapper de travers.
--
-- La colonne `destinataire_clerk_id` vit dans `pending_ouvertures`, pas dans
-- `pending_publications` : le plan nommait la mauvaise table, et l'ALTER
-- echouait en annulant le premier au passage.
ALTER TABLE tickets RENAME COLUMN author_clerk_id TO author_user_id;
ALTER TABLE pending_ouvertures RENAME COLUMN destinataire_clerk_id TO destinataire_user_id;
