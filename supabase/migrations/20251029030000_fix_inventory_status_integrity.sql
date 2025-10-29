/*
  # Fix Inventory Status Integrity

  ## Purpose
  Correct batch statuses where batches are marked as 'in_inventory' but have no
  corresponding entry in the gold_inventory table. This ensures that only batches
  that have been properly entered into inventory have the 'in_inventory' status.

  ## Changes
  1. Data Correction
     - Find all batches with status='in_inventory' but no gold_inventory entry
     - Reset their status to 'processing' so they appear in the inventory entry form
     - Add audit trail entries documenting the correction

  2. Data Integrity Enforcement
     - Create validation function to prevent future inconsistencies
     - Add trigger to enforce the validation on batch status updates
     - Ensure 'in_inventory' status can only be set when inventory entry exists

  3. Documentation
     - Add helpful comments explaining the constraints
     - Document the proper workflow for inventory entry

  ## Data Safety
  - Only affects batches with inconsistent status (in_inventory without inventory entry)
  - Preserves all batch data and history
  - Creates complete audit trail of corrections
  - No data is deleted or lost

  ## Important Notes
  - After this migration, batches can only be set to 'in_inventory' through the inventory entry form
  - Manual status changes to 'in_inventory' will be blocked by the trigger
  - This ensures data consistency between batches and gold_inventory tables
*/

-- Step 1: Find and fix batches with 'in_inventory' status but no inventory entry
DO $$
DECLARE
  batch_record RECORD;
  affected_count INTEGER := 0;
BEGIN
  RAISE NOTICE 'Starting inventory status integrity check...';

  -- Find problematic batches
  FOR batch_record IN
    SELECT b.id, b.batch_number, b.status, b.updated_at
    FROM batches b
    LEFT JOIN gold_inventory gi ON b.id = gi.batch_id
    WHERE b.status = 'in_inventory'
      AND gi.id IS NULL
  LOOP
    RAISE NOTICE 'Found batch % (%) with in_inventory status but no inventory entry',
      batch_record.batch_number, batch_record.id;

    -- Reset status to 'processing'
    UPDATE batches
    SET
      status = 'processing',
      updated_at = now()
    WHERE id = batch_record.id;

    -- Add entry to batch_status_history for audit trail
    INSERT INTO batch_status_history (
      batch_id,
      status,
      previous_status,
      changed_at,
      changed_by,
      comments
    ) VALUES (
      batch_record.id,
      'processing',
      'in_inventory',
      now(),
      NULL,
      'AUTOMATIC CORRECTION: Batch was incorrectly marked as in_inventory without a corresponding inventory entry. Status reset to processing to allow proper inventory entry through the Add Inventory Entry form.'
    );

    affected_count := affected_count + 1;
  END LOOP;

  IF affected_count > 0 THEN
    RAISE NOTICE 'Successfully corrected % batch(es) with inconsistent inventory status', affected_count;
    RAISE NOTICE 'These batches will now appear in the Add Inventory Entry form';
  ELSE
    RAISE NOTICE 'No inconsistent batches found. All inventory statuses are correct.';
  END IF;
END $$;

-- Step 2: Create a function to validate inventory status changes
CREATE OR REPLACE FUNCTION validate_inventory_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only validate if status is being changed
  IF NEW.status IS DISTINCT FROM OLD.status THEN

    -- If status is being changed TO 'in_inventory'
    IF NEW.status = 'in_inventory' THEN
      -- Check if there's a corresponding inventory entry
      IF NOT EXISTS (
        SELECT 1 FROM gold_inventory
        WHERE batch_id = NEW.id
      ) THEN
        RAISE EXCEPTION 'Cannot set batch status to in_inventory without creating an inventory entry first. Please use the Add Inventory Entry form to properly enter this batch into inventory.';
      END IF;
    END IF;

    -- If status is being changed FROM 'in_inventory' to something else
    IF OLD.status = 'in_inventory' AND NEW.status != 'in_inventory' THEN
      -- Check if inventory entry exists and has not been sold
      IF EXISTS (
        SELECT 1 FROM gold_inventory
        WHERE batch_id = NEW.id
        AND (quantity_sold_oz IS NULL OR quantity_sold_oz = 0)
      ) THEN
        RAISE WARNING 'Changing status from in_inventory for batch % which has inventory stock available', NEW.batch_number;
      END IF;
    END IF;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 3: Drop existing trigger if it exists and create new one
