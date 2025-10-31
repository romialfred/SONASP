/*
  # Create Sales Status Transitions Table

  1. New Table
    - `sales_status_transitions` - Defines valid workflow transitions

  2. Features
    - 7-step workflow from the official process diagram
    - Validation of allowed transitions
    - Role-based transition permissions
    - Automatic vs manual transition tracking

  3. Security
    - RLS enabled
    - Read access for all authenticated users
    - Only system can insert/update transition rules
*/

-- Create sales_status_transitions table
CREATE TABLE IF NOT EXISTS sales_status_transitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  step_number integer NOT NULL,
  status_from text NOT NULL,
  status_to text NOT NULL,
  description text NOT NULL,
  description_en text,
  is_automatic boolean DEFAULT false,
  required_role text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  CONSTRAINT unique_transition UNIQUE (status_from, status_to)
);

-- Insert the 7 official workflow steps from the diagram
INSERT INTO sales_status_transitions (step_number, status_from, status_to, description, description_en, is_automatic, required_role, notes)
VALUES
  -- Step 1: Create sales → Pending approval
  (1, 'create_sales', 'pending_approval', 'Vente créée, en attente d''approbation client', 'Sale created, pending customer approval', true, NULL, 'Automatic transition on sale creation'),

  -- Step 2: Pending approval → Customer rejected
  (2, 'pending_approval', 'customer_rejected', 'Rejet par le client', 'Rejected by customer', false, 'customer', 'Customer rejection path'),

  -- Step 3: Pending approval → Customer approved
  (3, 'pending_approval', 'customer_approved', 'Approbation du client', 'Customer approval', false, 'customer', 'Customer approves the sale'),

  -- Step 4: Customer approved → Waiting for payment
  (4, 'customer_approved', 'waiting_for_payment', 'En attente de paiement', 'Waiting for payment', true, NULL, 'Automatic transition after customer approval'),

  -- Step 5: Waiting for payment → Virtual payment
  (5, 'waiting_for_payment', 'virtual_payment', 'Paiement virtuel généré automatiquement', 'Virtual payment generated automatically', true, NULL, 'System creates virtual payment record'),

  -- Step 6: Waiting for payment → Payment received (alternative path)
  (6, 'waiting_for_payment', 'payment_received', 'Paiement réel reçu', 'Real payment received', false, 'management', 'Management records actual payment'),

  -- Step 6b: Virtual payment → Payment received
  (6, 'virtual_payment', 'payment_received', 'Paiement réel reçu', 'Real payment received', false, 'management', 'Convert virtual to real payment'),

  -- Step 7: Payment received → Completed
  (7, 'payment_received', 'completed', 'Vente clôturée', 'Sale closed', false, 'management', 'Final closure of sale');

-- Add additional useful transitions for workflow flexibility
INSERT INTO sales_status_transitions (step_number, status_from, status_to, description, description_en, is_automatic, required_role, notes)
VALUES
  -- Allow re-opening if needed
  (0, 'customer_rejected', 'pending_approval', 'Réouverture après rejet', 'Reopen after rejection', false, 'management', 'Allow management to reopen rejected sales'),

  -- Allow cancellation at any point
  (0, 'create_sales', 'customer_rejected', 'Annulation', 'Cancellation', false, 'management', 'Cancel sale before approval'),
  (0, 'customer_approved', 'customer_rejected', 'Annulation après approbation', 'Cancel after approval', false, 'management', 'Cancel approved sale if needed'),

  -- Direct completion path if payment already received
  (0, 'customer_approved', 'payment_received', 'Paiement direct', 'Direct payment', false, 'management', 'Payment received immediately after approval');

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_transitions_from ON sales_status_transitions(status_from);
CREATE INDEX IF NOT EXISTS idx_transitions_to ON sales_status_transitions(status_to);
CREATE INDEX IF NOT EXISTS idx_transitions_step ON sales_status_transitions(step_number);

-- Enable RLS
ALTER TABLE sales_status_transitions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "All authenticated users can view transitions"
  ON sales_status_transitions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only system/management can modify transitions"
  ON sales_status_transitions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'management'
    )
  );

-- Create function to validate status transitions
CREATE OR REPLACE FUNCTION validate_sales_status_transition(
  p_old_status text,
  p_new_status text
)
RETURNS boolean AS $$
DECLARE
  v_is_valid boolean;
BEGIN
  -- If status hasn't changed, it's valid
  IF p_old_status = p_new_status THEN
    RETURN true;
  END IF;

  -- If old status is NULL (new record), allow any initial status
  IF p_old_status IS NULL THEN
    RETURN true;
  END IF;

  -- Check if transition exists in allowed transitions
  SELECT EXISTS (
    SELECT 1
    FROM sales_status_transitions
    WHERE status_from = p_old_status
      AND status_to = p_new_status
  ) INTO v_is_valid;

  RETURN v_is_valid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger function to validate transitions
CREATE OR REPLACE FUNCTION check_sales_status_transition()
RETURNS TRIGGER AS $$
BEGIN
  -- Only validate on UPDATE when status changes
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    IF NOT validate_sales_status_transition(OLD.status, NEW.status) THEN
      RAISE EXCEPTION 'Invalid status transition from % to %. Please follow the official workflow.', OLD.status, NEW.status
        USING HINT = 'Check sales_status_transitions table for valid transitions';
    END IF;
  END IF;

  -- For INSERT, validate the initial status is valid
  IF TG_OP = 'INSERT' THEN
    IF NEW.status NOT IN ('create_sales', 'pending_approval') THEN
      RAISE NOTICE 'New sales should start with create_sales or pending_approval status';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on sales table to validate transitions
DROP TRIGGER IF EXISTS trigger_validate_sales_status_transition ON sales;
CREATE TRIGGER trigger_validate_sales_status_transition
  BEFORE INSERT OR UPDATE ON sales
  FOR EACH ROW
  EXECUTE FUNCTION check_sales_status_transition();

-- Add comments for documentation
COMMENT ON TABLE sales_status_transitions IS 'Defines valid state transitions for the sales workflow with 7 official steps';
COMMENT ON FUNCTION validate_sales_status_transition IS 'Validates if a status transition is allowed according to workflow rules';
COMMENT ON TRIGGER trigger_validate_sales_status_transition ON sales IS 'Enforces valid status transitions according to official workflow';

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Sales status transitions table created with 7-step workflow validation';
END $$;
