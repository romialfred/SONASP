/*
  # Clean Allowed Status Transitions - Keep Only Valid Workflow

  1. Problem
    - Multiple migration executions created duplicate transitions
    - Table allowed_status_transitions has many redundant entries
    - Need to keep only the valid workflow transitions

  2. Solution
    - Define the OFFICIAL workflow transitions
    - Remove ALL existing transitions
    - Insert only the valid ones
    - Ensure no duplicates

  3. Official Workflow (based on PRD and current implementation)
    
    MAIN WORKFLOW:
    created → approved_for_transport → waiting_airport_receipt → received_at_airport
    → waiting_refinery_receipt → received_at_refinery → validated_for_processing
    → processing → processed → in_inventory → allocated_to_sale → sold
    
    CANCELLATION BRANCHES:
    approved_for_transport → cancelled (before shipment)
    waiting_airport_receipt → cancelled (during transit)
    waiting_refinery_receipt → cancelled (during refinery transit)
    pending_factory_approval → cancelled (rejected)
    
    RETURN/ADJUSTMENT:
    allocated_to_sale → ready_for_sale (sale cancelled)
    ready_for_sale → in_inventory (removed from sale)
    validated_for_refinery → waiting_refinery_receipt (shipped to refinery)
*/

-- STEP 1: Backup current transitions (optional, for safety)
CREATE TEMP TABLE transitions_backup AS
SELECT * FROM allowed_status_transitions;

-- STEP 2: Count before cleanup
DO $$
DECLARE
  v_total INTEGER;
  v_unique INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_total FROM allowed_status_transitions;
  SELECT COUNT(DISTINCT (from_status, to_status)) INTO v_unique FROM allowed_status_transitions;
  
  RAISE NOTICE '═══════════════════════════════════════════════';
  RAISE NOTICE 'BEFORE CLEANUP';
  RAISE NOTICE '═══════════════════════════════════════════════';
  RAISE NOTICE 'Total transitions: %', v_total;
  RAISE NOTICE 'Unique transitions: %', v_unique;
  RAISE NOTICE 'Duplicates to remove: %', v_total - v_unique;
END $$;

-- STEP 3: Delete ALL existing transitions
DELETE FROM allowed_status_transitions;

-- STEP 4: Insert ONLY the valid workflow transitions
INSERT INTO allowed_status_transitions (
  from_status,
  to_status,
  requires_role,
  is_system_transition,
  description
) VALUES

-- ═══════════════════════════════════════════════
-- FACTORY WORKFLOW
-- ═══════════════════════════════════════════════
('created', 'approved_for_transport', 'factory_manager', false,
  'Factory manager approves batch for transport'),
  
('approved_for_transport', 'waiting_airport_receipt', 'factory_staff', false,
  'Batch shipped from factory to airport'),
  
('approved_for_transport', 'cancelled', 'factory_manager', false,
  'Transport cancelled before shipment'),
  
('pending_factory_approval', 'approved_for_transport', 'factory_manager', false,
  'Factory manager approves batch for transport'),
  
('pending_factory_approval', 'cancelled', 'factory_manager', false,
  'Batch cancelled before approval'),

-- ═══════════════════════════════════════════════
-- AIRPORT WORKFLOW
-- ═══════════════════════════════════════════════
('waiting_airport_receipt', 'received_at_airport', 'airport_staff', false,
  'Batch received and confirmed at airport'),
  
('waiting_airport_receipt', 'cancelled', 'management', false,
  'Batch cancelled during transit to airport'),
  
('received_at_airport', 'waiting_refinery_receipt', 'airport_staff', false,
  'Batch shipped from airport to refinery after confirmation'),
  
('received_at_airport', 'validated_for_refinery', 'airport_manager', false,
  'Airport manager validates batch for refinery transport'),

-- ═══════════════════════════════════════════════
-- REFINERY WORKFLOW
-- ═══════════════════════════════════════════════
('waiting_refinery_receipt', 'received_at_refinery', 'refinery_staff', false,
  'Batch received and confirmed at refinery'),
  
