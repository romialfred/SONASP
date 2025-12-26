-- ============================================================================
-- FIX: Ajouter la colonne 'pays' manquante à snp_artisans_miniers
-- ============================================================================
-- À exécuter dans le SQL Editor de Supabase Dashboard AVANT d'insérer les données
-- ============================================================================

-- Vérifier si la colonne existe déjà, sinon l'ajouter
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'snp_artisans_miniers'
    AND column_name = 'pays'
  ) THEN
    -- Ajouter la colonne pays
    ALTER TABLE snp_artisans_miniers
    ADD COLUMN pays text DEFAULT 'Burkina Faso' CHECK (pays IN ('Burkina Faso', 'Mali', 'Niger'));

    RAISE NOTICE 'Colonne "pays" ajoutée avec succès';
  ELSE
    RAISE NOTICE 'Colonne "pays" existe déjà';
  END IF;
END $$;

-- Mettre à jour les enregistrements existants qui n'ont pas de pays
UPDATE snp_artisans_miniers
SET pays = 'Burkina Faso'
WHERE pays IS NULL;

-- Vérification
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'snp_artisans_miniers'
  AND column_name = 'pays';
