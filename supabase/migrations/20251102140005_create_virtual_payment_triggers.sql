/*
  # Create Virtual Payment Triggers

  1. Purpose
    - Automatically create virtual payment when sale reaches customer_approved status
    - Transition sale to waiting_for_payment status
    - Prevent duplicate virtual payments

  2. Trigger Logic
    - Detects when sale status changes to customer_approved
    - Creates virtual payment record with sale amount
    - Updates sale status to waiting_for_payment
    - Uses transaction to ensure atomicity

  3. Security
    - Operates with SECURITY DEFINER to bypass RLS
    - Only triggered by valid status transitions
*/

-- Create function to automatically create virtual payment
CREATE OR REPLACE FUNCTION create_virtual_payment_on_customer_approval()
RETURNS TRIGGER AS $$
DECLARE
  v_payment_id uuid;
  v_virtual_payment_exists boolean;
BEGIN
  -- Only proceed if status changed TO customer_approved
  IF TG_OP = 'UPDATE' AND NEW.status = 'customer_approved' AND OLD.status != 'customer_approved' THEN

    -- Check if virtual payment already exists for this sale
    SELECT EXISTS (
      SELECT 1 FROM payments
      WHERE sale_id = NEW.id
        AND payment_type = 'virtual'
        AND is_virtual = true
    ) INTO v_virtual_payment_exists;

    -- Only create if virtual payment doesn't exist
    IF NOT v_virtual_payment_exists THEN
      -- Create virtual payment record
      INSERT INTO payments (
        sale_id,
        amount,
        currency,
        payment_type,
        is_virtual,
        status,
        expected_date,
        reference_number,
        payment_currency,
        receiving_currency,
        fx_rate,
        notes
      ) VALUES (
        NEW.id,
        COALESCE(NEW.final_proceeds, NEW.net_proceeds, NEW.gross_proceeds, 0),
        'USD', -- Default currency, can be adjusted based on sale
        'virtual',
        true,
        'pending',
        CURRENT_DATE,
        'VIRTUAL-' || NEW.sale_number,
        'USD',
        'USD',
        1.0,
        'Virtual payment created automatically as reference when customer approved sale'
      ) RETURNING id INTO v_payment_id;

      RAISE NOTICE 'Virtual payment created with ID: % for sale: %', v_payment_id, NEW.sale_number;

      -- Update sale status to waiting_for_payment
      -- Note: This will be handled by a separate trigger to avoid recursion
      NEW.status = 'waiting_for_payment';

    ELSE
      RAISE NOTICE 'Virtual payment already exists for sale: %, skipping creation', NEW.sale_number;
    END IF;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for virtual payment creation
DROP TRIGGER IF EXISTS trigger_create_virtual_payment ON sales;
CREATE TRIGGER trigger_create_virtual_payment
  BEFORE UPDATE ON sales
  FOR EACH ROW
  WHEN (NEW.status = 'customer_approved' AND OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION create_virtual_payment_on_customer_approval();

-- Create function to handle automatic status transition after virtual payment
CREATE OR REPLACE FUNCTION auto_transition_to_waiting_for_payment()
RETURNS TRIGGER AS $$
BEGIN
  -- This function is called AFTER virtual payment is created
  -- It ensures the sale transitions to waiting_for_payment status

  IF TG_OP = 'INSERT' AND NEW.payment_type = 'virtual' THEN
    -- Update the related sale status
    UPDATE sales
    SET status = 'waiting_for_payment'
    WHERE id = NEW.sale_id
      AND status = 'customer_approved';

    RAISE NOTICE 'Sale % transitioned to waiting_for_payment', NEW.sale_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for automatic status transition
DROP TRIGGER IF EXISTS trigger_auto_transition_waiting_payment ON payments;
CREATE TRIGGER trigger_auto_transition_waiting_payment
  AFTER INSERT ON payments
  FOR EACH ROW
  WHEN (NEW.payment_type = 'virtual')
  EXECUTE FUNCTION auto_transition_to_waiting_for_payment();

-- Create function to prevent manual deletion of virtual payments
CREATE OR REPLACE FUNCTION prevent_virtual_payment_deletion()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.payment_type = 'virtual' AND OLD.is_virtual = true THEN
    RAISE EXCEPTION 'Virtual payments cannot be deleted. They serve as historical reference.'
      USING HINT = 'Virtual payments are automatically created and should remain for audit purposes';
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to prevent virtual payment deletion
DROP TRIGGER IF EXISTS trigger_prevent_virtual_payment_deletion ON payments;
CREATE TRIGGER trigger_prevent_virtual_payment_deletion
  BEFORE DELETE ON payments
  FOR EACH ROW
  WHEN (OLD.payment_type = 'virtual')
  EXECUTE FUNCTION prevent_virtual_payment_deletion();

-- Add comments for documentation
COMMENT ON FUNCTION create_virtual_payment_on_customer_approval IS 'Automatically creates virtual payment when sale is approved by customer';
COMMENT ON FUNCTION auto_transition_to_waiting_for_payment IS 'Transitions sale to waiting_for_payment status after virtual payment creation';
COMMENT ON FUNCTION prevent_virtual_payment_deletion IS 'Prevents accidental deletion of virtual payments which serve as audit trail';

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Virtual payment triggers created successfully';
  RAISE NOTICE 'Sales will automatically generate virtual payments when customer approves';
  RAISE NOTICE 'Virtual payments are protected from deletion for audit purposes';
END $$;
