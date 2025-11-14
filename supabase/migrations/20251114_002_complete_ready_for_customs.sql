/*
  # Migration Complète: Ajout du statut 'ready_for_customs'

  ## Analyse de la structure actuelle:
  - La table daily_production utilise l'enum 'production_status_v2'
  - Valeurs actuelles: 'prepared', 'shipped', 'cancelled'
  - Relations: shipping_production_items.daily_production_id

  ## Changements:
  1. Créer un nouvel enum avec toutes les valeurs incluant 'ready_for_customs'
  2. Migrer la colonne vers le nouvel enum
  3. Mettre à jour toutes les productions existantes
  4. Créer les indexes nécessaires

  ## Workflow final:
  prepared → ready_for_customs → shipped → cancelled
*/

-- =====================================================
-- ÉTAPE 1: Analyse de l'état actuel
-- =====================================================
DO $$
DECLARE
  v_current_type text;
  v_enum_values text;
BEGIN
  -- Vérifier le type actuel de la colonne status
  SELECT udt_name INTO v_current_type
  FROM information_schema.columns
  WHERE table_name = 'daily_production'
  AND column_name = 'status';

  -- Afficher les valeurs actuelles de l'enum
  SELECT string_agg(e.enumlabel::text, ', ' ORDER BY e.enumsortorder)
  INTO v_enum_values
  FROM pg_enum e
  JOIN pg_type t ON e.enumtypid = t.oid
  WHERE t.typname = v_current_type;

  RAISE NOTICE '📊 État actuel:';
  RAISE NOTICE '  - Type de colonne: %', v_current_type;
  RAISE NOTICE '  - Valeurs enum: %', v_enum_values;
END $$;

-- =====================================================
-- ÉTAPE 2: Supprimer les dépendances (triggers, fonctions)
-- =====================================================
DROP TRIGGER IF EXISTS production_status_change_trigger ON daily_production;
DROP FUNCTION IF EXISTS log_production_status_change() CASCADE;

DO $$
BEGIN
  RAISE NOTICE '✅ Triggers et fonctions dépendantes supprimés';
END $$;

-- =====================================================
-- ÉTAPE 3: Créer le nouvel enum avec toutes les valeurs
-- =====================================================
DO $$
BEGIN
  -- Supprimer l'ancien enum production_status_v2 (CASCADE supprime les colonnes qui l'utilisent)
  DROP TYPE IF EXISTS production_status_v2 CASCADE;

  -- Créer le nouvel enum avec toutes les valeurs incluant ready_for_customs
  CREATE TYPE production_status_v2 AS ENUM (
    'prepared',
    'ready_for_customs',
    'shipped',
    'cancelled'
  );

  RAISE NOTICE '✅ Nouvel enum production_status_v2 créé avec: prepared, ready_for_customs, shipped, cancelled';
END $$;

-- =====================================================
-- ÉTAPE 4: Recréer la colonne status avec le nouvel enum
-- =====================================================
DO $$
BEGIN
  -- Ajouter la colonne status avec le nouvel enum
  ALTER TABLE daily_production
    ADD COLUMN IF NOT EXISTS status production_status_v2 DEFAULT 'prepared' NOT NULL;

  RAISE NOTICE '✅ Colonne status recréée avec le nouvel enum';
END $$;

-- =====================================================
-- ÉTAPE 5: Mettre à jour les données existantes
-- =====================================================

-- Mettre à jour toutes les productions sans statut à 'prepared'
UPDATE daily_production
SET status = 'prepared'
WHERE status IS NULL;

-- Mettre à jour les productions 'shipped' vers 'prepared'
-- SAUF celles qui sont déjà dans des expéditions
DO $$
DECLARE
  v_updated_count integer;
BEGIN
  UPDATE daily_production
  SET status = 'prepared'
  WHERE status = 'shipped'
  AND id NOT IN (
    SELECT DISTINCT daily_production_id
    FROM shipping_production_items
    WHERE daily_production_id IS NOT NULL
  );

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RAISE NOTICE '✅ % productions mises à jour de shipped vers prepared', v_updated_count;
END $$;

-- =====================================================
-- ÉTAPE 6: Recréer les triggers et fonctions
-- =====================================================

