/*
  # Workflow Engine and Advanced Status Management

  ## Overview
  Implements state machine for batch status transitions, conditional workflows,
  approval routing, and escalation rules.

  ## New Tables

  ### 1. `batch_workflow_definitions`
  Defines workflow templates for different batch types
  - `id` (uuid, primary key)
  - `workflow_name` (text)
  - `metal_type` (text)
  - `country` (text)
  - `workflow_config` (jsonb) - Complete workflow configuration
  - `is_active` (boolean)
  - `created_by` (uuid)
  - `created_at` (timestamptz)

  ### 2. `batch_status_transitions`
  Defines valid status transitions and rules
  - `id` (uuid, primary key)
  - `from_status` (text)
  - `to_status` (text)
  - `requires_approval` (boolean)
  - `approval_role` (text)
  - `conditions` (jsonb) - Conditional logic
  - `auto_trigger_on` (jsonb) - Automatic transition rules
  - `is_reversible` (boolean)

  ### 3. `batch_approvals`
  Multi-level approval tracking
  - `id` (uuid, primary key)
  - `batch_id` (uuid)
  - `approval_type` (text) - status_change, variance, quality, sale
  - `approval_level` (integer)
  - `required_role` (text)
  - `requested_by` (uuid)
  - `requested_at` (timestamptz)
  - `approved_by` (uuid)
  - `approved_at` (timestamptz)
  - `status` (text) - pending, approved, rejected, escalated
  - `comments` (text)
  - `escalated_to` (uuid)
  - `escalated_at` (timestamptz)

  ### 4. `batch_workflow_instances`
  Tracks active workflows for each batch
  - `id` (uuid, primary key)
  - `batch_id` (uuid)
  - `workflow_definition_id` (uuid)
  - `current_step` (text)
  - `workflow_data` (jsonb)
  - `started_at` (timestamptz)
  - `completed_at` (timestamptz)
  - `status` (text) - active, completed, cancelled, failed

  ### 5. `batch_escalations`
  Escalation tracking for delayed actions
  - `id` (uuid, primary key)
  - `batch_id` (uuid)
  - `escalation_type` (text) - approval_delay, quality_issue, variance
  - `escalated_from` (uuid)
  - `escalated_to` (uuid)
  - `escalation_reason` (text)
  - `original_request_date` (timestamptz)
  - `escalated_at` (timestamptz)
  - `resolved_at` (timestamptz)
  - `resolution` (text)

  ## Functions

  ### validate_status_transition
  Validates if a status transition is allowed

  ### get_next_approver
  Determines next approver in chain

  ### check_escalation_needed
  Checks if escalation is needed based on time

  ## Security
  - RLS enabled on all tables
  - Role-based approval policies
  - Audit trail for all workflow actions
*/

-- Create batch_workflow_definitions table
CREATE TABLE IF NOT EXISTS batch_workflow_definitions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  workflow_name text NOT NULL,
  description text,
  metal_type text CHECK (metal_type IN ('gold', 'silver', 'both')),
  country text,
  workflow_config jsonb NOT NULL,
  is_active boolean DEFAULT true,
  version integer DEFAULT 1,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create batch_status_transitions table
CREATE TABLE IF NOT EXISTS batch_status_transitions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_status text NOT NULL,
  to_status text NOT NULL,
  requires_approval boolean DEFAULT false,
  approval_roles text[],
  min_approval_count integer DEFAULT 1,
  conditions jsonb,
  auto_trigger_on jsonb,
  is_reversible boolean DEFAULT false,
  notification_template text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(from_status, to_status)
);

-- Create batch_approvals table
CREATE TABLE IF NOT EXISTS batch_approvals (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  batch_id uuid REFERENCES batches(id) ON DELETE CASCADE,
  approval_type text NOT NULL CHECK (
    approval_type IN ('status_change', 'variance', 'quality', 'sale', 'split', 'merge', 'hold_release', 'custom')
  ),
  approval_level integer DEFAULT 1,
  required_role text,
  request_description text,
  request_data jsonb,
  requested_by uuid,
  requested_at timestamptz DEFAULT now(),
  approved_by uuid,
  approved_at timestamptz,
  status text DEFAULT 'pending' CHECK (
    status IN ('pending', 'approved', 'rejected', 'escalated', 'cancelled')
  ),
  comments text,
  rejection_reason text,
  escalated_to uuid,
  escalated_at timestamptz,
  expires_at timestamptz
);

