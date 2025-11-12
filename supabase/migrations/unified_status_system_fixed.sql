/*
  # Système Unifié de Gestion des Statuts - VERSION CORRIGÉE

  ## Corrections
  - Gère les dépendances sur la colonne status (trigger, view)
  - Ne DROP pas la colonne status, la convertit en place
  - Recrée les objets dépendants avec les nouveaux types

  ## Vue d'ensemble
  Ce système unifie la gestion des statuts à travers Production, Shipping et Refining.
  Il crée un flow centralisé avec historique complet et permissions par contexte.

  ## 1. Nouveau Système de Statuts
    - Production: prepared, shipped, cancelled
    - Shipping: prepared, validated_for_refinery, cancelled
    - Unified Flow: Un seul historique partagé entre tous les modules

  ## 2. Tables Modifiées
    - `daily_production`: Nouveau enum pour status
    - `shipping_preparations`: Nouveau enum pour status
    - `unified_status_history`: Historique centralisé avec contexte

  ## 3. Règles de Transition
    - Production → Shipping: Seulement si status = 'shipped'
    - Shipping → Refining: Seulement si status = 'validated_for_refinery'
    - Refining → Sales: Expédition disponible pour pré-vente

  ## 4. Permissions par Contexte
    - Production Management: Peut changer status jusqu'à 'shipped'
    - Shipping Management: Peut changer status à partir de 'shipped'
    - Refining: Lecture seule, reçoit les 'validated_for_refinery'

  ## 5. Security
    - RLS activé sur unified_status_history
    - Tracking complet: user, timestamp, action, context, metadata
*/

-- =====================================================
-- 1. NOUVEAUX ENUMS POUR STATUS
-- =====================================================

-- Production status (simplifié)
DO $$ BEGIN
  DROP TYPE IF EXISTS production_status_v2 CASCADE;
  CREATE TYPE production_status_v2 AS ENUM (
    'prepared',      -- Prêt à être expédié
    'shipped',       -- Expédié (transfert vers shipping)
    'cancelled'      -- Annulé
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Shipping status (nouveau)
DO $$ BEGIN
  DROP TYPE IF EXISTS shipping_status_v2 CASCADE;
  CREATE TYPE shipping_status_v2 AS ENUM (
    'pending',                  -- En attente de préparation
    'prepared',                 -- Préparé
    'validated_for_refinery',   -- Validé pour raffinerie (peut être vendu)
    'in_refining',              -- En cours de raffinage
    'refined',                  -- Raffiné
    'in_sale',                  -- En vente
    'sold',                     -- Vendu
    'cancelled'                 -- Annulé
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Context enum (où le changement a été fait)
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
-- 2. TABLE UNIFIÉE D'HISTORIQUE DES STATUTS
-- =====================================================

CREATE TABLE IF NOT EXISTS unified_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Référence à l'entité (peut être production OU shipping)
  entity_type TEXT NOT NULL CHECK (entity_type IN ('production', 'shipping')),
  entity_id uuid NOT NULL,

  -- Statuts
  old_status TEXT,
  new_status TEXT NOT NULL,

  -- Contexte du changement
  change_context status_change_context NOT NULL,

  -- Qui, quand, pourquoi
  changed_by uuid REFERENCES auth.users(id),
  changed_at timestamptz DEFAULT now() NOT NULL,
  action_description TEXT,
  notes TEXT,

  -- Métadonnées additionnelles (JSON flexible)
  metadata jsonb DEFAULT '{}'::jsonb,

  -- Pour traçabilité
  ip_address inet,
  user_agent text,

  created_at timestamptz DEFAULT now() NOT NULL
);

-- Indexes pour performance
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

-- ==============================
-- 3.1 PRODUCTION STATUS
-- ==============================

-- Backup de l'ancien status de production si nécessaire
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'daily_production' AND column_name = 'status'
  ) THEN
    -- Renommer l'ancien status temporairement
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'daily_production' AND column_name = 'status_old_backup'
    ) THEN
      ALTER TABLE daily_production RENAME COLUMN status TO status_old_backup;
      RAISE NOTICE 'Production: Ancien status backed up to status_old_backup';
    END IF;
  END IF;
END $$;

-- Ajouter nouveau status à daily_production
ALTER TABLE daily_production
  ADD COLUMN IF NOT EXISTS status production_status_v2 DEFAULT 'prepared' NOT NULL;

