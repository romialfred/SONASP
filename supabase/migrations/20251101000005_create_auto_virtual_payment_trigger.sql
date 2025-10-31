/*
  # Create Automatic Virtual Payment Trigger

  1. Purpose
    - Automatically create virtual payment record when sale is approved by customer
    - Transition sale status from customer_approved → waiting_for_payment → virtual_payment
    - Generate payment reference number

  2. Trigger Logic
    - Fires when sales.status changes to 'customer_approved'
    - Creates payment record with payment_type = 'virtual'
    - Updates sale status to 'waiting_for_payment' then 'virtual_payment'
    - Logs audit trail

  3. Security
    - Runs with SECURITY DEFINER to bypass RLS during automatic creation
    - Only triggers on valid status transitions
*/

-- Create function to auto-generate virtual payment
CREATE OR REPLACE FUNCTION auto_create_virtual_payment()
RETURNS TRIGGER AS $$
DECLARE
  v_payment_id uuid;
  v_reference_number text;
  v_expected_date date;
  v_payment_terms_days integer := 30;
BEGIN
  -- Only proceed if status changed TO customer_approved
  IF TG_OP = 'UPDATE' AND NEW.status = 'customer_approved' AND OLD.status != 'customer_approved' THEN

    -- Generate unique payment reference
    v_reference_number := 'VP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 10000)::text, 4, '0');

    -- Calculate expected payment date (sale date + payment terms)
    v_expected_date := COALESCE(NEW.sale_date, NEW.created_at::date) + v_payment_terms_days;

    -- Create virtual payment record
    INSERT INTO payments (
      sale_id,
      customer_id,
      amount,
      currency,
      expected_date,
      reference_number,
      bank_name,
      payment_method,
      payment_type,
      is_virtual,
      status,
      notes,
      created_by,
      created_at
    )
    VALUES (
      NEW.id,
      NEW.customer_id,
      NEW.gross_proceeds, -- Using gross_proceeds as payment amount
      COALESCE(NEW.currency, 'USD'),
      v_expected_date,
      v_reference_number,
      'Virtual Payment - Pending',
      'wire_transfer',
      'virtual',
      true,
      'pending',
      'Auto-generated virtual payment on customer approval',
      NEW.created_by,
      now()
    )
    RETURNING id INTO v_payment_id;

    -- Update sale status to waiting_for_payment
    NEW.status := 'waiting_for_payment';

    -- Log audit trail
    INSERT INTO audit_logs (
      user_id,
      user_email,
      action,
      module,
      details,
      ip_address,
      status,
      created_at
    )
    SELECT
      NEW.created_by,
      u.email,
      'AUTO_CREATE_VIRTUAL_PAYMENT',
      'Sales',
      'Virtual payment ' || v_reference_number || ' auto-created for sale ' || NEW.sale_number || '. Payment ID: ' || v_payment_id,
      NULL,
      'success',
      now()
    FROM auth.users u
    WHERE u.id = NEW.created_by;

    RAISE NOTICE 'Virtual payment % created for sale %', v_reference_number, NEW.sale_number;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on sales table
DROP TRIGGER IF EXISTS trigger_auto_create_virtual_payment ON sales;
CREATE TRIGGER trigger_auto_create_virtual_payment
  BEFORE UPDATE ON sales
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_virtual_payment();

-- Create function to transition to virtual_payment status after virtual payment creation
CREATE OR REPLACE FUNCTION update_sale_to_virtual_payment_status()
RETURNS TRIGGER AS $$
BEGIN
  -- When a virtual payment is created, update the sale to virtual_payment status
  IF TG_OP = 'INSERT' AND NEW.is_virtual = true AND NEW.payment_type = 'virtual' THEN
    UPDATE sales
    SET status = 'virtual_payment'
    WHERE id = NEW.sale_id
      AND status = 'waiting_for_payment';

    RAISE NOTICE 'Sale status updated to virtual_payment for sale_id %', NEW.sale_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on payments table
DROP TRIGGER IF EXISTS trigger_update_sale_virtual_payment_status ON payments;
CREATE TRIGGER trigger_update_sale_virtual_payment_status
  AFTER INSERT ON payments
  FOR EACH ROW
  EXECUTE FUNCTION update_sale_to_virtual_payment_status();

-- Create function to handle payment type enforcement
CREATE OR REPLACE FUNCTION enforce_payment_type_consistency()
RETURNS TRIGGER AS $$
BEGIN
  -- Ensure payment_type matches is_virtual flag
  IF NEW.is_virtual = true AND NEW.payment_type IS NULL THEN
    NEW.payment_type := 'virtual';
  ELSIF NEW.is_virtual = false AND NEW.payment_type IS NULL THEN
    NEW.payment_type := 'real';
  END IF;

  -- Ensure consistency
  IF NEW.is_virtual = true AND NEW.payment_type != 'virtual' THEN
    RAISE EXCEPTION 'Inconsistent payment type: is_virtual=true but payment_type=%', NEW.payment_type;
  END IF;

  IF NEW.is_virtual = false AND NEW.payment_type = 'virtual' THEN
    RAISE EXCEPTION 'Inconsistent payment type: is_virtual=false but payment_type=virtual';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to enforce consistency
DROP TRIGGER IF EXISTS trigger_enforce_payment_type_consistency ON payments;
CREATE TRIGGER trigger_enforce_payment_type_consistency
  BEFORE INSERT OR UPDATE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION enforce_payment_type_consistency();

-- Add comments for documentation
COMMENT ON FUNCTION auto_create_virtual_payment IS 'Automatically creates virtual payment record when sale is approved by customer';
COMMENT ON FUNCTION update_sale_to_virtual_payment_status IS 'Updates sale status to virtual_payment after virtual payment creation';
COMMENT ON FUNCTION enforce_payment_type_consistency IS 'Ensures payment_type and is_virtual flag are consistent';
COMMENT ON TRIGGER trigger_auto_create_virtual_payment ON sales IS 'Triggers virtual payment creation on customer approval';
COMMENT ON TRIGGER trigger_update_sale_virtual_payment_status ON payments IS 'Updates sale status after virtual payment insert';

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Automatic virtual payment trigger created - will auto-generate payments on customer approval';
END $$;
