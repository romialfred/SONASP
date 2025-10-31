/*
  # Fix Batches Status Constraint - Final

  1. Changes
    - Drop existing batches_status_check constraint
    - Recreate with correct status values
    - Ensure all current batch statuses are valid
    - Add comprehensive status list

  2. Status List (Complete Workflow)
    - pending_factory_approval: Initial state when batch is created
    - approved_for_transport: Factory approved, ready to ship
    - waiting_airport_receipt: In transit to airport
    - received_at_airport: Arrived at airport
    - validated_for_refinery: Airport validated, ready for refinery
    - waiting_refinery_receipt: In transit to refinery
    - received_at_refinery: Arrived at refinery
    - validated_for_processing: Refinery validated, ready to process
    - processing: Being refined/processed
    - in_inventory: Refined and in gold inventory
    - ready_for_sale: Available for sale
    - allocated_to_sale: Reserved for a sale
    - sold: Sold and delivered
    - cancelled: Cancelled or rejected
*/

-- Step 1: Drop existing constraint if it exists
ALTER TABLE batches DROP CONSTRAINT IF EXISTS batches_status_check;

-- Step 2: Update any invalid statuses to valid ones
UPDATE batches SET status = 'pending_factory_approval'
WHERE status NOT IN (
  'pending_factory_approval',
  'approved_for_transport',
  'waiting_airport_receipt',
  'received_at_airport',
  'validated_for_refinery',
  'waiting_refinery_receipt',
  'received_at_refinery',
  'validated_for_processing',
  'processing',
  'in_inventory',
  'ready_for_sale',
  'allocated_to_sale',
  'sold',
  'cancelled'
);

-- Step 3: Add the constraint with all valid statuses
ALTER TABLE batches ADD CONSTRAINT batches_status_check CHECK (
  status IN (
    'pending_factory_approval',
    'approved_for_transport',
    'waiting_airport_receipt',
    'received_at_airport',
    'validated_for_refinery',
    'waiting_refinery_receipt',
    'received_at_refinery',
    'validated_for_processing',
    'processing',
    'in_inventory',
    'ready_for_sale',
    'allocated_to_sale',
    'sold',
    'cancelled'
  )
);

-- Add comment to help understand the constraint
COMMENT ON CONSTRAINT batches_status_check ON batches IS
  'Ensures batch status follows the defined workflow from creation through sale';

-- Create a helpful view showing all valid statuses
CREATE OR REPLACE VIEW batch_valid_statuses AS
SELECT
  status_value,
  status_description,
  status_order
FROM (VALUES
  ('pending_factory_approval', 'Waiting for factory approval before transport', 1),
  ('approved_for_transport', 'Approved by factory, ready to ship to airport', 2),
  ('waiting_airport_receipt', 'In transit from mine to airport', 3),
  ('received_at_airport', 'Received and checked at airport', 4),
  ('validated_for_refinery', 'Airport validation complete, ready for refinery', 5),
  ('waiting_refinery_receipt', 'In transit from airport to refinery', 6),
  ('received_at_refinery', 'Received and checked at refinery', 7),
  ('validated_for_processing', 'Refinery validation complete, ready for processing', 8),
  ('processing', 'Currently being refined/processed', 9),
  ('in_inventory', 'Refined and stored in gold inventory', 10),
  ('ready_for_sale', 'Available for sale to customers', 11),
  ('allocated_to_sale', 'Reserved for a specific sale transaction', 12),
  ('sold', 'Sold and delivered to customer', 13),
  ('cancelled', 'Batch cancelled or rejected', 99)
) AS statuses(status_value, status_description, status_order)
ORDER BY status_order;

-- Grant access to the view
GRANT SELECT ON batch_valid_statuses TO authenticated;