('waiting_refinery_receipt', 'cancelled', 'management', false,
  'Batch cancelled during transit to refinery'),
  
('received_at_refinery', 'validated_for_processing', 'refinery_manager', false,
  'Refinery manager validates batch for processing'),
  
('validated_for_processing', 'processing', 'refinery_staff', false,
  'Batch processing started at refinery'),
  
('validated_for_refinery', 'waiting_refinery_receipt', 'airport_staff', false,
  'Batch shipped to refinery'),

-- ═══════════════════════════════════════════════
-- PROCESSING WORKFLOW (THE CRITICAL ONE!)
-- ═══════════════════════════════════════════════
('processing', 'processed', 'refinery_staff', false,
  'Batch processing completed at refinery'),
  
('processed', 'in_inventory', 'refinery_staff', false,
  'Processed batch added to inventory via Add Inventory Entry'),

-- ═══════════════════════════════════════════════
-- SALES WORKFLOW
-- ═══════════════════════════════════════════════
('in_inventory', 'ready_for_sale', 'management', false,
  'Management approves batch for sale'),
  
('ready_for_sale', 'allocated_to_sale', 'sales_staff', false,
  'Batch allocated to a specific sale'),
  
('ready_for_sale', 'in_inventory', 'management', false,
  'Batch removed from sale availability'),
  
('allocated_to_sale', 'sold', 'sales_manager', false,
  'Sale completed and finalized'),
  
('allocated_to_sale', 'ready_for_sale', 'sales_staff', false,
  'Sale allocation removed, batch back to available')

ON CONFLICT (from_status, to_status) DO NOTHING;

-- STEP 5: Verify the cleanup
DO $$
DECLARE
  v_total INTEGER;
  v_unique INTEGER;
  rec RECORD;
BEGIN
  SELECT COUNT(*) INTO v_total FROM allowed_status_transitions;
  SELECT COUNT(DISTINCT (from_status, to_status)) INTO v_unique FROM allowed_status_transitions;
  
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════';
  RAISE NOTICE 'AFTER CLEANUP';
  RAISE NOTICE '═══════════════════════════════════════════════';
  RAISE NOTICE 'Total transitions: %', v_total;
  RAISE NOTICE 'Unique transitions: %', v_unique;
  RAISE NOTICE 'Duplicates: %', v_total - v_unique;
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════';
  RAISE NOTICE 'ALL VALID TRANSITIONS';
  RAISE NOTICE '═══════════════════════════════════════════════';
  
  FOR rec IN 
    SELECT from_status, to_status, requires_role, description
    FROM allowed_status_transitions
    ORDER BY 
      CASE from_status
        WHEN 'created' THEN 1
        WHEN 'pending_factory_approval' THEN 2
        WHEN 'approved_for_transport' THEN 3
        WHEN 'waiting_airport_receipt' THEN 4
        WHEN 'received_at_airport' THEN 5
        WHEN 'validated_for_refinery' THEN 6
        WHEN 'waiting_refinery_receipt' THEN 7
        WHEN 'received_at_refinery' THEN 8
        WHEN 'validated_for_processing' THEN 9
        WHEN 'processing' THEN 10
        WHEN 'processed' THEN 11
        WHEN 'in_inventory' THEN 12
        WHEN 'ready_for_sale' THEN 13
        WHEN 'allocated_to_sale' THEN 14
        WHEN 'sold' THEN 15
        ELSE 99
      END,
      to_status
  LOOP
    RAISE NOTICE '  % → % (%) - %', 
      RPAD(rec.from_status, 25),
      RPAD(rec.to_status, 25),
      RPAD(rec.requires_role, 20),
      rec.description;
  END LOOP;
  
  RAISE NOTICE '';
  RAISE NOTICE '✓✓✓ CLEANUP COMPLETED SUCCESSFULLY ✓✓✓';
END $$;

-- STEP 6: Drop the temporary backup table
DROP TABLE IF EXISTS transitions_backup;