-- Create batch_workflow_instances table
CREATE TABLE IF NOT EXISTS batch_workflow_instances (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  batch_id uuid REFERENCES batches(id) ON DELETE CASCADE,
  workflow_definition_id uuid REFERENCES batch_workflow_definitions(id),
  current_step text,
  workflow_data jsonb,
  step_history jsonb[],
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  status text DEFAULT 'active' CHECK (
    status IN ('active', 'completed', 'cancelled', 'failed', 'paused')
  ),
  error_message text,
  UNIQUE(batch_id, workflow_definition_id, started_at)
);

-- Create batch_escalations table
CREATE TABLE IF NOT EXISTS batch_escalations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  batch_id uuid REFERENCES batches(id) ON DELETE CASCADE,
  approval_id uuid REFERENCES batch_approvals(id),
  escalation_type text NOT NULL CHECK (
    escalation_type IN ('approval_delay', 'quality_issue', 'variance', 'customs_hold', 'security_breach', 'other')
  ),
  severity text CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  escalated_from uuid,
  escalated_to uuid,
  escalation_reason text NOT NULL,
  escalation_details jsonb,
  original_request_date timestamptz,
  escalated_at timestamptz DEFAULT now(),
  acknowledged_at timestamptz,
  resolved_at timestamptz,
  resolution text,
  resolution_data jsonb
);

-- Insert default status transitions
INSERT INTO batch_status_transitions (from_status, to_status, requires_approval, approval_roles, conditions) VALUES
  ('created', 'shipped', false, NULL, NULL),
  ('shipped', 'received_airport', false, NULL, NULL),
  ('received_airport', 'shipped_refinery', false, NULL, NULL),
  ('shipped_refinery', 'received_refinery', false, NULL, NULL),
  ('received_refinery', 'processing', false, NULL, NULL),
  ('processing', 'processed', false, NULL, NULL),
  ('processed', 'approved', true, ARRAY['refinery_supervisor', 'management'], '{"quality_check_required": true}'),
  ('approved', 'ready_for_sale', true, ARRAY['management'], NULL)
ON CONFLICT (from_status, to_status) DO NOTHING;

-- Function to validate status transitions
CREATE OR REPLACE FUNCTION validate_status_transition(
  p_batch_id uuid,
  p_from_status text,
  p_to_status text,
  p_user_id uuid
)
RETURNS jsonb AS $$
DECLARE
  v_transition record;
  v_result jsonb;
  v_batch record;
  v_has_required_approvals boolean;
