/*
  # Status Manager System - Gestion Dynamique des Workflows

  1. Tables Créées
    - workflow_templates : Templates de workflows (Production, Shipping, Payment)
    - workflow_statuses : Statuts individuels dans un workflow
    - workflow_transitions : Transitions autorisées entre statuts
    - workflow_history : Historique des modifications de workflows

  2. Sécurité
    - RLS activé sur toutes les tables
    - Policies pour admins et gestionnaires
    - Audit trail complet
*/

-- TYPES ENUM
DO $$ BEGIN
  CREATE TYPE workflow_type AS ENUM (
    'production',
    'shipping',
    'payment',
    'refining',
    'sales'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE workflow_change_type AS ENUM (
    'created',
    'status_added',
    'status_removed',
    'status_updated',
    'transition_added',
    'transition_removed',
    'workflow_activated',
    'workflow_deactivated'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- TABLE: workflow_templates
CREATE TABLE IF NOT EXISTS workflow_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  workflow_type workflow_type NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT false,
  mining_company_id UUID REFERENCES mining_companies(id) ON DELETE CASCADE,
  version INTEGER DEFAULT 1,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workflow_templates_type ON workflow_templates(workflow_type);
CREATE INDEX IF NOT EXISTS idx_workflow_templates_company ON workflow_templates(mining_company_id);
CREATE INDEX IF NOT EXISTS idx_workflow_templates_active ON workflow_templates(is_active, workflow_type);

-- TABLE: workflow_statuses
CREATE TABLE IF NOT EXISTS workflow_statuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_template_id UUID NOT NULL REFERENCES workflow_templates(id) ON DELETE CASCADE,
  status_key VARCHAR(100) NOT NULL,
  status_label VARCHAR(200) NOT NULL,
  status_color VARCHAR(50) DEFAULT '#6B7280',
  description TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  is_initial BOOLEAN DEFAULT false,
  is_final BOOLEAN DEFAULT false,
  icon VARCHAR(50),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_status_key_per_workflow UNIQUE (workflow_template_id, status_key),
  CONSTRAINT unique_order_index_per_workflow UNIQUE (workflow_template_id, order_index)
);

CREATE INDEX IF NOT EXISTS idx_workflow_statuses_template ON workflow_statuses(workflow_template_id);
CREATE INDEX IF NOT EXISTS idx_workflow_statuses_order ON workflow_statuses(workflow_template_id, order_index);

-- TABLE: workflow_transitions
CREATE TABLE IF NOT EXISTS workflow_transitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_template_id UUID NOT NULL REFERENCES workflow_templates(id) ON DELETE CASCADE,
  from_status_id UUID NOT NULL REFERENCES workflow_statuses(id) ON DELETE CASCADE,
  to_status_id UUID NOT NULL REFERENCES workflow_statuses(id) ON DELETE CASCADE,
  transition_label VARCHAR(200),
  requires_approval BOOLEAN DEFAULT false,
  approval_roles TEXT[] DEFAULT '{}',
  conditions JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_transition UNIQUE (workflow_template_id, from_status_id, to_status_id),
  CONSTRAINT no_self_transition CHECK (from_status_id != to_status_id)
);

CREATE INDEX IF NOT EXISTS idx_workflow_transitions_template ON workflow_transitions(workflow_template_id);
CREATE INDEX IF NOT EXISTS idx_workflow_transitions_from ON workflow_transitions(from_status_id);
CREATE INDEX IF NOT EXISTS idx_workflow_transitions_to ON workflow_transitions(to_status_id);

