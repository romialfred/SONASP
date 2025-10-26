/*
  # Payments Module Enhancement

  1. Purpose
     - Create comprehensive payment tracking with full transaction history
     - Link payments to complete sales lifecycle (shipping → refining → sales → payment)
     - Add payment documents and supporting evidence
     - Create views for payment analytics and reporting

  2. New Tables
     - payment_documents: Store all payment-related documents (invoices, proofs, contracts)
     - payment_history: Track all status changes and updates to payments
     - payment_reminders: Automated reminder tracking for overdue payments

  3. New Views
     - payments_with_details: Complete payment information with related data
     - payment_analytics: Aggregated payment statistics

  4. Enhancements to Existing Tables
     - Add payment_method and transaction details to payments table
     - Add customer bank information
     - Add payment verification fields

  5. Security
     - Enable RLS on all new tables
     - Create appropriate access policies
*/

-- Add new columns to payments table if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'payment_method') THEN
    ALTER TABLE payments ADD COLUMN payment_method TEXT CHECK (payment_method IN ('wire_transfer', 'swift', 'bank_transfer', 'check', 'cash', 'other'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'transaction_id') THEN
    ALTER TABLE payments ADD COLUMN transaction_id TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'verified_by') THEN
    ALTER TABLE payments ADD COLUMN verified_by UUID REFERENCES auth.users(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'verified_at') THEN
    ALTER TABLE payments ADD COLUMN verified_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'customer_id') THEN
    ALTER TABLE payments ADD COLUMN customer_id UUID REFERENCES customers(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'invoice_number') THEN
    ALTER TABLE payments ADD COLUMN invoice_number TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'due_date') THEN
    ALTER TABLE payments ADD COLUMN due_date DATE;
  END IF;
END $$;

-- Payment Documents Table
CREATE TABLE IF NOT EXISTS payment_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type IN ('invoice', 'payment_proof', 'receipt', 'bank_statement', 'contract', 'tax_document', 'other')),
  document_name TEXT NOT NULL,
  document_url TEXT NOT NULL,
  file_size BIGINT,
  mime_type TEXT,
  uploaded_by UUID REFERENCES auth.users(id),
  uploaded_at TIMESTAMPTZ DEFAULT now(),
  notes TEXT,
  is_verified BOOLEAN DEFAULT false,
  verified_by UUID REFERENCES auth.users(id),
  verified_at TIMESTAMPTZ
);

CREATE INDEX idx_payment_documents_payment_id ON payment_documents(payment_id);
CREATE INDEX idx_payment_documents_type ON payment_documents(document_type);

-- Payment History Table
CREATE TABLE IF NOT EXISTS payment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  changed_by UUID REFERENCES auth.users(id),
  changed_at TIMESTAMPTZ DEFAULT now(),
  change_type TEXT NOT NULL CHECK (change_type IN ('created', 'updated', 'submitted', 'approved', 'rejected', 'verified', 'cancelled', 'status_change')),
  old_status TEXT,
  new_status TEXT,
  field_changes JSONB,
  notes TEXT,
  ip_address TEXT
);

CREATE INDEX idx_payment_history_payment_id ON payment_history(payment_id);
CREATE INDEX idx_payment_history_changed_at ON payment_history(changed_at DESC);

-- Payment Reminders Table
CREATE TABLE IF NOT EXISTS payment_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  reminder_type TEXT NOT NULL CHECK (reminder_type IN ('due_soon', 'overdue', 'follow_up', 'final_notice')),
  sent_at TIMESTAMPTZ DEFAULT now(),
  sent_to TEXT NOT NULL,
  sent_by UUID REFERENCES auth.users(id),
  message TEXT,
  delivery_status TEXT DEFAULT 'sent' CHECK (delivery_status IN ('sent', 'delivered', 'failed', 'bounced')),
  opened_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,
  response_notes TEXT
);

CREATE INDEX idx_payment_reminders_payment_id ON payment_reminders(payment_id);
CREATE INDEX idx_payment_reminders_sent_at ON payment_reminders(sent_at DESC);