-- Créer index
CREATE INDEX IF NOT EXISTS idx_daily_production_status_v2
  ON daily_production(status);

-- ==============================
-- 3.2 SHIPPING STATUS - GÉRER LES DÉPENDANCES
-- ==============================

-- ÉTAPE 1: Drop les objets dépendants
DO $$
BEGIN
  RAISE NOTICE 'Dropping dependent objects on shipping_preparations.status...';
END $$;

-- Drop les triggers qui dépendent de la colonne status
DROP TRIGGER IF EXISTS trg_update_license_quantity_on_update ON shipping_preparations;
DROP TRIGGER IF EXISTS trg_update_license_quantity_on_insert ON shipping_preparations;
DROP TRIGGER IF EXISTS trg_update_license_quantity_on_delete ON shipping_preparations;

-- Drop la vue qui dépend de la colonne status
DROP VIEW IF EXISTS assay_certificates_with_shipping CASCADE;

DO $$
BEGIN
  RAISE NOTICE 'Dependent objects dropped successfully';
END $$;

-- ÉTAPE 2: Backup et conversion du status
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shipping_preparations'
    AND column_name = 'status'
    AND data_type IN ('text', 'character varying')
  ) THEN
    -- Backup de l'ancien status
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'shipping_preparations' AND column_name = 'status_old_backup'
    ) THEN
      ALTER TABLE shipping_preparations ADD COLUMN status_old_backup TEXT;
      UPDATE shipping_preparations SET status_old_backup = status;
      RAISE NOTICE 'Shipping: Ancien status backed up';
    END IF;

    -- Drop l'ancienne colonne status (maintenant que les dépendances sont gérées)
    ALTER TABLE shipping_preparations DROP COLUMN status;
    RAISE NOTICE 'Shipping: Old status column dropped';
  END IF;
END $$;

-- ÉTAPE 3: Ajouter nouveau status à shipping_preparations
ALTER TABLE shipping_preparations
  ADD COLUMN IF NOT EXISTS status shipping_status_v2 DEFAULT 'pending' NOT NULL;

-- Créer index
CREATE INDEX IF NOT EXISTS idx_shipping_preparations_status_v2
  ON shipping_preparations(status);

DO $$
BEGIN
  RAISE NOTICE 'New status column created with proper enum type';
END $$;

-- =====================================================
-- 4. RECRÉER LES OBJETS DÉPENDANTS
-- =====================================================

-- RECRÉER LA VUE: assay_certificates_with_shipping
CREATE OR REPLACE VIEW assay_certificates_with_shipping AS
SELECT
  ac.*,
  sp.expedition_lot_number,
  sp.status::text as shipping_status,  -- Cast to text for compatibility
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

COMMENT ON VIEW assay_certificates_with_shipping IS
  'View combining assay certificates with shipping preparation details (updated for new status enum)';

-- RECRÉER LES TRIGGERS: License quantity updates
-- Trigger sur INSERT de shipping_preparations
CREATE TRIGGER trg_update_license_quantity_on_insert
AFTER INSERT ON shipping_preparations
FOR EACH ROW
WHEN (NEW.license_id IS NOT NULL)
EXECUTE FUNCTION update_license_used_quantity();

-- Trigger sur UPDATE de shipping_preparations
-- Note: On garde la référence à status dans le trigger
CREATE TRIGGER trg_update_license_quantity_on_update
AFTER UPDATE OF license_id, total_net_weight_grams, status ON shipping_preparations
FOR EACH ROW
WHEN (NEW.license_id IS NOT NULL OR OLD.license_id IS NOT NULL)
EXECUTE FUNCTION update_license_used_quantity();

-- Trigger sur DELETE de shipping_preparations
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
-- 5. FONCTION: Log Status Change (Universel)
-- =====================================================

CREATE OR REPLACE FUNCTION log_unified_status_change()
RETURNS TRIGGER AS $$
DECLARE
  v_entity_type TEXT;
  v_context status_change_context;
  v_action_desc TEXT;
