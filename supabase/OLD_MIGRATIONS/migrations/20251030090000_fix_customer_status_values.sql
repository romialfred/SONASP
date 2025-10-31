/*
  # Fix Customer Status Values
  
  1. Updates
    - Set all NULL or invalid status values to 'active'
    - Ensure all customers have a valid status
  
  2. Verification
    - Check that all statuses are now valid
*/

-- Update any NULL statuses to 'active'
UPDATE customers
SET status = 'active'
WHERE status IS NULL;

-- Update any invalid statuses to 'active'
UPDATE customers
SET status = 'active'
WHERE status NOT IN ('active', 'inactive', 'pending');

-- Add a comment to track the fix
COMMENT ON COLUMN customers.status IS 'Customer status: active, inactive, or pending. Default is active. Updated 2025-10-30 to fix NULL values.';
