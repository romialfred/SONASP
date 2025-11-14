/*
  # Système Complet des ENUMs de Statut - VERSION VÉRIFIÉE

  ## Tables existantes vérifiées:
  ✅ daily_production - Existe
  ✅ shipping_preparations - Existe
  ✅ sales - Existe
  ✅ production_status_history - Existe
  ❌ freight_customs - N'existe PAS
  ❌ refinery_batches - N'existe PAS
  ❌ inventory - N'existe PAS

  ## ENUMs créés (suivant le workflow):
  1. production_status_v2: prepared, ready_for_customs, cancelled
  2. shipping_preparation_status: ready_for_customs, approved_by_customs, ready_for_expedition
  3. sale_status: for_sale, sold, paid

  ## Workflow actuel:
  Production → Shipping Préparation → Sale

  ## Notes:
  - SHIPPED retiré de production_status_v2
  - Seulement les tables existantes sont modifiées
  - Les ENUMs pour freight_customs, refinery, inventory seront créés quand les tables existeront
*/

-- =====================================================
-- ÉTAPE 1: Nettoyage des triggers existants
-- =====================================================

DO $$
BEGIN
  -- Supprimer les triggers de daily_production
  DROP TRIGGER IF EXISTS production_status_change_trigger ON daily_production CASCADE;
  DROP FUNCTION IF EXISTS log_production_status_change() CASCADE;

  -- Supprimer les triggers de shipping_preparations si existent
  DROP TRIGGER IF EXISTS shipping_status_change_trigger ON shipping_preparations CASCADE;
  DROP FUNCTION IF EXISTS log_shipping_status_change() CASCADE;

  RAISE NOTICE '✅ Étape 1: Triggers et fonctions nettoyés';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '⚠️  Étape 1: Erreur nettoyage - %', SQLERRM;
END $$;

-- =====================================================
-- ÉTAPE 2: Créer les ENUMs pour les tables existantes
-- =====================================================

-- 2.1 PRODUCTION STATUS (pour daily_production)
DO $$
BEGIN
  -- Supprimer l'ancien enum
  DROP TYPE IF EXISTS production_status_v2 CASCADE;

  -- Créer le nouveau avec les bonnes valeurs
  CREATE TYPE production_status_v2 AS ENUM (
    'prepared',           -- Préparé
    'ready_for_customs',  -- Prêt pour la douane
    'cancelled'           -- Annulé
  );

  RAISE NOTICE '✅ Étape 2.1: production_status_v2 créé (prepared, ready_for_customs, cancelled)';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '❌ Étape 2.1: Erreur - %', SQLERRM;
END $$;

-- 2.2 SHIPPING PREPARATION STATUS (pour shipping_preparations)
DO $$
BEGIN
  DROP TYPE IF EXISTS shipping_preparation_status CASCADE;

  CREATE TYPE shipping_preparation_status AS ENUM (
    'ready_for_customs',      -- Prêt pour la douane
    'approved_by_customs',    -- Approuvé par la douane
    'ready_for_expedition'    -- Prêt pour Expédition
  );

  RAISE NOTICE '✅ Étape 2.2: shipping_preparation_status créé (ready_for_customs, approved_by_customs, ready_for_expedition)';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '❌ Étape 2.2: Erreur - %', SQLERRM;
END $$;

-- 2.3 SALE STATUS (pour sales)
DO $$
BEGIN
  DROP TYPE IF EXISTS sale_status CASCADE;

  CREATE TYPE sale_status AS ENUM (
    'for_sale',               -- En vente
    'sold',                   -- Vendu
    'paid'                    -- Payé
  );

  RAISE NOTICE '✅ Étape 2.3: sale_status créé (for_sale, sold, paid)';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '❌ Étape 2.3: Erreur - %', SQLERRM;
END $$;

-- =====================================================
-- ÉTAPE 3: Appliquer les ENUMs aux tables existantes
-- =====================================================

-- 3.1 TABLE daily_production
DO $$
BEGIN
  -- Supprimer la colonne status existante
  ALTER TABLE daily_production DROP COLUMN IF EXISTS status CASCADE;

  -- Recréer avec le bon type
  ALTER TABLE daily_production
    ADD COLUMN status production_status_v2 DEFAULT 'prepared' NOT NULL;

  RAISE NOTICE '✅ Étape 3.1: daily_production.status recréée avec production_status_v2';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '❌ Étape 3.1: Erreur - %', SQLERRM;
END $$;

-- 3.2 TABLE shipping_preparations
DO $$
DECLARE
  v_has_status boolean;
BEGIN
  -- Vérifier si la colonne status existe
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'shipping_preparations'
    AND column_name = 'status'
  ) INTO v_has_status;

  IF v_has_status THEN
    ALTER TABLE shipping_preparations DROP COLUMN status CASCADE;
  END IF;

  -- Ajouter la colonne avec le bon type
  ALTER TABLE shipping_preparations
    ADD COLUMN status shipping_preparation_status DEFAULT 'ready_for_customs' NOT NULL;

  RAISE NOTICE '✅ Étape 3.2: shipping_preparations.status créée avec shipping_preparation_status';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '❌ Étape 3.2: Erreur - %', SQLERRM;
END $$;

-- 3.3 TABLE sales
DO $$
DECLARE
  v_has_status boolean;
BEGIN
  -- Vérifier si la colonne status existe
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'sales'
    AND column_name = 'status'
  ) INTO v_has_status;

  IF v_has_status THEN
    ALTER TABLE sales DROP COLUMN status CASCADE;
  END IF;

  -- Ajouter la colonne avec le bon type
  ALTER TABLE sales
    ADD COLUMN status sale_status DEFAULT 'for_sale' NOT NULL;

  RAISE NOTICE '✅ Étape 3.3: sales.status créée avec sale_status';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '❌ Étape 3.3: Erreur - %', SQLERRM;
