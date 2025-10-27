/*
  # Ensure Payments Module is Properly Configured

  1. Purpose
     - Ensure payments module exists with proper category and description
     - Update the module to be active and have correct display name

  2. Changes
     - Insert or update payments module with sales category
     - Ensure it has proper display name and description
*/

-- Ensure payments module exists with correct configuration
INSERT INTO modules (name, display_name, description, category, is_active)
VALUES (
  'payments',
  'Payment Management',
  'Process and track customer payments, manage payment records and documents',
  'sales',
  true
)
ON CONFLICT (name)
DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  is_active = EXCLUDED.is_active;

-- Also ensure related payment modules exist for granular permissions
INSERT INTO modules (name, display_name, description, category, is_active) VALUES
  ('payments_view', 'View Payments', 'View payment records and transaction history', 'sales', true),
  ('payments_create', 'Create Payments', 'Create and submit payment records', 'sales', true),
  ('payments_approve', 'Approve Payments', 'Approve or reject payment submissions', 'sales', true),
  ('payments_documents', 'Payment Documents', 'Upload and manage payment documents and proofs', 'sales', true)
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  is_active = EXCLUDED.is_active;

COMMENT ON TABLE modules IS 'System modules for granular permission management across different functional areas';
