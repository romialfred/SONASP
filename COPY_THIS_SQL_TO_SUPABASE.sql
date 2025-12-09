-- =====================================================
-- 🚨 MIGRATION CRITIQUE : CORRIGER AFFICHAGE RAFFINERIE & COMPAGNIE DE FRET
-- =====================================================
-- À EXÉCUTER DANS : Supabase Dashboard → SQL Editor
-- DURÉE : ~30 secondes
-- IMPACT : Les informations de raffinerie et compagnie de fret s'afficheront correctement
-- =====================================================

-- 1. AJOUTER refinery_id
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipping_preparations' 
    AND column_name = 'refinery_id'
  ) THEN
    ALTER TABLE shipping_preparations 
    ADD COLUMN refinery_id UUID REFERENCES refinery_plants(id) ON DELETE SET NULL;
    
    RAISE NOTICE '✅ Colonne refinery_id ajoutée';
    
    CREATE INDEX IF NOT EXISTS idx_shipping_preparations_refinery 
    ON shipping_preparations(refinery_id);
    
    RAISE NOTICE '✅ Index sur refinery_id créé';
  ELSE
    RAISE NOTICE 'ℹ️  Colonne refinery_id existe déjà';
  END IF;
END $$;

-- 2. AJOUTER freight_company_id
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipping_preparations' 
    AND column_name = 'freight_company_id'
  ) THEN
    ALTER TABLE shipping_preparations 
    ADD COLUMN freight_company_id UUID REFERENCES freight_companies(id) ON DELETE SET NULL;
    
    RAISE NOTICE '✅ Colonne freight_company_id ajoutée';
    
    CREATE INDEX IF NOT EXISTS idx_shipping_preparations_freight 
    ON shipping_preparations(freight_company_id);
    
    RAISE NOTICE '✅ Index sur freight_company_id créé';
  ELSE
    RAISE NOTICE 'ℹ️  Colonne freight_company_id existe déjà';
  END IF;
END $$;

-- 3. MIGRER LES DONNÉES EXISTANTES
DO $$
DECLARE
  v_migrated_refinery INT := 0;
  v_migrated_freight INT := 0;
BEGIN
  -- Migrer les UUIDs depuis shipped_to_address vers refinery_id
  UPDATE shipping_preparations sp
  SET refinery_id = shipped_to_address::uuid
  WHERE shipped_to_address IS NOT NULL
    AND shipped_to_address ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND refinery_id IS NULL
    AND EXISTS (SELECT 1 FROM refinery_plants WHERE id = shipped_to_address::uuid);
  
  GET DIAGNOSTICS v_migrated_refinery = ROW_COUNT;
  RAISE NOTICE '✅ % raffineries migrées depuis shipped_to_address', v_migrated_refinery;
  
  -- Migrer les UUIDs depuis shipped_to_company vers freight_company_id
  UPDATE shipping_preparations sp
  SET freight_company_id = shipped_to_company::uuid
  WHERE shipped_to_company IS NOT NULL
    AND shipped_to_company ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND freight_company_id IS NULL
    AND EXISTS (SELECT 1 FROM freight_companies WHERE id = shipped_to_company::uuid);
  
  GET DIAGNOSTICS v_migrated_freight = ROW_COUNT;
  RAISE NOTICE '✅ % compagnies de fret migrées depuis shipped_to_company', v_migrated_freight;

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '⚠️  Erreur lors de la migration des données: %', SQLERRM;
    RAISE NOTICE 'ℹ️  Les colonnes ont été créées mais la migration des données a échoué';
END $$;

-- 4. AJOUTER export_license_id SI MANQUANT
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipping_preparations' 
    AND column_name = 'export_license_id'
  ) THEN
    ALTER TABLE shipping_preparations 
    ADD COLUMN export_license_id UUID REFERENCES export_licenses(id) ON DELETE SET NULL;
    
    RAISE NOTICE '✅ Colonne export_license_id ajoutée';
    
    -- Migrer depuis license_id si elle existe
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'shipping_preparations' 
      AND column_name = 'license_id'
    ) THEN
      UPDATE shipping_preparations 
      SET export_license_id = license_id 
      WHERE license_id IS NOT NULL AND export_license_id IS NULL;
      
      RAISE NOTICE '✅ Données migrées depuis license_id vers export_license_id';
    END IF;
    
    CREATE INDEX IF NOT EXISTS idx_shipping_preparations_export_license 
    ON shipping_preparations(export_license_id);
    
    RAISE NOTICE '✅ Index sur export_license_id créé';
  ELSE
    RAISE NOTICE 'ℹ️  Colonne export_license_id existe déjà';
  END IF;
END $$;

-- 5. COMMENTAIRES DOCUMENTATION
COMMENT ON COLUMN shipping_preparations.refinery_id IS 
'UUID de la raffinerie de destination (refinery_plants.id)';

COMMENT ON COLUMN shipping_preparations.freight_company_id IS 
'UUID de la compagnie de fret (freight_companies.id)';

COMMENT ON COLUMN shipping_preparations.export_license_id IS 
'UUID de la licence d''exportation (export_licenses.id)';

-- 6. VÉRIFICATION FINALE
DO $$
DECLARE
  v_count_refinery INT;
  v_count_freight INT;
  v_count_license INT;
BEGIN
  SELECT COUNT(*) INTO v_count_refinery FROM shipping_preparations WHERE refinery_id IS NOT NULL;
  SELECT COUNT(*) INTO v_count_freight FROM shipping_preparations WHERE freight_company_id IS NOT NULL;
  SELECT COUNT(*) INTO v_count_license FROM shipping_preparations WHERE export_license_id IS NOT NULL;
  
  RAISE NOTICE '====================================';
  RAISE NOTICE '✅ MIGRATION TERMINÉE AVEC SUCCÈS';
  RAISE NOTICE '====================================';
  RAISE NOTICE 'Expéditions avec raffinerie: %', v_count_refinery;
  RAISE NOTICE 'Expéditions avec compagnie de fret: %', v_count_freight;
  RAISE NOTICE 'Expéditions avec licence d''export: %', v_count_license;
  RAISE NOTICE '====================================';
  RAISE NOTICE '🎯 Vous pouvez maintenant rafraîchir l''application';
  RAISE NOTICE '✅ Les informations s''afficheront correctement';
  RAISE NOTICE '====================================';
END $$;
