/*
  # Fix batch_approvals Table Structure - FINAL

  ## Problem
  The batch_approvals table has conflicting structures from different migrations.
  The latest migration recreated it with old column names (approver_id, approver_name, etc.)
  instead of using the correct workflow structure (requested_by, approved_by, request_data).

  ## Solution
  1. Drop and recreate batch_approvals with correct structure
  2. Use the structure from workflow_engine_and_status_management migration
  3. Ensure all constraints match the correct approval types

  ## Table Structure
  - Uses request_data (jsonb) to store flexible approval information
  - No NOT NULL constraint on approver_id (doesn't exist)
  - Uses requested_by and approved_by for user tracking
  - Correct approval_type values from CHECK constraint
*/

-- Drop the table completely to start fresh
DROP TABLE IF EXISTS batch_approvals CASCADE;

-- Recreate with correct structure from workflow engine
CREATE TABLE batch_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES batches(id) ON DELETE CASCADE,

  -- Approval type must match the CHECK constraint
  approval_type TEXT NOT NULL CHECK (
    approval_type IN (
      'status_change',
      'variance',
      'quality',
      'sale',
      'split',
      'merge',
      'hold_release',
      'custom'
    )
  ),

  -- Approval metadata
  approval_level INTEGER DEFAULT 1,
  required_role TEXT,
  request_description TEXT,

  -- Flexible data storage for approval-specific information
  request_data JSONB,

  -- User tracking (nullable - not all approvals require immediate approval)
  requested_by UUID REFERENCES auth.users(id),
  requested_at TIMESTAMPTZ DEFAULT now(),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,

  -- Approval status
  status TEXT DEFAULT 'pending' CHECK (
    status IN ('pending', 'approved', 'rejected', 'escalated', 'cancelled')
  ),

  -- Comments and notes
  comments TEXT,
  rejection_reason TEXT,

  -- Escalation tracking
  escalated_to UUID REFERENCES auth.users(id),
  escalated_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_batch_approvals_batch_id ON batch_approvals(batch_id);
CREATE INDEX idx_batch_approvals_status ON batch_approvals(status);
CREATE INDEX idx_batch_approvals_type ON batch_approvals(approval_type);
CREATE INDEX idx_batch_approvals_requested_by ON batch_approvals(requested_by);
CREATE INDEX idx_batch_approvals_approved_by ON batch_approvals(approved_by);
CREATE INDEX idx_batch_approvals_requested_at ON batch_approvals(requested_at);

-- Enable RLS
ALTER TABLE batch_approvals ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view batch approvals for their batches"
  ON batch_approvals FOR SELECT
  TO authenticated
  USING (
    batch_id IN (
      SELECT id FROM batches
      WHERE created_by = auth.uid()
    )
    OR requested_by = auth.uid()
    OR approved_by = auth.uid()
  );

CREATE POLICY "Users can create batch approval requests"
  ON batch_approvals FOR INSERT
  TO authenticated
  WITH CHECK (requested_by = auth.uid());

CREATE POLICY "Authorized users can approve requests"
  ON batch_approvals FOR UPDATE
  TO authenticated
  USING (
    status = 'pending'
    AND (
      -- User has the required role
      EXISTS (
        SELECT 1 FROM user_profiles
        WHERE id = auth.uid()
        AND role = batch_approvals.required_role
      )
      OR
      -- Or user is a manager
      EXISTS (
        SELECT 1 FROM user_profiles
        WHERE id = auth.uid()
        AND role IN ('management', 'admin')
      )
    )
  );

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_batch_approvals_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER batch_approvals_updated_at
  BEFORE UPDATE ON batch_approvals
  FOR EACH ROW
  EXECUTE FUNCTION update_batch_approvals_updated_at();

-- Add helpful comment
COMMENT ON TABLE batch_approvals IS 'Tracks approval requests and decisions for batch operations including status changes, variance approvals, and quality checks';
COMMENT ON COLUMN batch_approvals.approval_type IS 'Type of approval: status_change, variance, quality, sale, split, merge, hold_release, custom';
COMMENT ON COLUMN batch_approvals.request_data IS 'Flexible JSONB field storing approval-specific data like previous_status, new_status, approver_name, variance_grams, etc.';
COMMENT ON COLUMN batch_approvals.status IS 'Approval status: pending, approved, rejected, escalated, cancelled';
