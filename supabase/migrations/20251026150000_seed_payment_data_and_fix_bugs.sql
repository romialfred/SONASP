/*
  # Seed Payment Data and Fix Payment Module Bugs

  1. Purpose
    - Add comprehensive sample payment data
    - Link payments to existing sales
    - Create payment documents and history
    - Fix any bugs in payment module

  2. Sample Data Created
    - 30+ payment records with various statuses
    - Payment documents (proofs, invoices)
    - Payment history tracking
    - Different payment methods and currencies

  3. Bug Fixes
    - Ensure proper foreign key relationships
    - Add missing indexes for performance
    - Fix RLS policies for payments access
    - Add triggers for automatic history tracking

  4. Security
    - RLS enabled on all payment tables
    - Management can view/edit all payments
    - Users can view payments for their sales
*/

-- First, ensure the payments table has all necessary columns
-- This is a safety check in case the previous migration wasn't applied
DO $$
BEGIN
  -- Add customer_id if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payments' AND column_name = 'customer_id'
  ) THEN
    ALTER TABLE payments ADD COLUMN customer_id UUID REFERENCES customers(id);
  END IF;

  -- Add invoice_number if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payments' AND column_name = 'invoice_number'
  ) THEN
    ALTER TABLE payments ADD COLUMN invoice_number TEXT;
  END IF;

  -- Add payment_method if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payments' AND column_name = 'payment_method'
  ) THEN
    ALTER TABLE payments ADD COLUMN payment_method TEXT CHECK (payment_method IN ('wire_transfer', 'swift', 'bank_transfer', 'check', 'cash', 'other'));
  END IF;

  -- Add transaction_id if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payments' AND column_name = 'transaction_id'
  ) THEN
    ALTER TABLE payments ADD COLUMN transaction_id TEXT;
  END IF;

  -- Add verified_by if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payments' AND column_name = 'verified_by'
  ) THEN
    ALTER TABLE payments ADD COLUMN verified_by UUID REFERENCES auth.users(id);
  END IF;

  -- Add verified_at if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payments' AND column_name = 'verified_at'
  ) THEN
    ALTER TABLE payments ADD COLUMN verified_at TIMESTAMPTZ;
  END IF;

  -- Add due_date if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payments' AND column_name = 'due_date'
  ) THEN
    ALTER TABLE payments ADD COLUMN due_date DATE;
  END IF;
END $$;

-- Fix: Update status constraint to include more realistic statuses
DO $$
BEGIN
  -- Drop old constraint if it exists
  ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_status_check;

  -- Add new constraint with more statuses
  ALTER TABLE payments ADD CONSTRAINT payments_status_check
    CHECK (status IN ('pending', 'submitted', 'under_review', 'approved', 'rejected', 'verified', 'completed', 'cancelled'));
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_payments_sale_id ON payments(sale_id);
CREATE INDEX IF NOT EXISTS idx_payments_customer_id ON payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_expected_date ON payments(expected_date);
CREATE INDEX IF NOT EXISTS idx_payments_actual_date ON payments(actual_date);
CREATE INDEX IF NOT EXISTS idx_payments_invoice_number ON payments(invoice_number);

-- Enable RLS on payments table
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to recreate them properly
DROP POLICY IF EXISTS "Users can view own payments" ON payments;
DROP POLICY IF EXISTS "Management can view all payments" ON payments;
DROP POLICY IF EXISTS "Management can manage all payments" ON payments;

-- RLS Policy: Users can view payments for their sales
CREATE POLICY "Users can view own sale payments"
  ON payments
  FOR SELECT
  TO authenticated
  USING (
    created_by = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM sales s
      WHERE s.id = payments.sale_id
      AND s.created_by = auth.uid()
    )
  );

-- RLS Policy: Management can view all payments
CREATE POLICY "Management can view all payments"
  ON payments
  FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role')::text = 'management'
    OR
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'management'
    )
  );

-- RLS Policy: Management can insert payments
CREATE POLICY "Management can create payments"
  ON payments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role')::text = 'management'
    OR
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'management'
    )
  );

-- RLS Policy: Management can update payments
CREATE POLICY "Management can update payments"
  ON payments
  FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role')::text = 'management'
    OR
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'management'
    )
  )
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role')::text = 'management'
    OR
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'management'
    )
  );

