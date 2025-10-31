/*
  # Seed Batch Status Transitions

  ## Purpose
  Define all valid batch status transitions and their approval requirements.
  This table is used to validate status changes and enforce workflow rules.

  ## Status Flow
  1. pending_factory_approval → approved_for_transport (requires factory approval)
  2. approved_for_transport → waiting_airport_receipt (automatic)
  3. waiting_airport_receipt → received_at_airport (requires airport confirmation)
  4. received_at_airport → validated_for_refinery (requires airport validation)
  5. validated_for_refinery → waiting_refinery_receipt (automatic)
  6. waiting_refinery_receipt → received_at_refinery (requires refinery confirmation)
  7. received_at_refinery → validated_for_processing (requires refinery validation)
  8. validated_for_processing → processing (manual start)
  9. processing → in_inventory (after refining completion)
  10. in_inventory → ready_for_sale (after quality check)
  11. ready_for_sale → allocated_to_sale (when sale is created)
  12. allocated_to_sale → sold (when payment received)
  13. Any status → cancelled (requires management approval)
*/

-- Clear existing transitions
DELETE FROM batch_status_transitions;

-- Insert all valid status transitions
INSERT INTO batch_status_transitions (
  from_status,
  to_status,
  requires_approval,
  approval_roles,
  min_approval_count,
  conditions,
  is_reversible,
  notification_template,
  is_active
) VALUES

-- 1. Factory approval for transport
(
  'pending_factory_approval',
  'approved_for_transport',
  true,
  ARRAY['factory_manager', 'management'],
  1,
  '{"min_weight_grams": 0}'::jsonb,
  false,
  'batch_approved_for_transport',
  true
),

-- 2. Start transport to airport
(
  'approved_for_transport',
  'waiting_airport_receipt',
  false,
  NULL,
  0,
  NULL,
  true,
  'batch_in_transit_to_airport',
  true
),

-- 3. Receive at airport
(
  'waiting_airport_receipt',
  'received_at_airport',
  false,
  ARRAY['airport_operator'],
  1,
  NULL,
  false,
  'batch_received_at_airport',
  true
),

-- 4. Airport validation
(
  'received_at_airport',
  'validated_for_refinery',
  true,
  ARRAY['airport_manager', 'management'],
  1,
  '{"max_variance_percentage": 2.0}'::jsonb,
  false,
  'batch_validated_at_airport',
  true
),

-- 5. Start transport to refinery
(
  'validated_for_refinery',
  'waiting_refinery_receipt',
  false,
  NULL,
  0,
  NULL,
  true,
  'batch_in_transit_to_refinery',
  true
),

-- 6. Receive at refinery
(
  'waiting_refinery_receipt',
  'received_at_refinery',
  false,
  ARRAY['refinery_operator'],
  1,
  NULL,
  false,
  'batch_received_at_refinery',
  true
),

-- 7. Refinery validation
(
  'received_at_refinery',
  'validated_for_processing',
  true,
  ARRAY['refinery_manager', 'management'],
  1,
  '{"max_variance_percentage": 2.0}'::jsonb,
  false,
  'batch_validated_at_refinery',
  true
),

-- 8. Start processing
(
  'validated_for_processing',
  'processing',
  false,
  ARRAY['refinery_operator'],
  1,
  NULL,
  true,
  'batch_processing_started',
  true
),

-- 9. Processing complete → inventory
(
  'processing',
  'in_inventory',
  true,
  ARRAY['refinery_supervisor', 'management'],
  1,
  '{"min_fineness_percentage": 90.0}'::jsonb,
  false,
  'batch_moved_to_inventory',
  true
),

-- 10. Ready for sale
(
  'in_inventory',
  'ready_for_sale',
  true,
  ARRAY['sales_manager', 'management'],
  1,
  NULL,
  true,
  'batch_ready_for_sale',
  true
),

-- 11. Allocate to sale
(
  'ready_for_sale',
  'allocated_to_sale',
  false,
  ARRAY['sales_operator'],
  1,
  NULL,
  true,
  'batch_allocated_to_sale',
  true
),

-- 12. Mark as sold
(
  'allocated_to_sale',
  'sold',
  true,
  ARRAY['finance_manager', 'management'],
  1,
  '{"payment_confirmed": true}'::jsonb,
  false,
  'batch_sold',
  true
),

-- 13. Cancel from pending factory approval
(
  'pending_factory_approval',
  'cancelled',
  true,
  ARRAY['management'],
  1,
  NULL,
  false,
  'batch_cancelled',
  true
),

-- 14. Cancel from approved for transport
(
  'approved_for_transport',
  'cancelled',
  true,
  ARRAY['management'],
  1,
  NULL,
  false,
  'batch_cancelled',
  true
),

-- 15. Cancel from waiting airport receipt
(
  'waiting_airport_receipt',
  'cancelled',
  true,
  ARRAY['management'],
  1,
  NULL,
  false,
  'batch_cancelled',
  true
),

-- 16. Return allocated batch to ready for sale
(
  'allocated_to_sale',
  'ready_for_sale',
  true,
  ARRAY['sales_manager', 'management'],
  1,
  NULL,
  false,
  'batch_deallocated',
  true
);

-- Create helpful view for checking valid transitions
CREATE OR REPLACE VIEW batch_status_transition_map AS
SELECT
  from_status,
  to_status,
  requires_approval,
  approval_roles,
  min_approval_count,
  is_active,
  CASE
    WHEN requires_approval THEN 'Requires approval from: ' || array_to_string(approval_roles, ', ')
    ELSE 'Automatic transition'
  END as approval_info
FROM batch_status_transitions
WHERE is_active = true
ORDER BY
  CASE from_status
    WHEN 'pending_factory_approval' THEN 1
    WHEN 'approved_for_transport' THEN 2
    WHEN 'waiting_airport_receipt' THEN 3
    WHEN 'received_at_airport' THEN 4
    WHEN 'validated_for_refinery' THEN 5
    WHEN 'waiting_refinery_receipt' THEN 6
    WHEN 'received_at_refinery' THEN 7
    WHEN 'validated_for_processing' THEN 8
    WHEN 'processing' THEN 9
    WHEN 'in_inventory' THEN 10
    WHEN 'ready_for_sale' THEN 11
    WHEN 'allocated_to_sale' THEN 12
    ELSE 99
  END;

-- Grant access
GRANT SELECT ON batch_status_transition_map TO authenticated;

-- Add helpful comments
COMMENT ON TABLE batch_status_transitions IS 'Defines valid batch status transitions and their approval requirements';
COMMENT ON VIEW batch_status_transition_map IS 'Human-readable view of valid status transitions';