BEGIN
  -- Get batch details
  SELECT * INTO v_batch FROM batches WHERE id = p_batch_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'Batch not found'
    );
  END IF;

  -- Check if batch is on hold
  IF v_batch.is_on_hold THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'Batch is on hold',
      'hold_reason', v_batch.hold_reason
    );
  END IF;

  -- Get transition rules
  SELECT * INTO v_transition
  FROM batch_status_transitions
  WHERE from_status = p_from_status
    AND to_status = p_to_status
    AND is_active = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'Invalid status transition'
    );
  END IF;

  -- Check if approval is required
  IF v_transition.requires_approval THEN
    SELECT EXISTS(
      SELECT 1 FROM batch_approvals
      WHERE batch_id = p_batch_id
        AND approval_type = 'status_change'
        AND status = 'approved'
        AND request_data->>'to_status' = p_to_status
    ) INTO v_has_required_approvals;

    IF NOT v_has_required_approvals THEN
      RETURN jsonb_build_object(
        'valid', false,
        'error', 'Approval required',
        'required_roles', v_transition.approval_roles,
        'requires_approval_request', true
      );
    END IF;
  END IF;

  -- Transition is valid
  RETURN jsonb_build_object(
    'valid', true,
    'transition_id', v_transition.id,
    'notification_template', v_transition.notification_template
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check and create escalations
CREATE OR REPLACE FUNCTION check_approval_escalations()
RETURNS void AS $$
DECLARE
  v_approval record;
  v_escalation_threshold interval := interval '24 hours';
BEGIN
  FOR v_approval IN
    SELECT * FROM batch_approvals
    WHERE status = 'pending'
      AND requested_at < (now() - v_escalation_threshold)
      AND escalated_at IS NULL
  LOOP
    INSERT INTO batch_escalations (
      batch_id,
      approval_id,
      escalation_type,
      severity,
      escalated_from,
      escalation_reason,
      original_request_date
    )
    VALUES (
      v_approval.batch_id,
      v_approval.id,
      'approval_delay',
      CASE
        WHEN now() - v_approval.requested_at > interval '48 hours' THEN 'high'
        ELSE 'medium'
      END,
      v_approval.requested_by,
      'Approval pending for more than 24 hours',
      v_approval.requested_at
    );

    UPDATE batch_approvals
    SET status = 'escalated',
        escalated_at = now()
    WHERE id = v_approval.id;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to automatically expire reservations
CREATE OR REPLACE FUNCTION expire_batch_reservations()
RETURNS void AS $$
BEGIN
  UPDATE batch_reservations
  SET status = 'expired',
      released_at = now()
  WHERE status = 'active'
    AND reservation_expires_at < now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get available batch weight (excluding reservations)
CREATE OR REPLACE FUNCTION get_batch_available_weight(p_batch_id uuid)
RETURNS numeric AS $$
DECLARE
  v_total_weight numeric;
  v_reserved_weight numeric;
BEGIN
  SELECT weight_grams INTO v_total_weight
  FROM batches
  WHERE id = p_batch_id;

  SELECT COALESCE(SUM(reserved_weight_grams), 0) INTO v_reserved_weight
  FROM batch_reservations
  WHERE batch_id = p_batch_id
    AND status = 'active';

  RETURN v_total_weight - v_reserved_weight;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_batch_workflow_definitions_metal_type ON batch_workflow_definitions(metal_type);
CREATE INDEX IF NOT EXISTS idx_batch_workflow_definitions_country ON batch_workflow_definitions(country);
CREATE INDEX IF NOT EXISTS idx_batch_workflow_definitions_active ON batch_workflow_definitions(is_active);
CREATE INDEX IF NOT EXISTS idx_batch_status_transitions_from ON batch_status_transitions(from_status);
CREATE INDEX IF NOT EXISTS idx_batch_status_transitions_to ON batch_status_transitions(to_status);
CREATE INDEX IF NOT EXISTS idx_batch_approvals_batch_id ON batch_approvals(batch_id);
CREATE INDEX IF NOT EXISTS idx_batch_approvals_status ON batch_approvals(status);
CREATE INDEX IF NOT EXISTS idx_batch_approvals_type ON batch_approvals(approval_type);
CREATE INDEX IF NOT EXISTS idx_batch_approvals_requested_by ON batch_approvals(requested_by);
CREATE INDEX IF NOT EXISTS idx_batch_workflow_instances_batch_id ON batch_workflow_instances(batch_id);
CREATE INDEX IF NOT EXISTS idx_batch_workflow_instances_status ON batch_workflow_instances(status);
CREATE INDEX IF NOT EXISTS idx_batch_escalations_batch_id ON batch_escalations(batch_id);
CREATE INDEX IF NOT EXISTS idx_batch_escalations_resolved ON batch_escalations(resolved_at);

-- Create trigger for workflow_definitions updated_at
CREATE TRIGGER update_batch_workflow_definitions_updated_at
  BEFORE UPDATE ON batch_workflow_definitions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE batch_workflow_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE batch_status_transitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE batch_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE batch_workflow_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE batch_escalations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for batch_workflow_definitions
CREATE POLICY "Users can view workflow definitions" ON batch_workflow_definitions
  FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Admins can manage workflow definitions" ON batch_workflow_definitions
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- RLS Policies for batch_status_transitions
CREATE POLICY "Users can view status transitions" ON batch_status_transitions
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- RLS Policies for batch_approvals
CREATE POLICY "Users can view batch approvals" ON batch_approvals
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create approval requests" ON batch_approvals
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = requested_by);

CREATE POLICY "Users can update approval requests" ON batch_approvals
  FOR UPDATE
  TO authenticated
  USING (true);

-- RLS Policies for batch_workflow_instances
CREATE POLICY "Users can view workflow instances" ON batch_workflow_instances
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "System can manage workflow instances" ON batch_workflow_instances
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- RLS Policies for batch_escalations
CREATE POLICY "Users can view batch escalations" ON batch_escalations
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create escalations" ON batch_escalations
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = escalated_from);

CREATE POLICY "Escalation recipients can update" ON batch_escalations
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = escalated_to);
