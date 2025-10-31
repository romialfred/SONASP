/*
  # Add Physical Payment Trigger

  1. Purpose
    - Automatically update sale status when physical/real payment is created
    - Transition from waiting_for_payment to payment_received
    - Eventually transition to completed status

  2. Trigger Logic
    - Detects when real payment (non-virtual) is created
    - Updates sale status to payment_received
    - Allows for final completion workflow

  3. Security
    - Operates with SECURITY DEFINER to bypass RLS
    - Only triggered by valid payment creation
*/

-- Create function to update sale status when physical payment is created
CREATE OR REPLACE FUNCTION update_sale_status_on_physical_payment()
RETURNS TRIGGER AS $$
DECLARE
  v_current_sale_status text;
BEGIN
  -- Only proceed if this is a real (non-virtual) payment
  IF TG_OP = 'INSERT' AND (NEW.payment_type IS NULL OR NEW.payment_type != 'virtual') AND (NEW.is_virtual IS NULL OR NEW.is_virtual = false) THEN

    -- Get current sale status
    SELECT status INTO v_current_sale_status
    FROM sales
    WHERE id = NEW.sale_id;

    -- If sale is waiting_for_payment, transition to payment_received
    IF v_current_sale_status = 'waiting_for_payment' THEN
      UPDATE sales
      SET status = 'payment_received',
          updated_at = NOW()
      WHERE id = NEW.sale_id;

      RAISE NOTICE 'Sale % transitioned to payment_received due to physical payment', NEW.sale_id;

    -- If sale is in virtual_payment status, transition to payment_received
    ELSIF v_current_sale_status = 'virtual_payment' THEN
      UPDATE sales
      SET status = 'payment_received',
          updated_at = NOW()
      WHERE id = NEW.sale_id;

      RAISE NOTICE 'Sale % transitioned from virtual_payment to payment_received', NEW.sale_id;
    END IF;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for physical payment status update
DROP TRIGGER IF EXISTS trigger_update_sale_on_physical_payment ON payments;
CREATE TRIGGER trigger_update_sale_on_physical_payment
  AFTER INSERT ON payments
  FOR EACH ROW
  WHEN (
    (NEW.payment_type IS DISTINCT FROM 'virtual' OR NEW.payment_type IS NULL)
    AND
    (NEW.is_virtual = false OR NEW.is_virtual IS NULL)
  )
  EXECUTE FUNCTION update_sale_status_on_physical_payment();

-- Create function to optionally auto-complete sale after payment received
CREATE OR REPLACE FUNCTION auto_complete_sale_after_payment()
RETURNS TRIGGER AS $$
BEGIN
  -- Only proceed if status changed TO payment_received
  IF TG_OP = 'UPDATE' AND NEW.status = 'payment_received' AND OLD.status != 'payment_received' THEN

    -- Auto-complete the sale after a short delay (this can be manual or automatic)
    -- For now, we'll leave it at payment_received and require manual completion
    -- If automatic completion is desired, uncomment the following:

    -- NEW.status = 'completed';
    -- RAISE NOTICE 'Sale % auto-completed after payment received', NEW.sale_number;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto-completion (currently disabled, can be enabled if needed)
-- DROP TRIGGER IF EXISTS trigger_auto_complete_sale ON sales;
-- CREATE TRIGGER trigger_auto_complete_sale
--   BEFORE UPDATE ON sales
--   FOR EACH ROW
--   WHEN (NEW.status = 'payment_received' AND OLD.status IS DISTINCT FROM NEW.status)
--   EXECUTE FUNCTION auto_complete_sale_after_payment();

-- Add comments for documentation
COMMENT ON FUNCTION update_sale_status_on_physical_payment IS 'Updates sale status to payment_received when physical payment is created';
COMMENT ON FUNCTION auto_complete_sale_after_payment IS 'Optionally auto-completes sale after payment is received (currently manual)';

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Physical payment trigger created successfully';
  RAISE NOTICE 'Sales will automatically update to payment_received when management records physical payment';
  RAISE NOTICE 'Physical payments update sale status: waiting_for_payment -> payment_received';
END $$;
