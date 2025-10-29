/*
  # Add Processing to Processed Transition - CORRECTED

  1. Problem
    - Error: "Transition from processing to processed is not allowed"
    - The transition might be missing or inactive in batch_status_transitions

  2. Solution
    - Ensure the transition exists with correct columns
    - Table structure: from_status, to_status, requires_approval, approval_roles, 
      min_approval_count, conditions, is_active

  3. Note
    - The migration file 20251025120001 already inserts this transition
    - This migration ensures it exists and is active
*/

-- First check if the transition exists
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM batch_status_transitions
  WHERE from_status = 'processing' AND to_status = 'processed';
  
  IF v_count > 0 THEN
    RAISE NOTICE 'Transition processing → processed already exists. Ensuring it is active...';
    
    -- Make sure it's active
    UPDATE batch_status_transitions
    SET 
      is_active = true,
      requires_approval = false,
      approval_roles = NULL,
      updated_at = now()
    WHERE from_status = 'processing' AND to_status = 'processed';
    
    RAISE NOTICE '✓ Transition processing → processed is now ACTIVE';
  ELSE
    RAISE NOTICE 'Transition processing → processed does NOT exist. Creating it...';
    
    -- Insert the missing transition using correct columns
    INSERT INTO batch_status_transitions (
      from_status,
      to_status,
      requires_approval,
      approval_roles,
      min_approval_count,
      conditions,
      auto_trigger_on,
      is_reversible,
      notification_template,
      is_active
    )
    VALUES (
      'processing',
      'processed',
      false,  -- No approval required
      NULL,   -- No specific roles needed
      1,      -- Min approval count
      NULL,   -- No conditions
      NULL,   -- No auto trigger
      false,  -- Not reversible
      NULL,   -- No notification template
      true    -- Active
    );
    
    RAISE NOTICE '✓ Transition processing → processed CREATED successfully';
  END IF;
END $$;

-- Verify the result
DO $$
DECLARE
  v_from_status TEXT;
  v_to_status TEXT;
  v_is_active BOOLEAN;
  v_requires_approval BOOLEAN;
BEGIN
  SELECT from_status, to_status, is_active, requires_approval
  INTO v_from_status, v_to_status, v_is_active, v_requires_approval
  FROM batch_status_transitions
  WHERE from_status = 'processing' AND to_status = 'processed';
  
  IF v_from_status IS NULL THEN
    RAISE EXCEPTION '❌ FAILED: Transition processing → processed still does not exist!';
  END IF;
  
  IF NOT v_is_active THEN
    RAISE EXCEPTION '❌ FAILED: Transition exists but is NOT ACTIVE!';
  END IF;
  
  RAISE NOTICE '✓✓✓ SUCCESS ✓✓✓';
  RAISE NOTICE 'Transition: % → %', v_from_status, v_to_status;
  RAISE NOTICE 'Is Active: %', v_is_active;
  RAISE NOTICE 'Requires Approval: %', v_requires_approval;
END $$;

-- Show all transitions from 'processing'
DO $$
DECLARE
  rec RECORD;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════';
  RAISE NOTICE 'All transitions from PROCESSING status:';
  RAISE NOTICE '════════════════════════════════════════';
  
  FOR rec IN 
    SELECT from_status, to_status, is_active, requires_approval
    FROM batch_status_transitions
    WHERE from_status = 'processing'
    ORDER BY to_status
  LOOP
    RAISE NOTICE '  % → % (active: %, approval: %)', 
      rec.from_status, rec.to_status, rec.is_active, rec.requires_approval;
  END LOOP;
END $$;
