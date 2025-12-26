-- ============================================================================
-- DIAGNOSTIC ET CORRECTION COMPLETE - ARTISANS MINIERS
-- ============================================================================
-- Exécutez ce script dans le SQL Editor de Supabase
-- ============================================================================

-- ETAPE 1: Vérifier l'existence de la table
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'SNP_artisans_miniers'
  ) THEN
    RAISE NOTICE 'Table SNP_artisans_miniers existe';
  ELSE
    RAISE NOTICE 'ERREUR: Table SNP_artisans_miniers n''existe pas!';
  END IF;
END $$;

-- ETAPE 2: Ajouter la colonne pays si manquante
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'SNP_artisans_miniers'
    AND column_name = 'pays'
  ) THEN
    ALTER TABLE "SNP_artisans_miniers"
    ADD COLUMN pays text DEFAULT 'Burkina Faso';

    RAISE NOTICE 'Colonne "pays" ajoutée avec succès';
  ELSE
    RAISE NOTICE 'Colonne "pays" existe déjà';
  END IF;
END $$;

-- ETAPE 3: Supprimer mining_company_id si elle existe (non nécessaire)
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'SNP_artisans_miniers'
    AND column_name = 'mining_company_id'
  ) THEN
    ALTER TABLE "SNP_artisans_miniers"
    DROP COLUMN IF EXISTS mining_company_id;

    RAISE NOTICE 'Colonne "mining_company_id" supprimée (non nécessaire)';
  ELSE
    RAISE NOTICE 'Colonne "mining_company_id" n''existe pas (correct)';
  END IF;
END $$;

-- ETAPE 4: Ajouter updated_by si manquante
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'SNP_artisans_miniers'
    AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE "SNP_artisans_miniers"
    ADD COLUMN updated_by uuid REFERENCES auth.users(id);

    RAISE NOTICE 'Colonne "updated_by" ajoutée';
  ELSE
    RAISE NOTICE 'Colonne "updated_by" existe déjà';
  END IF;
END $$;

-- ETAPE 5: Nettoyer les données existantes (si erreur précédente)
-- ============================================================================
DELETE FROM "SNP_artisans_miniers" WHERE pays IS NULL;

-- ETAPE 6: Afficher la structure actuelle
-- ============================================================================
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'SNP_artisans_miniers'
ORDER BY ordinal_position;

-- ETAPE 7: Compter les artisans existants
-- ============================================================================
SELECT COUNT(*) as artisans_existants FROM "SNP_artisans_miniers";

-- ETAPE 8: Vérifier les RLS policies
-- ============================================================================
SELECT
  schemaname,
  tablename,
  policyname,
  cmd,
  roles
FROM pg_policies
WHERE tablename = 'SNP_artisans_miniers';

-- ETAPE 9: Vérifier les triggers
-- ============================================================================
SELECT
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'SNP_artisans_miniers';
