/*
  # Système Complet des ENUMs de Statut - Toutes les Phases

  ## Vue d'ensemble
  Cette migration crée tous les enums de statut pour l'ensemble du workflow
  de Gold Shipper, en suivant rigoureusement le tableau de workflow fourni.

  ## ENUMs créés:
  1. production_status_v2: prepared, ready_for_customs, cancelled
  2. shipping_preparation_status: ready_for_customs, approved_by_customs, ready_for_expedition
  3. freight_customs_status: ready_for_expedition, shipped_to_refinery
  4. refinery_status: shipped_to_refinery, refined
  5. inventory_status: in_inventory
  6. sale_status: for_sale, sold, paid

  ## Workflow complet:
  Production → Shipping Préparation → Freight & Customs → Refinery → Inventory → Sale

  ## Notes importantes:
  - "shipped" est SUPPRIMÉ de production_status_v2
  - Chaque phase a son propre enum distinct
  - Les transitions entre phases sont gérées par les statuts correspondants
*/

-- =====================================================
-- ÉTAPE 1: Nettoyage complet
-- =====================================================

-- Supprimer tous les triggers et fonctions dépendantes
DROP TRIGGER IF EXISTS production_status_change_trigger ON daily_production CASCADE;
DROP TRIGGER IF EXISTS shipping_status_change_trigger ON shipping_preparations CASCADE;
DROP TRIGGER IF EXISTS freight_status_change_trigger ON freight_customs CASCADE;

DROP FUNCTION IF EXISTS log_production_status_change() CASCADE;
DROP FUNCTION IF EXISTS log_shipping_status_change() CASCADE;
DROP FUNCTION IF EXISTS log_freight_status_change() CASCADE;

DO $$
BEGIN
  RAISE NOTICE '✅ Nettoyage: Tous les triggers et fonctions supprimés';
END $$;

-- =====================================================
-- ÉTAPE 2: Créer tous les ENUMs
-- =====================================================

-- 1. PRODUCTION STATUS (Phase: Production)
DO $$
BEGIN
  DROP TYPE IF EXISTS production_status_v2 CASCADE;

  CREATE TYPE production_status_v2 AS ENUM (
    'prepared',           -- Préparé
    'ready_for_customs',  -- Prêt pour la douane
    'cancelled'           -- Annulé
  );

  RAISE NOTICE '✅ 1/6 Enum production_status_v2 créé: prepared, ready_for_customs, cancelled';
END $$;

-- 2. SHIPPING PREPARATION STATUS (Phase: Shipping Préparation)
DO $$
BEGIN
  DROP TYPE IF EXISTS shipping_preparation_status CASCADE;

  CREATE TYPE shipping_preparation_status AS ENUM (
    'ready_for_customs',      -- Prêt pour la douane
    'approved_by_customs',    -- Approuvé par la douane
    'ready_for_expedition'    -- Prêt pour Expédition
  );

  RAISE NOTICE '✅ 2/6 Enum shipping_preparation_status créé: ready_for_customs, approved_by_customs, ready_for_expedition';
END $$;

-- 3. FREIGHT & CUSTOMS STATUS (Phase: Freight & Customs)
DO $$
BEGIN
  DROP TYPE IF EXISTS freight_customs_status CASCADE;

  CREATE TYPE freight_customs_status AS ENUM (
    'ready_for_expedition',   -- Prêt pour Expédition
    'shipped_to_refinery'     -- Expédié à la raffinerie
  );

  RAISE NOTICE '✅ 3/6 Enum freight_customs_status créé: ready_for_expedition, shipped_to_refinery';
END $$;

-- 4. REFINERY STATUS (Phase: Refinery)
DO $$
BEGIN
  DROP TYPE IF EXISTS refinery_status CASCADE;

  CREATE TYPE refinery_status AS ENUM (
    'shipped_to_refinery',    -- Expédié à la raffinerie
    'refined'                 -- Raffinée
  );

  RAISE NOTICE '✅ 4/6 Enum refinery_status créé: shipped_to_refinery, refined';
END $$;

-- 5. INVENTORY STATUS (Phase: Inventory)
DO $$
BEGIN
  DROP TYPE IF EXISTS inventory_status CASCADE;

  CREATE TYPE inventory_status AS ENUM (
    'in_inventory'            -- En inventaire
  );

  RAISE NOTICE '✅ 5/6 Enum inventory_status créé: in_inventory';
END $$;