DROP TRIGGER IF EXISTS enforce_inventory_status_integrity ON batches;

CREATE TRIGGER enforce_inventory_status_integrity
  BEFORE UPDATE ON batches
  FOR EACH ROW
  WHEN (NEW.status IS DISTINCT FROM OLD.status)
  EXECUTE FUNCTION validate_inventory_status_change();

-- Step 4: Add helpful comments for documentation
COMMENT ON FUNCTION validate_inventory_status_change() IS
  'Validates batch status transitions to ensure data consistency:
   - Prevents setting status to in_inventory without a gold_inventory entry
   - Warns when changing status away from in_inventory while stock exists
   - Enforces proper workflow through the Add Inventory Entry form';

COMMENT ON TRIGGER enforce_inventory_status_integrity ON batches IS
  'Enforces inventory status integrity by preventing manual status changes to in_inventory
   without a proper inventory entry. This ensures the workflow:
   1. Batch reaches processing status after refinery processing
   2. User creates inventory entry through Add Inventory Entry form
   3. Form automatically updates batch status to in_inventory
   4. Batch then becomes available for sale allocation';

-- Step 5: Create a view to help identify batches ready for inventory entry
CREATE OR REPLACE VIEW batches_ready_for_inventory AS
SELECT
  b.id,
  b.batch_number,
  b.weight_grams,
  b.metal_type,
  b.status,
  b.shipping_date,
  b.refinery_received_at,
  b.refinery_received_weight_grams,
  mc.name as mining_company_name,
  mc.country as mining_company_country,
  COALESCE(b.refinery_received_weight_grams, b.weight_grams) as weight_before_melting_estimate,
  CASE
    WHEN gi.id IS NOT NULL THEN 'Has Inventory Entry'
    WHEN b.status = 'processing' THEN 'Ready for Inventory Entry'
    ELSE 'Not Ready'
  END as inventory_entry_status
FROM batches b
LEFT JOIN mining_companies mc ON b.mining_company_id = mc.id
LEFT JOIN gold_inventory gi ON b.id = gi.batch_id
WHERE b.status IN ('processing', 'in_inventory')
ORDER BY b.refinery_received_at DESC NULLS LAST, b.shipping_date DESC;

COMMENT ON VIEW batches_ready_for_inventory IS
  'Shows batches that are ready for or already in inventory, with their current status.
   Use this view to monitor which batches need inventory entry and which are completed.';

-- Step 6: Verify the corrections
DO $$
DECLARE
  processing_count INTEGER;
  inventory_count INTEGER;
  inventory_with_entry_count INTEGER;
  inventory_without_entry_count INTEGER;
BEGIN
  -- Count batches in processing status
  SELECT COUNT(*) INTO processing_count
  FROM batches
  WHERE status = 'processing';

  -- Count batches in inventory status
  SELECT COUNT(*) INTO inventory_count
  FROM batches
  WHERE status = 'in_inventory';

  -- Count inventory status batches WITH inventory entry
  SELECT COUNT(*) INTO inventory_with_entry_count
  FROM batches b
  INNER JOIN gold_inventory gi ON b.id = gi.batch_id
  WHERE b.status = 'in_inventory';

  -- Count inventory status batches WITHOUT inventory entry (should be 0)
  SELECT COUNT(*) INTO inventory_without_entry_count
  FROM batches b
  LEFT JOIN gold_inventory gi ON b.id = gi.batch_id
  WHERE b.status = 'in_inventory' AND gi.id IS NULL;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'Inventory Status Verification Results:';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Batches with status=processing: %', processing_count;
  RAISE NOTICE 'Batches with status=in_inventory: %', inventory_count;
  RAISE NOTICE 'In-inventory batches WITH inventory entry: %', inventory_with_entry_count;
  RAISE NOTICE 'In-inventory batches WITHOUT inventory entry: %', inventory_without_entry_count;
  RAISE NOTICE '========================================';

  IF inventory_without_entry_count > 0 THEN
    RAISE WARNING 'Found % batch(es) with in_inventory status but no inventory entry!', inventory_without_entry_count;
  ELSE
    RAISE NOTICE 'SUCCESS: All in_inventory batches have corresponding inventory entries!';
  END IF;
END $$;
