/*
  # Insert New Sales Status Transitions

  1. Purpose
    - Define the new 9-step sales workflow
    - Insert all valid status transitions
    - Configure automatic vs manual transitions

  2. Workflow Steps
    1. Create Sales -> pending_management_approval (automatic)
    2. pending_management_approval -> management_rejected (management)
    3. pending_management_approval -> management_approved (management)
    4. pending_for_customer_approval -> customer_rejected (management/customer)
    5. pending_for_customer_approval -> customer_approved (management/customer)
    6. customer_approved -> waiting_for_payment (automatic)
    7. waiting_for_payment -> virtual_payment (automatic)
    8. waiting_for_payment -> payment_received (automatic)
    9. payment_received -> completed (automatic)

  3. Security
    - RLS policies already exist from previous migrations
    - Only management can modify transitions
*/

-- Insert the 9 official workflow transitions
INSERT INTO sales_status_transitions (
  step_number,
  status_from,
  status_to,
  description,
  description_en,
  is_automatic,
  required_role,
  notes
) VALUES
  -- Step 1: Create sales -> Pending management approval (AUTOMATIC)
  (
    1,
    'create_sales',
    'pending_management_approval',
    'Vente créée, en attente d''approbation du management',
    'Sale created, pending management approval',
    true,
    NULL,
    'Automatic transition when sale is created by system'
  ),

  -- Step 2: Pending management approval -> Management rejected
  (
    2,
    'pending_management_approval',
    'management_rejected',
    'Vente rejetée par le management',
    'Sale rejected by management',
    false,
    'management',
    'Management rejects the sale'
  ),

  -- Step 3: Pending management approval -> Management approved
  (
    3,
    'pending_management_approval',
    'management_approved',
    'Vente approuvée par le management, en attente d''approbation client',
    'Sale approved by management, pending customer approval',
    false,
    'management',
    'Management approves, now waiting for customer'
  ),

  -- Step 4: Pending for customer approval -> Customer rejected
  (
    4,
    'pending_for_customer_approval',
    'customer_rejected',
    'Vente rejetée par le client',
    'Sale rejected by customer',
    false,
    'customer',
    'Customer rejects the sale offer'
  ),

  -- Step 5: Pending for customer approval -> Customer approved
  (
    5,
    'pending_for_customer_approval',
    'customer_approved',
    'Vente approuvée par le client',
    'Sale approved by customer',
    false,
    'customer',
    'Customer accepts the sale offer'
  ),

  -- Step 6: Customer approved -> Waiting for payment (AUTOMATIC)
  (
    6,
    'customer_approved',
    'waiting_for_payment',
    'En attente de paiement',
    'Waiting for payment',
    true,
    NULL,
    'Automatic transition after customer approval'
  ),

  -- Step 7: Waiting for payment -> Virtual payment (AUTOMATIC)
  (
    7,
    'waiting_for_payment',
    'virtual_payment',
    'Paiement virtuel généré automatiquement',
    'Virtual payment generated automatically',
    true,
    NULL,
    'System creates virtual payment record as reference'
  ),

  -- Step 8: Waiting for payment -> Payment received (AUTOMATIC when real payment recorded)
  (
    8,
    'waiting_for_payment',
    'payment_received',
    'Paiement réel reçu et enregistré',
    'Real payment received and recorded',
    true,
    NULL,
    'Automatic when management records real payment'
  ),

  -- Step 9: Payment received -> Completed (AUTOMATIC)
  (
    9,
    'payment_received',
    'completed',
    'Vente clôturée avec succès',
    'Sale completed successfully',
    true,
    NULL,
    'Final closure of sale after payment confirmation'
  );

-- Add additional useful transitions for workflow flexibility
INSERT INTO sales_status_transitions (
  step_number,
  status_from,
  status_to,
  description,
  description_en,
  is_automatic,
  required_role,
  notes
) VALUES
  -- Allow management to transition approved to customer approval pending
  (
    10,
    'management_approved',
    'pending_for_customer_approval',
    'Envoi de la proposition au client',
    'Sending proposal to customer',
    false,
    'management',
    'Management sends approval to customer for final confirmation'
  ),

  -- Allow virtual payment to be replaced by real payment
  (
    11,
    'virtual_payment',
    'payment_received',
    'Remplacement du paiement virtuel par paiement réel',
    'Virtual payment replaced by real payment',
    true,
    NULL,
    'System replaces virtual payment when real payment is recorded'
  );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_sales_transitions_from ON sales_status_transitions(status_from);
CREATE INDEX IF NOT EXISTS idx_sales_transitions_to ON sales_status_transitions(status_to);
CREATE INDEX IF NOT EXISTS idx_sales_transitions_step ON sales_status_transitions(step_number);
CREATE INDEX IF NOT EXISTS idx_sales_transitions_automatic ON sales_status_transitions(is_automatic);

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

  -- If old status is NULL (new record), allow initial status
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
      RAISE EXCEPTION 'Invalid status transition from "%" to "%". Please follow the official workflow.', OLD.status, NEW.status
        USING HINT = 'Check sales_status_transitions table for valid transitions';
    END IF;
  END IF;

  -- For INSERT, validate the initial status is valid
  IF TG_OP = 'INSERT' THEN
    IF NEW.status NOT IN ('create_sales', 'pending_management_approval') THEN
      RAISE NOTICE 'New sales should start with create_sales or pending_management_approval status';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on sales table to validate transitions
CREATE TRIGGER trigger_validate_sales_status_transition
  BEFORE INSERT OR UPDATE ON sales
  FOR EACH ROW
  EXECUTE FUNCTION check_sales_status_transition();

-- Add comments for documentation
COMMENT ON TABLE sales_status_transitions IS 'Defines valid state transitions for the sales workflow with 9 official steps';
COMMENT ON FUNCTION validate_sales_status_transition IS 'Validates if a status transition is allowed according to workflow rules';
COMMENT ON TRIGGER trigger_validate_sales_status_transition ON sales IS 'Enforces valid status transitions according to official workflow';

-- Success message
DO $$
DECLARE
  v_count integer;
BEGIN
  SELECT COUNT(*) INTO v_count FROM sales_status_transitions;
  RAISE NOTICE 'Sales status transitions table populated with % transitions', v_count;
  RAISE NOTICE 'New 9-step workflow implemented successfully';
END $$;