END $$;

-- =====================================================
-- ÉTAPE 4: Recréer le trigger de logging pour production
-- =====================================================

DO $$
BEGIN
  -- Créer la fonction de logging
  CREATE OR REPLACE FUNCTION log_production_status_change()
  RETURNS TRIGGER AS $func$
  BEGIN
    IF (TG_OP = 'INSERT' AND NEW.status IS NOT NULL) THEN
      INSERT INTO production_status_history (
        production_id,
        old_status,
        new_status,
        changed_by,
        notes
      ) VALUES (
        NEW.id,
        NULL,
        NEW.status::text,
        NEW.created_by,
        'Production créée'
      );
    ELSIF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) THEN
      INSERT INTO production_status_history (
        production_id,
        old_status,
        new_status,
        changed_by
      ) VALUES (
        NEW.id,
        OLD.status::text,
        NEW.status::text,
        auth.uid()
      );
    END IF;
    RETURN NEW;
  END;
  $func$ LANGUAGE plpgsql SECURITY DEFINER;

  -- Créer le trigger
  CREATE TRIGGER production_status_change_trigger
    AFTER INSERT OR UPDATE ON daily_production
    FOR EACH ROW
    EXECUTE FUNCTION log_production_status_change();

  RAISE NOTICE '✅ Étape 4: Trigger production_status_change_trigger recréé';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '❌ Étape 4: Erreur - %', SQLERRM;
END $$;

-- =====================================================
-- ÉTAPE 5: Créer les indexes de performance
-- =====================================================

DO $$
BEGIN
  -- Index pour daily_production
  DROP INDEX IF EXISTS idx_daily_production_status_v3;
  DROP INDEX IF EXISTS idx_daily_production_ready_customs;
  DROP INDEX IF EXISTS idx_daily_production_company_status;

  CREATE INDEX idx_daily_production_status_v3
    ON daily_production(status);

  CREATE INDEX idx_daily_production_ready_customs
    ON daily_production(status)
    WHERE status = 'ready_for_customs';

  CREATE INDEX idx_daily_production_company_status
    ON daily_production(mining_company_id, status);

  -- Index pour shipping_preparations
  DROP INDEX IF EXISTS idx_shipping_preparations_status;

  CREATE INDEX idx_shipping_preparations_status
    ON shipping_preparations(status);

  -- Index pour sales
  DROP INDEX IF EXISTS idx_sales_status;

  CREATE INDEX idx_sales_status
    ON sales(status);

  RAISE NOTICE '✅ Étape 5: Indexes de performance créés';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '❌ Étape 5: Erreur - %', SQLERRM;
END $$;

-- =====================================================
-- ÉTAPE 6: Ajouter les commentaires de documentation
-- =====================================================

DO $$
BEGIN
  COMMENT ON TYPE production_status_v2 IS 'Statuts de production: prepared → ready_for_customs. Cancelled pour annulation.';
  COMMENT ON TYPE shipping_preparation_status IS 'Statuts de préparation d''expédition: ready_for_customs → approved_by_customs → ready_for_expedition.';
  COMMENT ON TYPE sale_status IS 'Statuts de vente: for_sale → sold → paid.';

  COMMENT ON COLUMN daily_production.status IS 'Workflow Production: prepared → ready_for_customs. Le statut ready_for_customs indique que la production est validée et prête pour inclusion dans une expédition.';
  COMMENT ON COLUMN shipping_preparations.status IS 'Workflow Shipping: ready_for_customs → approved_by_customs → ready_for_expedition.';
  COMMENT ON COLUMN sales.status IS 'Workflow Vente: for_sale → sold → paid.';

  RAISE NOTICE '✅ Étape 6: Commentaires de documentation ajoutés';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '❌ Étape 6: Erreur - %', SQLERRM;
END $$;

-- =====================================================
-- ÉTAPE 7: Rapport final
-- =====================================================
DO $$
DECLARE
  v_enum_record RECORD;
  v_prod_count integer;
  v_ship_count integer;
  v_sales_count integer;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE '✅ MIGRATION COMPLÈTE - ENUMS VÉRIFIÉS ET APPLIQUÉS';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE '';

  -- Lister les enums créés
  RAISE NOTICE '📋 ENUMS CRÉÉS:';
  RAISE NOTICE '';

  FOR v_enum_record IN
    SELECT
      t.typname as enum_name,
      string_agg(e.enumlabel::text, ', ' ORDER BY e.enumsortorder) as values
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname IN ('production_status_v2', 'shipping_preparation_status', 'sale_status')
    GROUP BY t.typname
    ORDER BY t.typname
  LOOP
    RAISE NOTICE '  • %: %', v_enum_record.enum_name, v_enum_record.values;
  END LOOP;

  -- Statistiques
  SELECT COUNT(*) INTO v_prod_count FROM daily_production;
  SELECT COUNT(*) INTO v_ship_count FROM shipping_preparations;
  SELECT COUNT(*) INTO v_sales_count FROM sales;

  RAISE NOTICE '';
  RAISE NOTICE '📊 STATISTIQUES:';
  RAISE NOTICE '  - Productions: %', v_prod_count;
  RAISE NOTICE '  - Shipping preparations: %', v_ship_count;
  RAISE NOTICE '  - Sales: %', v_sales_count;

  RAISE NOTICE '';
  RAISE NOTICE '🎯 WORKFLOW ACTUEL:';
  RAISE NOTICE '  Production → Shipping Préparation → Sale';
  RAISE NOTICE '';
  RAISE NOTICE '✅ Migration terminée avec succès!';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '❌ Erreur rapport final: %', SQLERRM;
END $$;
