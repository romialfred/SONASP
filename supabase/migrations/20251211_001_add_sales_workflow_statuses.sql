/*
  # Add Sales Workflow Statuses

  1. Updates
    - Add all required statuses to sale_status enum for complete workflow
    - Supports: Draft → Management Approval → Customer Approval → Payment → Completed

  2. Status Flow
    - create_sales: Initial draft
    - pending_management_approval: Awaiting management approval
    - management_approved: Approved by management
    - management_rejected: Rejected by management
    - pending_for_customer_approval: Awaiting customer approval
    - customer_approved: Approved by customer
    - customer_rejected: Rejected by customer
    - waiting_for_payment: Awaiting payment
    - virtual_payment: Virtual payment made
    - payment_received: Payment confirmed
    - completed: Sale completed

  3. Existing Statuses (preserved)
    - in_sale: Legacy status
    - sold: Legacy status
    - cancelled: Sale cancelled
*/

-- Add new statuses to sale_status enum
DO $$
DECLARE
  status_to_add TEXT;
BEGIN
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
      EXECUTE format('ALTER TYPE sale_status ADD VALUE IF NOT EXISTS %L', status_to_add);
      RAISE NOTICE 'Added status: %', status_to_add;
    ELSE
      RAISE NOTICE 'Status already exists: %', status_to_add;
    END IF;
  END LOOP;
END $$;