-- Create comprehensive payment view with all related data
CREATE OR REPLACE VIEW payments_with_details AS
SELECT
  p.id,
  p.sale_id,
  p.customer_id,
  p.invoice_number,
  p.expected_date,
  p.actual_date,
  p.due_date,
  p.amount,
  p.currency,
  p.fx_rate,
  p.bank_name,
  p.account_number,
  p.reference_number,
  p.transaction_id,
  p.payment_method,
  p.proof_url,
  p.notes,
  p.status,
  p.created_by,
  p.created_at,
  p.approved_by,
  p.approved_at,
  p.verified_by,
  p.verified_at,
  -- Sale information
  s.sale_number,
  s.sale_date,
  s.total_amount as sale_total_amount,
  s.net_proceeds,
  s.status as sale_status,
  s.london_am_rate,
  -- Customer information
  c.customer_name,
  c.email as customer_email,
  c.phone as customer_phone,
  c.company_name,
  c.country as customer_country,
  -- Calculate payment status metrics
  CASE
    WHEN p.status = 'approved' THEN 'paid'
    WHEN p.status = 'pending' AND p.due_date < CURRENT_DATE THEN 'overdue'
    WHEN p.status = 'pending' AND p.due_date >= CURRENT_DATE THEN 'pending'
    WHEN p.status = 'rejected' THEN 'rejected'
    ELSE 'unknown'
  END as payment_status_category,
  CASE
    WHEN p.due_date IS NOT NULL THEN CURRENT_DATE - p.due_date
    ELSE NULL
  END as days_overdue,
  -- Document counts
  (SELECT COUNT(*) FROM payment_documents pd WHERE pd.payment_id = p.id) as document_count,
  (SELECT COUNT(*) FROM payment_documents pd WHERE pd.payment_id = p.id AND pd.document_type = 'payment_proof') as proof_count,
  -- History count
  (SELECT COUNT(*) FROM payment_history ph WHERE ph.payment_id = p.id) as history_count,
  -- Reminder count
  (SELECT COUNT(*) FROM payment_reminders pr WHERE pr.payment_id = p.id) as reminder_count,
  -- Creator information
  creator.email as created_by_email,
  creator.raw_user_meta_data->>'full_name' as created_by_name,
  -- Approver information
  approver.email as approved_by_email,
  approver.raw_user_meta_data->>'full_name' as approved_by_name,
  -- Verifier information
  verifier.email as verified_by_email,
  verifier.raw_user_meta_data->>'full_name' as verified_by_name
FROM payments p
LEFT JOIN sales s ON p.sale_id = s.id
LEFT JOIN customers c ON p.customer_id = c.id OR s.customer_id = c.id
LEFT JOIN auth.users creator ON p.created_by = creator.id
LEFT JOIN auth.users approver ON p.approved_by = approver.id
LEFT JOIN auth.users verifier ON p.verified_by = verifier.id;

-- Create payment analytics view
CREATE OR REPLACE VIEW payment_analytics AS
SELECT
  DATE_TRUNC('month', p.created_at) as month,
  COUNT(*) as total_payments,
  COUNT(*) FILTER (WHERE p.status = 'approved') as approved_payments,
  COUNT(*) FILTER (WHERE p.status = 'pending') as pending_payments,
  COUNT(*) FILTER (WHERE p.status = 'rejected') as rejected_payments,
  SUM(p.amount) as total_amount,
  SUM(CASE WHEN p.status = 'approved' THEN p.amount ELSE 0 END) as approved_amount,
  SUM(CASE WHEN p.status = 'pending' THEN p.amount ELSE 0 END) as pending_amount,
  AVG(p.amount) as average_payment,
  COUNT(DISTINCT p.customer_id) as unique_customers,
  AVG(CASE WHEN p.actual_date IS NOT NULL AND p.expected_date IS NOT NULL
      THEN p.actual_date - p.expected_date ELSE NULL END) as avg_delay_days
FROM payments p
GROUP BY DATE_TRUNC('month', p.created_at)
ORDER BY month DESC;

-- Enable RLS on new tables
ALTER TABLE payment_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_reminders ENABLE ROW LEVEL SECURITY;

-- RLS Policies for payment_documents
CREATE POLICY "Users can view payment documents they have access to"
  ON payment_documents FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM payments p
      WHERE p.id = payment_documents.payment_id
      AND (
        p.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM user_profiles up
          WHERE up.id = auth.uid()
          AND up.role IN ('management', 'customer')
        )
      )
    )
  );

