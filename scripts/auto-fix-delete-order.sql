/*
  # Script Automatique: Analyse FK et Correction de l'Ordre

  Ce script:
  1. Analyse toutes les FK
  2. Identifie les dépendances
  3. Affiche l'ordre de suppression correct
*/

-- Table temporaire pour stocker les FK
CREATE TEMP TABLE IF NOT EXISTS fk_relations AS
SELECT
  tc.table_name as table_enfant,
  ccu.table_name AS table_parent
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public';

-- Afficher les FK par table parent
SELECT
  table_parent as "Table Parent (à supprimer EN DERNIER)",
  string_agg(DISTINCT table_enfant, ', ' ORDER BY table_enfant) as "Tables Enfants (à supprimer EN PREMIER)"
FROM fk_relations
WHERE table_parent IN (
  'daily_production', 'export_licenses', 'shipping_preparations',
  'inventory', 'sales', 'customers', 'mining_companies'
)
GROUP BY table_parent
ORDER BY table_parent;

-- Nettoyer
DROP TABLE IF EXISTS fk_relations;
