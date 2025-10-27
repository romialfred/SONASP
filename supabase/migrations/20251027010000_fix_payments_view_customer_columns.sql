/*
  # Fix Payments View Customer Column Names

  1. Purpose
     - Fix column mismatch in payments_with_details view
     - Customers table has 'name' not 'customer_name'
     - Customers table has 'contact_person' not 'company_name'

  2. Changes
     - Recreate payments_with_details view with correct column names
     - This will fix "Unknown Customer" display issue in payments
*/

-- Drop existing view
DROP VIEW IF EXISTS payments_with_details;

-- Recreate with correct customer column names
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
  -- Customer information (fixed column names)
  c.name as customer_name,
  c.email as customer_email,
  c.phone as customer_phone,
  c.contact_person as company_name,
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
LEFT JOIN customers c ON COALESCE(p.customer_id, s.customer_id) = c.id
LEFT JOIN auth.users creator ON p.created_by = creator.id
LEFT JOIN auth.users approver ON p.approved_by = approver.id
LEFT JOIN auth.users verifier ON p.verified_by = verifier.id;

COMMENT ON VIEW payments_with_details IS 'Comprehensive view of payments with all related sale, customer, and tracking information with correct customer column names';
