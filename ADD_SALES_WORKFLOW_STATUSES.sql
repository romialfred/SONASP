/*
  # Add Sales Workflow Statuses to sale_status Enum

  IMPORTANT: Execute this in Supabase SQL Editor to fix the sale creation error

  This adds all workflow statuses:
  - create_sales
  - pending_management_approval
  - management_approved
  - management_rejected
  - pending_for_customer_approval
  - customer_approved
  - customer_rejected
  - waiting_for_payment
  - virtual_payment
  - payment_received
  - completed

  Workflow: Draft → Management Approval → Customer Approval → Payment → Completed
*/

-- Add new statuses to sale_status enum (safe, idempotent)
DO $$
DECLARE
  status_to_add TEXT;
BEGIN
  RAISE NOTICE '=== Adding Sales Workflow Statuses ===';

  FOR status_to_add IN
    SELECT unnest(ARRAY[
      'create_sales',
      'pending_management_approval',
      'management_approved',
      'management_rejected',
      'pending_for_customer_approval',
      'customer_approved',
      'customer_rejected',
      'waiting_for_payment',
      'virtual_payment',
      'payment_received',
      'completed'
    ])
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum
      WHERE enumlabel = status_to_add
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'sale_status')
    ) THEN
      EXECUTE format('ALTER TYPE sale_status ADD VALUE %L', status_to_add);
      RAISE NOTICE '✓ Added status: %', status_to_add;
    ELSE
      RAISE NOTICE '  Status already exists: %', status_to_add;
    END IF;
  END LOOP;

  RAISE NOTICE '=== Migration Complete ===';
END $$;

-- Verify all statuses
SELECT
  'Current sale_status values:' as info,
  enumlabel as status_value,
  enumsortorder as sort_order
FROM pg_enum
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'sale_status')
ORDER BY enumsortorder;
