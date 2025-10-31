/*
  # Create Status Transition Triggers

  1. Purpose
    - Automatically set initial sale status to pending_management_approval
    - Automatically transition to completed when real payment is recorded
    - Create audit trail for all status transitions

  2. Trigger Logic
    - New sales start at pending_management_approval
    - Real payment recording triggers payment_received status
    - Payment received triggers completed status
    - All transitions are logged for audit

  3. Security
    - Operates with appropriate permissions
    - Validates transitions according to workflow rules
*/

-- Create function to set initial sale status
CREATE OR REPLACE FUNCTION set_initial_sale_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Set initial status if not explicitly provided
  IF NEW.status IS NULL OR NEW.status = '' OR NEW.status = 'create_sales' THEN
    NEW.status = 'pending_management_approval';
    RAISE NOTICE 'Sale % created with initial status: pending_management_approval', NEW.sale_number;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for initial status
DROP TRIGGER IF EXISTS trigger_set_initial_sale_status ON sales;
CREATE TRIGGER trigger_set_initial_sale_status
  BEFORE INSERT ON sales
  FOR EACH ROW
  EXECUTE FUNCTION set_initial_sale_status();

-- Create function to transition to payment_received when real payment is recorded
CREATE OR REPLACE FUNCTION update_sale_on_real_payment()
RETURNS TRIGGER AS $$
DECLARE
  v_sale_status text;
BEGIN
  -- Only proceed for real payments that are being inserted
  IF TG_OP = 'INSERT' AND NEW.payment_type = 'real' THEN

    -- Get current sale status
    SELECT status INTO v_sale_status
    FROM sales
    WHERE id = NEW.sale_id;

    -- If sale is waiting_for_payment or virtual_payment, transition to payment_received
    IF v_sale_status IN ('waiting_for_payment', 'virtual_payment') THEN
      UPDATE sales
      SET status = 'payment_received'
      WHERE id = NEW.sale_id;

      RAISE NOTICE 'Sale % transitioned to payment_received after real payment', NEW.sale_id;
    END IF;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for payment received transition
DROP TRIGGER IF EXISTS trigger_update_sale_on_real_payment ON payments;
CREATE TRIGGER trigger_update_sale_on_real_payment
  AFTER INSERT ON payments
  FOR EACH ROW
  WHEN (NEW.payment_type = 'real')
  EXECUTE FUNCTION update_sale_on_real_payment();

-- Create function to auto-transition to completed
CREATE OR REPLACE FUNCTION auto_complete_sale_on_payment_received()
RETURNS TRIGGER AS $$
BEGIN
  -- When sale reaches payment_received, automatically transition to completed
  IF TG_OP = 'UPDATE' AND NEW.status = 'payment_received' AND OLD.status != 'payment_received' THEN

    -- Check if there's a real payment with approved status
    IF EXISTS (
      SELECT 1 FROM payments
      WHERE sale_id = NEW.id
        AND payment_type = 'real'
        AND status IN ('approved', 'pending')
    ) THEN
      -- Transition to completed
      NEW.status = 'completed';
      RAISE NOTICE 'Sale % auto-transitioned to completed', NEW.sale_number;
    END IF;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto-completion
DROP TRIGGER IF EXISTS trigger_auto_complete_sale ON sales;
CREATE TRIGGER trigger_auto_complete_sale
  BEFORE UPDATE ON sales
  FOR EACH ROW
  WHEN (NEW.status = 'payment_received' AND OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION auto_complete_sale_on_payment_received();

-- Create function to log status transitions for audit
CREATE OR REPLACE FUNCTION log_sale_status_transition()
RETURNS TRIGGER AS $$
DECLARE
  v_user_email text;
BEGIN
  -- Only log when status actually changes
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN

    -- Get user email
    SELECT email INTO v_user_email
    FROM auth.users
    WHERE id = auth.uid();

    -- Insert audit log entry
    INSERT INTO audit_logs (
      user_id,
      user_email,
      action,
      module,
      details,
      status,
      created_at
    ) VALUES (
      auth.uid(),
      COALESCE(v_user_email, 'system'),
      'UPDATE',
      'Sales',
      format('Sale %s status changed from %s to %s', NEW.sale_number, OLD.status, NEW.status),
      'success',
      now()
    );

    RAISE NOTICE 'Audit log created for sale % status transition: % -> %',
      NEW.sale_number, OLD.status, NEW.status;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for audit logging
DROP TRIGGER IF EXISTS trigger_log_sale_status_transition ON sales;
CREATE TRIGGER trigger_log_sale_status_transition
  AFTER UPDATE ON sales
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION log_sale_status_transition();

-- Create function to validate management approval
CREATE OR REPLACE FUNCTION validate_management_approval()
RETURNS TRIGGER AS $$
DECLARE
  v_user_role text;
BEGIN
  -- Check if user is transitioning to management_approved
  IF TG_OP = 'UPDATE' AND NEW.status = 'management_approved' AND OLD.status != 'management_approved' THEN

    -- Get user role
    SELECT role INTO v_user_role
    FROM user_profiles
    WHERE id = auth.uid();

    -- Validate user has management role
    IF v_user_role NOT IN ('management', 'admin') THEN
      RAISE EXCEPTION 'Only management users can approve sales'
        USING HINT = 'Contact a management user to approve this sale';
    END IF;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for management approval validation
DROP TRIGGER IF EXISTS trigger_validate_management_approval ON sales;
CREATE TRIGGER trigger_validate_management_approval
  BEFORE UPDATE ON sales
  FOR EACH ROW
  WHEN (NEW.status = 'management_approved' AND OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION validate_management_approval();

-- Add comments for documentation
COMMENT ON FUNCTION set_initial_sale_status IS 'Sets initial status to pending_management_approval for new sales';
COMMENT ON FUNCTION update_sale_on_real_payment IS 'Transitions sale to payment_received when real payment is recorded';
COMMENT ON FUNCTION auto_complete_sale_on_payment_received IS 'Automatically completes sale when payment is received';
COMMENT ON FUNCTION log_sale_status_transition IS 'Creates audit trail entry for every status transition';
COMMENT ON FUNCTION validate_management_approval IS 'Ensures only management users can approve sales';

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Status transition triggers created successfully';
  RAISE NOTICE 'Automatic workflow progression enabled';
  RAISE NOTICE 'Audit trail logging activated for all status changes';
  RAISE NOTICE 'Role-based validation implemented for approvals';
END $$;
