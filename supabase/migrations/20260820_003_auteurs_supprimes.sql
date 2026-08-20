-- ============================================================================
-- Un compte supprimé ne doit plus geler les lignes qu'il a créées
--
-- Les dix déclarations de `daily_production` référençaient un compte
-- `auth.users` qui n'existe plus. La contrainte étant en NO ACTION, PostgreSQL
-- revalide la clé à **chaque** mise à jour : toute modification d'une
-- déclaration — changement de statut compris — échouait avec
-- « violates foreign key constraint daily_production_created_by_fkey ».
-- La production était donc figée, sans que rien à l'écran ne l'explique.
--
-- Deux corrections :
--   1. Les références orphelines passent à NULL : l'auteur est inconnu, et
--      l'écran le dit désormais (« Auteur inconnu ») plutôt que d'attribuer la
--      ligne au système.
--   2. Les clés passent en ON DELETE SET NULL, pour que la suppression d'un
--      compte n'immobilise plus les écritures qu'il a faites.
--
-- Retour arrière : rétablir NO ACTION sur chacune des cinq contraintes. Les
-- auteurs effacés ne sont pas récupérables — ils ne l'étaient déjà plus.
-- ============================================================================

UPDATE daily_production dp SET created_by = NULL
WHERE created_by IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = dp.created_by);

UPDATE freight_shipment_productions f SET added_by = NULL
WHERE added_by IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = f.added_by);

UPDATE production_documents d SET uploaded_by = NULL
WHERE uploaded_by IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = d.uploaded_by);

UPDATE production_forecasts p SET created_by = NULL
WHERE created_by IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.created_by);

UPDATE production_status_history h SET changed_by = NULL
WHERE changed_by IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = h.changed_by);

ALTER TABLE daily_production DROP CONSTRAINT daily_production_created_by_fkey;
ALTER TABLE daily_production ADD CONSTRAINT daily_production_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE freight_shipment_productions DROP CONSTRAINT freight_shipment_productions_added_by_fkey;
ALTER TABLE freight_shipment_productions ADD CONSTRAINT freight_shipment_productions_added_by_fkey
  FOREIGN KEY (added_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE production_documents DROP CONSTRAINT production_documents_uploaded_by_fkey;
ALTER TABLE production_documents ADD CONSTRAINT production_documents_uploaded_by_fkey
  FOREIGN KEY (uploaded_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE production_forecasts DROP CONSTRAINT production_forecasts_created_by_fkey;
ALTER TABLE production_forecasts ADD CONSTRAINT production_forecasts_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE production_status_history DROP CONSTRAINT production_status_history_changed_by_fkey;
ALTER TABLE production_status_history ADD CONSTRAINT production_status_history_changed_by_fkey
  FOREIGN KEY (changed_by) REFERENCES auth.users(id) ON DELETE SET NULL;