-- 6. SALE STATUS (Phase: Sale)
DO $$
BEGIN
  DROP TYPE IF EXISTS sale_status CASCADE;

  CREATE TYPE sale_status AS ENUM (
    'for_sale',               -- En vente
    'sold',                   -- Vendu
    'paid'                    -- Payé
  );

  RAISE NOTICE '✅ 6/6 Enum sale_status créé: for_sale, sold, paid';
END $$;

-- =====================================================
-- ÉTAPE 3: Appliquer les ENUMs aux tables existantes
-- =====================================================

-- 3.1 TABLE: daily_production (Production phase)
DO $$
BEGIN
  ALTER TABLE daily_production
    DROP COLUMN IF EXISTS status CASCADE;

  ALTER TABLE daily_production
    ADD COLUMN status production_status_v2 DEFAULT 'prepared' NOT NULL;

  RAISE NOTICE '✅ daily_production.status → production_status_v2 (prepared, ready_for_customs, cancelled)';
END $$;

-- 3.2 TABLE: shipping_preparations (Shipping Préparation phase)
DO $$
BEGIN
  -- Vérifier si la table existe
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'shipping_preparations') THEN
    ALTER TABLE shipping_preparations
      DROP COLUMN IF EXISTS status CASCADE;

    ALTER TABLE shipping_preparations
      ADD COLUMN status shipping_preparation_status DEFAULT 'ready_for_customs' NOT NULL;

    RAISE NOTICE '✅ shipping_preparations.status → shipping_preparation_status (ready_for_customs, approved_by_customs, ready_for_expedition)';
  ELSE
    RAISE NOTICE '⚠️  Table shipping_preparations n''existe pas encore';
  END IF;
END $$;

-- 3.3 TABLE: freight_customs (Freight & Customs phase)
DO $$
BEGIN
  -- Vérifier si la table existe
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'freight_customs') THEN
    ALTER TABLE freight_customs
      DROP COLUMN IF EXISTS status CASCADE;

    ALTER TABLE freight_customs
      ADD COLUMN status freight_customs_status DEFAULT 'ready_for_expedition' NOT NULL;

    RAISE NOTICE '✅ freight_customs.status → freight_customs_status (ready_for_expedition, shipped_to_refinery)';
  ELSE
    RAISE NOTICE '⚠️  Table freight_customs n''existe pas encore';
  END IF;
END $$;

-- 3.4 TABLE: refinery_batches (Refinery phase)
DO $$
BEGIN
  -- Vérifier si la table existe
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'refinery_batches') THEN
    ALTER TABLE refinery_batches
      DROP COLUMN IF EXISTS status CASCADE;

    ALTER TABLE refinery_batches
      ADD COLUMN status refinery_status DEFAULT 'shipped_to_refinery' NOT NULL;

    RAISE NOTICE '✅ refinery_batches.status → refinery_status (shipped_to_refinery, refined)';
  ELSE
    RAISE NOTICE '⚠️  Table refinery_batches n''existe pas encore';
  END IF;
END $$;

-- 3.5 TABLE: inventory (Inventory phase)
DO $$
BEGIN
  -- Vérifier si la table existe
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'inventory') THEN
    ALTER TABLE inventory
      DROP COLUMN IF EXISTS status CASCADE;

    ALTER TABLE inventory
      ADD COLUMN status inventory_status DEFAULT 'in_inventory' NOT NULL;

    RAISE NOTICE '✅ inventory.status → inventory_status (in_inventory)';
  ELSE
    RAISE NOTICE '⚠️  Table inventory n''existe pas encore';
  END IF;
END $$;

-- 3.6 TABLE: sales (Sale phase)
DO $$
BEGIN
  -- Vérifier si la table existe
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sales') THEN
    ALTER TABLE sales
      DROP COLUMN IF EXISTS status CASCADE;

    ALTER TABLE sales
      ADD COLUMN status sale_status DEFAULT 'for_sale' NOT NULL;

    RAISE NOTICE '✅ sales.status → sale_status (for_sale, sold, paid)';
  ELSE
    RAISE NOTICE '⚠️  Table sales n''existe pas encore';
  END IF;
END $$;

-- =====================================================
-- ÉTAPE 4: Recréer les triggers de logging
-- =====================================================

-- 4.1 Trigger pour daily_production
CREATE OR REPLACE FUNCTION log_production_status_change()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER production_status_change_trigger
  AFTER INSERT OR UPDATE ON daily_production
  FOR EACH ROW
  EXECUTE FUNCTION log_production_status_change();

DO $$
BEGIN
  RAISE NOTICE '✅ Trigger production_status_change_trigger recréé';
