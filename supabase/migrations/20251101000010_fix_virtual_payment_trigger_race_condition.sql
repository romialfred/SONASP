/*
  # Fix Virtual Payment Trigger Race Condition

  1. Problem Identified
    - BEFORE UPDATE trigger on sales modifies status to 'waiting_for_payment'
    - AFTER INSERT trigger on payments tries to update same sales record to 'virtual_payment'
    - Race condition causes inconsistent state
    - Violates database best practices (modifying same record in nested triggers)

  2. Solution
    - Remove the AFTER INSERT trigger on payments (trigger_update_sale_virtual_payment_status)
    - Update BEFORE UPDATE trigger to directly set status to 'virtual_payment' instead of 'waiting_for_payment'
    - Simplify workflow: customer_approved → virtual_payment (single step)
    - Remove race condition entirely

  3. Benefits
    - No nested trigger updates
    - Atomic status transition
    - Simpler to debug and maintain
    - Better performance
*/

-- Drop the problematic AFTER INSERT trigger
DROP TRIGGER IF EXISTS trigger_update_sale_virtual_payment_status ON payments;
DROP FUNCTION IF EXISTS update_sale_to_virtual_payment_status();

-- Update the auto_create_virtual_payment function to set virtual_payment status directly
CREATE OR REPLACE FUNCTION auto_create_virtual_payment()
RETURNS TRIGGER AS $$
DECLARE
  v_payment_id uuid;
  v_reference_number text;
  v_expected_date date;
  v_payment_terms_days integer := 30;
  v_mechanism_terms integer := 2; -- Default spot = 2 days
BEGIN
  -- Only proceed if status changed TO customer_approved
  IF TG_OP = 'UPDATE' AND NEW.status = 'customer_approved' AND OLD.status != 'customer_approved' THEN

    -- Determine payment terms based on mechanism_type
    IF NEW.mechanism_type IS NOT NULL THEN
      IF NEW.mechanism_type IN ('forward_7', 'forward_7_days') THEN
        v_mechanism_terms := 7;
      ELSIF NEW.mechanism_type IN ('forward_14', 'forward_14_days') THEN
        v_mechanism_terms := 14;
      ELSE
        v_mechanism_terms := 2; -- spot or unknown defaults to 2 days
      END IF;
    END IF;

    -- Generate unique payment reference
    v_reference_number := 'VP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 10000)::text, 4, '0');

    -- Calculate expected payment date using mechanism terms
    v_expected_date := CURRENT_DATE + v_mechanism_terms;

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
      NEW.final_proceeds, -- Use final_proceeds (after royalties) as payment amount
      COALESCE(NEW.currency, 'USD'),
      v_expected_date,
      v_reference_number,
      'Virtual Payment - Pending Confirmation',
      'wire_transfer',
      'virtual',
      true,
      'pending',
      'Auto-generated virtual payment on customer approval. Payment due in ' || v_mechanism_terms || ' days based on ' || COALESCE(NEW.mechanism_type, 'spot') || ' terms.',
      NEW.created_by,
      now()
    )
    RETURNING id INTO v_payment_id;

    -- FIXED: Set status directly to virtual_payment (no intermediate waiting_for_payment)
    -- This eliminates the race condition with the AFTER INSERT trigger
    NEW.status := 'virtual_payment';

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
      jsonb_build_object(
        'payment_reference', v_reference_number,
        'payment_id', v_payment_id,
        'sale_number', NEW.sale_number,
        'expected_date', v_expected_date,
        'payment_terms_days', v_mechanism_terms,
        'mechanism', COALESCE(NEW.mechanism_type, 'spot'),
        'amount', NEW.final_proceeds
      )::text,
      NULL,
      'success',
      now()
    FROM auth.users u
    WHERE u.id = NEW.created_by;

    RAISE NOTICE 'Virtual payment % created for sale % with % days terms', v_reference_number, NEW.sale_number, v_mechanism_terms;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure trigger is properly configured
DROP TRIGGER IF EXISTS trigger_auto_create_virtual_payment ON sales;
CREATE TRIGGER trigger_auto_create_virtual_payment
  BEFORE UPDATE ON sales
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_virtual_payment();

-- Update status transitions to reflect the fix
-- Remove the intermediate waiting_for_payment step from customer_approved
DELETE FROM sales_status_transitions
WHERE status_from = 'customer_approved' AND status_to = 'waiting_for_payment';

-- Add direct transition: customer_approved → virtual_payment
INSERT INTO sales_status_transitions (
  step_number,
  status_from,
  status_to,
  description,
  description_en,
  is_automatic,
  required_role,
  notes
)
VALUES (
  4,
  'customer_approved',
  'virtual_payment',
  'Paiement virtuel créé automatiquement',
  'Virtual payment auto-created',
  true,
  NULL,
  'Automatic transition via trigger - creates virtual payment record'
)
ON CONFLICT (status_from, status_to) DO UPDATE
SET
  step_number = EXCLUDED.step_number,
  description = EXCLUDED.description,
  description_en = EXCLUDED.description_en,
  is_automatic = EXCLUDED.is_automatic,
  notes = EXCLUDED.notes;

-- Update comments
COMMENT ON FUNCTION auto_create_virtual_payment IS 'Automatically creates virtual payment and transitions sale to virtual_payment status (FIXED: no race condition)';
COMMENT ON TRIGGER trigger_auto_create_virtual_payment ON sales IS 'Triggers virtual payment creation and status update atomically on customer approval (FIXED: single atomic operation)';

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Virtual payment trigger race condition FIXED - now uses single atomic operation';
  RAISE NOTICE 'Status flow: customer_approved → virtual_payment (direct, no intermediate state)';
END $$;
