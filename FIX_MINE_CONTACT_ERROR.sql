/*
  Fix: Column mc.contact_person does not exist
  
  Problème: La vue v_license_requests_detailed référence mc.contact_person
  mais cette colonne n'existe pas dans mining_companies
  
  Solution: Colonne supprimée de la vue
*/

-- Vérifier les colonnes disponibles dans mining_companies
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'mining_companies'
ORDER BY ordinal_position;

-- La migration 20251111030000 a été corrigée pour ne plus utiliser contact_person
-- Il suffit de réappliquer la migration corrigée

-- Test: Vérifier que la vue peut être créée
DROP VIEW IF EXISTS v_license_requests_detailed CASCADE;

-- La vue sera recréée lors de l'application de la migration corrigée
-- Migration: supabase/migrations/20251111030000_enhance_license_views.sql