END $$;

-- =====================================================
-- ÉTAPE 5: Créer les indexes pour les performances
-- =====================================================

-- Index pour daily_production
CREATE INDEX IF NOT EXISTS idx_daily_production_status_v3
  ON daily_production(status);

CREATE INDEX IF NOT EXISTS idx_daily_production_ready_customs
  ON daily_production(status)
  WHERE status = 'ready_for_customs';

CREATE INDEX IF NOT EXISTS idx_daily_production_company_status
  ON daily_production(mining_company_id, status);

-- Index pour shipping_preparations (si existe)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'shipping_preparations') THEN
    CREATE INDEX IF NOT EXISTS idx_shipping_preparations_status
      ON shipping_preparations(status);
    RAISE NOTICE '✅ Index créés pour shipping_preparations';
  END IF;
END $$;

-- Index pour freight_customs (si existe)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'freight_customs') THEN
    CREATE INDEX IF NOT EXISTS idx_freight_customs_status
      ON freight_customs(status);
    RAISE NOTICE '✅ Index créés pour freight_customs';
  END IF;
END $$;

-- =====================================================
-- ÉTAPE 6: Ajouter les commentaires
-- =====================================================

COMMENT ON TYPE production_status_v2 IS 'Statuts de production: prepared → ready_for_customs. Cancelled pour annulation.';
COMMENT ON TYPE shipping_preparation_status IS 'Statuts de préparation d''expédition: ready_for_customs → approved_by_customs → ready_for_expedition.';
COMMENT ON TYPE freight_customs_status IS 'Statuts de fret et douane: ready_for_expedition → shipped_to_refinery.';
COMMENT ON TYPE refinery_status IS 'Statuts de raffinerie: shipped_to_refinery → refined.';
COMMENT ON TYPE inventory_status IS 'Statuts d''inventaire: in_inventory (stock disponible).';
COMMENT ON TYPE sale_status IS 'Statuts de vente: for_sale → sold → paid.';

COMMENT ON COLUMN daily_production.status IS 'Workflow Production: prepared → ready_for_customs. Le statut ready_for_customs indique que la production est validée et prête pour inclusion dans une expédition.';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shipping_preparations' AND column_name = 'status') THEN
    COMMENT ON COLUMN shipping_preparations.status IS 'Workflow Shipping: ready_for_customs → approved_by_customs → ready_for_expedition.';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'freight_customs' AND column_name = 'status') THEN
    COMMENT ON COLUMN freight_customs.status IS 'Workflow Freight: ready_for_expedition → shipped_to_refinery.';
  END IF;
END $$;

-- =====================================================
-- ÉTAPE 7: Vérification finale complète
-- =====================================================
DO $$
DECLARE
  v_enum_record RECORD;
  v_production_count integer;
  v_ready_customs_count integer;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE '✅ MIGRATION COMPLÈTE - SYSTÈME D''ENUMS TERMINÉ';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE '';

  -- Afficher tous les enums créés
  RAISE NOTICE '📋 ENUMS CRÉÉS:';
  RAISE NOTICE '';

  FOR v_enum_record IN
    SELECT
      t.typname as enum_name,
      string_agg(e.enumlabel::text, ', ' ORDER BY e.enumsortorder) as values
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname IN (
      'production_status_v2',
      'shipping_preparation_status',
      'freight_customs_status',
      'refinery_status',
      'inventory_status',
      'sale_status'
    )
    GROUP BY t.typname
    ORDER BY t.typname
  LOOP
    RAISE NOTICE '  • %: %', v_enum_record.enum_name, v_enum_record.values;
  END LOOP;

  -- Statistiques sur daily_production
  SELECT COUNT(*) INTO v_production_count FROM daily_production;
  SELECT COUNT(*) INTO v_ready_customs_count
  FROM daily_production WHERE status = 'ready_for_customs';

  RAISE NOTICE '';
  RAISE NOTICE '📊 STATISTIQUES daily_production:';
  RAISE NOTICE '  - Total productions: %', v_production_count;
  RAISE NOTICE '  - Ready for customs: %', v_ready_customs_count;
  RAISE NOTICE '  - Prepared: %', v_production_count - v_ready_customs_count;

  RAISE NOTICE '';
  RAISE NOTICE '🎯 WORKFLOW COMPLET:';
  RAISE NOTICE '  Production → Shipping Préparation → Freight & Customs → Refinery → Inventory → Sale';
  RAISE NOTICE '';
  RAISE NOTICE '✅ Migration terminée avec succès!';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
END $$;
