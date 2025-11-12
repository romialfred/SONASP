/*
  # Systeme Unifie de Gestion des Statuts - VERSION CORRIGEE

  ## Corrections
  - Gere les dependances sur la colonne status (trigger, view)
  - Drop explicite des triggers et views AVANT modification
  - Recree les objets dependants avec les nouveaux types
  - Tous les RAISE NOTICE dans des blocs DO $$

  ## Vue d'ensemble
  Ce systeme unifie la gestion des statuts a travers Production, Shipping et Refining.
  Il cree un flow centralise avec historique complet et permissions par contexte.
*/

-- =====================================================
-- 1. NOUVEAUX ENUMS POUR STATUS
-- =====================================================

-- Production status (simplifie)
DO $$ BEGIN
  DROP TYPE IF EXISTS production_status_v2 CASCADE;
  CREATE TYPE production_status_v2 AS ENUM (
    'prepared',
    'shipped',
    'cancelled'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Shipping status (nouveau)
DO $$ BEGIN
  DROP TYPE IF EXISTS shipping_status_v2 CASCADE;
  CREATE TYPE shipping_status_v2 AS ENUM (
    'pending',
    'prepared',
    'validated_for_refinery',
    'in_refining',
    'refined',
    'in_sale',
    'sold',
    'cancelled'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Context enum
DO $$ BEGIN
  CREATE TYPE status_change_context AS ENUM (
    'production_management',
    'shipping_management',
    'refining_process',
    'sales_management',
    'inventory_management',
    'system'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- =====================================================
-- 2. TABLE UNIFIEE D'HISTORIQUE DES STATUTS
-- =====================================================

CREATE TABLE IF NOT EXISTS unified_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('production', 'shipping')),
  entity_id uuid NOT NULL,
  old_status TEXT,
  new_status TEXT NOT NULL,
  change_context status_change_context NOT NULL,
  changed_by uuid REFERENCES auth.users(id),
  changed_at timestamptz DEFAULT now() NOT NULL,
  action_description TEXT,
  notes TEXT,
  metadata jsonb DEFAULT '{}'::jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_unified_status_history_entity
  ON unified_status_history(entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_unified_status_history_context
  ON unified_status_history(change_context);

CREATE INDEX IF NOT EXISTS idx_unified_status_history_changed_at
  ON unified_status_history(changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_unified_status_history_changed_by
  ON unified_status_history(changed_by);

-- =====================================================
-- 3. MIGRATION DES COLONNES STATUS
-- =====================================================

-- 3.1 PRODUCTION STATUS
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'daily_production' AND column_name = 'status'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'daily_production' AND column_name = 'status_old_backup'
    ) THEN
      ALTER TABLE daily_production RENAME COLUMN status TO status_old_backup;
      RAISE NOTICE 'Production: Ancien status backed up';
    END IF;
  END IF;
END $$;

ALTER TABLE daily_production
  ADD COLUMN IF NOT EXISTS status production_status_v2 DEFAULT 'prepared' NOT NULL;

CREATE INDEX IF NOT EXISTS idx_daily_production_status_v2
  ON daily_production(status);

-- 3.2 SHIPPING STATUS - GERER LES DEPENDANCES

-- ETAPE 1: Drop les objets dependants
DO $$
BEGIN
  RAISE NOTICE 'Dropping dependent objects on shipping_preparations.status...';
END $$;

DROP TRIGGER IF EXISTS trg_update_license_quantity_on_update ON shipping_preparations;
DROP TRIGGER IF EXISTS trg_update_license_quantity_on_insert ON shipping_preparations;
DROP TRIGGER IF EXISTS trg_update_license_quantity_on_delete ON shipping_preparations;
DROP VIEW IF EXISTS assay_certificates_with_shipping CASCADE;

DO $$
BEGIN
  RAISE NOTICE 'Dependent objects dropped successfully';
END $$;

-- ETAPE 2: Backup et conversion du status
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shipping_preparations'
    AND column_name = 'status'
    AND data_type IN ('text', 'character varying')
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'shipping_preparations' AND column_name = 'status_old_backup'
    ) THEN
      ALTER TABLE shipping_preparations ADD COLUMN status_old_backup TEXT;
      UPDATE shipping_preparations SET status_old_backup = status;
      RAISE NOTICE 'Shipping: Ancien status backed up';
    END IF;
    ALTER TABLE shipping_preparations DROP COLUMN status;
    RAISE NOTICE 'Shipping: Old status column dropped';
  END IF;
END $$;

-- ETAPE 3: Ajouter nouveau status
ALTER TABLE shipping_preparations
  ADD COLUMN IF NOT EXISTS status shipping_status_v2 DEFAULT 'pending' NOT NULL;

CREATE INDEX IF NOT EXISTS idx_shipping_preparations_status_v2
  ON shipping_preparations(status);

DO $$
BEGIN
  RAISE NOTICE 'New status column created with proper enum type';
END $$;

-- =====================================================
-- 4. RECREER LES OBJETS DEPENDANTS
-- =====================================================

CREATE OR REPLACE VIEW assay_certificates_with_shipping AS
SELECT
  ac.*,
  sp.expedition_lot_number,
  sp.status::text as shipping_status,
  sp.total_net_weight_grams as shipping_weight,
  sp.total_gross_weight_grams as shipping_gross_weight,
  sp.shipped_to_company,
  sp.shipped_to_address,
  sp.shipped_to_country,
  sp.mining_company_id,
  mc.name as mining_company_name,
  mc.country as mining_company_country,
  sp.prepared_at,
  sp.shipped_at,
  sp.created_at as shipping_created_at
FROM assay_certificates ac
LEFT JOIN shipping_preparations sp ON ac.shipping_preparation_id = sp.id
LEFT JOIN mining_companies mc ON sp.mining_company_id = mc.id
ORDER BY ac.created_at DESC;

CREATE TRIGGER trg_update_license_quantity_on_insert
AFTER INSERT ON shipping_preparations
FOR EACH ROW
WHEN (NEW.license_id IS NOT NULL)
EXECUTE FUNCTION update_license_used_quantity();

CREATE TRIGGER trg_update_license_quantity_on_update
AFTER UPDATE OF license_id, total_net_weight_grams, status ON shipping_preparations
FOR EACH ROW
WHEN (NEW.license_id IS NOT NULL OR OLD.license_id IS NOT NULL)
EXECUTE FUNCTION update_license_used_quantity();

CREATE TRIGGER trg_update_license_quantity_on_delete
AFTER DELETE ON shipping_preparations
FOR EACH ROW
WHEN (OLD.license_id IS NOT NULL)
EXECUTE FUNCTION update_license_used_quantity();

DO $$
BEGIN
  RAISE NOTICE 'Dependent objects recreated successfully';
END $$;

-- =====================================================
-- 5. FONCTION: Log Status Change
-- =====================================================

CREATE OR REPLACE FUNCTION log_unified_status_change()
RETURNS TRIGGER AS $$
DECLARE
  v_entity_type TEXT;
  v_context status_change_context;
  v_action_desc TEXT;
BEGIN
  IF TG_TABLE_NAME = 'daily_production' THEN
    v_entity_type := 'production';
    v_context := 'production_management';
  ELSIF TG_TABLE_NAME = 'shipping_preparations' THEN
    v_entity_type := 'shipping';
    v_context := 'shipping_management';
  ELSE
    v_entity_type := 'unknown';
    v_context := 'system';
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_action_desc := format('Creation de %s avec status: %s', v_entity_type, NEW.status);
    INSERT INTO unified_status_history (
      entity_type, entity_id, old_status, new_status,
      change_context, changed_by, action_description, notes
    ) VALUES (
      v_entity_type, NEW.id, NULL, NEW.status::text,
      v_context, COALESCE(NEW.created_by, auth.uid()),
      v_action_desc, 'Creation initiale'
    );
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    v_action_desc := format('Changement de status: %s -> %s', OLD.status, NEW.status);
    INSERT INTO unified_status_history (
      entity_type, entity_id, old_status, new_status,
      change_context, changed_by, action_description
    ) VALUES (
      v_entity_type, NEW.id, OLD.status::text, NEW.status::text,
      v_context, auth.uid(), v_action_desc
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS unified_status_change_trigger ON daily_production;
CREATE TRIGGER unified_status_change_trigger
  AFTER INSERT OR UPDATE ON daily_production
  FOR EACH ROW
  WHEN (NEW.status IS NOT NULL)
  EXECUTE FUNCTION log_unified_status_change();

DROP TRIGGER IF EXISTS unified_status_change_trigger ON shipping_preparations;
CREATE TRIGGER unified_status_change_trigger
  AFTER INSERT OR UPDATE ON shipping_preparations
  FOR EACH ROW
  WHEN (NEW.status IS NOT NULL)
  EXECUTE FUNCTION log_unified_status_change();

-- =====================================================
-- 6. FONCTIONS AUXILIAIRES
-- =====================================================

CREATE OR REPLACE FUNCTION get_unified_status_history(
  p_entity_type TEXT,
  p_entity_id uuid
)
RETURNS TABLE (
  id uuid,
  old_status TEXT,
  new_status TEXT,
  change_context TEXT,
  changed_by uuid,
  changed_at timestamptz,
  action_description TEXT,
  notes TEXT,
  user_email TEXT,
  user_name TEXT,
  metadata jsonb
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ush.id,
    ush.old_status,
    ush.new_status,
    ush.change_context::text,
    ush.changed_by,
    ush.changed_at,
    ush.action_description,
    ush.notes,
    au.email as user_email,
    COALESCE(up.full_name, au.email) as user_name,
    ush.metadata
  FROM unified_status_history ush
  LEFT JOIN auth.users au ON ush.changed_by = au.id
  LEFT JOIN user_profiles up ON ush.changed_by = up.user_id
  WHERE ush.entity_type = p_entity_type
    AND ush.entity_id = p_entity_id
  ORDER BY ush.changed_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION can_change_status(
  p_entity_type TEXT,
  p_entity_id uuid,
  p_current_status TEXT,
  p_new_status TEXT,
  p_context status_change_context
)
RETURNS BOOLEAN AS $$
DECLARE
  v_allowed BOOLEAN := false;
BEGIN
  IF p_entity_type = 'production' AND p_context = 'production_management' THEN
    IF p_current_status IN ('prepared') THEN
      v_allowed := p_new_status IN ('prepared', 'shipped', 'cancelled');
    ELSIF p_current_status = 'shipped' THEN
      v_allowed := false;
    END IF;
  ELSIF p_entity_type = 'shipping' AND p_context = 'shipping_management' THEN
    IF p_current_status = 'pending' THEN
      v_allowed := p_new_status IN ('prepared', 'cancelled');
    ELSIF p_current_status = 'prepared' THEN
      v_allowed := p_new_status IN ('validated_for_refinery', 'cancelled');
    ELSIF p_current_status = 'validated_for_refinery' THEN
      v_allowed := p_new_status IN ('in_refining');
    ELSIF p_current_status = 'in_refining' THEN
      v_allowed := p_new_status IN ('refined');
    END IF;
  ELSIF p_entity_type = 'shipping' AND p_context = 'refining_process' THEN
    IF p_current_status = 'validated_for_refinery' THEN
      v_allowed := p_new_status IN ('in_refining');
    ELSIF p_current_status = 'in_refining' THEN
      v_allowed := p_new_status IN ('refined');
    END IF;
  ELSIF p_context = 'sales_management' THEN
    IF p_current_status = 'validated_for_refinery' THEN
      v_allowed := p_new_status IN ('in_sale');
    ELSIF p_current_status = 'refined' THEN
      v_allowed := p_new_status IN ('in_sale');
    ELSIF p_current_status = 'in_sale' THEN
      v_allowed := p_new_status IN ('sold');
    END IF;
  END IF;
  RETURN v_allowed;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 7. VUES SPECIALISEES
-- =====================================================

CREATE OR REPLACE VIEW shipments_for_refinery AS
SELECT
  sp.*,
  dp.production_date,
  dp.bullion_grams,
  dp.pure_gold_grams,
  dp.estimated_fineness_pct
FROM shipping_preparations sp
LEFT JOIN daily_production dp ON sp.daily_production_id = dp.id
WHERE sp.status = 'validated_for_refinery';

CREATE OR REPLACE VIEW shipments_for_presale AS
SELECT
  sp.*,
  dp.production_date,
  dp.bullion_grams,
  dp.pure_gold_grams,
  dp.estimated_fineness_pct,
  dp.estimated_oz
FROM shipping_preparations sp
LEFT JOIN daily_production dp ON sp.daily_production_id = dp.id
WHERE sp.status IN ('validated_for_refinery', 'refined');

-- =====================================================
-- 8. RLS POLICIES
-- =====================================================

ALTER TABLE unified_status_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view unified status history" ON unified_status_history;
DROP POLICY IF EXISTS "Users can insert unified status history" ON unified_status_history;

CREATE POLICY "Users can view unified status history"
  ON unified_status_history
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert unified status history"
  ON unified_status_history
  FOR INSERT
  TO authenticated
  WITH CHECK (changed_by = auth.uid());

-- =====================================================
-- 9. MIGRATION DES DONNEES EXISTANTES
-- =====================================================

DO $$
DECLARE
  v_production RECORD;
  v_count INTEGER := 0;
  v_status_text TEXT;
BEGIN
  FOR v_production IN
    SELECT id, status_old_backup::text as status_text, created_by, created_at
    FROM daily_production
    WHERE status_old_backup IS NOT NULL
  LOOP
    v_status_text := v_production.status_text;

    IF v_status_text = 'prepared' THEN
      UPDATE daily_production
      SET status = 'prepared'::production_status_v2
      WHERE id = v_production.id;
      v_count := v_count + 1;
    ELSIF v_status_text = 'shipped' THEN
      UPDATE daily_production
      SET status = 'shipped'::production_status_v2
      WHERE id = v_production.id;
      v_count := v_count + 1;
    ELSE
      UPDATE daily_production
      SET status = 'prepared'::production_status_v2
      WHERE id = v_production.id;
      v_count := v_count + 1;
    END IF;
  END LOOP;
  RAISE NOTICE 'Migrated % production records', v_count;
END $$;

DO $$
DECLARE
  v_shipping RECORD;
  v_count INTEGER := 0;
BEGIN
  FOR v_shipping IN
    SELECT id, status_old_backup, created_by, created_at
    FROM shipping_preparations
    WHERE status_old_backup IS NOT NULL
  LOOP
    IF v_shipping.status_old_backup = 'prepared' THEN
      UPDATE shipping_preparations
      SET status = 'prepared'::shipping_status_v2
      WHERE id = v_shipping.id;
      v_count := v_count + 1;
    ELSIF v_shipping.status_old_backup = 'shipped' THEN
      UPDATE shipping_preparations
      SET status = 'validated_for_refinery'::shipping_status_v2
      WHERE id = v_shipping.id;
      v_count := v_count + 1;
    ELSE
      UPDATE shipping_preparations
      SET status = 'pending'::shipping_status_v2
      WHERE id = v_shipping.id;
      v_count := v_count + 1;
    END IF;
  END LOOP;
  RAISE NOTICE 'Migrated % shipping records', v_count;
END $$;

-- =====================================================
-- 10. COMMENTS ET GRANTS
-- =====================================================

COMMENT ON TABLE unified_status_history IS
'Historique unifie des changements de statuts pour Production et Shipping';

COMMENT ON COLUMN unified_status_history.entity_type IS
'Type d entite: production ou shipping';

COMMENT ON COLUMN unified_status_history.change_context IS
'Contexte: production_management, shipping_management, refining_process, etc';

COMMENT ON COLUMN daily_production.status IS
'Status Production: prepared -> shipped -> cancelled';

COMMENT ON COLUMN shipping_preparations.status IS
'Status Shipping: pending -> prepared -> validated_for_refinery -> in_refining -> refined -> in_sale -> sold';

GRANT SELECT ON shipments_for_refinery TO authenticated;
GRANT SELECT ON shipments_for_presale TO authenticated;
GRANT SELECT ON assay_certificates_with_shipping TO authenticated;
GRANT EXECUTE ON FUNCTION get_unified_status_history TO authenticated;
GRANT EXECUTE ON FUNCTION can_change_status TO authenticated;

-- =====================================================
-- 11. SUCCES
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Unified Status System Migration COMPLETE!';
  RAISE NOTICE '============================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Changes applied:';
  RAISE NOTICE '  - New ENUM types created';
  RAISE NOTICE '  - unified_status_history table created';
  RAISE NOTICE '  - Status columns migrated (backups kept)';
  RAISE NOTICE '  - Dependent objects (triggers, views) recreated';
  RAISE NOTICE '  - Auto-logging triggers installed';
  RAISE NOTICE '  - Permission functions created';
  RAISE NOTICE '  - Views for refinery and presale created';
  RAISE NOTICE '  - RLS policies configured';
  RAISE NOTICE '  - Existing data migrated';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '  1. Verify data migration';
  RAISE NOTICE '  2. Test status changes';
  RAISE NOTICE '  3. Integrate UnifiedStatusFlow component';
  RAISE NOTICE '  4. Optionally drop *_old_backup columns';
END $$;