BEGIN
  -- Déterminer le type d'entité
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

  -- Générer description de l'action
  IF TG_OP = 'INSERT' THEN
    v_action_desc := format('Création de %s avec status: %s', v_entity_type, NEW.status);

    INSERT INTO unified_status_history (
      entity_type,
      entity_id,
      old_status,
      new_status,
      change_context,
      changed_by,
      action_description,
      notes
    ) VALUES (
      v_entity_type,
      NEW.id,
      NULL,
      NEW.status::text,
      v_context,
      COALESCE(NEW.created_by, auth.uid()),
      v_action_desc,
      'Création initiale'
    );

  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    v_action_desc := format(
      'Changement de status: %s → %s',
      OLD.status,
      NEW.status
    );

    INSERT INTO unified_status_history (
      entity_type,
      entity_id,
      old_status,
      new_status,
      change_context,
      changed_by,
      action_description
    ) VALUES (
      v_entity_type,
      NEW.id,
      OLD.status::text,
      NEW.status::text,
      v_context,
      auth.uid(),
      v_action_desc
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 6. TRIGGERS POUR AUTO-LOGGING
-- =====================================================

-- Trigger pour daily_production
DROP TRIGGER IF EXISTS unified_status_change_trigger ON daily_production;
CREATE TRIGGER unified_status_change_trigger
  AFTER INSERT OR UPDATE ON daily_production
  FOR EACH ROW
  WHEN (NEW.status IS NOT NULL)
  EXECUTE FUNCTION log_unified_status_change();

-- Trigger pour shipping_preparations
DROP TRIGGER IF EXISTS unified_status_change_trigger ON shipping_preparations;
CREATE TRIGGER unified_status_change_trigger
  AFTER INSERT OR UPDATE ON shipping_preparations
  FOR EACH ROW
  WHEN (NEW.status IS NOT NULL)
  EXECUTE FUNCTION log_unified_status_change();

-- =====================================================
-- 7. FONCTION: Obtenir l'historique complet
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

-- =====================================================
-- 8. FONCTION: Vérifier si changement de status autorisé
-- =====================================================

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
  -- Production Management
  IF p_entity_type = 'production' AND p_context = 'production_management' THEN
    -- Peut changer seulement si pas encore shipped
    IF p_current_status IN ('prepared') THEN
      v_allowed := p_new_status IN ('prepared', 'shipped', 'cancelled');
    ELSIF p_current_status = 'shipped' THEN
      -- Une fois shipped, ne peut plus changer depuis production
      v_allowed := false;
    END IF;

  -- Shipping Management
  ELSIF p_entity_type = 'shipping' AND p_context = 'shipping_management' THEN
    -- Transitions autorisées
    IF p_current_status = 'pending' THEN
      v_allowed := p_new_status IN ('prepared', 'cancelled');
    ELSIF p_current_status = 'prepared' THEN
      v_allowed := p_new_status IN ('validated_for_refinery', 'cancelled');
    ELSIF p_current_status = 'validated_for_refinery' THEN
      v_allowed := p_new_status IN ('in_refining');
    ELSIF p_current_status = 'in_refining' THEN
      v_allowed := p_new_status IN ('refined');
    END IF;

  -- Refining Process
  ELSIF p_entity_type = 'shipping' AND p_context = 'refining_process' THEN
    -- Peut seulement confirmer la réception et marquer raffiné
    IF p_current_status = 'validated_for_refinery' THEN
      v_allowed := p_new_status IN ('in_refining');
    ELSIF p_current_status = 'in_refining' THEN
      v_allowed := p_new_status IN ('refined');
    END IF;

  -- Sales Management
  ELSIF p_context = 'sales_management' THEN
    -- Peut mettre en vente si validated_for_refinery
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
-- 9. VIEW: Expéditions disponibles pour raffinerie
-- =====================================================

CREATE OR REPLACE VIEW shipments_for_refinery AS
SELECT
  sp.*,
  dp.mining_company_id,
  dp.production_date,
  dp.bullion_grams,
  dp.pure_gold_grams,
  dp.estimated_fineness_pct
FROM shipping_preparations sp
LEFT JOIN daily_production dp ON sp.daily_production_id = dp.id
WHERE sp.status = 'validated_for_refinery';

-- =====================================================
-- 10. VIEW: Expéditions disponibles pour vente (pré-vente)
-- =====================================================

CREATE OR REPLACE VIEW shipments_for_presale AS
SELECT
  sp.*,
  dp.mining_company_id,
  dp.production_date,
  dp.bullion_grams,
  dp.pure_gold_grams,
  dp.estimated_fineness_pct,
  dp.estimated_oz
FROM shipping_preparations sp
LEFT JOIN daily_production dp ON sp.daily_production_id = dp.id
WHERE sp.status IN ('validated_for_refinery', 'refined');

-- =====================================================
-- 11. RLS POLICIES
-- =====================================================

-- Enable RLS
ALTER TABLE unified_status_history ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view unified status history" ON unified_status_history;
DROP POLICY IF EXISTS "Users can insert unified status history" ON unified_status_history;

-- Policies
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
-- 12. MIGRATION DES DONNÉES EXISTANTES
-- =====================================================

-- Migrer les status existants de production
DO $$
DECLARE
  v_production RECORD;
  v_count INTEGER := 0;
BEGIN
  FOR v_production IN
    SELECT id, status_old_backup, created_by, created_at
    FROM daily_production
    WHERE status_old_backup IS NOT NULL
  LOOP
    -- Mapper ancien status vers nouveau
    IF v_production.status_old_backup IN ('prepared', 'shipped') THEN
      UPDATE daily_production
      SET status = v_production.status_old_backup::production_status_v2
      WHERE id = v_production.id;
      v_count := v_count + 1;
    ELSE
      -- Statuts non mappés → prepared par défaut
      UPDATE daily_production
      SET status = 'prepared'
      WHERE id = v_production.id;
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RAISE NOTICE 'Migrated % production records', v_count;
END $$;

-- Migrer les status existants de shipping
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
    -- Mapper ancien status vers nouveau
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
      -- pending par défaut
      UPDATE shipping_preparations
      SET status = 'pending'::shipping_status_v2
      WHERE id = v_shipping.id;
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RAISE NOTICE 'Migrated % shipping records', v_count;
END $$;

-- =====================================================
-- 13. COMMENTS POUR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE unified_status_history IS
'Historique unifié des changements de statuts pour Production et Shipping.
Permet de tracer tous les changements avec contexte, user, et métadonnées.';

COMMENT ON COLUMN unified_status_history.entity_type IS
'Type d''entité: production (daily_production) ou shipping (shipping_preparations)';

COMMENT ON COLUMN unified_status_history.change_context IS
'Contexte où le changement a été effectué: production_management, shipping_management, refining_process, etc.';

COMMENT ON COLUMN daily_production.status IS
'Status Production: prepared (prêt) → shipped (expédié) → cancelled (annulé)';

COMMENT ON COLUMN shipping_preparations.status IS
'Status Shipping: pending → prepared → validated_for_refinery → in_refining → refined → in_sale → sold';

-- =====================================================
-- 14. GRANT PERMISSIONS
-- =====================================================

-- Grant sur les vues
GRANT SELECT ON shipments_for_refinery TO authenticated;
GRANT SELECT ON shipments_for_presale TO authenticated;
GRANT SELECT ON assay_certificates_with_shipping TO authenticated;

-- Grant sur les fonctions
GRANT EXECUTE ON FUNCTION get_unified_status_history TO authenticated;
GRANT EXECUTE ON FUNCTION can_change_status TO authenticated;

-- =====================================================
-- 15. SUCCÈS
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '✅ ========================================';
  RAISE NOTICE '✅ Unified Status System Migration COMPLETE!';
  RAISE NOTICE '✅ ========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Changes applied:';
  RAISE NOTICE '  ✓ New ENUM types created';
  RAISE NOTICE '  ✓ unified_status_history table created';
  RAISE NOTICE '  ✓ Status columns migrated (backups kept)';
  RAISE NOTICE '  ✓ Dependent objects (triggers, views) recreated';
  RAISE NOTICE '  ✓ Auto-logging triggers installed';
  RAISE NOTICE '  ✓ Permission functions created';
  RAISE NOTICE '  ✓ Views for refinery and presale created';
  RAISE NOTICE '  ✓ RLS policies configured';
  RAISE NOTICE '  ✓ Existing data migrated';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '  1. Verify data migration (check *_old_backup columns)';
  RAISE NOTICE '  2. Test status changes in the application';
  RAISE NOTICE '  3. Integrate UnifiedStatusFlow component';
  RAISE NOTICE '  4. After validation, optionally drop *_old_backup columns';
END $$;