-- TABLE: workflow_history
CREATE TABLE IF NOT EXISTS workflow_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_template_id UUID NOT NULL REFERENCES workflow_templates(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  change_type workflow_change_type NOT NULL,
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  changes_summary TEXT,
  previous_config JSONB,
  new_config JSONB,
  changed_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workflow_history_template ON workflow_history(workflow_template_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_workflow_history_version ON workflow_history(workflow_template_id, version);

-- ROW LEVEL SECURITY
ALTER TABLE workflow_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_transitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view workflow templates" ON workflow_templates;
CREATE POLICY "Users can view workflow templates"
  ON workflow_templates FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins can manage workflow templates" ON workflow_templates;
CREATE POLICY "Admins can manage workflow templates"
  ON workflow_templates FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Users can view workflow statuses" ON workflow_statuses;
CREATE POLICY "Users can view workflow statuses"
  ON workflow_statuses FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins can manage workflow statuses" ON workflow_statuses;
CREATE POLICY "Admins can manage workflow statuses"
  ON workflow_statuses FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Users can view workflow transitions" ON workflow_transitions;
CREATE POLICY "Users can view workflow transitions"
  ON workflow_transitions FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins can manage workflow transitions" ON workflow_transitions;
CREATE POLICY "Admins can manage workflow transitions"
  ON workflow_transitions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Users can view workflow history" ON workflow_history;
CREATE POLICY "Users can view workflow history"
  ON workflow_history FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "System can insert workflow history" ON workflow_history;
CREATE POLICY "System can insert workflow history"
  ON workflow_history FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- FONCTIONS
CREATE OR REPLACE FUNCTION increment_workflow_version()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE workflow_templates
  SET version = version + 1,
      updated_at = now()
  WHERE id = NEW.workflow_template_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION log_workflow_change()
RETURNS TRIGGER AS $$
DECLARE
  v_change_type workflow_change_type;
  v_summary TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_change_type := 'status_added';
    v_summary := 'Nouveau statut ajouté: ' || NEW.status_label;
  ELSIF TG_OP = 'UPDATE' THEN
    v_change_type := 'status_updated';
    v_summary := 'Statut modifié: ' || NEW.status_label;
  ELSIF TG_OP = 'DELETE' THEN
    v_change_type := 'status_removed';
    v_summary := 'Statut supprimé: ' || OLD.status_label;
  END IF;

  INSERT INTO workflow_history (
    workflow_template_id,
    version,
    change_type,
    changed_by,
    changes_summary,
    previous_config,
    new_config
  ) VALUES (
    COALESCE(NEW.workflow_template_id, OLD.workflow_template_id),
    (SELECT version FROM workflow_templates WHERE id = COALESCE(NEW.workflow_template_id, OLD.workflow_template_id)),
    v_change_type,
    auth.uid(),
    v_summary,
    CASE WHEN TG_OP != 'INSERT' THEN row_to_json(OLD) ELSE NULL END,
    CASE WHEN TG_OP != 'DELETE' THEN row_to_json(NEW) ELSE NULL END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- TRIGGERS
DROP TRIGGER IF EXISTS trigger_increment_version_on_status_change ON workflow_statuses;
CREATE TRIGGER trigger_increment_version_on_status_change
  AFTER INSERT OR UPDATE OR DELETE ON workflow_statuses
  FOR EACH ROW
  EXECUTE FUNCTION increment_workflow_version();

DROP TRIGGER IF EXISTS trigger_increment_version_on_transition_change ON workflow_transitions;
CREATE TRIGGER trigger_increment_version_on_transition_change
  AFTER INSERT OR UPDATE OR DELETE ON workflow_transitions
  FOR EACH ROW
  EXECUTE FUNCTION increment_workflow_version();

DROP TRIGGER IF EXISTS trigger_log_status_changes ON workflow_statuses;
CREATE TRIGGER trigger_log_status_changes
  AFTER INSERT OR UPDATE OR DELETE ON workflow_statuses
  FOR EACH ROW
  EXECUTE FUNCTION log_workflow_change();

-- DONNÉES INITIALES
DO $$
DECLARE
  v_workflow_id UUID;
  v_prepared_id UUID;
  v_in_safe_id UUID;
  v_ready_customs_id UUID;
  v_shipped_id UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM workflow_templates WHERE name = 'Workflow Production Standard') THEN
    INSERT INTO workflow_templates (
      name, workflow_type, description, is_active
    ) VALUES (
      'Workflow Production Standard', 'production',
      'Workflow de production standard avec 4 étapes principales', true
    ) RETURNING id INTO v_workflow_id;

    INSERT INTO workflow_statuses (
      workflow_template_id, status_key, status_label, status_color,
      description, order_index, is_initial, is_final, icon
    ) VALUES
      (v_workflow_id, 'prepared', 'Préparé', '#3B82F6',
       'Production préparée et en attente de validation', 0, true, false, 'Package'),
      (v_workflow_id, 'in_safe', 'En Coffre', '#10B981',
       'Production sécurisée dans le coffre-fort', 1, false, false, 'Lock'),
      (v_workflow_id, 'ready_for_customs', 'Prêt pour Douane', '#F59E0B',
       'Production prête pour les formalités douanières', 2, false, false, 'FileCheck'),
      (v_workflow_id, 'shipped', 'Expédié', '#8B5CF6',
       'Production expédiée vers la destination', 3, false, true, 'Truck');

    SELECT id INTO v_prepared_id FROM workflow_statuses WHERE workflow_template_id = v_workflow_id AND status_key = 'prepared';
    SELECT id INTO v_in_safe_id FROM workflow_statuses WHERE workflow_template_id = v_workflow_id AND status_key = 'in_safe';
    SELECT id INTO v_ready_customs_id FROM workflow_statuses WHERE workflow_template_id = v_workflow_id AND status_key = 'ready_for_customs';
    SELECT id INTO v_shipped_id FROM workflow_statuses WHERE workflow_template_id = v_workflow_id AND status_key = 'shipped';

    INSERT INTO workflow_transitions (
      workflow_template_id, from_status_id, to_status_id, transition_label, requires_approval
    ) VALUES
      (v_workflow_id, v_prepared_id, v_in_safe_id, 'Mettre en coffre', false),
      (v_workflow_id, v_in_safe_id, v_ready_customs_id, 'Préparer douane', false),
      (v_workflow_id, v_ready_customs_id, v_shipped_id, 'Expédier', true);
  END IF;
END $$;