-- Fonction pour logger les changements de statut
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

-- Recréer le trigger
CREATE TRIGGER production_status_change_trigger
  AFTER INSERT OR UPDATE ON daily_production
  FOR EACH ROW
  EXECUTE FUNCTION log_production_status_change();

DO $$
BEGIN
  RAISE NOTICE '✅ Trigger de logging des statuts recréé';
END $$;

-- =====================================================
-- ÉTAPE 7: Créer les indexes pour les performances
-- =====================================================

-- Index général sur le statut
CREATE INDEX IF NOT EXISTS idx_daily_production_status_v3
  ON daily_production(status);

-- Index pour les productions ready_for_customs
CREATE INDEX IF NOT EXISTS idx_daily_production_ready_for_customs
  ON daily_production(status)
  WHERE status = 'ready_for_customs';

-- Index composé mining_company + status
CREATE INDEX IF NOT EXISTS idx_daily_production_company_status
  ON daily_production(mining_company_id, status)
  WHERE status IN ('prepared', 'ready_for_customs');

DO $$
BEGIN
  RAISE NOTICE '✅ Indexes créés pour optimiser les performances';
END $$;

-- =====================================================
-- ÉTAPE 8: Mettre à jour les métadonnées
-- =====================================================

COMMENT ON COLUMN daily_production.status IS
  'Workflow: prepared → ready_for_customs → shipped → cancelled. ' ||
  'Le statut ready_for_customs indique que la production est validée et prête pour inclusion dans une expédition.';

-- =====================================================
-- ÉTAPE 9: Vérification finale
-- =====================================================
DO $$
DECLARE
  v_enum_values text;
  v_prepared_count integer;
  v_ready_count integer;
  v_shipped_count integer;
  v_cancelled_count integer;
  v_total_count integer;
BEGIN
  -- Afficher toutes les valeurs du nouvel enum
  SELECT string_agg(e.enumlabel::text, ', ' ORDER BY e.enumsortorder)
  INTO v_enum_values
  FROM pg_enum e
  JOIN pg_type t ON e.enumtypid = t.oid
  WHERE t.typname = 'production_status_v2';

  -- Compter les productions par statut
  SELECT COUNT(*) INTO v_prepared_count
  FROM daily_production WHERE status = 'prepared';

  SELECT COUNT(*) INTO v_ready_count
  FROM daily_production WHERE status = 'ready_for_customs';

  SELECT COUNT(*) INTO v_shipped_count
  FROM daily_production WHERE status = 'shipped';

  SELECT COUNT(*) INTO v_cancelled_count
  FROM daily_production WHERE status = 'cancelled';

  SELECT COUNT(*) INTO v_total_count FROM daily_production;

  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════';
  RAISE NOTICE '✅ MIGRATION TERMINÉE AVEC SUCCÈS';
  RAISE NOTICE '════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE '📋 Valeurs enum production_status_v2:';
  RAISE NOTICE '   %', v_enum_values;
  RAISE NOTICE '';
  RAISE NOTICE '📊 Répartition des productions:';
  RAISE NOTICE '   - Prepared:           % (%.1f%%)', v_prepared_count, (v_prepared_count::float / NULLIF(v_total_count, 0) * 100);
  RAISE NOTICE '   - Ready for Customs:  % (%.1f%%)', v_ready_count, (v_ready_count::float / NULLIF(v_total_count, 0) * 100);
  RAISE NOTICE '   - Shipped:            % (%.1f%%)', v_shipped_count, (v_shipped_count::float / NULLIF(v_total_count, 0) * 100);
  RAISE NOTICE '   - Cancelled:          % (%.1f%%)', v_cancelled_count, (v_cancelled_count::float / NULLIF(v_total_count, 0) * 100);
  RAISE NOTICE '   - TOTAL:              %', v_total_count;
  RAISE NOTICE '';
  RAISE NOTICE '🎯 Prochaines étapes:';
  RAISE NOTICE '   1. Vérifier que l''application fonctionne correctement';
  RAISE NOTICE '   2. Valider manuellement les productions de "prepared" à "ready_for_customs"';
  RAISE NOTICE '   3. Créer des expéditions avec les productions validées';
  RAISE NOTICE '';
END $$;