CREATE POLICY "Users can upload payment documents"
  ON payment_documents FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM payments p
      WHERE p.id = payment_documents.payment_id
      AND (
        p.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM user_profiles up
          WHERE up.id = auth.uid()
          AND up.role IN ('management', 'customer')
        )
      )
    )
  );

CREATE POLICY "Users can update their own payment documents"
  ON payment_documents FOR UPDATE
  TO authenticated
  USING (uploaded_by = auth.uid())
  WITH CHECK (uploaded_by = auth.uid());

CREATE POLICY "Management can delete payment documents"
  ON payment_documents FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'management'
    )
  );

-- RLS Policies for payment_history
CREATE POLICY "Users can view payment history for accessible payments"
  ON payment_history FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM payments p
      WHERE p.id = payment_history.payment_id
      AND (
        p.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM user_profiles up
          WHERE up.id = auth.uid()
          AND up.role IN ('management', 'customer')
        )
      )
    )
  );

CREATE POLICY "System can insert payment history"
  ON payment_history FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- RLS Policies for payment_reminders
CREATE POLICY "Users can view payment reminders for accessible payments"
  ON payment_reminders FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM payments p
      WHERE p.id = payment_reminders.payment_id
      AND (
        p.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM user_profiles up
          WHERE up.id = auth.uid()
          AND up.role IN ('management', 'customer')
        )
      )
    )
  );

CREATE POLICY "Management can create payment reminders"
  ON payment_reminders FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'management'
    )
  );

CREATE POLICY "Management can update payment reminders"
  ON payment_reminders FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'management'
    )
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_payments_customer_id ON payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_due_date ON payments(due_date);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at DESC);

-- Create function to automatically log payment changes
CREATE OR REPLACE FUNCTION log_payment_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO payment_history (payment_id, changed_by, change_type, new_status, notes)
    VALUES (NEW.id, NEW.created_by, 'created', NEW.status, 'Payment record created');
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status != NEW.status THEN
      INSERT INTO payment_history (payment_id, changed_by, change_type, old_status, new_status, notes)
      VALUES (NEW.id, auth.uid(), 'status_change', OLD.status, NEW.status, 'Payment status changed');
    END IF;

    IF NEW.verified_at IS NOT NULL AND OLD.verified_at IS NULL THEN
      INSERT INTO payment_history (payment_id, changed_by, change_type, new_status, notes)
      VALUES (NEW.id, NEW.verified_by, 'verified', NEW.status, 'Payment verified');
    END IF;

    IF NEW.approved_at IS NOT NULL AND OLD.approved_at IS NULL THEN
      INSERT INTO payment_history (payment_id, changed_by, change_type, new_status, notes)
      VALUES (NEW.id, NEW.approved_by, 'approved', NEW.status, 'Payment approved');
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for automatic payment logging
DROP TRIGGER IF EXISTS payment_changes_trigger ON payments;
CREATE TRIGGER payment_changes_trigger
  AFTER INSERT OR UPDATE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION log_payment_changes();

-- Create function to generate invoice numbers
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TEXT AS $$
DECLARE
  year_part TEXT;
  month_part TEXT;
  sequence_part TEXT;
  next_seq INTEGER;
BEGIN
  year_part := TO_CHAR(CURRENT_DATE, 'YY');
  month_part := TO_CHAR(CURRENT_DATE, 'MM');

  SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM 8) AS INTEGER)), 0) + 1
  INTO next_seq
  FROM payments
  WHERE invoice_number LIKE 'INV-' || year_part || month_part || '%';

  sequence_part := LPAD(next_seq::TEXT, 4, '0');

  RETURN 'INV-' || year_part || month_part || '-' || sequence_part;
END;
$$ LANGUAGE plpgsql;

-- Add comments for documentation
COMMENT ON TABLE payment_documents IS 'Stores all documents related to payments including invoices, proofs, receipts, and contracts';
COMMENT ON TABLE payment_history IS 'Tracks all changes and status updates to payment records for audit purposes';
COMMENT ON TABLE payment_reminders IS 'Manages automated reminders sent to customers for payment follow-ups';
COMMENT ON VIEW payments_with_details IS 'Comprehensive view of payments with all related sale, customer, and tracking information';
COMMENT ON VIEW payment_analytics IS 'Aggregated payment statistics by month for reporting and analytics';
