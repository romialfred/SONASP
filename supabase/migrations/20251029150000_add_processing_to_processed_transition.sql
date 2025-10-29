/*
  # Add Processing to Processed Transition - CRITICAL FIX

  1. Problem
    - Error: "Transition from processing to processed is not allowed"
    - The transition is missing from the transitions table
    - This blocks the "Process Completed" button workflow

  2. Solution
    - Add the transition: processing → processed
    - Works with both table names: batch_status_transitions OR allowed_status_transitions
    - Manual action by refinery_staff

  3. Security
    - requires_role: refinery_staff
    - is_system_transition: false (manual via UI button)
*/

-- First, check which table exists and add to the correct one
DO $$
DECLARE
  v_table_name TEXT;
  v_count INTEGER;
BEGIN
  -- Check if batch_status_transitions exists
  SELECT table_name INTO v_table_name
  FROM information_schema.tables
  WHERE table_name = 'batch_status_transitions'
    AND table_schema = 'public';
  
  IF v_table_name IS NULL THEN
    -- Check if allowed_status_transitions exists
    SELECT table_name INTO v_table_name
    FROM information_schema.tables
    WHERE table_name = 'allowed_status_transitions'
      AND table_schema = 'public';
  END IF;
  
  IF v_table_name IS NULL THEN
    RAISE EXCEPTION 'Neither batch_status_transitions nor allowed_status_transitions table exists!';
  END IF;
  
  RAISE NOTICE 'Using table: %', v_table_name;
  
  -- Insert into the correct table
  IF v_table_name = 'batch_status_transitions' THEN
    INSERT INTO batch_status_transitions (
      from_status,
      to_status,
      requires_role,
      is_system_transition,
      is_active,
      description
    )
    VALUES (
      'processing',
      'processed',
      'refinery_staff',
      false,
      true,
      'Refinery staff marks processing as completed. Batch ready for inventory entry.'
    )
    ON CONFLICT (from_status, to_status) 
    DO UPDATE SET
      requires_role = EXCLUDED.requires_role,
      is_system_transition = EXCLUDED.is_system_transition,
      is_active = EXCLUDED.is_active,
      description = EXCLUDED.description,
      updated_at = now();
    
    SELECT COUNT(*) INTO v_count
    FROM batch_status_transitions
    WHERE from_status = 'processing' AND to_status = 'processed';
    
  ELSIF v_table_name = 'allowed_status_transitions' THEN
    INSERT INTO allowed_status_transitions (
      from_status,
      to_status,
      requires_role,
      is_system_transition,
      is_active,
      description
    )
    VALUES (
      'processing',
      'processed',
      'refinery_staff',
      false,
      true,
      'Refinery staff marks processing as completed. Batch ready for inventory entry.'
    )
    ON CONFLICT (from_status, to_status) 
    DO UPDATE SET
      requires_role = EXCLUDED.requires_role,
      is_system_transition = EXCLUDED.is_system_transition,
      is_active = EXCLUDED.is_active,
      description = EXCLUDED.description,
      updated_at = now();
    
    SELECT COUNT(*) INTO v_count
    FROM allowed_status_transitions
    WHERE from_status = 'processing' AND to_status = 'processed';
  END IF;
  
  IF v_count = 0 THEN
    RAISE EXCEPTION 'Failed to add processing → processed transition';
  ELSE
    RAISE NOTICE '✓ SUCCESS: Transition processing → processed added to %', v_table_name;
  END IF;
END $$;

-- Verify all transitions from 'processing' status
DO $$
DECLARE
  v_table_name TEXT;
  v_transitions TEXT;
BEGIN
  SELECT table_name INTO v_table_name
  FROM information_schema.tables
  WHERE table_name IN ('batch_status_transitions', 'allowed_status_transitions')
    AND table_schema = 'public'
  LIMIT 1;
  
  IF v_table_name = 'batch_status_transitions' THEN
    SELECT string_agg(to_status, ', ') INTO v_transitions
    FROM batch_status_transitions
    WHERE from_status = 'processing' AND is_active = true;
  ELSE
    SELECT string_agg(to_status, ', ') INTO v_transitions
    FROM allowed_status_transitions
    WHERE from_status = 'processing' AND is_active = true;
  END IF;
  
  RAISE NOTICE 'Available transitions from processing: %', v_transitions;
END $$;
