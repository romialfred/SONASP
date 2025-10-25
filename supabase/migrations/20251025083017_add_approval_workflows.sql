/*
  # Add Approval Workflow Fields

  1. Schema Additions
    - Add approval workflow fields to existing tables
    - Create approval_requests table for tracking all approvals
    - Add indices for performance

  2. Changes
    - Add destination and carrier fields to batches
    - Add supplier and purity fields to batches
    - Create approval_requests table for workflow tracking

  3. Security
    - Enable RLS on approval_requests table
    - Add policies for role-based access
*/

-- Add missing fields to batches table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'batches' AND column_name = 'supplier'
  ) THEN
    ALTER TABLE batches ADD COLUMN supplier text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'batches' AND column_name = 'purity_percentage'
  ) THEN
    ALTER TABLE batches ADD COLUMN purity_percentage numeric;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'batches' AND column_name = 'carrier'
  ) THEN
    ALTER TABLE batches ADD COLUMN carrier text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'batches' AND column_name = 'destination'
  ) THEN
    ALTER TABLE batches ADD COLUMN destination text;
  END IF;
END $$;

-- Create approval_requests table if not exists
CREATE TABLE IF NOT EXISTS approval_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_type text NOT NULL CHECK (request_type IN ('batch_receipt', 'refining_process', 'sale_approval', 'payment_approval')),
  entity_id uuid NOT NULL,
  entity_type text NOT NULL,
  requested_by uuid REFERENCES user_profiles(id),
  requested_at timestamptz DEFAULT now(),
  approver_role text NOT NULL,
  assigned_to uuid REFERENCES user_profiles(id),
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  comments text,
  approved_by uuid REFERENCES user_profiles(id),
  approved_at timestamptz,
  rejection_reason text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE approval_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies for approval_requests
CREATE POLICY "Users can view own approval requests"
  ON approval_requests FOR SELECT
  TO authenticated
  USING (
    auth.uid() = requested_by OR
    auth.uid() = assigned_to OR
    auth.uid() = approved_by OR
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'management'
    )
  );

CREATE POLICY "Users can create approval requests"
  ON approval_requests FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = requested_by);

CREATE POLICY "Assigned users can update requests"
  ON approval_requests FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = assigned_to OR
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'management'
    )
  );

-- Create indices for performance
CREATE INDEX IF NOT EXISTS idx_approval_requests_status ON approval_requests(status);
CREATE INDEX IF NOT EXISTS idx_approval_requests_type ON approval_requests(request_type);
CREATE INDEX IF NOT EXISTS idx_approval_requests_entity ON approval_requests(entity_id, entity_type);
CREATE INDEX IF NOT EXISTS idx_approval_requests_assigned ON approval_requests(assigned_to);
CREATE INDEX IF NOT EXISTS idx_batches_status ON batches(status);
CREATE INDEX IF NOT EXISTS idx_receiving_records_batch ON receiving_records(batch_id);
CREATE INDEX IF NOT EXISTS idx_refining_records_batch ON refining_records(batch_id);
CREATE INDEX IF NOT EXISTS idx_sales_status ON sales(status);