-- Create trigger to automatically log payment changes
CREATE OR REPLACE FUNCTION log_payment_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO payment_history (
      payment_id,
      changed_by,
      change_type,
      new_status,
      field_changes,
      notes
    ) VALUES (
      NEW.id,
      NEW.created_by,
      'created',
      NEW.status,
      jsonb_build_object(
        'amount', NEW.amount,
        'currency', NEW.currency,
        'bank_name', NEW.bank_name
      ),
      'Payment record created'
    );
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      INSERT INTO payment_history (
        payment_id,
        changed_by,
        change_type,
        old_status,
        new_status,
        notes
      ) VALUES (
        NEW.id,
        auth.uid(),
        'status_change',
        OLD.status,
        NEW.status,
        'Payment status changed'
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS payment_changes_trigger ON payments;

-- Create trigger
CREATE TRIGGER payment_changes_trigger
  AFTER INSERT OR UPDATE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION log_payment_changes();

-- Now, create sample payment data based on existing sales
-- We'll create payments for sales that exist in the system

DO $$
DECLARE
  sale_record RECORD;
  customer_record RECORD;
  payment_id UUID;
  mgmt_user_id UUID;
  payment_counter INTEGER := 1;
  random_days INTEGER;
  payment_status TEXT;
  payment_method TEXT;
BEGIN
  -- Get a management user ID for created_by
  SELECT id INTO mgmt_user_id
  FROM user_profiles
  WHERE role = 'management'
  LIMIT 1;

  -- If no management user found, use any user
  IF mgmt_user_id IS NULL THEN
    SELECT id INTO mgmt_user_id
    FROM user_profiles
    LIMIT 1;
  END IF;

  -- Create payments for existing sales
  FOR sale_record IN
    SELECT s.id as sale_id, s.customer_id, s.total_amount, s.sale_date, s.sale_number, s.currency
    FROM sales s
    WHERE s.status IN ('approved', 'completed')
    ORDER BY s.sale_date DESC
    LIMIT 50
  LOOP
    -- Get customer info
    SELECT * INTO customer_record
    FROM customers
    WHERE id = sale_record.customer_id;

    -- Generate random payment status
    CASE (payment_counter % 5)
      WHEN 0 THEN payment_status := 'completed';
      WHEN 1 THEN payment_status := 'approved';
      WHEN 2 THEN payment_status := 'verified';
      WHEN 3 THEN payment_status := 'under_review';
      ELSE payment_status := 'pending';
    END CASE;

    -- Generate random payment method
    CASE (payment_counter % 4)
      WHEN 0 THEN payment_method := 'wire_transfer';
      WHEN 1 THEN payment_method := 'swift';
      WHEN 2 THEN payment_method := 'bank_transfer';
      ELSE payment_method := 'other';
    END CASE;

    -- Generate random number of days for payment
    random_days := (random() * 30)::INTEGER;

    -- Insert payment
    INSERT INTO payments (
      sale_id,
      customer_id,
      invoice_number,
      expected_date,
      actual_date,
      due_date,
      amount,
      currency,
      fx_rate,
      bank_name,
      account_number,
      reference_number,
      transaction_id,
      payment_method,
      proof_url,
      notes,
      status,
      created_by,
      created_at,
      approved_by,
      approved_at,
      verified_by,
      verified_at
    ) VALUES (
      sale_record.sale_id,
      sale_record.customer_id,
      'INV-' || sale_record.sale_number || '-' || payment_counter,
      sale_record.sale_date + INTERVAL '30 days',
      CASE
        WHEN payment_status IN ('completed', 'approved', 'verified')
        THEN sale_record.sale_date + (random_days || ' days')::INTERVAL
        ELSE NULL
      END,
      sale_record.sale_date + INTERVAL '45 days',
      sale_record.total_amount,
      COALESCE(sale_record.currency, 'USD'),
      CASE
        WHEN sale_record.currency = 'XOF' THEN 600.00
        WHEN sale_record.currency = 'GNF' THEN 8500.00
        ELSE 1.00
      END,
      COALESCE(customer_record.bank_name, 'International Bank'),
      'ACC-' || LPAD(payment_counter::TEXT, 10, '0'),
      'REF-' || to_char(now(), 'YYYYMMDD') || '-' || LPAD(payment_counter::TEXT, 6, '0'),
      'TXN-' || gen_random_uuid()::TEXT,
      payment_method,
      CASE
        WHEN payment_status IN ('completed', 'approved', 'verified')
        THEN 'https://storage.example.com/payments/proof-' || payment_counter || '.pdf'
        ELSE NULL
      END,
      'Payment for sale ' || sale_record.sale_number || '. ' ||
      CASE payment_status
        WHEN 'completed' THEN 'Payment received and verified.'
        WHEN 'approved' THEN 'Payment approved by management.'
        WHEN 'verified' THEN 'Payment verified against bank statement.'
        WHEN 'under_review' THEN 'Payment under review by finance team.'
        ELSE 'Payment pending customer action.'
      END,
      payment_status,
      mgmt_user_id,
      sale_record.sale_date,
      CASE
        WHEN payment_status IN ('completed', 'approved', 'verified')
        THEN mgmt_user_id
        ELSE NULL
      END,
      CASE
        WHEN payment_status IN ('completed', 'approved', 'verified')
        THEN sale_record.sale_date + ((random_days + 5) || ' days')::INTERVAL
        ELSE NULL
      END,
      CASE
        WHEN payment_status IN ('completed', 'verified')
        THEN mgmt_user_id
        ELSE NULL
      END,
      CASE
        WHEN payment_status IN ('completed', 'verified')
        THEN sale_record.sale_date + ((random_days + 7) || ' days')::INTERVAL
        ELSE NULL
      END
    ) RETURNING id INTO payment_id;

    -- Create payment documents for completed/approved payments
    IF payment_status IN ('completed', 'approved', 'verified') THEN
      -- Insert invoice document
      INSERT INTO payment_documents (
        payment_id,
        document_type,
        document_name,
        document_url,
        file_size,
        mime_type,
        uploaded_by,
        uploaded_at,
        notes,
        is_verified,
        verified_by,
        verified_at
      ) VALUES (
        payment_id,
        'invoice',
        'Invoice_' || sale_record.sale_number || '.pdf',
        'https://storage.example.com/invoices/inv-' || payment_counter || '.pdf',
        125000 + (random() * 100000)::BIGINT,
        'application/pdf',
        mgmt_user_id,
        sale_record.sale_date,
        'Official invoice for sale ' || sale_record.sale_number,
        true,
        mgmt_user_id,
        sale_record.sale_date + INTERVAL '1 day'
      );

      -- Insert payment proof document
      INSERT INTO payment_documents (
        payment_id,
        document_type,
        document_name,
        document_url,
        file_size,
        mime_type,
        uploaded_by,
        uploaded_at,
        notes,
        is_verified,
        verified_by,
        verified_at
      ) VALUES (
        payment_id,
        'payment_proof',
        'Payment_Proof_' || sale_record.sale_number || '.pdf',
        'https://storage.example.com/proofs/proof-' || payment_counter || '.pdf',
        85000 + (random() * 50000)::BIGINT,
        'application/pdf',
        mgmt_user_id,
        sale_record.sale_date + ((random_days) || ' days')::INTERVAL,
        'Bank transfer proof from customer',
        payment_status IN ('completed', 'verified'),
        CASE WHEN payment_status IN ('completed', 'verified') THEN mgmt_user_id ELSE NULL END,
        CASE WHEN payment_status IN ('completed', 'verified') THEN sale_record.sale_date + ((random_days + 2) || ' days')::INTERVAL ELSE NULL END
      );

      -- Insert bank statement document for completed payments
      IF payment_status = 'completed' THEN
        INSERT INTO payment_documents (
          payment_id,
          document_type,
          document_name,
          document_url,
          file_size,
          mime_type,
          uploaded_by,
          uploaded_at,
          notes,
          is_verified,
          verified_by,
          verified_at
        ) VALUES (
          payment_id,
          'bank_statement',
          'Bank_Statement_' || to_char(sale_record.sale_date, 'YYYY_MM') || '.pdf',
          'https://storage.example.com/statements/stmt-' || payment_counter || '.pdf',
          450000 + (random() * 200000)::BIGINT,
          'application/pdf',
          mgmt_user_id,
          sale_record.sale_date + ((random_days + 3) || ' days')::INTERVAL,
          'Monthly bank statement showing payment',
          true,
          mgmt_user_id,
          sale_record.sale_date + ((random_days + 4) || ' days')::INTERVAL
        );
      END IF;
    END IF;

    payment_counter := payment_counter + 1;
  END LOOP;

  RAISE NOTICE 'Created % payment records with documents', payment_counter - 1;
END $$;

-- Grant appropriate permissions
GRANT SELECT ON payments TO authenticated;
GRANT SELECT ON payment_documents TO authenticated;
GRANT SELECT ON payment_history TO authenticated;

RAISE NOTICE 'Payment data seeded successfully with sample records';
